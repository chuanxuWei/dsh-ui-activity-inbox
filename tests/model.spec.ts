import { describe, expect, it } from 'vitest'
import type {
  GoalProjection,
  JobView,
  SessionId,
  SessionListState,
  SessionSummary,
  WorkspaceId,
  WorkspaceListState,
  WorkspaceView,
} from '../src/client/contracts.js'
import { countActivity, deriveActivityItems } from '../src/client/model.js'

const sid = (value: string) => value as SessionId

const summary = (id: string, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id),
  displayTitle: id,
  running: false,
  blank: false,
  updatedAt: 1,
  ...overrides,
})

const goal = (phase: GoalProjection['goal']['phase']): GoalProjection => ({
  goal: {
    id: 'goal' as GoalProjection['goal']['id'],
    revision: 1,
    objective: 'Ship the inbox',
    phase,
    maxGoalRounds: 5,
    ...(phase === 'blocked'
      ? { blockedReason: { code: 'waiting', message: 'Waiting on CI' } }
      : {}),
  },
  roundsStarted: 1,
  createdAt: 1,
  updatedAt: 2,
})

const job = (status: JobView['status']): JobView => ({
  id: 'job' as JobView['id'],
  kind: 'bash',
  label: 'tests',
  status,
  startedAt: 1,
})

function sessions(items: readonly SessionSummary[]): SessionListState {
  return {
    ids: items.map(item => item.id),
    byId: Object.fromEntries(items.map(item => [item.id, item])),
    current: sid('idle'),
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: { [sid('job-owner')]: [job('stopping'), job('completed')] },
    currentAddress: undefined,
  }
}

function workspace(
  items: readonly SessionSummary[],
  archivedSessionIds: readonly SessionId[] = [],
): WorkspaceListState {
  const project: WorkspaceView = {
    workspaceId: 'workspace' as WorkspaceId,
    path: '/projects/inbox',
    title: 'Inbox project',
    sessionIds: items.map(item => item.id),
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
  }
  return {
    items: [project],
    archivedSessionIds,
    state: 'idle',
    phase: 'ready',
    error: null,
    baselinesReady: true,
    recentWorkspaceId: project.workspaceId,
  }
}

describe('Activity Inbox projection', () => {
  it('assigns one priority state from interaction, goal, activity, and completion facts', () => {
    const items = [
      summary('ready', { completed: true, updatedAt: 4 }),
      summary('idle', { updatedAt: 3 }),
      summary('job-owner', { updatedAt: 7 }),
      summary('child-owner', { updatedAt: 6 }),
      summary('child', { origin: 'subagent', parentId: sid('child-owner'), running: true }),
      summary('blocked', { running: true, projectionValues: { goal: goal('blocked') }, updatedAt: 8 }),
      summary('needs-action', {
        pendingInteraction: 'question',
        running: true,
        completed: true,
        projectionValues: { goal: goal('blocked') },
        updatedAt: 2,
      }),
    ]

    const result = deriveActivityItems(sessions(items), workspace(items))

    expect(result.map(item => [item.sessionId, item.state])).toEqual([
      ['needs-action', 'needs-action'],
      ['blocked', 'blocked'],
      ['job-owner', 'running'],
      ['child-owner', 'running'],
      ['ready', 'ready'],
      ['idle', 'idle'],
    ])
    expect(result.find(item => item.sessionId === 'child-owner')?.runningSubagents).toBe(1)
    expect(result.find(item => item.sessionId === 'job-owner')?.runningJobs).toBe(1)
    expect(result.every(item => item.workspace === 'Inbox project')).toBe(true)
  })

  it('hides archived, blank, and subagent rows and falls back to the cwd basename', () => {
    const items = [
      summary('kept', { cwd: '/projects/loose/' }),
      summary('archived'),
      summary('blank', { blank: true }),
      summary('child', { origin: 'subagent' }),
    ]
    const result = deriveActivityItems(
      sessions(items),
      { ...workspace([], [sid('archived')]), items: [] },
    )

    expect(result.map(item => [item.sessionId, item.workspace])).toEqual([['kept', 'loose']])
  })

  it('counts the five filters and all attention buckets', () => {
    const items = [
      summary('action', { pendingInteraction: 'approval' }),
      summary('blocked', { projectionValues: { goal: goal('blocked') } }),
      summary('running', { running: true }),
      summary('ready', { completed: true }),
      summary('idle'),
    ]

    expect(countActivity(deriveActivityItems(sessions(items), workspace(items)))).toEqual({
      all: 5,
      attention: 3,
      'needs-action': 1,
      blocked: 1,
      running: 1,
      ready: 1,
      idle: 1,
    })
  })
})

/** Pure Activity Inbox projection over DSH's shared client list stores. */
import type {
  GoalSnapshot,
  PendingInteractionStatus,
  SessionId,
  SessionListState,
  WorkspaceListState,
} from './contracts.js'

/** Mutually exclusive priority buckets shown by the Activity Inbox. */
export type ActivityState = 'needs-action' | 'blocked' | 'running' | 'ready' | 'idle'

/** One top-level Session projected as an Activity Inbox task row. */
export interface ActivityItem {
  readonly sessionId: SessionId
  readonly title: string
  readonly workspace: string | undefined
  readonly updatedAt: number
  readonly state: ActivityState
  readonly current: boolean
  readonly pendingInteraction: PendingInteractionStatus | undefined
  readonly goal: GoalSnapshot | undefined
  readonly sessionRunning: boolean
  readonly runningSubagents: number
  readonly runningJobs: number
}

/** Counts used by the trigger, summary, and filters. */
export type ActivityCounts = Record<ActivityState | 'all' | 'attention', number>

const PRIORITY: Record<ActivityState, number> = {
  'needs-action': 0,
  blocked: 1,
  running: 2,
  ready: 3,
  idle: 4,
}

function liveJobCount(list: SessionListState, sessionId: SessionId): number {
  return (list.jobsBySession[sessionId] ?? [])
    .filter(job => job.status === 'running' || job.status === 'stopping').length
}

function goalOf(list: SessionListState, sessionId: SessionId): GoalSnapshot | undefined {
  const projected = list.byId[sessionId]?.projectionValues?.goal
  return projected?.goal
}

function fallbackWorkspace(cwd: string | undefined): string | undefined {
  if (cwd === undefined || cwd === '') return undefined
  const normalized = cwd.replace(/[/\\]+$/, '')
  return normalized.split(/[/\\]/).pop() || cwd
}

function runningDescendants(list: SessionListState): ReadonlyMap<SessionId, number> {
  const result = new Map<SessionId, number>()
  for (const summary of Object.values(list.byId)) {
    if (!summary.running || summary.parentId === undefined) continue
    const seen = new Set<SessionId>([summary.id])
    let ancestor = summary.parentId
    while (!seen.has(ancestor)) {
      seen.add(ancestor)
      result.set(ancestor, (result.get(ancestor) ?? 0) + 1)
      const parent = list.byId[ancestor]?.parentId
      if (parent === undefined) break
      ancestor = parent
    }
  }
  return result
}

/**
 * Derive priority rows from the same authoritative projections as DSH's
 * ordinary Session list.
 * @param list - Shared Session list state.
 * @param workspaces - Shared Workspace grouping and archive state.
 * @returns Priority-sorted top-level task rows.
 */
export function deriveActivityItems(
  list: SessionListState,
  workspaces: WorkspaceListState,
): ActivityItem[] {
  const archived = new Set(workspaces.archivedSessionIds)
  const workspaceBySession = new Map<SessionId, string>()
  for (const workspace of workspaces.items) {
    for (const sessionId of workspace.sessionIds) {
      if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace.title)
    }
  }

  const descendants = runningDescendants(list)
  const items: ActivityItem[] = []
  for (const sessionId of list.ids) {
    const summary = list.byId[sessionId]
    if (summary === undefined || summary.blank || summary.origin === 'subagent' || archived.has(sessionId)) continue
    const goal = goalOf(list, sessionId)
    const runningSubagents = descendants.get(sessionId) ?? 0
    const runningJobs = liveJobCount(list, sessionId)
    const state: ActivityState = summary.pendingInteraction !== undefined
      ? 'needs-action'
      : goal?.phase === 'blocked'
        ? 'blocked'
        : summary.running || runningSubagents > 0 || runningJobs > 0
          ? 'running'
          : summary.completed === true
            ? 'ready'
            : 'idle'

    items.push({
      sessionId,
      title: summary.displayTitle,
      workspace: workspaceBySession.get(sessionId) ?? fallbackWorkspace(summary.cwd),
      updatedAt: summary.updatedAt,
      state,
      current: list.current === sessionId,
      pendingInteraction: summary.pendingInteraction,
      goal,
      sessionRunning: summary.running,
      runningSubagents,
      runningJobs,
    })
  }

  return items.sort((left, right) => {
    const priority = PRIORITY[left.state] - PRIORITY[right.state]
    if (priority !== 0) return priority
    if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt
    return left.sessionId < right.sessionId ? -1 : 1
  })
}

/**
 * Count each bucket plus attention (Needs you, Blocked, or Ready).
 * @param items - Derived Activity Inbox rows.
 * @returns Counts for the trigger, summary, and filters.
 */
export function countActivity(items: readonly ActivityItem[]): ActivityCounts {
  const counts: ActivityCounts = {
    all: items.length,
    attention: 0,
    'needs-action': 0,
    blocked: 0,
    running: 0,
    ready: 0,
    idle: 0,
  }
  for (const item of items) counts[item.state] += 1
  counts.attention = counts['needs-action'] + counts.blocked + counts.ready
  return counts
}

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  SessionId,
  SessionListState,
  SessionSummary,
  WorkspaceListState,
} from '../src/client/contracts.js'
import { ActivityInbox, type ActivityInboxProps } from '../src/client/ActivityInbox.js'
import { zh } from '../src/client/locales.js'

const NOW = 1_700_000_000_000
const sid = (value: string) => value as SessionId

const summary = (id: string, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id),
  displayTitle: id,
  running: false,
  blank: false,
  updatedAt: NOW,
  ...overrides,
})

const items = [
  summary('Approve release', { pendingInteraction: 'approval' }),
  summary('Review finished work', { completed: true, updatedAt: NOW - 60_000 }),
  summary('Quiet session', { updatedAt: NOW - 3_600_000 }),
]

const sessionState: SessionListState = {
  ids: items.map(item => item.id),
  byId: Object.fromEntries(items.map(item => [item.id, item])),
  current: sid('Quiet session'),
  phase: 'ready',
  subagentsByParent: {},
  jobsBySession: {},
  currentAddress: undefined,
}

const workspaceState: WorkspaceListState = {
  items: [],
  archivedSessionIds: [],
  state: 'idle',
  phase: 'ready',
  error: null,
  baselinesReady: true,
  recentWorkspaceId: undefined,
}

function translate(key: keyof typeof zh, params?: Record<string, unknown>): string {
  return zh[key].replace(/\{([^}]+)\}/g, (_, name: string) => String(params?.[name] ?? `{${name}}`))
}

const t = translate as ActivityInboxProps['t']

function hook<T>(snapshot: T) {
  return function select<S>(selector: (state: T) => S): S { return selector(snapshot) }
}

function props(openSession = vi.fn(), wide = true): ActivityInboxProps {
  return {
    wide,
    useSessions: hook(sessionState),
    useWorkspaces: hook(workspaceState),
    openSession,
    t,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ActivityInbox', () => {
  it('opens from the wide footer row and renders priority groups and counts', () => {
    render(<ActivityInbox {...props()} />)
    const trigger = screen.getByRole('button', {
      name: '任务动态收件箱：2 项需要关注，0 项进行中',
    })
    expect(trigger.textContent).toContain('任务动态')
    expect(trigger.textContent).toContain('2 项待关注')
    fireEvent.click(trigger)

    const panel = screen.getByRole('dialog', { name: '任务动态收件箱' })
    expect(within(panel).getByText('2 项需要关注 · 0 项进行中')).toBeDefined()
    expect(within(panel).getByRole('button', {
      name: '需要你处理: Approve release, 未分组',
    })).toBeDefined()
    expect(within(panel).getByRole('button', {
      name: '待查看: Review finished work, 未分组',
    })).toBeDefined()
    expect(within(panel).getByRole('button', {
      name: '空闲: Quiet session, 未分组',
    })).toBeDefined()
  })

  it('filters to one bucket and reports an empty filtered view', () => {
    render(<ActivityInbox {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: /任务动态收件箱/ }))
    fireEvent.click(screen.getByRole('button', { name: '待查看 1' }))
    expect(screen.getByText('Review finished work')).toBeDefined()
    expect(screen.queryByText('Approve release')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '进行中 0' }))
    expect(screen.getByText('这个视图里暂时没有任务。')).toBeDefined()
  })

  it('opens a task, closes the panel, and returns focus after Escape', () => {
    const openSession = vi.fn()
    render(<ActivityInbox {...props(openSession)} />)
    const trigger = screen.getByRole('button', { name: /任务动态收件箱/ })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', {
      name: '待查看: Review finished work, 未分组',
    }))
    expect(openSession).toHaveBeenCalledWith(sid('Review finished work'))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('shows a compact attention badge in rail mode', () => {
    render(<ActivityInbox {...props(vi.fn(), false)} />)
    const trigger = screen.getByRole('button', { name: /任务动态收件箱/ })
    expect(trigger.textContent).toBe('2')
  })
})

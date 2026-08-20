/** Narrow public contracts consumed from the DSH rc.8 browser host. */

export type SessionId = string & { readonly __sessionId?: never }
export type WorkspaceId = string & { readonly __workspaceId?: never }
export type PendingInteractionStatus = 'approval' | 'plan-review' | 'question'

export interface GoalSnapshot {
  readonly id: string
  readonly revision: number
  readonly objective: string
  readonly phase: 'active' | 'paused' | 'blocked' | 'complete'
  readonly maxGoalRounds: number
  readonly blockedReason?: { readonly code: string; readonly message: string }
}

export interface GoalProjection {
  readonly goal: GoalSnapshot
  readonly roundsStarted: number
  readonly createdAt: number
  readonly updatedAt: number
}

export interface JobView {
  readonly id: string
  readonly kind: string
  readonly label: string
  readonly status: 'running' | 'stopping' | 'completed' | 'failed' | 'cancelled'
  readonly startedAt: number
}

export interface SessionSummary {
  readonly id: SessionId
  readonly displayTitle: string
  readonly cwd?: string
  readonly parentId?: SessionId
  readonly origin?: 'subagent'
  readonly running: boolean
  readonly pendingInteraction?: PendingInteractionStatus
  readonly completed?: boolean
  readonly blank: boolean
  readonly updatedAt: number
  readonly projectionValues?: { readonly goal?: GoalProjection }
}

export interface SessionListState {
  readonly ids: readonly SessionId[]
  readonly byId: Readonly<Record<SessionId, SessionSummary>>
  readonly current: SessionId | undefined
  readonly phase: 'pending' | 'loading' | 'ready' | 'error'
  readonly subagentsByParent: Readonly<Record<SessionId, unknown>>
  readonly jobsBySession: Readonly<Record<SessionId, readonly JobView[]>>
  readonly currentAddress: unknown | undefined
}

export interface WorkspaceView {
  readonly workspaceId: WorkspaceId
  readonly path: string
  readonly title: string
  readonly sessionIds: readonly SessionId[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface WorkspaceListState {
  readonly items: readonly WorkspaceView[]
  readonly archivedSessionIds: readonly SessionId[]
  readonly state: 'idle' | 'loading' | 'error'
  readonly phase: 'pending' | 'loading' | 'ready' | 'error'
  readonly error: unknown | null
  readonly baselinesReady: boolean
  readonly recentWorkspaceId: WorkspaceId | undefined
}

export type SnapshotHook<T> = <S>(selector: (state: T) => S) => S

export interface FooterActionRuntime {
  readonly wide: boolean
  readonly useSessions: SnapshotHook<SessionListState>
  readonly useWorkspaces: SnapshotHook<WorkspaceListState>
}

export type Translate<Key extends string> = (
  key: Key,
  params?: Readonly<Record<string, unknown>>,
) => string

export interface SlotEntryOptions {
  readonly name: 'sidebar.footer.action'
  readonly id: string
  readonly order: number
  readonly label: () => string
  readonly locale: string
  readonly inject: () => { readonly openSession: (sessionId: SessionId) => void }
}

export interface ActivityInboxClientContext {
  readonly locale: {
    register: (
      namespace: string,
      dictionaries: Readonly<Record<string, Readonly<Record<string, string>>>>,
    ) => void | (() => void)
    bind: (namespace: string) => Translate<string>
  }
  readonly sessions: { open: (sessionId: SessionId) => void }
  readonly slots: {
    inject: (
      name: 'sidebar.footer.action',
      setup: () => void | (() => void),
    ) => void | (() => void)
    register: (options: SlotEntryOptions, component: unknown) => void | (() => void)
  }
  effect: (setup: () => void | (() => void), label?: string) => void
}

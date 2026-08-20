/** Sidebar Activity Inbox: priority filters over every top-level Session. */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FooterActionRuntime, SessionId, Translate } from './contracts.js'
import { NS, type ActivityInboxKey } from './locales.js'
import {
  countActivity,
  deriveActivityItems,
  type ActivityItem,
  type ActivityState,
} from './model.js'
import css from './ActivityInbox.module.css'

/** Callback face injected by the browser plugin. */
export interface ActivityInboxInjected {
  /** Open the selected Session through DSH's shared Sessions runtime. */
  openSession: (sessionId: SessionId) => void
}

/** Props composed by the official sidebar footer-action slot. */
export type ActivityInboxProps =
  FooterActionRuntime & ActivityInboxInjected & { readonly t: Translate<ActivityInboxKey> }

type ActivityFilter = ActivityState | 'all'

const STATE_ORDER: readonly ActivityState[] = ['needs-action', 'blocked', 'running', 'ready', 'idle']

const FILTER_KEYS = {
  all: 'filter.all',
  'needs-action': 'filter.needsAction',
  blocked: 'filter.blocked',
  running: 'filter.running',
  ready: 'filter.ready',
  idle: 'filter.idle',
} as const satisfies Record<ActivityFilter, ActivityInboxKey>

const STATE_KEYS = {
  'needs-action': 'state.needsAction',
  blocked: 'state.blocked',
  running: 'state.running',
  ready: 'state.ready',
  idle: 'state.idle',
} as const satisfies Record<ActivityState, ActivityInboxKey>

const PENDING_KEYS = {
  approval: 'pending.approval',
  'plan-review': 'pending.planReview',
  question: 'pending.question',
} as const satisfies Record<NonNullable<ActivityItem['pendingInteraction']>, ActivityInboxKey>

function ageLabel(updatedAt: number, now: number, t: Translate<ActivityInboxKey>): string {
  const elapsed = Math.max(0, now - updatedAt)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return t('time.now')
  if (minutes < 60) return t('time.minutes', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hours', { n: hours })
  return t('time.days', { n: Math.floor(hours / 24) })
}

function detailLabel(item: ActivityItem, t: Translate<ActivityInboxKey>): string {
  if (item.pendingInteraction !== undefined) return t(PENDING_KEYS[item.pendingInteraction])
  if (item.state === 'blocked') {
    return item.goal?.blockedReason?.message ?? item.goal?.objective ?? t('state.blocked')
  }
  if (item.state === 'running') {
    const parts: string[] = []
    if (item.sessionRunning) parts.push(t('detail.sessionRunning'))
    if (item.runningSubagents > 0) {
      parts.push(t(item.runningSubagents === 1 ? 'detail.subagents.one' : 'detail.subagents.other', {
        n: item.runningSubagents,
      }))
    }
    if (item.runningJobs > 0) {
      parts.push(t(item.runningJobs === 1 ? 'detail.jobs.one' : 'detail.jobs.other', {
        n: item.runningJobs,
      }))
    }
    return parts.join(' · ')
  }
  if (item.state === 'ready') return t('detail.ready')
  if (item.goal?.phase === 'active') return t('detail.goalActive', { objective: item.goal.objective })
  if (item.goal?.phase === 'paused') return t('detail.goalPaused', { objective: item.goal.objective })
  return t('detail.idle')
}

function ChecklistIcon({ size }: { readonly size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6.4 4h6.1M6.4 8h6.1M6.4 12h6.1M2.5 4l.8.8L4.8 3.2M2.5 8l.8.8 1.5-1.6M2.5 12l.8.8 1.5-1.6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Render the footer trigger and its priority panel.
 * @param props - Footer slot runtime, locale, and Session navigation props.
 * @returns The Activity Inbox trigger and, while open, its task panel.
 */
export function ActivityInbox({ wide, useSessions, useWorkspaces, openSession, t }: ActivityInboxProps) {
  const sessions = useSessions(snapshot => snapshot)
  const workspaces = useWorkspaces(snapshot => snapshot)
  const items = useMemo(() => deriveActivityItems(sessions, workspaces), [sessions, workspaces])
  const counts = useMemo(() => countActivity(items), [items])
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [now, setNow] = useState(() => Date.now())
  const [anchor, setAnchor] = useState<{ left: number; bottom: number }>()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const identity = useId().replaceAll(':', '')
  const panelId = `dsh-activity-inbox-panel-${identity}`
  const titleId = `dsh-activity-inbox-title-${identity}`

  useLayoutEffect(() => {
    if (!open) return
    const place = (): void => {
      const rect = trigger.current?.getBoundingClientRect()
      if (rect !== undefined) setAnchor({ left: Math.max(8, rect.left), bottom: window.innerHeight - rect.top + 8 })
    }
    place()
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('resize', place) }
  }, [open, wide])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const visible = filter === 'all' ? items : items.filter(item => item.state === filter)
  const sections = (filter === 'all' ? STATE_ORDER : [filter])
    .map(state => ({ state, items: visible.filter(item => item.state === state) }))
    .filter(section => section.items.length > 0)
  const triggerLabel = t('trigger.aria', { attention: counts.attention, running: counts.running })
  const triggerCount = counts.attention > 0
    ? t('trigger.count.attention', { n: counts.attention })
    : counts.running > 0
      ? t('trigger.count.running', { n: counts.running })
      : t('trigger.count.quiet')
  const badgeCount = counts.attention > 0 ? counts.attention : counts.running
  const badgeKind = counts.attention > 0 ? 'attention' : 'running'

  return (
    <div ref={root} className={wide ? css.root : `${css.root} ${css.rail}`}>
      <button
          ref={trigger}
          type="button"
          className={open ? `${css.trigger} ${css.triggerOpen}` : css.trigger}
          aria-label={triggerLabel}
          aria-expanded={open}
          aria-controls={panelId}
          title={wide ? undefined : t('trigger.label')}
          onClick={() => {
            setNow(Date.now())
            setOpen(current => !current)
          }}
        >
          <ChecklistIcon size={wide ? 16 : 18} />
          {wide && (
            <>
              <span className={css.triggerLabel}>{t('trigger.label')}</span>
              <span className={css.triggerCount}>{triggerCount}</span>
            </>
          )}
          {!wide && badgeCount > 0 && (
            <span className={css.badge} data-kind={badgeKind}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
      </button>

      {open && anchor !== undefined && (
        <section
          id={panelId}
          className={css.panel}
          style={anchor}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <header className={css.panelHeader}>
            <div>
              <h2 id={titleId} className={css.panelTitle}>{t('panel.title')}</h2>
              <p className={css.panelSummary}>{t('panel.summary', {
                attention: counts.attention,
                running: counts.running,
              })}</p>
            </div>
            <button
              type="button"
              className={css.close}
              aria-label={t('panel.close')}
              onClick={() => {
                setOpen(false)
                trigger.current?.focus()
              }}
            >
              <CloseIcon />
            </button>
          </header>

          <div className={css.filters} role="group" aria-label={t('panel.title')}>
            {(Object.keys(FILTER_KEYS) as ActivityFilter[]).map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                aria-label={`${t(FILTER_KEYS[value])} ${counts[value]}`}
                className={filter === value ? `${css.filter} ${css.filterSelected}` : css.filter}
                onClick={() => { setFilter(value) }}
              >
                <span>{t(FILTER_KEYS[value])}</span>
                <span className={css.filterCount}>{counts[value]}</span>
              </button>
            ))}
          </div>

          <div className={css.body}>
            {sections.length === 0 && <p className={css.empty}>{t('empty')}</p>}
            {sections.map(section => (
              <section key={section.state} className={css.group} aria-label={t(STATE_KEYS[section.state])}>
                <div className={css.groupHeader}>
                  <span>{t(STATE_KEYS[section.state])}</span>
                  <span>{section.items.length}</span>
                </div>
                <ul className={css.rows}>
                  {section.items.map((item) => {
                    const workspace = item.workspace ?? t('workspace.ungrouped')
                    const status = t(STATE_KEYS[item.state])
                    const detail = detailLabel(item, t)
                    return (
                      <li key={item.sessionId}>
                        <button
                          type="button"
                          className={item.current ? `${css.row} ${css.rowCurrent}` : css.row}
                          data-activity-state={item.state}
                          aria-label={`${status}: ${item.title}, ${workspace}`}
                          onClick={() => {
                            openSession(item.sessionId)
                            setOpen(false)
                          }}
                        >
                          <span className={css.stateMark}>
                            <span className={css.stateDot} data-state={item.state} aria-hidden />
                          </span>
                          <span className={css.rowBody}>
                            <span className={css.rowTitleLine}>
                              <span className={css.rowTitle}>{item.title}</span>
                              <span className={css.rowTime}>{ageLabel(item.updatedAt, now, t)}</span>
                            </span>
                            <span className={css.rowMeta}>
                              <span className={css.workspace}>{workspace}</span>
                              <span className={css.detail} title={detail}>{detail}</span>
                            </span>
                          </span>
                          <span className={css.statePill} data-state={item.state}>{status}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

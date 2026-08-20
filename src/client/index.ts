/** Registers Activity Inbox in DSH's official sidebar footer-action slot. */
import type { ActivityInboxClientContext } from './contracts.js'
import { ActivityInbox, type ActivityInboxInjected } from './ActivityInbox.js'
import { mountCss } from './ActivityInbox.module.css'
import { en, NS, zh, type ActivityInboxKey } from './locales.js'

export { ActivityInbox } from './ActivityInbox.js'
export type { ActivityInboxInjected, ActivityInboxProps } from './ActivityInbox.js'
export { countActivity, deriveActivityItems } from './model.js'
export type { ActivityCounts, ActivityItem, ActivityState } from './model.js'
export type { ActivityInboxKey } from './locales.js'

/** Cordis browser plugin name. */
export const name = 'ui-activity-inbox'

/** Required services for Slot contribution, Session navigation, and locale. */
export const inject = ['slots', 'sessions', 'locale']

/**
 * Register dictionaries and the additive sidebar footer action.
 * @param ctx - DSH browser Cordis context.
 */
export function apply(ctx: ActivityInboxClientContext): void {
  ctx.effect(() => mountCss(), 'ui-activity-inbox: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-activity-inbox: dictionaries')
  ctx.effect(() => ctx.slots.inject(
    'sidebar.footer.action',
    () => ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'activity-inbox',
      order: 10,
      label: () => ctx.locale.bind(NS)('trigger.label'),
      locale: NS,
      inject: (): ActivityInboxInjected => ({
        openSession: (sessionId) => { ctx.sessions.open(sessionId) },
      }),
    }, ActivityInbox),
  ), 'ui-activity-inbox: footer action')
}

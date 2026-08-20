import { Context } from '@deepseek-ai/cordis'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActivityInboxClientContext, SlotEntryOptions } from '../src/client/contracts.js'
import { ActivityInbox, apply, inject, name } from '../src/client/index.js'
import { apply as applyNode, name as nodeName } from '../src/index.js'
import { en, NS, zh } from '../src/client/locales.js'

const cssLifecycle = vi.hoisted(() => ({ mount: vi.fn(), dispose: vi.fn() }))
vi.mock('../src/client/ActivityInbox.module.css', () => ({
  default: {},
  mountCss: () => {
    cssLifecycle.mount()
    return cssLifecycle.dispose
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

async function bench() {
  const ctx = new Context()
  const entries: Array<{ options: SlotEntryOptions; component: unknown }> = []
  let localeName = 'zh'
  const dictionaries = new Map<string, Readonly<Record<string, Readonly<Record<string, string>>>>>()
  const slots = {
    inject: (_name: 'sidebar.footer.action', setup: () => void | (() => void)) => setup(),
    register: (options: SlotEntryOptions, component: unknown) => {
      const entry = { options, component }
      entries.push(entry)
      return () => { entries.splice(entries.indexOf(entry), 1) }
    },
  }
  const open = vi.fn()
  const locale = {
    register: (namespace: string, value: Readonly<Record<string, Readonly<Record<string, string>>>>) => {
      dictionaries.set(namespace, value)
      return () => { dictionaries.delete(namespace) }
    },
    bind: (namespace: string) => (key: string) => dictionaries.get(namespace)?.[localeName]?.[key] ?? key,
    setLocale: (value: string) => { localeName = value },
  }
  ctx.provide('slots', slots as never)
  ctx.provide('sessions', { open } as never)
  ctx.provide('locale', locale as never)
  const fiber = ctx.plugin({
    inject: [...inject],
    apply: pluginCtx => { apply(pluginCtx as unknown as ActivityInboxClientContext) },
  })
  await fiber.await()
  return { entries, fiber, locale, open }
}

describe('ui-activity-inbox browser half', () => {
  it('registers one disposable official footer action', async () => {
    expect(name).toBe('ui-activity-inbox')
    expect(inject).toEqual(['slots', 'sessions', 'locale'])
    const { entries, fiber, open } = await bench()
    const entry = entries[0]
    expect(cssLifecycle.mount).toHaveBeenCalledOnce()
    expect(entry?.options.id).toBe('activity-inbox')
    expect(entry?.options.order).toBe(10)
    expect(entry?.component).toBe(ActivityInbox)
    entry?.options.inject?.().openSession('session' as never)
    expect(open).toHaveBeenCalledWith('session')

    await fiber.dispose()
    expect(entries).toHaveLength(0)
    expect(cssLifecycle.dispose).toHaveBeenCalledOnce()
  })

  it('registers key-identical dictionaries and releases them with the fiber', async () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    const { fiber, locale } = await bench()
    const t = locale.bind(NS)
    expect(t('panel.title')).toBe(zh['panel.title'])
    locale.setLocale('en')
    expect(t('panel.title')).toBe(en['panel.title'])
    await fiber.dispose()
    expect(t('panel.title')).not.toBe(en['panel.title'])
  })
})

describe('ui-activity-inbox node half', () => {
  it('stays inert and named', () => {
    expect(nodeName).toBe('ui-activity-inbox')
    expect(applyNode).not.toThrow()
  })
})

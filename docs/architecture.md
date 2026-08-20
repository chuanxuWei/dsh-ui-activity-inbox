# Architecture and verification

## Integration decision

The plugin contributes one item to `sidebar.footer.action`, the additive root-scoped list slot present in official DeepSeek Harness `0.1.0-rc.8`. A task inbox is a small global sidebar action, so it does not need to own or replace the sidebar tree.

The browser half registers:

- locale dictionaries under `activityInbox`;
- one slot entry with id `activity-inbox`;
- a narrow callback that forwards row selection to `sessions.open()`.

Cordis effects own both registrations, so disabling or removing the plugin releases them with its Fiber.

## Source-of-truth mapping

| Inbox fact | Official DSH owner |
| --- | --- |
| Session title, activity, completion, pending interaction | `SessionListState` |
| Goal phase and blocked reason | Session goal projection |
| Descendant subagent activity | `indexSubagentDescendants()` |
| Background activity | `jobsBySession` |
| Workspace title and archive membership | `WorkspaceListState` |
| Opening a task | `sessions.open()` |

No fact is persisted by this plugin. Reopening the panel recomputes the view from the shared stores.

## Priority projection

A top-level, non-blank, non-archived Session receives the first matching state:

1. pending interaction → Needs you;
2. blocked goal → Blocked;
3. active Session, descendant, or job → Running;
4. unread completion → Ready;
5. otherwise → Recent.

This precedence prevents one task from appearing in several urgency groups.

## Distribution

The package has an inert Node half and a browser half wrapped for DSH's `window.__ModuleLoader__`. CSS Modules are compiled, hashed, and embedded in the browser bundle, so Git installs do not depend on a separate stylesheet loader.

The package metadata exposes `cordis.patch.yml` through `dsh.bundle.patch` and declares the DSH client packages the profile must inject.

The package keeps a narrow, source-controlled rc.8 host contract for compilation. DSH's internal client packages are runtime-provided through `dsh.client.inject`, not independently installed from npm; this prevents a duplicate runtime and remains buildable even when internal package publication is incomplete.

## Verification matrix

| Layer | Proof |
| --- | --- |
| Projection | Priority precedence, filtering, archive/blank/subagent exclusion, counts |
| Component | Wide and rail triggers, groups, filters, navigation, Escape focus |
| Cordis | Official footer slot registration, callback wiring, locale and Fiber disposal |
| Bundle | TypeScript declaration-only build plus browser and Node bundles |
| Package | Required files, ModuleLoader wrapper, CSS embedding, manifest/slot guard |
| Install surface | `pnpm pack --dry-run` lists the publishable artifact |

CI repeats `pnpm check` and package packing on Node 24 with the pinned pnpm version.

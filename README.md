# DSH Activity Inbox

[简体中文](./README.zh.md)

Turn DeepSeek Harness's conversation list into a task operating system. Activity Inbox adds one compact footer action that summarizes every top-level Session by urgency, without replacing the official sidebar.

## What it shows

- **Needs you** — approvals, plan reviews, and questions waiting for input.
- **Blocked** — active goals whose blocked reason needs attention.
- **Running** — main Sessions, descendant subagents, or background jobs still working.
- **Ready** — completed Sessions that have not been opened yet.
- **Recent** — quiet Sessions that remain available for navigation.

Rows are grouped by priority, sorted by latest activity, and open through DSH's shared Session navigation runtime. Archived Sessions, blank drafts, and child subagent Sessions are intentionally omitted.

## Compatibility

- DeepSeek Harness `0.1.0-rc.8`
- Node.js `22.19+` or `24+`
- Web profile

The plugin uses the public additive `sidebar.footer.action` slot available in official rc.8. It does not require a fork or an unpublished sidebar-header slot.

## Install

```bash
dsh plugin --profile web add github:chuanxuWei/dsh-ui-activity-inbox
```

If pnpm asks you to approve the package build, add this package to the profile's `pnpm-workspace.yaml`, then run the command again:

```yaml
allowBuilds:
  dsh-ui-activity-inbox: true
```

Restart the DSH web process after installing or updating the plugin.

## Design and data ownership

Activity Inbox is a read-only browser projection. It reads the official `useSessions` and `useWorkspaces` slot hooks and calls `sessions.open()` for navigation. It does not create a second task database, call Host APIs, mutate Session state, or replace the built-in sidebar.

The priority rule is deliberately deterministic:

```text
Needs you > Blocked > Running > Ready > Recent
```

Each Session appears in exactly one bucket.

## Development

```bash
pnpm install
pnpm check
pnpm pack --dry-run
```

`pnpm check` compiles declarations, builds the DSH ModuleLoader browser bundle, runs projection/UI/Cordis lifecycle tests, and verifies the distributable package contract.

DSH's client packages are supplied by the target profile through `dsh.client.inject`; they are not fetched from npm as standalone dependencies. This avoids duplicating the Harness runtime and keeps one owner for Session state.

See [docs/architecture.md](./docs/architecture.md) for integration decisions and the verification matrix.

## License

MIT

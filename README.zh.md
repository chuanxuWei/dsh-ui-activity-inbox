# DSH Activity Inbox（任务动态收件箱）

[English](./README.md)

把 DeepSeek Harness 的聊天列表升级成任务操作系统。插件在官方侧边栏底部增加一个紧凑入口，集中展示所有顶层 Session 的紧急程度，但不替换 DSH 原生侧边栏。

## 它解决什么问题

当多个 Agent、子代理和后台任务同时运行时，“最近聊天”不足以回答三个问题：

1. 现在什么事情在等我？
2. 哪些任务还在工作，哪些已经受阻？
3. 哪些结果已经完成，但我还没打开查看？

Activity Inbox 将顶层 Session 投影为五个互斥状态：

- **需要你处理**：等待审批、计划确认或问题回答。
- **受阻**：目标进入 blocked，并显示官方投影给出的原因。
- **进行中**：主 Session、后代子代理或后台任务仍在运行。
- **待查看**：任务已完成，但结果尚未被打开。
- **最近**：当前没有活跃工作的普通 Session。

列表按优先级分组，再按最近更新时间排序；点击任意任务会通过 DSH 原生 Session 导航打开。已归档 Session、空白草稿和子代理自己的 Session 不会重复出现。

## 兼容范围

- DeepSeek Harness `0.1.0-rc.8`
- Node.js `22.19+` 或 `24+`
- Web profile

插件使用 rc.8 官方公开的增量槽位 `sidebar.footer.action`，不依赖 fork，也不依赖尚未发布的侧边栏头部槽位。

## 安装

```bash
dsh plugin --profile web add github:chuanxuWei/dsh-ui-activity-inbox
```

如果 pnpm 要求授权 Git 依赖执行构建，请在该 profile 的 `pnpm-workspace.yaml` 中加入：

```yaml
allowBuilds:
  dsh-ui-activity-inbox: true
```

然后重新执行安装命令。安装或更新后，请重启 DSH Web 进程。

## 数据边界

这是一个只读的浏览器端投影插件：

- 数据来自官方槽位提供的 `useSessions` 与 `useWorkspaces`；
- 导航只调用 `sessions.open()`；
- 不创建第二套任务数据库；
- 不直接调用 Host API；
- 不修改 Session 状态；
- 不替换内置聊天列表。

状态优先级固定为：

```text
需要你处理 > 受阻 > 进行中 > 待查看 > 最近
```

因此每个 Session 只会落入一个状态，不会重复计数。

## 本地开发

```bash
pnpm install
pnpm check
pnpm pack --dry-run
```

`pnpm check` 会完成类型声明编译、DSH ModuleLoader 浏览器打包、数据投影/UI/Cordis 生命周期测试，以及发布包契约检查。

DSH 客户端包由目标 profile 根据 `dsh.client.inject` 提供，插件不会从 npm 再安装一套 Harness 运行时。这样既避开内部包不完整的独立发布链，也保证 Session 状态只有一个所有者。

集成理由和验证矩阵见 [docs/architecture.md](./docs/architecture.md)。

## License

MIT

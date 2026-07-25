# Braum 布隆 CF 探针 Git 工作规范

> 文档版本：v1.0  
> 更新日期：2026-07-24  
> 适用范围：Braum 布隆 CF 探针 monorepo（Cloudflare Workers 全栈）

## 1. 仓库模式

项目采用单一 monorepo，Workers 后端、前端展示页、管理后台、D1 数据库迁移、部署配置和文档统一版本管理：

```text
apps/web/              # Astro SSR 前端与管理后台（部署到 Cloudflare Web Worker）
apps/api/              # Cloudflare Workers 后端（探针引擎 + API）
apps/api/migrations/   # Cloudflare D1 迁移脚本
docs/                  # 产品和工程文档
```

原因是 MVP 阶段大量功能会同时改变 D1 schema、Workers API 和页面。单仓库可以让这些变化原子提交、一起验证和一起回滚，减少跨仓库版本漂移。目录边界仍需严格遵守：前端不得直连 D1 数据库，所有数据通过 Workers API 访问。

## 2. 分支模型

采用轻量主干开发，不设置长期 `develop` 分支。

| 分支 | 用途 |
|---|---|
| `main` | 受保护主干，始终可构建、可部署 |
| `feature/<name>` | 短生命周期功能或文档变更 |
| `fix/<name>` | 常规缺陷修复 |
| `hotfix/<name>` | 从生产版本点创建的紧急修复 |

分支名使用小写英文和短横线，例如 `feature/node-map`、`fix/alert-rule-evaluation`。功能分支原则上在数天内合并；大型功能使用 feature flag 拆成可独立验证的小变更，避免长期分叉。

`main` 保护规则：

- 禁止直接推送和强制推送。
- 至少一名非作者审查通过。
- 必需 CI 检查全部通过。
- 合并前分支必须基于最新 `main`，仓库统一采用 squash merge。
- 安全、鉴权、迁移和管理权限改动应指定对应领域审查人。

## 3. Git Worktree

worktree 用于同时维护两个独立分支，不是每个小改动的强制步骤。

```bash
# 在仓库主目录创建功能 worktree
git fetch origin
git worktree add -b feature/node-map ../braum-node-map origin/main

# 查看 worktree
git worktree list

# 合并后清理
git worktree remove ../braum-node-map
git branch -d feature/node-map
git worktree prune
```

规则：

- 一个分支只能被一个 worktree 检出。
- worktree 统一放在主仓库同级目录，命名为 `braum-<feature>`。
- 删除前确认分支已经推送或合并，且目录没有未提交修改。
- 根目录 `.env` 按 worktree 单独创建，不使用软链接共享秘密；项目不再使用 `.dev.vars`。
- D1 migration 版本号可能冲突；合并主干后必须重新检查顺序并通过 `wrangler d1 migrations apply --local` 运行全量迁移测试。

## 4. 提交规范

使用 Conventional Commits：

```text
<type>(<scope>): <简要描述>

<可选正文：为什么改、重要约束、迁移或兼容说明>
```

### 4.1 type

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `refactor` | 不改变外部行为的重构 |
| `perf` | 性能优化 |
| `docs` | 文档修改 |
| `style` | 纯格式调整 |
| `test` | 测试修改 |
| `build` | 构建、依赖或镜像 |
| `ci` | CI/CD |
| `chore` | 其他维护工作 |

常用 scope：`worker`、`frontend`、`admin`、`probe`、`alert`、`d1`、`kv`、`auth`、`deploy`、`docs`。

示例：

```text
feat(probe): add HTTP probe with custom headers and expected status

- support configurable request headers
- validate response status code against expected_status
- record dns_time_ms separately
```

```text
fix(alert): suppress duplicate notifications within cooldown window
```

### 4.2 原子提交

- 一次提交只表达一个可解释、可验证的变化。
- 提交必须保持工作区可构建；不要提交调试日志、临时绕过或已知失败测试。
- Workers API 变化应在同一提交中包含路由定义、handler 实现和前端消费方修改。
- D1 schema 变化应包含 migration 文件、类型定义和相关测试。
- `wrangler.toml` 配置变化应同步更新 `.env.example` 和部署文档。
- 不把无关格式化与业务修改混在一起。

## 5. Pull Request 规范

PR 描述至少包含：

```markdown
## 目的
解决什么问题，为什么现在需要。

## 变化
- 用户可感知变化
- API / schema / 配置变化

## 验证
- 执行过的命令与结果
- UI 截图或录屏（如适用）

## 风险与回滚
- 数据兼容、缓存、权限和部署风险
- 如何关闭功能或回滚应用
```

涉及破坏性变化时增加 `BREAKING CHANGE:`，但 MVP 阶段仍应优先通过兼容迁移避免破坏性发布。

## 6. D1 Migration 工作流

迁移使用 Wrangler 内置的 D1 migrations 功能，采用递增编号 + 描述命名：

```text
apps/api/migrations/0001_init_core.sql
apps/api/migrations/0002_init_alerts.sql
apps/api/migrations/0003_init_incidents.sql
```

每条 migration 是纯 SQL 文件（D1 基于 SQLite），通过 `wrangler d1 migrations apply` 执行。

规则：

- 已进入生产环境的 migration 永不修改；修正必须新增 migration。
- CI 在空库执行全量 migration 验证；生产部署由 Cloudflare Git 集成执行 pending migrations。
- 生产采用"扩展 → 应用切换 → 收缩"：先增加兼容字段/表，部署读写新旧结构的 Workers，最后在后续版本移除旧结构。
- `probe_results` 等大表变更避免长时间锁表；数据回填拆成可恢复的 Cron 任务。
- 禁止通过 Cloudflare Dashboard 控制台手工修改生产 D1 schema。
- 部署前执行 `wrangler d1 migrations apply DB --remote --dry-run` 确认变更内容。

## 7. API 契约与类型安全

Workers 后端使用 TypeScript，通过 `zod` schema 定义请求/响应类型，并作为 API 契约的事实来源。《API 接口设计文档》解释业务语义。二者必须保持一致。

标准流程：

1. 先在 `apps/api/src/schemas/` 定义或修改 zod schema。
2. 修改 Workers handler/service 实现。
3. 同步更新前端 API 调用层的类型引用（从 schemas 导入或生成）。
4. CI 运行类型检查 `pnpm typecheck`，确保前后端类型一致。
5. API 变更 PR 必须包含前后端对应修改。

## 8. `.gitignore` 与秘密

根目录 `.gitignore` 至少覆盖：

```gitignore
.DS_Store
.env
.env.*
!.env.example
node_modules/
.wrangler/
.next/
dist/
out/
coverage/
.turbo/
tmp/
*.log
*.test
```

- 仓库只提交 `.env.example`，值使用明显的本地占位符。
- Cloudflare Secrets 通过 Dashboard 的 Variables and Secrets 页面或 Wrangler 设置，**禁止**提交到仓库。
- 禁止提交密码、token、私钥、真实邮箱列表、D1 数据库快照或含个人信息的日志。
- 即使秘密随后从 Git 删除，也应视为已泄露并立即轮换。
- CI 启用秘密扫描；依赖 bot 的升级 PR 仍需通过完整测试。

## 9. 合并前检查清单

### 通用

- [ ] 变更范围聚焦，PR 描述说明了风险和回滚。
- [ ] 没有调试代码、临时注释、秘密或用户隐私数据。
- [ ] 文档、D1 migration、`wrangler.toml` 和实现保持一致。
- [ ] 新行为有测试，修复包含可复现问题的回归测试。
- [ ] 日志不包含 Authorization、Cookie、密码或一次性 token。

### Workers 后端

- [ ] `pnpm lint`、`pnpm typecheck`、`pnpm test` 全部通过。
- [ ] Workers handler 中无硬编码配置，使用 `env` 绑定访问 D1/KV。
- [ ] 所有 D1 查询使用参数化绑定（`?`），禁止字符串拼接 SQL。
- [ ] 写接口考虑鉴权、幂等、限流、审计日志和 KV 缓存失效。
- [ ] Cron Trigger 处理逻辑有超时保护和错误兜底。

### 前端（Web Worker）

- [ ] lint、类型检查、单元测试和生产构建通过。
- [ ] 页面元数据、键盘操作、焦点状态、错误/空/加载状态完整。
- [ ] UI 变化附桌面和移动端截图。
- [ ] Astro SSR 构建、Worker 部署和 API 地址配置保持一致。

### D1 与部署

- [ ] D1 migration 在空库与升级路径通过（`wrangler d1 migrations apply --local`）。
- [ ] 索引覆盖主要查询路径，使用 `EXPLAIN QUERY PLAN` 验证。
- [ ] 新增本地变量已记录到 `.env.example`；新增生产 Secret 已记录到配置与部署文档。
- [ ] `wrangler.toml` 默认/生产配置与部署文档保持同步。
- [ ] 部署和回滚不依赖不可逆的 schema 删除。

## 10. Release 与 hotfix

- 合并 `main` 后由 CI 执行检查、类型检查和构建；Cloudflare Git 集成负责部署。
- 生产发布由 Cloudflare Workers Git 集成执行 API/Web Worker 部署和 D1 migration。
- hotfix 从当前生产标签创建，合并回 `main` 后正常发布，不维护独立长期分支。
- API 与 Web Worker 回滚均使用对应 Worker 的 `wrangler versions rollback`，秒级全球生效。
- D1 回滚优先使用 Time Travel（30 天），避免执行高风险 down migration。

## 11. 当前项目初始化

当前文档目录尚未初始化 Git。开始编码时按以下顺序建立基线：

1. 确认本目录作为 monorepo 根目录，移除无用系统文件并添加根 `.gitignore`。
2. `git init`，创建 `main`，加入文档基线、`wrangler.toml` 骨架和目录说明。
3. 运行文档一致性检查后创建首个 `docs: establish MVP baseline` 提交。
4. 配置远端（GitHub）、分支保护和 CI 后，再开始业务功能分支。
5. 创建 Cloudflare D1 / KV 资源（参考《部署运维文档》），将绑定 ID 填入 `wrangler.toml`。

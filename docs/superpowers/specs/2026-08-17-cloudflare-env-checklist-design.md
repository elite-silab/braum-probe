# Cloudflare 变量本地备忘录设计

## 背景

项目当前把生产普通配置放在 `wrangler.jsonc`，把生产 Secrets 要求用户在 Cloudflare 控制台手动填写，同时根目录 `.env` 还混有本地配置、重复配置和已废弃变量，`apps/api/.dev.vars` 的位置和职责也不清晰。这容易让维护者忘记 Cloudflare 中必须存在的变量，并可能让本地开发误用生产密钥。

## 目标

- 根目录 `.env` 作为维护者电脑上的生产 Cloudflare Variables and Secrets 私密备忘录。
- 根目录 `.dev.vars` 专门保存 Wrangler 本地开发变量，与生产值隔离。
- `.env.example` 和 `.dev.vars.example` 提交到仓库，分别作为生产和开发模板。
- 部署仍由维护者在 Cloudflare 控制台手动填写变量，不增加自动上传或同步脚本。
- `wrangler.jsonc` 继续保存可公开、可版本管理的 Worker 配置和 Cloudflare 资源绑定。
- 环境文件统一放在仓库根目录，不再使用 `apps/api/.dev.vars`。

## 非目标

- 不把 `.env` 提交到 Git。
- 不让 `pnpm deploy` 自动上传 `.env` 中的生产值。
- 不在本地开发中读取生产 `.env`；存在 `.dev.vars` 时由 Wrangler 使用开发变量。
- 不把 Cloudflare API Token、Account ID、D1 ID 或 KV ID 当作 Worker Variables and Secrets。
- 不改变现有单 Worker 架构、部署方式或运行时接口。

## 配置边界

### 生产 `.env` 与 `.env.example`

只记录需要在 Cloudflare Worker 的 **Settings → Variables and Secrets** 中手动创建的变量：

| 变量 | Cloudflare 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `JWT_SECRET` | Secret | 是 | Access Token 签名 |
| `JWT_REFRESH_SECRET` | Secret | 是 | Refresh Token 签名 |
| `ENCRYPTION_KEY` | Secret | 是 | 告警渠道配置加密 |
| `ADMIN_INITIAL_PASSWORD` | Secret | 首次部署必填 | 初始管理员密码 |
| `TELEGRAM_BOT_TOKEN` | Secret | 否 | Telegram 默认机器人 Token |

`.env` 保存维护者自己的生产值并继续由 `.gitignore` 忽略；`.env.example` 只使用明显的生产占位值和说明。两个文件都要注明：它们不会自动上传到 Cloudflare，部署时必须由维护者对照文件在 Cloudflare 控制台手动填写。

### 开发 `.dev.vars` 与 `.dev.vars.example`

根目录 `.dev.vars` 使用同一组运行时变量名，但只保存本地测试值。`.dev.vars.example` 提供安全、不可用于生产的示例值。Wrangler 在本地开发时优先读取 `.dev.vars`，从而避免使用生产 `.env`。

真实 `.dev.vars` 继续由 `.gitignore` 忽略；原有 `apps/api/.dev.vars` 迁移到根目录后删除。未使用 Telegram 时，开发文件中的 `TELEGRAM_BOT_TOKEN` 可以留空。

### `wrangler.jsonc`

继续保存以下非敏感内容：

- Worker 名称、入口、兼容日期和兼容标志；
- `APP_VERSION`、`AGENT_API_URL`、`AGENT_RELEASE_BASE_URL`；
- D1、KV、Durable Object、Assets 和 Cron 绑定；
- 可观测性配置。

在 `wrangler.jsonc` 的 `vars` 附近增加注释，说明 Secrets 不应写入该文件，并指向本地 `.env` 备忘录。D1 和 KV ID 属于资源绑定，不属于 Worker 环境变量，因此仍保留在 Wrangler 配置中。

## 清理规则

- 从生产 `.env` 移除与 `wrangler.jsonc` 重复的 `AGENT_API_URL`、`AGENT_RELEASE_BASE_URL`。
- 从本机 `.env` 移除当前项目未使用的 `PUBLIC_API_URL`、`CORS_ORIGINS`、`SMTP_PASSWORD`、`WORKER_API_URL`。
- 把 `apps/api/.dev.vars` 中已有的开发值迁移到根目录 `.dev.vars`，然后删除旧文件。
- 保留 `.env` 中已有的五个 Cloudflare Secret 值；清理时不得在终端、日志或 Git diff 中输出真实值。

## 文档与交互

README、环境变量指南、小白部署指南和部署运维文档统一说明：

1. 生产维护者在本机复制 `.env.example` 为 `.env` 并填写生产值；
2. `.env` 只是生产私密备忘录，Wrangler 不会把其中的值自动上传为 Worker Variables 或 Secrets；
3. 部署前对照 `.env`，在 Cloudflare 控制台逐项创建同名 Secret；
4. 本地开发者复制 `.dev.vars.example` 为 `.dev.vars`，只填写测试值；
5. `wrangler.jsonc` 只维护非敏感配置和资源绑定，不要把 Secrets 写进去；
6. 不在子目录创建重复环境文件。

## 安全与错误预防

- `.gitignore` 必须忽略真实 `.env`、`.env.*`、`.dev.vars` 和 `.dev.vars.*`，仅允许 `.env.example` 与 `.dev.vars.example` 入库。
- 文档和模板不得包含可用的生产密钥或密码。
- 五个 Cloudflare 配置均按 Secret 类型保存，避免控制台明文展示。
- `JWT_SECRET`、`JWT_REFRESH_SECRET` 和 `ENCRYPTION_KEY` 必须使用三个不同的随机长字符串。
- `TELEGRAM_BOT_TOKEN` 未使用时可留空，不要求在 Cloudflare 创建。
- `.dev.vars.example` 必须明确标注测试用途，其示例值不得复制到生产环境。
- 本地开发前必须创建根目录 `.dev.vars`；如果该文件缺失，Wrangler 可能把 `.env` 当作本地变量来源。

## 验收标准

- `.env.example` 只包含五个需手动填写到 Cloudflare 的变量，并清楚标注必填性和类型。
- 本机 `.env` 只保留对应五个键及说明，真实值不出现在 Git 状态、diff 或日志中。
- 根目录存在 `.dev.vars.example`；本机开发值位于被忽略的根目录 `.dev.vars`。
- `apps/api/.dev.vars` 不再存在。
- `wrangler.jsonc` 不含 Secret 值，并明确配置边界。
- README 与三份部署/配置文档明确区分生产 `.env` 和开发 `.dev.vars`，不再出现相互矛盾的指引。
- `git diff --check`、配置引用检查和现有测试通过。

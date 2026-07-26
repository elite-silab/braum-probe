# Next.js 单 Worker 设计

**目标：** 将 Braum 的 Astro 前端迁移到 Next.js，同时只部署一个 Cloudflare Worker。唯一生产地址为 `https://braum-probe.codeelite.workers.dev`。

## 架构

项目保留现有 Hono API、D1/KV 数据层、定时任务和 Go Agent。Next.js 只替换 Web 展示层，不重写已经具备测试覆盖的后端业务。

统一 Worker 入口按路径分流：

- `/health`、`/api/v1/*`、`/api/admin/v1/*`、`/api/agent/v1/*` 交给 Hono；
- 其余请求交给 OpenNext 生成的 Next.js Worker；
- Cloudflare `scheduled` 事件继续调用现有 `handleScheduled`。

D1、KV、Secrets、Cron 和静态资源都绑定到同一个 `braum-probe` Worker。浏览器使用同源相对路径访问 API，不再配置 `PUBLIC_API_URL` 或跨 Worker CORS。

## Web 迁移

Next.js 使用 App Router。现有 React/TSX 组件和 Tailwind 样式尽量复用；Astro 页面、布局和服务端数据加载迁移为 `app` 目录中的页面与布局。管理后台继续在浏览器中保存 JWT，公开状态页保持现有信息结构和交互。

## 开发与部署

`pnpm dev` 启动完整的 Next.js 应用，并通过统一入口提供 API；`predev` 自动执行本地 D1 migration。生产构建由 OpenNext Cloudflare 生成产物，Wrangler 使用项目唯一配置部署 `braum-probe`。

Cloudflare 只需创建一个 Git 集成项目。旧的 `braum-web` 与 `braum-worker` 部署在迁移验证后可以删除。

## 错误处理与验证

不存在的 API 路由返回 JSON 404，不存在的页面使用 Next.js 404。现有 Hono/Vitest 与 Go 测试继续保留，并新增或执行以下验证：

1. Next.js 类型检查和生产构建；
2. Wrangler dry-run；
3. `/`、`/admin/login`、`/health` 和登录接口冒烟测试；
4. Agent 路由与 Cron 导出检查；
5. 文档中不存在双 Worker、Astro 或 `PUBLIC_API_URL` 的现行部署说明。

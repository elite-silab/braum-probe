# Web Worker Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Astro SSR 前端从不兼容的 Cloudflare Pages 部署改为独立 Cloudflare Worker 部署。

**Architecture:** API 继续运行在 `braum-worker`，Astro SSR 前端运行在 `braum-web` Worker。Astro Cloudflare Adapter 生成 `dist/server/wrangler.json`，其中包含 Worker 入口和 `dist/client` 静态资源绑定；浏览器与 Web Worker 都通过 `PUBLIC_API_URL` 访问 API Worker。

**Tech Stack:** Astro 7、`@astrojs/cloudflare` 14、Cloudflare Workers、Wrangler 4、pnpm workspace。

---

### Task 1: 增加 Web Worker 部署命令

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Steps:**
1. 为 Web 包增加 `wrangler` 开发依赖。
2. 增加 `deploy:worker` 脚本，使用 `dist/server/wrangler.json` 部署生成的 SSR Worker。
3. 重新生成锁文件。
4. 运行 Web 构建和 Wrangler dry-run，确认入口与静态资源绑定有效。

### Task 2: 将部署文档从 Pages 改为 Web Worker

**Files:**
- Modify: `README.md`
- Modify: `docs/小白部署指南.md`
- Modify: `docs/部署运维文档.md`
- Modify: `docs/环境变量与配置指南.md`
- Modify: `docs/架构设计文档.md`
- Modify: `docs/Git工作规范.md`
- Modify: `docs/adr/0001-workers-control-plane-vps-agent.md`
- Modify: `apps/api/wrangler.toml`

**Steps:**
1. 将拓扑改为浏览器 → Web Worker → API Worker → D1/KV。
2. 将第六步改为从同一 Git 仓库创建 `braum-web` Worker。
3. 配置 `PUBLIC_API_URL` 为 API Worker 的完整 HTTPS 地址。
4. 将 `CORS_ORIGINS` 改为实际 Web Worker 地址，不再引用 `pages.dev`。
5. 删除 Pages output directory、Pages Functions 和 Pages 回滚等过期说明。

### Task 3: 回归验证

**Files:**
- Verify only

**Steps:**
1. 运行 Astro Web 构建。
2. 运行 Web Worker Wrangler dry-run。
3. 运行 API Vitest 与 Go Agent 测试。
4. 搜索残留的当前 Pages 部署说明，并执行 `git diff --check`。

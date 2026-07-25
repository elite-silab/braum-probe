<p align="center">
  <img src="apps/web/public/logo-icon.svg" width="80" alt="Braum" />
</p>

<h1 align="center">Braum 布隆探针</h1>

<p align="center">
  <strong>Cloudflare 原生 · 无需额外控制面服务器 · 轻量 VPS 监控与网络探测</strong>
</p>

<p align="center">
  <a href="#-快速开始">快速开始</a> •
  <a href="#-文档">文档</a> •
  <a href="#-截图">截图</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Agent-Go-00ADD8?logo=go&logoColor=white" alt="Go Agent" />
  <img src="https://img.shields.io/badge/Frontend-Astro-BC52EE?logo=astro&logoColor=white" alt="Astro" />
  <img src="https://img.shields.io/badge/Database-D1-0052CC?logo=sqlite&logoColor=white" alt="D1" />
  <img src="https://img.shields.io/badge/Test-162%20passed-brightgreen?logo=vitest&logoColor=white" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" />
</p>


## ✨ 为什么选择 Braum？

- **无需额外控制面 VPS**：API、数据库、缓存和前端分别运行在 Workers、D1、KV 和 Pages 上
- **Agent 主动外连**：被监控 VPS 仅通过出站 HTTPS 上报，不需要开放 Agent 入站端口
- **节点本地探测**：HTTP 和 DNS 任务由各 VPS 就近执行，便于观察不同地区的网络质量
- **添加节点简单**：后台只需填写节点名称，即可生成一次性安装命令
- **轻量易维护**：单文件 Go Agent、自动数据库迁移、数据定期清理

> Braum 将控制面放在 Cloudflare 上，无需再准备一台 VPS 托管管理后台。轻量规模通常可以使用 Cloudflare 免费额度；被监控 VPS 的费用及超出免费额度后的 Cloudflare 用量不包含在内。

## 🚀 特性一览

- 🖥️ **VPS 资源监控** — CPU、内存、Swap、磁盘、负载、流量、连接数，Agent 默认每 60 秒主动上报
- 🔍 **节点本地探测** — HTTP/DNS 任务由 VPS Agent 就近执行，真实反映各地网络质量
- 🔐 **安全注册** — 一次性安装令牌 15 分钟有效；D1 仅存密钥摘要，Agent 密钥保存在 VPS 的 `0600` 配置文件中
- 📊 **状态总览** — 在线状态、资源趋势、延迟趋势、可用率指标
- 🔔 **智能告警** — CPU/内存/磁盘/负载/心跳/延迟/可用率/连续失败，Telegram + Webhook 通知
- 📢 **故障公告** — 维护计划、事件时间线、公开状态页
- 👥 **权限审计** — Owner/Admin/Viewer 三级权限，敏感字段自动脱敏
- 🎨 **四套主题** — 默认 / 樱の物语 / 星海夜航 / 翠灵庭院，独立 Dark 模式开关
- ☁️ **Cloudflare 原生** — Workers + D1 + KV + Pages，无需自管控制面服务器，全球边缘加速

## 📸 截图

| 前端首页 | 管理后台 |
|:---:|:---:|
| ![](docs/screenshots/dashboard.png) | ![](docs/screenshots/admin-dashboard.png) |

## 🏗️ 架构

```text
                        ┌──────────────────────────┐
 浏览器 ── Pages ──────▶│ Cloudflare Worker / Hono │
                        │ 鉴权 · 配置 · 告警 · API │
                        └────────────┬─────────────┘
                                     │
                              ┌──────┴──────┐
                              │ D1      KV  │
                              └─────────────┘
                                     ▲
             HTTPS 主动上报/配置下发 │
            ┌────────────────────────┼──────────────────────┐
      ┌─────┴─────┐            ┌─────┴─────┐          ┌─────┴─────┐
      │ VPS Agent │            │ VPS Agent │          │ VPS Agent │
      │ 东京      │            │ 法兰克福  │          │ 洛杉矶    │
      └─────┬─────┘            └─────┬─────┘          └─────┬─────┘
            └──────── HTTP / DNS 节点本地探测 ──────────────┘
```

- **控制面**（Cloudflare）：无需服务器，Workers 处理 API、D1 存数据、KV 做缓存、Pages 托管前端
- **Agent**（VPS 上）：Go 编写的轻量常驻进程，仅出站 HTTPS，不开入站端口

## 🚀 快速开始

> **你需要**：一个 Cloudflare 账号 + 一台被监控的 VPS。不需要域名，Cloudflare 会提供 `workers.dev` 和 `pages.dev` 地址；轻量使用可以从免费额度开始。

### 第一步：Fork 仓库

打开本仓库 → 右上角 **Fork** → **Create fork**

### 第二步：发布 Agent

Fork 仓库 → **Actions** → 启用工作流 → 左侧 **Agent Release** → **Run workflow** → 等变绿

### 第三步：创建 D1 和 KV

Cloudflare 控制台分别创建：

| 资源 | 路径 | 名称 | 需要复制 |
|------|------|------|----------|
| D1 数据库 | Storage & Databases → D1 → Create | `braum-production` | Database ID |
| KV 命名空间 | Storage & Databases → KV → Create | `braum-cache` | Namespace ID |

### 第四步：编辑配置

GitHub 打开 `apps/api/wrangler.toml` → 点铅笔 ✏️ → 改三处：

```toml
AGENT_RELEASE_BASE_URL = "https://github.com/你的用户名/braum-probe/releases/latest/download"
database_id = "第三步的 D1 ID"
id = "第三步的 KV ID"
```

点 **Commit changes** 保存。

### 第五步：部署 API（Worker）

Workers & Pages → Create → Import from Git → 选你 Fork 的仓库，填写：

| 配置项 | 值 |
|------|-----|
| Project name | `braum-worker` |
| Build command | `pnpm --filter @braum/shared build` |
| Deploy command | `pnpm --filter @braum/api deploy:full` |
| Node version | `22.12.0` 或更新的 22.x |

点 **Save and Deploy**，部署成功后复制 Worker 地址（如 `https://braum-worker.xxx.workers.dev`）。

然后进入 Worker **Settings → Variables and Secrets**，添加 4 个 Secret：

| 变量 | 值 |
|------|-----|
| `JWT_SECRET` | 随机长字符串 |
| `JWT_REFRESH_SECRET` | 另一个随机长字符串 |
| `ENCRYPTION_KEY` | 再一个随机长字符串 |
| `ADMIN_INITIAL_PASSWORD` | 你自己设的登录密码 |

保存后再 Deploy 一次 ☕

### 第六步：部署前端（Pages）

Workers & Pages → Create → Pages → Connect to Git → 选你 Fork 的仓库，填写：

| 配置项 | 值 |
|------|-----|
| Project name | `braum-web` |
| Build command | `pnpm --filter @braum/shared build && pnpm --filter @braum/web build` |
| Build output directory | `apps/web/dist` |

Environment variables 添加：

| 变量 | 值 |
|------|-----|
| `PUBLIC_API_URL` | `https://braum-worker.xxx.workers.dev`（第五步的地址） |

点 **Save and Deploy** ☕

### 第七步：回填地址

回 GitHub 再编辑 `apps/api/wrangler.toml`，把 Cloudflare 实际生成的两个地址粘贴到引号内。下面的域名只是格式示例，请勿照抄：

```toml
CORS_ORIGINS = "https://your-project.pages.dev"
AGENT_API_URL = "https://your-worker.your-subdomain.workers.dev"
```

Commit 后自动重新部署。

### 第八步：登录 + 安装 VPS

1. 打开第六步复制的 Pages 地址，在末尾加上 `/admin`
2. 邮箱 `admin@braum.local`，密码填第五步设的 `ADMIN_INITIAL_PASSWORD`
3. 「VPS 节点」→ 添加（只需填名称）→ 复制安装命令
4. SSH 到 VPS 执行，等 1 分钟节点上线 ✅

> 📖 详细图文见 [小白部署指南](docs/小白部署指南.md) · 命令行部署见 [部署运维文档](docs/部署运维文档.md)

### 本地开发

```bash
git clone https://github.com/你的用户名/braum-probe.git && cd braum-probe
pnpm install && cp .env.example .env
pnpm dev
```

`.env.example` 提供可直接运行的本地默认值；需要自定义时直接编辑生成的 `.env`。上面的复制命令只需在首次安装时执行，已有 `.env` 时不要重复执行，以免覆盖自己的配置。`pnpm dev` 会自动执行本地 D1 migration，不需要单独运行数据库命令。

- 前端：`http://localhost:4321`
- 管理后台：`http://localhost:4321/admin`（邮箱 `admin@braum.local`，密码为 `.env` 中的 `ADMIN_INITIAL_PASSWORD`）
- API：`http://localhost:8787`

### 添加第一台 VPS

1. 登录 `/admin` → 「VPS 节点」→ 点击「添加节点」
2. 只需填写名称，系统自动生成一次性安装命令
3. 在目标 VPS 上执行安装命令（自动识别架构、校验 SHA-256、创建沙箱服务）
4. 等待 ~1 分钟，节点自动上线

## 📦 项目结构

```
apps/
├── api/          # Cloudflare Worker / Hono 控制面
│   └── migrations/ # D1 数据库迁移脚本
├── agent/        # Go VPS Agent（轻量常驻进程）
└── web/          # Astro + React 状态页与管理后台
packages/
└── shared/       # TypeScript 跨层共享类型
docs/             # 架构、部署、交互与数据库文档
```

## 🔒 安全

- **RBAC 权限**：Owner / Admin / Viewer，每次请求从 D1 读取角色状态
- **Agent 密钥**：D1 仅存 SHA-256 摘要；密钥只返回一次，并以 `0600` 权限保存在 VPS 配置文件中
- **通知加密**：渠道配置 AES-GCM 加密，审计日志递归脱敏
- **SSRF 防护**：HTTP 目标保存前执行私网/回环地址检查
- **建议**：管理后台额外使用 Cloudflare Access 保护

## 📖 文档

| 文档 | 说明 |
|:---|:---|
| [部署指南](docs/部署运维文档.md) | 生产环境部署全流程 |
| [架构设计](docs/架构设计文档.md) | 系统架构与 ADR |
| [数据库设计](docs/数据库设计文档.md) | D1 Schema 与迁移 |
| [前端功能](docs/前端功能和交互设计文档.md) | 状态页功能与交互 |
| [管理后台](docs/管理后台功能和设计文档.md) | 后台功能与设计 |
| [UI 规范](docs/UI视觉与交互规范文档.md) | 主题系统与组件规范 |
| [环境变量](docs/环境变量与配置指南.md) | 配置项说明 |

## 🧪 质量

```bash
pnpm test        # TypeScript / Workers 测试 + Go Agent 测试
pnpm typecheck   # TypeScript 类型检查
pnpm lint        # ESLint + go vet
pnpm build       # 全量构建
```

## 🤝 参与贡献

欢迎 Issue 和 Pull Request！在提交 PR 前请确保：

- `pnpm test` 全部通过
- 新功能附带对应测试用例（项目遵循 TDD）
- 代码风格与现有项目一致

## 📄 协议

[MIT](LICENSE) — 自由使用、修改和分发。

## ⭐ Star History

如果你喜欢这个项目，请给一个 Star 支持！

---

<p align="center">
  <sub>Built with ❤️ on Cloudflare Workers</sub>
</p>

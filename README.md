<p align="center">
  <img src="apps/web/public/logo-icon.svg" width="80" alt="Braum" />
</p>

<h1 align="center">Braum 布隆探针</h1>

<p align="center">
  <strong>Cloudflare 原生 · 零服务器成本 · 全球 VPS 监控与网络探测平台</strong>
</p>

<p align="center">
  <a href="#-快速开始">快速开始</a> •
  <a href="https://github.com/your-org/braum-probe/wiki">文档</a> •
  <a href="#-截图预览">截图</a> •
  <a href="#-对比">对比</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Agent-Go-00ADD8?logo=go&logoColor=white" alt="Go Agent" />
  <img src="https://img.shields.io/badge/Frontend-Astro-BC52EE?logo=astro&logoColor=white" alt="Astro" />
  <img src="https://img.shields.io/badge/Database-D1-0052CC?logo=sqlite&logoColor=white" alt="D1" />
  <img src="https://img.shields.io/badge/Test-162%20passed-brightgreen?logo=vitest&logoColor=white" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" />
</p>

<p align="center">
  <img src="docs/screenshots/dashboard.png" width="700" alt="Braum Dashboard" />
</p>

## ✨ 为什么选择 Braum？

| 特性 | Braum | 哪吒探针 | Komari | Uptime Kuma |
|:---|:---:|:---:|:---:|:---:|
| **控制面需要服务器** | ❌ 不需要 | ✅ 需要 | ✅ 需要 | ✅ 需要 |
| **部署成本** | $0 (CF 免费版) | VPS 费用 | VPS 费用 | VPS 费用 |
| **边缘计算** | ✅ Cloudflare 全球节点 | ❌ 单点 | ❌ 单点 | ❌ 单点 |
| **Agent 入站端口** | 0 个（Agent 主动外连） | 需要 | 需要 | 不需要 |
| **HTTP/DNS 本地探测** | ✅ 由 VPS Agent 执行 | ❌ 控制面发起 | ❌ 控制面发起 | ✅ 控制面发起 |
| **告警通知** | ✅ Telegram + Webhook | ✅ 多渠道 | ✅ 邮件/Webhook | ✅ 90+ 渠道 |
| **主题系统** | 4 套 + Dark 模式 | 社区主题 | 可自定义 | 默认主题 |
| **管理后台** | ✅ 内置 RBAC | ✅ 内置 | ✅ 内置 | ✅ 内置 |
| **数据保留** | D1 自动清理 | 手动管理 | 手动管理 | SQLite |

> **核心差异**：其他探针都需要一台 VPS 运行控制面。Braum 的控制面完全运行在 Cloudflare 边缘网络上——D1 数据库、KV 缓存、Workers API、Pages 前端——全部免费。你只需要为被监控的 VPS 安装 Agent。

## 🚀 特性一览

- 🖥️ **VPS 资源监控** — CPU、内存、Swap、磁盘、负载、流量、连接数，Agent 每秒主动上报
- 🔍 **节点本地探测** — HTTP/DNS 任务由 VPS Agent 就近执行，真实反映各地网络质量
- 🔐 **安全注册** — 一次性 15 分钟安装令牌，D1 只存 SHA-256 摘要，密钥永不落盘
- 📊 **状态总览** — 在线状态、资源趋势、延迟热力图、可用率指标
- 🔔 **智能告警** — CPU/内存/磁盘/负载/心跳/延迟/可用率/连续失败，Telegram + Webhook 通知
- 📢 **故障公告** — 维护计划、事件时间线、公开状态页
- 👥 **权限审计** — Owner/Admin/Viewer 三级权限，敏感字段自动脱敏
- 🎨 **四套主题** — 默认 / 樱の物语 / 星海夜航 / 翠灵庭院，独立 Dark 模式开关
- ☁️ **Cloudflare 原生** — Workers + D1 + KV + Pages，零服务器运维，全球边缘加速

## 📸 截图

| 状态页 | 管理后台 |
|:---:|:---:|
| [![Dashboard](docs/screenshots/dashboard.png)](docs/screenshots/dashboard.png) | [![Admin](docs/screenshots/admin-dashboard.png)](docs/screenshots/admin-dashboard.png) |

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

> **你需要**：一个 Cloudflare 账号（免费）+ 一台 VPS。不需要域名，Cloudflare 会给你免费的 `workers.dev` 和 `pages.dev` 地址。

### 第一步：Fork 仓库

打开本仓库 → 右上角 **Fork** → **Create fork**

### 第二步：发布 Agent

Fork 仓库 → **Actions** → 启用工作流 → 左侧 **Agent Release** → **Run workflow** → 等变绿

### 第三步：创建 D1 数据库

Cloudflare 控制台 → **Storage & Databases → D1** → **Create database**
- 名称：`braum-production`
- 复制 **Database ID**

### 第四步：创建 KV

Cloudflare 控制台 → **Storage & Databases → KV** → **Create namespace**
- 名称：`braum-cache`
- 复制 **Namespace ID**

### 第五步：编辑配置

在 GitHub 打开 `apps/api/wrangler.toml` → 点铅笔 ✏️ → 改三处：

```toml
# 改成你的 GitHub 用户名
AGENT_RELEASE_BASE_URL = "https://github.com/你的用户名/braum-probe/releases/latest/download"

# 粘贴 D1 Database ID
database_id = "xxxx-xxxx-xxxx"

# 粘贴 KV Namespace ID
id = "xxxx-xxxx-xxxx"
```

点 **Commit changes** 保存。

### 第六步：部署 Worker（API）

Cloudflare → **Workers & Pages** → **Create** → **Import from Git** → 选你的 Fork 仓库

| 设置 | 值 |
|------|-----|
| Project name | `braum-worker` |
| Build command | `pnpm --filter @braum/shared build` |
| Deploy command | `pnpm --filter @braum/shared build && pnpm --filter @braum/api deploy:full` |
| Node version | `22` |

部署成功后复制 Worker 地址（如 `https://braum-worker.xxx.workers.dev`）。

进入 Worker **Settings → Variables and Secrets**，添加 4 个 **Secret**：

| 名称 | 值 |
|------|-----|
| `JWT_SECRET` | 随机长字符串 |
| `JWT_REFRESH_SECRET` | 另一个随机长字符串 |
| `ENCRYPTION_KEY` | 再一个随机长字符串 |
| `ADMIN_INITIAL_PASSWORD` | 你自己设的登录密码 |

保存后重新 **Deploy** 一次。

### 第七步：部署 Pages（前端）

Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**

| 设置 | 值 |
|------|-----|
| Project name | `braum-web` |
| Build command | `pnpm --filter @braum/shared build && pnpm --filter @braum/web build` |
| Build output | `apps/web/dist` |

Pages **Settings → Variables and Secrets** 添加：

| 名称 | 值 |
|------|-----|
| `PUBLIC_API_URL` | 第六步的 Worker 地址 |

重新部署。最后回 GitHub 再编辑一次 `wrangler.toml`，补上：

```toml
CORS_ORIGINS = "https://braum-web.你的账号.pages.dev"
AGENT_API_URL = "https://braum-worker.你的账号.workers.dev"
```

### 第八步：登录 + 安装 VPS

1. 打开 `https://braum-web.你的账号.pages.dev/admin`
2. 邮箱：`admin@braum.local`，密码：你第六步设的密码
3. 「VPS 节点」→ 添加（只需填名称）→ 复制安装命令
4. SSH 到 VPS 执行那条命令
5. 等 1 分钟，节点上线 ✅

<details>
<summary>📺 部署后你会得到什么？</summary>

| 地址 | 用途 |
|------|------|
| `https://braum-web.xxx.pages.dev` | 公开状态页 |
| `https://braum-web.xxx.pages.dev/admin` | 管理后台 |
| `https://braum-worker.xxx.workers.dev/health` | API 健康检查 |

</details>

> 📖 完整图文教程见 [小白部署指南](docs/小白部署指南.md) · 命令行部署见 [部署运维文档](docs/部署运维文档.md)

### 本地开发

```bash
git clone https://github.com/your-org/braum-probe.git && cd braum-probe
pnpm install && cp .env.example .env
pnpm db:migrate && pnpm db:seed
pnpm dev
```

- 前端：`http://localhost:4321`
- 管理后台：`http://localhost:4321/admin`（`admin@braum.local` / `admin123`）
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
├── agent/        # Go VPS Agent（轻量常驻进程）
└── web/          # Astro + React 状态页与管理后台
packages/
└── shared/       # TypeScript 跨层共享类型
docs/             # 架构、部署、交互与数据库文档
migrations/       # D1 数据库迁移脚本
```

## 🔒 安全

- **RBAC 权限**：Owner / Admin / Viewer，每次请求从 D1 读取角色状态
- **Agent 密钥**：D1 仅存 SHA-256 摘要，密钥只返回一次
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
pnpm test        # Vitest 107 个用例 + Go Agent 测试
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

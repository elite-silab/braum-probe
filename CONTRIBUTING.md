# Contributing to Braum

感谢你对 Braum 探针项目的关注！我们欢迎各种形式的贡献。

## 如何贡献

### 🐛 报告 Bug

- 使用 [GitHub Issues](../../issues) 提交 Bug 报告
- 描述复现步骤、预期行为和实际行为
- 附上环境信息（系统版本、Node.js 版本、Wrangler 版本）

### 💡 功能建议

- 先在 Issues 中搜索是否已有类似建议
- 如果没有，创建 Feature Request 并描述使用场景

### 🔧 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 编写代码和测试（项目遵循 TDD）
4. 确保所有测试通过：
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```
5. 提交代码：`git commit -m "feat: add my feature"`
6. 推送并创建 Pull Request

### Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
feat: 新功能
fix: 修复 Bug
docs: 文档更新
style: 代码风格
refactor: 重构
test: 测试相关
chore: 构建/工具链
```

### 代码规范

- **TypeScript**：严格模式，ESLint + Prettier
- **Go**：`go vet` + `go fmt`
- **测试**：项目遵循 TDD，新功能必须附带测试用例
- **文档**：修改公共 API 时同步更新文档

## 项目结构

```
apps/
├── api/          # Hono API、Cron 与 D1 migrations
├── agent/        # VPS Agent（Go）
└── web/          # Next.js App Router 前端
packages/
└── shared/       # 跨层共享类型
worker.ts         # 单 Cloudflare Worker 入口
wrangler.jsonc    # 单 Worker 配置
```

## 开发环境

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入本地配置

# 自动初始化数据库并启动完整的 Next.js + Hono 开发服务器
pnpm dev
```

## 许可证

贡献的代码将遵循项目的 [MIT 许可证](LICENSE)。

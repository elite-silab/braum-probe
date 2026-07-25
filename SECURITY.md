# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |

## Reporting a Vulnerability

如果你发现了安全漏洞，**请勿在公开 Issue 中报告**。

请通过以下方式私密联系维护者：

- 使用 GitHub 的 [Security Advisories](../../security/advisories) 功能
- 发送邮件至项目维护者

我们会在 48 小时内确认收到，并在评估后尽快修复。

## 安全最佳实践

- 生产环境务必修改 `.env` 中的默认密钥
- 管理后台建议启用 Cloudflare Access 保护
- 定期更新 Wrangler 和依赖包版本
- Agent 安装令牌仅 15 分钟有效，过期后需重新生成

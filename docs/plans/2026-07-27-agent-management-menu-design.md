# Braum Agent 数字菜单设计

## 目标

让 Linux VPS 用户只需记住 `sudo braum-agentctl`，即可完成 Agent 的日常查看与维护，不再要求小白记忆多条 systemd、journalctl 和文件删除命令。

## 方案

Worker 公开提供 `GET /api/agent/v1/manage.sh`。新节点安装时，安装器自动下载、执行 Bash 语法检查并将脚本安装到 `/usr/local/bin/braum-agentctl`；已有节点可通过同一接口一键补装，无需重新注册。

菜单提供服务状态、实时与最近日志、版本及脱敏配置摘要、启动、重启、停止、在线更新、卸载和退出。在线更新识别 linux/amd64 与 linux/arm64，从配置的 Release 地址下载二进制和 SHA-256 文件，校验后原子替换并重启；若启动失败，则恢复原二进制。配置文件和节点密钥不参与替换。

## 安全边界

- 生产下载只接受 HTTPS 并要求 TLS 1.2；HTTP 仅放行 localhost 开发地址。
- 管理脚本不启用 Shell 调试，不打印 `agent_secret` 或注册令牌。
- 配置摘要只报告凭据是否存在、文件权限和非敏感字段。
- 卸载必须输入完整的 `YES`，并明确后台节点与历史数据不会自动删除。
- 脚本需要 root 权限，Agent 服务本身仍以无登录低权限用户运行。

## 验证

- 对安装脚本与管理脚本执行 `bash -n`。
- 测试菜单项、管理脚本路由、TLS、SHA-256、回滚标记、密钥隐藏和发布地址转义。
- 运行 API 全量测试、TypeScript 类型检查、ESLint、Go 测试与静态检查。

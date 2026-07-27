# Braum Agent v0.1.2

这是一个兼容现有节点配置的修订版本，重点修复在线更新反馈和 systemd 安全配置同步问题。

## 更新内容

- 修复在线更新后新版本显示为“未知版本”的问题。
- 管理菜单统一使用 `0. 退出`，输入提示与选项范围保持一致。
- 在线更新时同步最新版 systemd 安全配置，确保启用 `NoNewPrivileges` 等沙箱限制。
- 更新失败时同时回滚 Agent 程序和 systemd 服务配置。
- 保留节点 ID、长期密钥、采集间隔和历史数据。
- 继续发布 linux/amd64、linux/arm64 二进制文件及对应 SHA256 校验文件。

## 升级方法

在 VPS 执行 `sudo braum-agentctl`，选择「8. 在线更新 Agent」。完成后再次打开菜单，选择「4. 查看版本与安全配置」，应看到：

```text
braum-agent 0.1.2
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
```

如果当前菜单仍显示 `10. 退出`，完成本次在线更新后管理脚本会自动刷新；重新运行 `sudo braum-agentctl` 即可看到 `0. 退出`。

完整使用方法见 [Agent 使用指南](https://github.com/elite-silab/braum-probe/blob/main/docs/Agent使用指南.md)。

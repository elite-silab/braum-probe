# Braum Agent v0.1.1

这是采用独立 `agent-v*` 版本序列后的首个 Agent 更新，兼容现有节点配置和 Workers API。

## 更新内容

- 上报 CPU、内存、磁盘、系统负载、进程数、TCP 连接数与运行时间。
- 上报累计上传/下载流量，并支持前台计算实时网络速率。
- 注册时自动采集主机名、发行版、内核、架构、处理器与虚拟化信息。
- 增加 WebSocket 实时控制通道，配置变化后可以立即唤醒状态与探测上报。
- 提供数字菜单式管理脚本，简化状态查看、升级、重启、日志和卸载操作。
- 发布 linux/amd64、linux/arm64 二进制文件及对应 SHA256 校验文件。

## 安装与升级

新节点直接使用管理后台生成的安装命令。现有节点可以运行 `sudo braum-agentctl` 并选择「8. 在线更新 Agent」；升级后通过 `/usr/local/bin/braum-agent --version` 可确认版本为 `0.1.1`。

完整使用方法见 [Agent 使用指南](https://github.com/elite-silab/braum-probe/blob/main/docs/Agent使用指南.md)。

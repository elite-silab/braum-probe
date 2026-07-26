# Braum Agent 使用与维护指南

> 版本：v1.0 · 更新：2026-07-27 · 适用：Linux amd64 / arm64

Braum Agent 安装在被监控的 VPS 上，负责采集服务器资源，并从 VPS 本地执行 HTTP/DNS 探测。Agent 只主动访问 Braum Worker，不监听公网端口，也不提供远程终端。

## 1. 使用前准备

开始前只需确认：

- Braum Worker 已部署并能打开管理后台；
- VPS 使用 Linux 和 systemd；
- VPS 架构为 amd64（x86_64）或 arm64（aarch64）；
- VPS 可以通过 HTTPS 访问 Worker 和 GitHub Release；
- 当前账号可以使用 `sudo`，或已经是 root。

安装脚本会自动识别架构、下载对应二进制、校验 SHA-256，创建低权限的 `braum-agent` 系统用户，并安装数字菜单管理工具 `braum-agentctl`。

## 2. 安装第一台 VPS

普通用户不需要自己拼接参数，也不要复制文档中的示例 Token。

1. 登录 Braum 管理后台。
2. 打开「VPS 节点」，点击「添加节点」。
3. 填写节点名称并保存；地区、系统、架构和 ISP 会在 Agent 注册时自动识别。
4. 点击「生成安装命令」。
5. 复制后台生成的完整命令，在目标 VPS 中执行。
6. 等待约一分钟，后台节点应显示为在线并出现资源数据。

安装命令中的注册令牌 15 分钟后过期，并且只能成功使用一次。命令包含短期凭据，不要发到群聊、工单、公开日志或代码仓库。

看到下面的输出表示安装程序已经完成：

```text
Braum Agent installed and started. Manage it with: sudo braum-agentctl
```

## 3. 使用数字菜单管理 Agent

安装完成后，只需要记住一个命令：

```bash
sudo braum-agentctl
```

输入菜单前面的数字即可执行操作：

```text
1. 查看服务状态
2. 查看实时日志
3. 查看最近日志
4. 查看版本与安全配置
5. 启动 Agent
6. 重启 Agent
7. 停止 Agent
8. 在线更新 Agent
9. 卸载 Agent
0. 退出
```

「版本与安全配置」只展示 Worker 地址、节点 ID、采集间隔、文件权限和凭据是否存在，不显示 `agent_secret` 或注册令牌。「卸载 Agent」必须再次输入 `YES`，避免误操作。

### 给已经安装 Agent 的旧节点补装菜单

新安装的节点会自动拥有管理菜单。旧节点不必重新注册，也不会轮换节点密钥；只需把下面地址换成自己的 Worker 地址后执行一次：

```bash
curl --proto '=https' --tlsv1.2 -fsSL 'https://你的Worker地址/api/agent/v1/manage.sh' | sudo bash
```

看到 `管理脚本已安装：sudo braum-agentctl` 后，即可使用数字菜单。

## 4. 确认运行状态

优先查看管理后台。节点显示在线、最近心跳持续更新并出现 CPU/内存数据，即代表完整上报链路正常。

需要在 VPS 排查时，运行 `sudo braum-agentctl`，选择「1. 查看服务状态」或「3. 查看最近日志」。选择「2. 查看实时日志」后，按 `Ctrl+C` 返回菜单。

下面的原生命令仅供熟悉 systemd 的开发者排障，普通用户不需要记忆：

```bash
sudo systemctl status braum-agent --no-pager
sudo journalctl -u braum-agent -n 50 --no-pager
/usr/local/bin/braum-agent --version
```

实时观察日志：

```bash
sudo journalctl -u braum-agent -f
```

正常运行时服务状态为 `active (running)`。Agent 默认至少每 60 秒上报一次，失败后会自动退避重试，网络恢复后无需手动重启。

## 5. Agent 会上报什么

Agent 上报：

- hostname、Linux 发行版、内核、CPU 架构和 Agent 版本；
- CPU、内存、Swap、磁盘和系统负载；
- 网络收发累计字节、TCP 连接数、进程数和运行时间；
- 后台分配给该节点的 HTTP/DNS 探测结果。

公网位置和 ISP 由 Agent 请求 Worker 时的 Cloudflare 网络信息识别。私网 IP 仅用于后台资产信息，不通过公共节点 API 返回。

Agent 不会上报文件内容、Shell 历史、环境变量、密码或 SSH 密钥。

管理页面会把累计收发字节展示为本次开机以来的下载、上传和总流量，并根据相邻两次采集的差值计算上下行速率。VPS 重启后 Linux 网络计数器和运行时间会重新从零开始，这不是数据丢失。

## 6. 添加 HTTP/DNS 探测

服务器资源监控安装后立即生效，网络探测是可选功能。节点在线但「探测历史」为空，通常只是尚未分配目标。

1. 在后台打开「监控目标」。
2. 添加 HTTP URL 或 DNS 域名。
3. 编辑 VPS 节点，将目标关联到该节点。
4. 等待下一次心跳和探测周期。

暂停节点后，Agent 仍会上报资源与心跳，但 Worker 不再向它下发探测目标。

## 7. 文件与服务位置

| 内容 | 位置 |
|---|---|
| Agent 程序 | `/usr/local/bin/braum-agent` |
| 数字菜单 | `/usr/local/bin/braum-agentctl` |
| 配置文件 | `/etc/braum-agent/config.json` |
| systemd 服务 | `/etc/systemd/system/braum-agent.service` |
| 运行用户 | `braum-agent` |
| 运行日志 | systemd journal |

配置文件权限为 `0600`，目录权限为 `0700`。注册成功后，一次性令牌会从配置中删除，替换为该节点独立的长期密钥：

```json
{
  "server": "https://braum-probe.你的Workers子域.workers.dev",
  "node_id": "节点ID",
  "agent_secret": "请勿复制或公开",
  "interval": 60
}
```

不要把一台 VPS 的配置复制到另一台，也不要手动修改 `node_id` 或 `agent_secret`。后台设置的采集周期最小为 60 秒。

## 8. 在线更新或重新安装

日常升级优先运行 `sudo braum-agentctl`，选择「8. 在线更新 Agent」。管理脚本会：

1. 自动识别 amd64 或 arm64；
2. 通过 HTTPS 下载最新版 Agent 和 `.sha256`；
3. 校验成功后原子替换程序并重启服务；
4. 启动失败时自动恢复旧版本；
5. 同步最新版管理脚本。

在线更新不会修改 `/etc/braum-agent/config.json`，因此节点 ID 和长期密钥都会保留，不需要在后台重新生成安装命令。

只有长期密钥需要轮换、配置损坏或 Agent 无法正常注册时，才需要从后台重新安装，步骤与首次安装一致：

1. 先确认 GitHub Release 中已经发布所需版本的 amd64/arm64 文件及 `.sha256`。
2. 在节点管理中重新生成安装命令。
3. 在原 VPS 执行新命令。
4. 安装脚本会校验并替换二进制、重写 systemd 服务、重启 Agent，然后重新注册。
5. 使用 `braum-agent --version` 和后台 Agent 版本确认升级结果。

重新注册成功后，节点长期密钥会自动轮换，旧 Agent 凭据立即失效。新命令生成后，旧 Agent 在新注册成功前仍可继续运行。

如果安装命令已经超过 15 分钟或曾经成功使用，请回到后台重新生成，不要反复执行旧命令。

## 9. 暂停、吊销、卸载和删除

这些操作含义不同：

| 操作 | 结果 |
|---|---|
| 暂停节点 | 保留 Agent 心跳与资源上报，停止下发探测目标 |
| 吊销凭据 | 当前 Agent 立即失去上报权限，节点变为离线 |
| 卸载 Agent | 删除 VPS 上的程序和配置，不删除后台节点 |
| 删除节点 | 删除后台节点以及关联的 Agent、指标和探测数据 |

在 VPS 运行 `sudo braum-agentctl`，选择「9. 卸载 Agent」，阅读提示后输入 `YES`。菜单会停止服务并删除 Agent 程序、管理脚本、配置和系统用户。

卸载后，再按需要在管理后台吊销凭据或删除节点。

## 10. 常见问题

### 下载失败或提示 404

确认 GitHub 仓库为公开状态，Release 已包含当前架构的二进制和同名 `.sha256`，并检查 `wrangler.jsonc` 中的 `AGENT_RELEASE_BASE_URL`。

### 提示 `Unsupported architecture`

当前只发布 Linux amd64 和 arm64。执行 `uname -m` 查看 VPS 架构；其他架构需要自行编译并扩展发布流程。

### 注册返回 401

注册令牌可能已过期、已使用，或后台又生成了新令牌。回到节点页面重新生成安装命令。

### 心跳返回 401

节点长期密钥可能已经吊销或被重装流程轮换。为该节点重新生成安装命令并重新安装。

### 服务启动失败

先运行 `sudo braum-agentctl`，选择「1. 查看服务状态」和「3. 查看最近日志」。开发者也可以直接查看：

```bash
sudo systemctl status braum-agent --no-pager
sudo journalctl -u braum-agent -n 100 --no-pager
```

重点检查 VPS 能否解析并访问 Worker、系统时间是否准确，以及 `/etc/braum-agent/config.json` 是否存在且归 `braum-agent` 用户所有。

### 节点在线但没有探测结果

资源上报和目标探测是两套数据。确认已创建启用的 HTTP/DNS 目标，并将目标关联到该节点。

### 节点经常离线

确认 VPS 的出站 TCP 443、DNS 和系统时间正常。Agent 会自动重试；持续失败时从日志中查找 `heartbeat failed` 后面的 HTTP 状态或网络错误。

### 提示 `braum-agentctl: command not found`

这是升级前安装的旧节点。按照「给已经安装 Agent 的旧节点补装菜单」执行一次补装命令，不需要重新添加节点或重新注册。

### 在线更新失败

管理脚本会在下载、SHA-256 校验或新版本启动失败时保留或恢复原 Agent。选择「3. 查看最近日志」确认原因，并检查 VPS 能否通过 HTTPS 访问 Worker 和 GitHub Release。

### 自动识别的位置不准确

位置来自 Cloudflare 看到的出口网络，代理或特殊路由可能影响结果。可以在后台节点的高级设置中手动修正。

## 11. 安全注意事项

- 所有生产通信必须使用 HTTPS；只有本地开发允许 localhost HTTP。
- 不公开安装命令、注册令牌或 `/etc/braum-agent/config.json`。
- 安装命令泄漏但尚未使用时，立即在后台生成新命令，旧令牌会失效。
- 长期密钥可能泄漏时，立即在后台吊销凭据并重新安装。
- D1 只保存注册令牌和长期密钥的 SHA-256 摘要，不能反推出明文。
- Agent 使用无登录 Shell 的低权限用户运行，并启用 systemd 沙箱限制。
- 在线更新强制校验 TLS 和 SHA-256，失败时不会继续替换；配置摘要永不显示节点密钥。
- Agent 不开放入站端口；防火墙只需允许必要的出站 HTTPS 和 DNS。

## 12. 开发与发布

开发者可以在仓库中测试和构建：

```bash
cd apps/agent
go test ./...
go vet ./...
go build ./cmd/braum-agent
```

正式版本由 GitHub Actions 的 `Agent Release` 工作流构建。它会对 linux/amd64 和 linux/arm64 分别运行测试、静态编译，并发布二进制与 SHA-256 文件。

Agent 使用以下同源接口：

| 接口 | 作用 | 凭据 |
|---|---|---|
| `GET /api/agent/v1/install.sh` | 获取安装脚本 | 无 |
| `GET /api/agent/v1/manage.sh` | 获取数字菜单管理脚本 | 无 |
| `POST /api/agent/v1/enroll` | 一次性注册 | 注册令牌 |
| `POST /api/agent/v1/heartbeat` | 上报系统与资源、获取目标 | 节点长期密钥 |
| `POST /api/agent/v1/probe-results` | 上报 HTTP/DNS 结果 | 节点长期密钥 |

远程终端不属于当前 Agent 协议，也不会复用永久心跳密钥实现。

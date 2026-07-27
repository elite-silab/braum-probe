# ADR-0002：使用 Durable Object 承载 WebSocket 实时控制通道

## 状态

已接受（2026-07-27）

## 背景

Braum 的 HTTPS 心跳适合可靠上报资源指标，但控制面无法立即通知 Agent 配置已变化，公开状态页也只能轮询。项目需要实时能力，同时必须保持单 Worker、无需 VPS 入站端口、配置简单，并避免把远程终端的高风险能力混入普通心跳协议。

## 决策

- 使用同一 Worker 绑定的单个 `RealtimeHub` Durable Object 管理 WebSocket 连接。
- HTTPS 继续承载注册、心跳、指标和探测结果；WebSocket 只承载事件与控制信号。
- Agent 使用现有节点凭据在 Worker 边缘完成握手鉴权，Durable Object 仅接收已经验证的节点 ID。
- 浏览器只接收连接状态和数据变化事件，收到事件后通过公开 API 获取最新数据。
- 保留定时心跳和前端轮询作为 WebSocket 故障时的降级路径。
- 远程终端保持关闭，后续使用独立会话协议和安全评审。

## 后果

### 正面

- 配置变更可以立即唤醒 Agent，不必等待下一次心跳。
- 状态页可以在指标到达后立即刷新。
- VPS 仍然只需要出站 TCP 443，不开放任何入站端口。
- Durable Object WebSocket 休眠降低空闲连接成本。
- WebSocket 故障不会中断基础监控。

### 负面

- Agent 增加 WebSocket 依赖、保活和重连状态机。
- 部署配置增加 Durable Object 绑定和迁移。
- 单个 Hub 是轻量部署下的集中点，未来连接规模显著增长时需要按租户或节点分片。

### 中性

- D1 和 KV 的职责不变，Durable Object 不持久化监控数据。
- 旧版 Agent 仍可仅使用 HTTPS 工作，但没有实时控制能力。

## 备选方案

**缩短 HTTP 轮询间隔**

实现简单，但会持续增加 Worker、D1 和 VPS 请求量，仍不能提供真正的双向通道。

**每个节点一个 Durable Object**

隔离性更好，但公开状态页需要连接或查询大量对象，不适合当前轻量项目。

**独立 WebSocket 服务**

长连接能力灵活，但引入第二个服务和额外运维，与单 Worker 目标冲突。

## 参考

- `docs/plans/2026-07-27-websocket-realtime-control-design.md`
- `docs/adr/0001-workers-control-plane-vps-agent.md`

-- Braum 布隆 CF 探针 — VPS Agent 与资源指标
-- Migration: 0005_init_agents

-- 一次性注册令牌。数据库只保存 SHA-256 摘要；成功注册后 used_at 立即写入。
CREATE TABLE IF NOT EXISTS agent_enrollment_tokens (
  id         TEXT PRIMARY KEY,
  node_id    TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_enrollment_node
  ON agent_enrollment_tokens(node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_enrollment_expiry
  ON agent_enrollment_tokens(expires_at);

-- 节点长期密钥。明文只在注册成功时返回一次。
CREATE TABLE IF NOT EXISTS agent_credentials (
  node_id      TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  secret_hash  TEXT NOT NULL UNIQUE,
  issued_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  rotated_at   TEXT,
  last_used_at TEXT
);

-- Agent/主机静态信息，心跳时 Upsert。
CREATE TABLE IF NOT EXISTS node_agent_info (
  node_id        TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  hostname       TEXT NOT NULL,
  os             TEXT NOT NULL,
  platform       TEXT,
  kernel_version TEXT,
  arch           TEXT NOT NULL,
  cpu_model      TEXT,
  cpu_cores      INTEGER,
  virtualization TEXT,
  agent_version  TEXT NOT NULL,
  public_ip      TEXT,
  private_ips    TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 主机资源时序指标。累计网络字节由 Agent 上报，前端按相邻样本计算速率。
CREATE TABLE IF NOT EXISTS node_metrics (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id          TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  cpu_usage         REAL NOT NULL CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
  memory_used_bytes INTEGER NOT NULL CHECK (memory_used_bytes >= 0),
  memory_total_bytes INTEGER NOT NULL CHECK (memory_total_bytes >= 0),
  swap_used_bytes   INTEGER NOT NULL DEFAULT 0 CHECK (swap_used_bytes >= 0),
  swap_total_bytes  INTEGER NOT NULL DEFAULT 0 CHECK (swap_total_bytes >= 0),
  disk_used_bytes   INTEGER NOT NULL CHECK (disk_used_bytes >= 0),
  disk_total_bytes  INTEGER NOT NULL CHECK (disk_total_bytes >= 0),
  load_1            REAL NOT NULL DEFAULT 0 CHECK (load_1 >= 0),
  load_5            REAL NOT NULL DEFAULT 0 CHECK (load_5 >= 0),
  load_15           REAL NOT NULL DEFAULT 0 CHECK (load_15 >= 0),
  network_rx_bytes  INTEGER NOT NULL DEFAULT 0 CHECK (network_rx_bytes >= 0),
  network_tx_bytes  INTEGER NOT NULL DEFAULT 0 CHECK (network_tx_bytes >= 0),
  tcp_connections   INTEGER NOT NULL DEFAULT 0 CHECK (tcp_connections >= 0),
  process_count     INTEGER NOT NULL DEFAULT 0 CHECK (process_count >= 0),
  uptime_seconds    INTEGER NOT NULL DEFAULT 0 CHECK (uptime_seconds >= 0),
  collected_at      TEXT NOT NULL,
  received_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_node_metrics_node_time
  ON node_metrics(node_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_node_metrics_time
  ON node_metrics(collected_at DESC);

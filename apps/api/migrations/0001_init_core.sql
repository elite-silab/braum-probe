-- Braum 布隆 CF 探针 — 核心表初始化
-- Migration: 0001_init_core

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','viewer')),
  avatar_url    TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- 探针节点表
-- ============================================
CREATE TABLE IF NOT EXISTS nodes (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  region            TEXT NOT NULL CHECK (region IN ('asia','europe','north_america','south_america','oceania','africa')),
  country           TEXT NOT NULL,
  city              TEXT NOT NULL,
  latitude          REAL NOT NULL,
  longitude         REAL NOT NULL,
  isp               TEXT,
  probe_type        TEXT NOT NULL CHECK (probe_type IN ('http','dns')),
  probe_interval    INTEGER NOT NULL DEFAULT 60,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','offline')),
  last_heartbeat_at TEXT,
  metadata          TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_region ON nodes(region);

-- ============================================
-- 监控目标表
-- ============================================
CREATE TABLE IF NOT EXISTS targets (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  address         TEXT NOT NULL,
  target_type     TEXT NOT NULL CHECK (target_type IN ('http','dns')),
  port            INTEGER,
  expected_status INTEGER DEFAULT 200,
  timeout_ms      INTEGER DEFAULT 5000,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================
-- 节点与目标关联表
-- ============================================
CREATE TABLE IF NOT EXISTS node_targets (
  node_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  PRIMARY KEY (node_id, target_id)
);

-- ============================================
-- 目标分组表
-- ============================================
CREATE TABLE IF NOT EXISTS target_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================
-- 分组与目标关联表
-- ============================================
CREATE TABLE IF NOT EXISTS group_targets (
  group_id  TEXT NOT NULL REFERENCES target_groups(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, target_id)
);

-- ============================================
-- 探测结果表（数据量最大，注意索引优化）
-- ============================================
CREATE TABLE IF NOT EXISTS probe_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id       TEXT NOT NULL REFERENCES nodes(id),
  target_id     TEXT NOT NULL REFERENCES targets(id),
  success       INTEGER NOT NULL CHECK (success IN (0, 1)),
  latency_ms    REAL,
  status_code   INTEGER,
  dns_time_ms   REAL,
  error_message TEXT,
  probe_at      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_probe_node_time ON probe_results(node_id, probe_at DESC);
CREATE INDEX IF NOT EXISTS idx_probe_target_time ON probe_results(target_id, probe_at DESC);
CREATE INDEX IF NOT EXISTS idx_probe_at ON probe_results(probe_at DESC);

-- ============================================
-- 聚合统计表（小时/天维度）
-- ============================================
CREATE TABLE IF NOT EXISTS probe_stats (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id        TEXT NOT NULL,
  target_id      TEXT NOT NULL,
  period         TEXT NOT NULL CHECK (period IN ('hourly','daily')),
  period_start   TEXT NOT NULL,
  total_probes   INTEGER NOT NULL DEFAULT 0,
  success_count  INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL,
  p50_latency_ms REAL,
  p95_latency_ms REAL,
  p99_latency_ms REAL,
  min_latency_ms REAL,
  max_latency_ms REAL,
  availability   REAL NOT NULL DEFAULT 0,
  UNIQUE(node_id, target_id, period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_stats_node_period ON probe_stats(node_id, period, period_start DESC);

-- ============================================
-- 全局配置表（KV 结构）
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 预设配置
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', '"Braum Status"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_probe_interval', '"60"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('data_retention_days', '"90"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('public_page_enabled', '"true"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('timezone', '"Asia/Shanghai"');

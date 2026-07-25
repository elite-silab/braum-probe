-- Braum 布隆 CF 探针 — 告警相关表
-- Migration: 0002_init_alerts

-- ============================================
-- 告警规则表
-- ============================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  metric             TEXT NOT NULL CHECK (metric IN ('availability','latency_ms','consecutive_failures')),
  operator           TEXT NOT NULL CHECK (operator IN ('>','<','>=','<=','==')),
  threshold          REAL NOT NULL,
  duration_seconds   INTEGER NOT NULL DEFAULT 300,
  scope              TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all','nodes','groups','regions')),
  suppress_minutes   INTEGER DEFAULT 15,
  notify_on_recovery INTEGER DEFAULT 1,
  enabled            INTEGER DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================
-- 告警规则与节点关联
-- ============================================
CREATE TABLE IF NOT EXISTS alert_rule_nodes (
  rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, node_id)
);

-- ============================================
-- 告警规则与目标分组关联
-- ============================================
CREATE TABLE IF NOT EXISTS alert_rule_groups (
  rule_id  TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES target_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, group_id)
);

-- ============================================
-- 通知渠道表
-- ============================================
CREATE TABLE IF NOT EXISTS alert_channels (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('telegram','email','webhook','wecom','slack','discord')),
  config       TEXT NOT NULL DEFAULT '{}',
  enabled      INTEGER DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================
-- 告警规则与通知渠道关联
-- ============================================
CREATE TABLE IF NOT EXISTS alert_rule_channels (
  rule_id    TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES alert_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, channel_id)
);

-- ============================================
-- 告警事件记录表
-- ============================================
CREATE TABLE IF NOT EXISTS alert_events (
  id            TEXT PRIMARY KEY,
  rule_id       TEXT NOT NULL REFERENCES alert_rules(id),
  node_id       TEXT,
  target_id     TEXT,
  trigger_value REAL NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('firing','resolved')),
  message       TEXT,
  notified      INTEGER DEFAULT 0,
  fired_at      TEXT NOT NULL,
  resolved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_alert_events_rule ON alert_events(rule_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_time ON alert_events(fired_at DESC);

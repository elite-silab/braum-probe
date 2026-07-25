-- Braum 布隆 CF 探针 — 公告/事件相关表
-- Migration: 0003_init_incidents

-- ============================================
-- 公告表
-- ============================================
CREATE TABLE IF NOT EXISTS incidents (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('critical','major','minor')),
  status      TEXT NOT NULL DEFAULT 'investigating'
              CHECK (status IN ('investigating','identified','monitoring','resolved','scheduled')),
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_time ON incidents(created_at DESC);

-- ============================================
-- 公告时间线更新表
-- ============================================
CREATE TABLE IF NOT EXISTS incident_updates (
  id          TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status      TEXT CHECK (status IN ('investigating','identified','monitoring','resolved','scheduled')),
  message     TEXT NOT NULL,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_incident_updates ON incident_updates(incident_id, created_at DESC);

-- ============================================
-- 公告与节点关联
-- ============================================
CREATE TABLE IF NOT EXISTS incident_nodes (
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  node_id     TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (incident_id, node_id)
);

-- ============================================
-- 公告与目标关联
-- ============================================
CREATE TABLE IF NOT EXISTS incident_targets (
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  target_id   TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  PRIMARY KEY (incident_id, target_id)
);

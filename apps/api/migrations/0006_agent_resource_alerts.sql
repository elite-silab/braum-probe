-- Braum 布隆 CF 探针 — Agent 资源指标告警
-- Migration: 0006_agent_resource_alerts

CREATE TABLE alert_rules_v2 (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  metric             TEXT NOT NULL CHECK (metric IN (
    'availability','latency_ms','consecutive_failures',
    'cpu_usage','memory_usage','disk_usage','load_1','heartbeat_age_seconds'
  )),
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

INSERT INTO alert_rules_v2 SELECT * FROM alert_rules;

CREATE TABLE alert_rule_nodes_v2 (
  rule_id TEXT NOT NULL REFERENCES alert_rules_v2(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, node_id)
);
INSERT INTO alert_rule_nodes_v2 SELECT * FROM alert_rule_nodes;

CREATE TABLE alert_rule_groups_v2 (
  rule_id  TEXT NOT NULL REFERENCES alert_rules_v2(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES target_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, group_id)
);
INSERT INTO alert_rule_groups_v2 SELECT * FROM alert_rule_groups;

CREATE TABLE alert_rule_channels_v2 (
  rule_id    TEXT NOT NULL REFERENCES alert_rules_v2(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES alert_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, channel_id)
);
INSERT INTO alert_rule_channels_v2 SELECT * FROM alert_rule_channels;

CREATE TABLE alert_events_v2 (
  id            TEXT PRIMARY KEY,
  rule_id       TEXT NOT NULL REFERENCES alert_rules_v2(id),
  node_id       TEXT,
  target_id     TEXT,
  trigger_value REAL NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('firing','resolved')),
  message       TEXT,
  notified      INTEGER DEFAULT 0,
  fired_at      TEXT NOT NULL,
  resolved_at   TEXT
);
INSERT INTO alert_events_v2 SELECT * FROM alert_events;

DROP TABLE alert_events;
DROP TABLE alert_rule_channels;
DROP TABLE alert_rule_groups;
DROP TABLE alert_rule_nodes;
DROP TABLE alert_rules;

ALTER TABLE alert_rules_v2 RENAME TO alert_rules;
ALTER TABLE alert_rule_nodes_v2 RENAME TO alert_rule_nodes;
ALTER TABLE alert_rule_groups_v2 RENAME TO alert_rule_groups;
ALTER TABLE alert_rule_channels_v2 RENAME TO alert_rule_channels;
ALTER TABLE alert_events_v2 RENAME TO alert_events;

CREATE INDEX idx_alert_events_rule ON alert_events(rule_id, fired_at DESC);
CREATE INDEX idx_alert_events_time ON alert_events(fired_at DESC);

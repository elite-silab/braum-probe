#!/usr/bin/env npx tsx
// Braum 布隆 CF 探针 — 数据库填充脚本
// 用法：npx tsx scripts/seed.ts [--db <path-to-db>]

import Database from 'better-sqlite3'
import { randomUUID, createHash, randomBytes } from 'node:crypto'
import { resolve, join } from 'node:path'
import { readdirSync } from 'node:fs'

const D1_DIR = resolve(__dirname, '../apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject')

// Wrangler v4 使用哈希命名的 SQLite 文件，需要自动检测
function findD1File(): string {
  try {
    const files = readdirSync(D1_DIR).filter(f => f.endsWith('.sqlite'))
    // 优先使用哈希命名的文件（Wrangler v4 实际使用的）
    const hashFile = files.find(f => f !== 'metadata.sqlite')
    if (hashFile) return join(D1_DIR, hashFile)
    if (files.includes('metadata.sqlite')) return join(D1_DIR, 'metadata.sqlite')
  } catch { /* directory may not exist yet */ }
  return join(D1_DIR, 'metadata.sqlite')
}

const DB_PATH = process.argv.includes('--db')
  ? process.argv[process.argv.indexOf('--db') + 1]
  : findD1File()

// ============================================
// 辅助函数
// ============================================
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(salt + password).digest('hex')
  return `${salt}$${hash}`
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// ============================================
// 初始化数据库（尝试连接）
// ============================================
console.log('🌱 Braum 探针 Seed 脚本')
console.log(`📦 数据库路径: ${DB_PATH}`)

let db: Database.Database

try {
  db = new Database(DB_PATH)
} catch {
  console.log('⚠️  无法连接到本地 D1 数据库。')
  console.log('💡 提示：请先运行 `cd apps/api && pnpm wrangler dev` 初始化数据库')
  console.log('   或使用 wrangler d1 execute 命令运行 schema')
  process.exit(0)
}

// ============================================
// 测试用户
// ============================================
console.log('\n👤 创建测试用户...')

let adminId: string = randomUUID()
let viewerId: string = randomUUID()

db.prepare(`
  INSERT OR IGNORE INTO users (id, email, name, password_hash, role, status)
  VALUES (?, 'admin@braum.local', 'Admin', ?, 'owner', 'active')
`).run(adminId, hashPassword('admin123'))

db.prepare(`
  INSERT OR IGNORE INTO users (id, email, name, password_hash, role, status)
  VALUES (?, 'viewer@braum.local', 'Viewer', ?, 'viewer', 'active')
`).run(viewerId, hashPassword('viewer123'))

// 获取实际的 admin user ID（INSERT OR IGNORE 后可能已存在）
const actualAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@braum.local') as { id: string } | undefined
if (actualAdmin) adminId = actualAdmin.id
const actualViewer = db.prepare('SELECT id FROM users WHERE email = ?').get('viewer@braum.local') as { id: string } | undefined
if (actualViewer) viewerId = actualViewer.id

// ============================================
// 测试节点（5 个不同地区）
// ============================================
console.log('🌍 创建测试节点...')

const nodes = [
  { id: 'seed-beijing', name: '北京 VPS', region: 'asia', country: '中国', city: '北京', latitude: 39.9042, longitude: 116.4074, isp: '中国电信', interval: 60, status: 'active', registered: true },
  { id: 'seed-tokyo', name: '东京 VPS', region: 'asia', country: '日本', city: '东京', latitude: 35.6762, longitude: 139.6503, isp: 'NTT', interval: 60, status: 'active', registered: true },
  { id: 'seed-singapore', name: '新加坡 VPS', region: 'asia', country: '新加坡', city: '新加坡', latitude: 1.3521, longitude: 103.8198, isp: 'Singtel', interval: 60, status: 'offline', registered: false },
  { id: 'seed-frankfurt', name: '法兰克福 VPS', region: 'europe', country: '德国', city: '法兰克福', latitude: 50.1109, longitude: 8.6821, isp: 'Deutsche Telekom', interval: 60, status: 'active', registered: true },
  { id: 'seed-san-jose', name: '美西 VPS', region: 'north_america', country: '美国', city: '圣何塞', latitude: 37.3382, longitude: -121.8863, isp: 'Hetzner', interval: 60, status: 'offline', registered: true },
]

for (const node of nodes) {
  db.prepare(`
    INSERT OR IGNORE INTO nodes (id, name, region, country, city, latitude, longitude, isp, probe_type, probe_interval, status, last_heartbeat_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'http', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(node.id, node.name, node.region, node.country, node.city, node.latitude, node.longitude, node.isp, node.interval, node.status)
}

// ============================================
// 测试目标（3 个 HTTP + 2 个 DNS）
// ============================================
console.log('🎯 创建测试目标...')

const targets = [
  { id: 'seed-target-cloudflare', name: 'Cloudflare', type: 'http', address: 'https://1.1.1.1', status: 200, timeout: 5000 },
  { id: 'seed-target-google', name: 'Google', type: 'http', address: 'https://www.google.com', status: 200, timeout: 5000 },
  { id: 'seed-target-github', name: 'GitHub', type: 'http', address: 'https://github.com', status: 200, timeout: 5000 },
  { id: 'seed-target-cf-dns', name: 'Cloudflare DNS', type: 'dns', address: '1.1.1.1', status: 0, timeout: 3000 },
  { id: 'seed-target-google-dns', name: 'Google DNS', type: 'dns', address: '8.8.8.8', status: 0, timeout: 3000 },
]

for (const target of targets) {
  db.prepare(`
    INSERT OR IGNORE INTO targets (id, name, target_type, address, expected_status, timeout_ms, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
  `).run(target.id, target.name, target.type, target.address, target.status, target.timeout)
}

// ============================================
// 关联所有节点与所有目标
// ============================================
console.log('🔗 关联节点与目标...')

for (const node of nodes) {
  for (const target of targets) {
    db.prepare(`
      INSERT OR IGNORE INTO node_targets (node_id, target_id) VALUES (?, ?)
    `).run(node.id, target.id)
  }
}

// ============================================
// 模拟 Agent 注册、主机信息与资源指标
// ============================================
console.log('🛰️  生成 Agent 与 VPS 资源指标...')

const insertMetric = db.prepare(`
  INSERT INTO node_metrics (
    node_id, cpu_usage, memory_used_bytes, memory_total_bytes,
    swap_used_bytes, swap_total_bytes, disk_used_bytes, disk_total_bytes,
    load_1, load_5, load_15, network_rx_bytes, network_tx_bytes,
    tcp_connections, process_count, uptime_seconds, collected_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

for (const [index, node] of nodes.entries()) {
  if (!node.registered) continue
  const secretHash = createHash('sha256').update(`seed-agent-${node.id}`).digest('hex')
  db.prepare(`
    INSERT INTO agent_credentials (node_id, secret_hash, last_used_at)
    VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(node_id) DO UPDATE SET secret_hash = excluded.secret_hash, last_used_at = excluded.last_used_at
  `).run(node.id, secretHash)
  db.prepare(`
    INSERT INTO node_agent_info (
      node_id, hostname, os, platform, kernel_version, arch,
      cpu_model, cpu_cores, agent_version, public_ip, private_ips
    ) VALUES (?, ?, 'linux', 'debian', '6.1.0', 'amd64', 'AMD EPYC 7B13', ?, '0.1.0', NULL, '["10.0.0.2"]')
    ON CONFLICT(node_id) DO UPDATE SET
      hostname = excluded.hostname, agent_version = excluded.agent_version,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run(node.id, node.id.replace('seed-', ''), index % 2 === 0 ? 4 : 2)
  db.prepare('DELETE FROM node_metrics WHERE node_id = ?').run(node.id)

  for (let sample = 287; sample >= 0; sample--) {
    const wave = Math.sin((sample + index * 13) / 18)
    const cpu = Math.max(2, Math.min(98, 24 + index * 5 + wave * 16 + Math.random() * 6))
    const memoryTotal = 4 * 1024 ** 3
    const memoryUsed = Math.floor(memoryTotal * (0.35 + index * 0.05 + wave * 0.04))
    const diskTotal = 80 * 1024 ** 3
    const diskUsed = Math.floor(diskTotal * (0.28 + index * 0.06))
    const collectedAt = new Date(Date.now() - sample * 5 * 60_000 - (node.status === 'offline' ? 2 * 3600_000 : 0)).toISOString()
    insertMetric.run(
      node.id, cpu, memoryUsed, memoryTotal, 0, 2 * 1024 ** 3,
      diskUsed, diskTotal, cpu / 30, cpu / 34, cpu / 38,
      10_000_000_000 + sample * 2_000_000, 6_000_000_000 + sample * 1_200_000,
      34 + index, 82 + index * 3, 86400 * (12 + index), collectedAt,
    )
  }
}

// ============================================
// 模拟探测结果（最近 7 天）
// ============================================
console.log('📊 生成模拟探测结果（7 天）...')

db.prepare("DELETE FROM probe_results WHERE node_id LIKE 'seed-%'").run()

const insertResult = db.prepare(`
  INSERT INTO probe_results (node_id, target_id, success, latency_ms, status_code, error_message, probe_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const insertMany = db.transaction(() => {
  let count = 0
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      for (const node of nodes) {
        if (!node.registered) continue
        for (const target of targets) {
          // 每小时每个节点-目标组合约 12 次探测（每5分钟一次）
          for (let probe = 0; probe < 12; probe++) {
            const success = Math.random() > 0.02 // 98% 成功率
            const latency = target.type === 'http'
              ? Math.floor(50 + Math.random() * 200 + (node.region === 'eu-west' ? 100 : 0))
              : Math.floor(5 + Math.random() * 30)

            const minutesAgo = day * 24 * 60 + hour * 60 + probe * 5
            const probeTime = new Date(Date.now() - minutesAgo * 60_000)

            insertResult.run(
              node.id,
              target.id,
              success ? 1 : 0,
              success ? latency : null,
              target.type === 'http' ? (success ? 200 : 503) : null,
              success ? null : 'Connection timeout',
              probeTime.toISOString()
            )
            count++
          }
        }
      }
    }
  }
  return count
})

const totalResults = insertMany()
console.log(`  ✅ 插入 ${totalResults} 条探测结果`)

// ============================================
// 测试告警规则
// ============================================
console.log('🔔 创建测试告警规则...')

const rules = [
  { id: 'seed-rule-availability', name: '可用率告警', metric: 'availability', operator: '<', threshold: 0.95, suppress: 15 },
  { id: 'seed-rule-latency', name: '高延迟告警', metric: 'latency_ms', operator: '>', threshold: 500, suppress: 30 },
  { id: 'seed-rule-failures', name: '连续失败告警', metric: 'consecutive_failures', operator: '>=', threshold: 3, suppress: 15 },
  { id: 'seed-rule-cpu', name: 'CPU 使用率告警', metric: 'cpu_usage', operator: '>', threshold: 90, suppress: 15 },
  { id: 'seed-rule-heartbeat', name: 'Agent 心跳中断', metric: 'heartbeat_age_seconds', operator: '>', threshold: 180, suppress: 15 },
]

for (const rule of rules) {
  db.prepare(`
    INSERT OR IGNORE INTO alert_rules (id, name, metric, operator, threshold, duration_seconds, scope, suppress_minutes, enabled)
    VALUES (?, ?, ?, ?, ?, 300, 'all', ?, 1)
  `).run(rule.id, rule.name, rule.metric, rule.operator, rule.threshold, rule.suppress)
}

// ============================================
// 测试公告
// ============================================
console.log('📢 创建测试公告...')

const incidents = [
  {
    id: 'seed-incident-maintenance',
    title: '计划维护 — 数据库升级',
    severity: 'major',
    status: 'resolved',
    description: '我们将在 UTC 2024-01-15 02:00-04:00 进行数据库升级维护。',
  },
  {
    id: 'seed-incident-europe-latency',
    title: '欧洲节点延迟增高',
    severity: 'minor',
    status: 'monitoring',
    description: '检测到欧洲节点网络延迟增高，正在排查中。',
  },
]

for (const incident of incidents) {
  db.prepare(`
    INSERT OR IGNORE INTO incidents (id, title, severity, status, description, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(incident.id, incident.title, incident.severity, incident.status, incident.description, adminId, daysAgo(3))
}

// ============================================
// 系统设置
// ============================================
console.log('⚙️  创建系统设置...')

const settings = [
  { key: 'site_name', value: 'Braum 探针' },
  { key: 'site_description', value: 'Cloudflare 控制面与 VPS Agent 监控平台' },
  { key: 'probe_interval_default', value: '60' },
  { key: 'data_retention_days', value: '30' },
  { key: 'alert_evaluation_interval', value: '120' },
]

for (const setting of settings) {
  db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, updated_at)
    VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(setting.key, setting.value)
}

// ============================================
// 完成
// ============================================
console.log('\n✅ Seed 完成！')
console.log(`  用户: admin@braum.local/admin123, viewer@braum.local/viewer123`)
console.log(`  节点: ${nodes.length} 个`)
console.log(`  目标: ${targets.length} 个`)
console.log(`  探测结果: ${totalResults} 条`)
console.log(`  告警规则: ${rules.length} 条`)
console.log(`  公告: ${incidents.length} 条`)
console.log(`  系统设置: ${settings.length} 条`)

db.close()

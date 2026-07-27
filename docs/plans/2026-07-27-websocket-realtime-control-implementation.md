# WebSocket Realtime Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a resilient WebSocket control channel for Agent presence, configuration notifications, and immediate dashboard refresh without replacing HTTPS monitoring.

**Architecture:** A hibernating `RealtimeHub` Durable Object owns Agent and viewer sockets inside the existing Worker. Edge routes authenticate Agent upgrades, API mutations publish small events, and Agents react by performing their existing HTTPS heartbeat. Browser polling remains as fallback.

**Tech Stack:** Cloudflare Workers, Durable Objects, Hono, TypeScript, Next.js/React, Go, Gorilla WebSocket, Vitest

---

### Task 1: Define the realtime protocol and Worker binding

**Files:**
- Modify: `packages/shared/src/agent.ts`
- Modify: `apps/api/src/env.ts`
- Modify: `wrangler.jsonc`
- Modify: `worker.ts`

**Steps:**

1. Add versioned control and viewer event types with a strict 16 KiB message limit.
2. Add the `REALTIME` Durable Object binding and SQLite class migration.
3. Export `RealtimeHub` from the single Worker entry.
4. Run `pnpm typecheck`; expect all workspaces to pass after the class is implemented.

### Task 2: Implement the hibernating Durable Object and upgrade routes

**Files:**
- Create: `apps/api/src/realtime/hub.ts`
- Create: `apps/api/src/realtime/client.ts`
- Create: `apps/api/src/realtime/protocol.test.ts`
- Create: `apps/api/src/routes/realtime.ts`
- Modify: `apps/api/src/routes/agent.ts`
- Modify: `apps/api/src/index.ts`

**Steps:**

1. Write tests for accepted internal events and rejected oversized or unknown messages.
2. Implement Agent/viewer socket attachments, connection snapshots, replacement, broadcast, ping/pong, notify, and credential-revocation disconnect.
3. Authenticate `/api/agent/v1/ws` with the existing Agent Bearer credential before forwarding the upgrade.
4. Expose a read-only `/api/v1/realtime` viewer upgrade route.
5. Run `pnpm --filter @braum/api test`; expect all tests to pass.

### Task 3: Publish configuration and metric events

**Files:**
- Modify: `apps/api/src/routes/agent.ts`
- Modify: `apps/api/src/routes/agent-admin.ts`
- Modify: `apps/api/src/routes/nodes.ts`
- Modify: `apps/api/src/routes/targets.ts`
- Modify: route tests

**Steps:**

1. Publish `metrics_updated` after a successful heartbeat.
2. Send `config_changed` after node assignment, interval, state, or assigned target changes.
3. Disconnect the Agent immediately when its credential is revoked or node is deleted.
4. Keep realtime publication best-effort so monitoring writes remain successful if the hub is unavailable.
5. Run the affected API tests; expect successful mutations with and without the optional test binding.

### Task 4: Add the Agent control client

**Files:**
- Modify: `apps/agent/go.mod`
- Modify: `apps/agent/go.sum`
- Create: `apps/agent/internal/agent/control.go`
- Create: `apps/agent/internal/agent/control_test.go`
- Modify: `apps/agent/cmd/braum-agent/main.go`

**Steps:**

1. Add Gorilla WebSocket and tests for URL derivation, authenticated handshake, ping/pong, and `config_changed` wake-up.
2. Implement TLS-aware connection, 16 KiB read limit, 25-second keepalive, and jittered exponential reconnect capped at 60 seconds.
3. Add a buffered wake channel to the existing heartbeat loop.
4. Run `go test ./...` and `go vet ./...`; expect both to pass.

### Task 5: Make the dashboard event-driven with polling fallback

**Files:**
- Create: `apps/web/src/lib/realtime.ts`
- Modify: `apps/web/src/components/Dashboard.tsx`
- Modify: `apps/web/src/components/NodeCard.tsx`

**Steps:**

1. Derive the same-origin WebSocket URL and implement visibility-aware reconnect with exponential backoff.
2. Refresh node data after `metrics_updated` or configuration events, with debounce to avoid request bursts.
3. Display a small realtime-connection indicator separately from heartbeat-derived node health.
4. Keep the existing 30-second polling timer as fallback.
5. Run Web and shared type checks plus ESLint; expect all to pass.

### Task 6: Update documentation and verify production build

**Files:**
- Modify: `README.md`
- Modify: `docs/Agent使用指南.md`
- Modify: `docs/架构设计文档.md`
- Modify: `docs/部署运维文档.md`
- Modify: `docs/环境变量与配置指南.md`

**Steps:**

1. Document that no WebSocket URL, port, certificate, or Durable Object ID is entered by users.
2. Document outbound TCP 443, automatic fallback, Agent upgrade requirements, and troubleshooting.
3. Run API tests, Go tests/vet, TypeScript checks, ESLint, `git diff --check`, and the production Worker build.
4. Review the final diff, commit with a focused message, and push `main`.

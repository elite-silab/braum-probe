# Braum Security Stabilization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate privilege escalation and restore reliable probing, alerting, aggregation, and production administration without changing the public API unnecessarily.

**Architecture:** Treat the Workers application and SQL migrations as the canonical backend and database contract. Enforce role authorization at the admin router boundary, redact secrets before audit persistence, align runtime SQL with migrations, and test cross-layer contracts against an in-memory SQLite database in addition to unit mocks. Pages Functions are considered legacy until they are either removed or deliberately brought back behind the same shared backend modules.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers/D1/KV, Astro/React, Vitest, SQLite.

> 后续架构说明：本计划中的“中心调度代表节点执行探测”已被 VPS Agent 架构取代。当前事实来源为 `2026-07-25-agent-platform-redesign.md` 与 ADR-0001；Cron 只检查 Agent 心跳、聚合和告警。

---

### Task 1: Lock down the management authorization boundary

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/middleware/auth.ts`
- Test: `apps/api/src/middleware/middleware.test.ts`

1. Add failing tests proving viewers cannot mutate resources, admins cannot manage users/settings, and owners can perform all management operations.
2. Define explicit read/write route groups: viewer reads, admin business-resource writes, owner user/settings/destructive writes.
3. Ensure the middleware verifies the current user is active and reads the current role from D1 rather than trusting a stale JWT role.
4. Run `pnpm --filter @braum/api test` and verify the new authorization tests pass.

### Task 2: Prevent sensitive data from entering audit storage or logs

**Files:**
- Modify: `apps/api/src/utils/audit.ts`
- Modify: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/routes/alerts.ts`
- Test: `apps/api/src/utils/audit.test.ts`

1. Add tests for recursive redaction of password, token, secret, authorization, cookie, and API-key fields.
2. Redact `changes` inside the central audit helper so all call sites are protected.
3. Remove the raw audit input from error logging.
4. Keep notification-channel config out of normal API responses and document encryption-at-rest as a follow-up migration.
5. Run the focused audit tests and the full API suite.

### Task 3: Align user and management API fields with the canonical migration

**Files:**
- Modify: `apps/api/src/routes/users.ts`
- Modify: `apps/web/src/components/admin/*` only where the UI still sends `username`
- Test: `apps/api/src/routes/users.test.ts`

1. Add SQLite contract assertions showing the canonical `users.name` column and accepted roles/statuses.
2. Replace `username` reads/writes with `name`, validate email/password/role/status, and prevent deletion or demotion of the last active owner.
3. Add owner-only user CRUD tests including self-demotion and last-owner protection.
4. Run API tests and type checking.

### Task 4: Restore alert evaluation and event persistence

**Files:**
- Modify: `apps/api/src/probe/alert-evaluator.ts`
- Modify: `apps/api/src/routes/alerts.ts`
- Test: `apps/api/src/probe/alert-evaluator.test.ts`

1. Replace the internal `lt/gt/lte/gte/eq` operator vocabulary with the migration/shared `</>/<=/>=/==` vocabulary.
2. Add contract tests using values accepted by `0002_init_alerts.sql`.
3. Write alert events using `trigger_value`, `event_type`, `fired_at`, `resolved_at`, and `notified`.
4. Update recovery lookup/update logic to the canonical columns.
5. Persist node associations for node-scoped rules or reject unsupported scopes with a clear 400 response.
6. Run focused and full API tests.

### Task 5: Restore scheduling and aggregation

**Files:**
- Modify: `apps/api/src/probe/scheduler.ts`
- Modify: `apps/api/src/probe/aggregator.ts`
- Test: `apps/api/src/probe/scheduler.test.ts`
- Test: `apps/api/src/probe/aggregator.test.ts`

1. Select due probe tasks based on `last_heartbeat_at` and `probe_interval`; do not mark a centrally executed node offline before probing it.
2. Use the previous completed hour/day as aggregation windows.
3. Replace `latency_p50/p95/p99` with `p50_latency_ms/p95_latency_ms/p99_latency_ms` everywhere.
4. Log rejected probe tasks instead of silently discarding `Promise.allSettled` failures.
5. Run contract tests and the full API suite.

### Task 6: Fix production API configuration and retire duplicate backend behavior

**Files:**
- Modify: `apps/web/src/pages/admin/login.astro`
- Modify: `apps/web/src/lib/api.ts`
- Modify or remove: `apps/web/functions/api/admin/v1/**`
- Modify: `README.md`
- Modify: `docs/部署运维文档.md`

1. Inject `PUBLIC_API_URL` into the login page rather than hard-coding localhost.
2. Choose Workers as the documented canonical admin API.
3. Remove the duplicate Pages API surface, or replace it with a transparent proxy if same-origin deployment is required.
4. Build the Web application and smoke-test login request URLs in the generated output.

### Task 7: Make quality gates truthful

**Files:**
- Modify: `package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`

1. Add the missing shared build script and replace semicolon command chaining with fail-fast recursive scripts.
2. Wire package lint scripts to ESLint and install/configure `@astrojs/check` when dependency changes are authorized.
3. Resolve current TypeScript and ESLint errors.
4. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`; all must exit zero without hidden errors or prompts.

### Task 8: Upgrade authentication and vulnerable dependencies

**Files:**
- Modify: `apps/api/src/utils/jwt.ts`
- Add: a password-hash migration path supporting old and new hashes during transition
- Modify: package manifests and `pnpm-lock.yaml`

1. Introduce a versioned, computationally expensive password hash supported in Workers and transparently rehash legacy SHA-256 passwords after successful login.
2. Apply dedicated login throttling and short-lived access tokens with refresh-token rotation/revocation.
3. Upgrade Astro, Cloudflare adapter, Wrangler, Undici, ws, and sharp to patched compatible versions.
4. Re-run the full suite, production builds, and `pnpm audit --prod`.

No git commit or deployment is performed unless explicitly requested.

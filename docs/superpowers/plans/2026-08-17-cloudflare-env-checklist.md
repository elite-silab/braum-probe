# Cloudflare Environment Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Separate the local production checklist from development variables, make `ADMIN_INITIAL_EMAIL` an effective runtime setting, and align Wrangler configuration and user documentation.

**Architecture:** The ignored root `.env` is a production-only checklist whose values are copied manually into Cloudflare. The ignored root `.dev.vars` is Wrangler's development-only source; committed example files document both roles. Runtime authentication reads `ADMIN_INITIAL_EMAIL` from the Worker environment instead of hardcoding an address, while `wrangler.jsonc` retains only non-secret variables and resource bindings.

**Tech Stack:** Cloudflare Workers, Wrangler JSONC, Hono, Next.js 16, TypeScript, Vitest, pnpm

---

## File map

- Modify `apps/api/src/routes/auth.ts`: validate and use the configured initial administrator email.
- Modify `apps/api/src/routes/auth.test.ts`: cover custom, missing, and invalid initial email behavior.
- Modify `apps/api/src/env.ts`: declare `ADMIN_INITIAL_EMAIL` and correct production/development comments.
- Modify `apps/api/src/test-helpers.ts`: provide the new binding in shared test environments.
- Modify `apps/web/src/lib/hono-handler.ts`: forward the development email binding.
- Modify `apps/web/src/app/(auth)/admin/login/page.tsx`: remove the fixed login email.
- Modify `apps/web/src/components/admin/AdminShell.tsx`: remove the fixed fallback email.
- Replace `.env.example`: document the six production Cloudflare entries.
- Create `.dev.vars.example`: document safe development-only values.
- Modify `.gitignore`: ignore real production/development files but allow both examples.
- Modify `wrangler.jsonc`: document why production Secrets are absent.
- Normalize ignored local `.env` and move `apps/api/.dev.vars` to root `.dev.vars` without printing values.
- Modify `README.md`, `docs/环境变量与配置指南.md`, `docs/小白部署指南.md`, `docs/部署运维文档.md`, and `docs/Git工作规范.md`: align setup instructions.

### Task 1: Make the initial administrator email test-driven

**Files:**
- Modify: `apps/api/src/routes/auth.test.ts`

- [x] **Step 1: Change the shared test environment to a custom email**

Add the binding and stop relying on the historical hardcoded address:

```ts
const ENV_BASE = {
  CACHE: createMockKV(),
  APP_VERSION: '0.2.1',
  JWT_SECRET: 'test-jwt-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  ADMIN_INITIAL_EMAIL: 'owner@example.com',
  ADMIN_INITIAL_PASSWORD: 'admin123',
  TELEGRAM_BOT_TOKEN: '',
  ENCRYPTION_KEY: '',
}
```

Update first-login and legacy-hash fixtures and requests to use `owner@example.com`.

- [x] **Step 2: Add failing configuration tests**

Add focused tests proving that the binding is used and bad configuration is visible:

```ts
it.each([
  ['', 'missing'],
  ['not-an-email', 'invalid'],
])('ADMIN_INITIAL_EMAIL %s returns a configuration error', async (configuredEmail) => {
  const db = mockDBWithUser(null)
  const app = createApp({
    ...ENV_BASE,
    DB: db,
    ADMIN_INITIAL_EMAIL: configuredEmail,
  })

  const res = await app.fetch(new Request('http://localhost/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@example.com', password: 'admin123' }),
  }))

  expect(res.status).toBe(503)
  const body: any = await res.json()
  expect(body.message).toContain('ADMIN_INITIAL_EMAIL')
})
```

- [x] **Step 3: Run the focused tests and verify failure**

Run:

```bash
pnpm --filter @braum/api exec vitest run src/routes/auth.test.ts
```

Expected: the custom first-login test and missing/invalid configuration tests fail because `auth.ts` still hardcodes `admin@braum.local`.

- [x] **Step 4: Commit the failing tests**

```bash
git add apps/api/src/routes/auth.test.ts
git commit -m "test: define configurable initial admin email"
```

### Task 2: Implement the runtime email binding

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/src/test-helpers.ts`
- Modify: `apps/web/src/lib/hono-handler.ts`

- [x] **Step 1: Add a small validator in `auth.ts`**

Place this above the login route:

```ts
function configuredAdminEmail(env: Env): string | null {
  const email = env.ADMIN_INITIAL_EMAIL?.trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}
```

- [x] **Step 2: Use the binding for first login and recovery**

Normalize submitted strings without silently supplying defaults:

```ts
const email = typeof body.email === 'string' ? body.email.trim() : ''
const password = typeof body.password === 'string' ? body.password : ''
```

When no user exists, validate the binding before attempting Owner creation:

```ts
const adminEmail = configuredAdminEmail(c.env)
if (!adminEmail) {
  return c.json({
    code: 50302,
    message: '初始管理员邮箱尚未配置，请在 Cloudflare Worker 中添加有效的 ADMIN_INITIAL_EMAIL',
    data: null,
  }, 503)
}
```

Use `adminEmail` for the comparison, insert, and follow-up query. In the unsupported PBKDF2 recovery condition, replace the fixed address with:

```ts
const adminEmail = configuredAdminEmail(c.env)

if (
  !isValid
  && adminEmail !== null
  && email === adminEmail
  && password === c.env.ADMIN_INITIAL_PASSWORD
  && isPasswordHashUnsupported(user.password_hash as string)
) {
```

- [x] **Step 3: Declare and forward the binding**

Add this field to `Env` next to the password:

```ts
ADMIN_INITIAL_EMAIL: string
ADMIN_INITIAL_PASSWORD: string
```

Add `ADMIN_INITIAL_EMAIL: 'admin@braum.local'` to `createMockEnv`, and include `'ADMIN_INITIAL_EMAIL'` in `localSecretNames` so local Next/Hono development receives the value from `.dev.vars`.

- [x] **Step 4: Run the focused tests and verify they pass**

Run:

```bash
pnpm --filter @braum/api exec vitest run src/routes/auth.test.ts
```

Expected: all authentication tests pass, including custom initial email and explicit 503 configuration errors.

- [x] **Step 5: Run API type checking**

Run:

```bash
pnpm --filter @braum/api typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [x] **Step 6: Commit runtime support**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/env.ts apps/api/src/test-helpers.ts apps/web/src/lib/hono-handler.ts
git commit -m "feat: configure initial administrator email"
```

### Task 3: Remove fixed administrator email from the UI

**Files:**
- Modify: `apps/web/src/app/(auth)/admin/login/page.tsx`
- Modify: `apps/web/src/components/admin/AdminShell.tsx`

- [x] **Step 1: Make the login field empty by default**

Replace the fixed state value and give the field a neutral example:

```tsx
const [email, setEmail] = useState('')
```

```tsx
<input
  type="email"
  required
  value={email}
  onChange={(event) => setEmail(event.target.value)}
  placeholder="owner@example.com"
  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
/>
```

- [x] **Step 2: Remove the fixed shell fallback**

Replace:

```ts
const email = user.email || 'admin@braum.local'
```

with:

```ts
const email = user.email || '管理员'
```

- [x] **Step 3: Verify the web type check**

Run:

```bash
pnpm --filter @braum/web typecheck
```

Expected: exit code 0.

- [x] **Step 4: Commit the UI change**

```bash
git add 'apps/web/src/app/(auth)/admin/login/page.tsx' apps/web/src/components/admin/AdminShell.tsx
git commit -m "fix: remove fixed administrator email from login"
```

### Task 4: Separate production and development environment files

**Files:**
- Modify: `.env.example`
- Create: `.dev.vars.example`
- Modify: `.gitignore`
- Modify: `wrangler.jsonc`
- Normalize ignored local file: `.env`
- Move ignored local file: `apps/api/.dev.vars` to `.dev.vars`

- [x] **Step 1: Replace `.env.example` with a production checklist**

Use exactly these keys and explain that values must be entered manually in Cloudflare:

```dotenv
# Braum 生产环境变量备忘录
# 本文件不会自动上传。复制为 .env，填写生产值后，对照它在
# Cloudflare Worker → Settings → Variables and Secrets 中手动创建同名变量。

# Text：初始 Owner 登录邮箱
ADMIN_INITIAL_EMAIL=owner@example.com

# Secret：初始 Owner 密码
ADMIN_INITIAL_PASSWORD=replace-with-a-strong-password

# Secret：三个值必须不同，并使用随机长字符串
JWT_SECRET=replace-with-a-random-secret
JWT_REFRESH_SECRET=replace-with-another-random-secret
ENCRYPTION_KEY=replace-with-a-third-random-secret

# Secret，可选；不使用 Telegram 时留空且无需在 Cloudflare 创建
TELEGRAM_BOT_TOKEN=
```

- [x] **Step 2: Create `.dev.vars.example`**

```dotenv
# Braum 本地开发变量
# 复制为根目录 .dev.vars。这里的测试值不得用于生产环境。

ADMIN_INITIAL_EMAIL=admin@braum.local
ADMIN_INITIAL_PASSWORD=braum-local-admin
JWT_SECRET=local-only-jwt-secret
JWT_REFRESH_SECRET=local-only-refresh-secret
ENCRYPTION_KEY=local-only-encryption-key
TELEGRAM_BOT_TOKEN=
```

- [x] **Step 3: Update ignore rules**

Use explicit exceptions for both committed examples:

```gitignore
.env
.env.*
!.env.example
.dev.vars
.dev.vars.*
!.dev.vars.example
```

- [x] **Step 4: Document the boundary in `wrangler.jsonc`**

Add this comment immediately above `vars`:

```jsonc
// 生产 Secrets 不写入仓库；请保存在本机 .env，并在 Cloudflare 控制台手动填写。
```

Keep `APP_VERSION`, `AGENT_API_URL`, `AGENT_RELEASE_BASE_URL`, D1, KV, Durable Object, Assets, Cron, and observability unchanged.

- [x] **Step 5: Normalize private local files without exposing values**

Perform an in-place mechanical migration that never prints secret values:

1. Read the six allowed production keys into memory.
2. Default a missing `ADMIN_INITIAL_EMAIL` to `admin@braum.local` for backward compatibility.
3. Rewrite `.env` with only the six production keys and explanatory comments.
4. Move `apps/api/.dev.vars` to root `.dev.vars`, add the development email and optional Telegram key, and keep existing development secret values.
5. Set both private files to mode `600`.

Verify names only:

```bash
sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .env
sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .dev.vars
```

Expected for both files: only `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, and `TELEGRAM_BOT_TOKEN`. No values are printed.

- [x] **Step 6: Check repository safety**

Run:

```bash
git check-ignore -v .env .dev.vars
git status --short
git diff --check
```

Expected: both private files are ignored; only `.env.example`, `.dev.vars.example`, `.gitignore`, and `wrangler.jsonc` appear as tracked changes.

- [x] **Step 7: Commit the configuration boundary**

```bash
git add .env.example .dev.vars.example .gitignore wrangler.jsonc
git commit -m "chore: separate production and development variables"
```

### Task 5: Align all setup documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/环境变量与配置指南.md`
- Modify: `docs/小白部署指南.md`
- Modify: `docs/部署运维文档.md`
- Modify: `docs/Git工作规范.md`

- [x] **Step 1: Replace fixed email instructions**

Every login instruction must say:

```md
- 邮箱：Cloudflare 中的 `ADMIN_INITIAL_EMAIL`
- 密码：Cloudflare 中的 `ADMIN_INITIAL_PASSWORD`
```

Remove user-facing references that prescribe `admin@braum.local` for production.

- [x] **Step 2: Document the two-file model**

Use the same concise explanation across the README and guides:

```md
- `.env`：只保存在维护者电脑上的生产变量备忘录；部署前对照它在 Cloudflare 控制台手动填写，不会自动上传。
- `.dev.vars`：Wrangler 本地开发变量；不得填写生产密钥。
- `wrangler.jsonc`：可提交的非敏感配置和 Cloudflare 资源绑定。
```

State that users copy `.env.example` to `.env` and `.dev.vars.example` to `.dev.vars` using the file manager; keep command-line copying as optional advanced usage only.

- [x] **Step 3: Update the Cloudflare table**

List `ADMIN_INITIAL_EMAIL` as required Text and these as Secrets: `ADMIN_INITIAL_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, plus optional `TELEGRAM_BOT_TOKEN`.

Remove claims that the root `.env` is for local development and claims that the project does not use `.dev.vars`.

- [x] **Step 4: Verify documentation consistency**

Run:

```bash
rg -n "admin@braum\.local|不.*\.dev\.vars|\.env.*本地开发|生产 Secrets|ADMIN_INITIAL_EMAIL" README.md docs .env.example .dev.vars.example wrangler.jsonc
```

Expected: `admin@braum.local` appears only in the development example or historical design context; current setup docs consistently describe production `.env`, development `.dev.vars`, and `ADMIN_INITIAL_EMAIL`.

- [x] **Step 5: Commit documentation**

```bash
git add README.md docs/环境变量与配置指南.md docs/小白部署指南.md docs/部署运维文档.md docs/Git工作规范.md
git commit -m "docs: clarify Cloudflare variable checklist"
```

### Task 6: Full verification and delivery

**Files:**
- Verify all modified files

- [x] **Step 1: Run API tests**

```bash
pnpm --filter @braum/api test
```

Expected: all API tests pass.

- [x] **Step 2: Run workspace type checks and lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: both commands exit 0.

- [x] **Step 3: Build the single Worker and Agent**

```bash
pnpm build
```

Expected: Next.js/OpenNext Worker and Go Agent builds complete successfully.

- [x] **Step 4: Run final safety checks**

```bash
git diff --check
git status --short
git grep -n 'admin@braum.local' -- ':!docs/superpowers/**' ':!.dev.vars.example'
```

Expected: no whitespace errors, no uncommitted implementation changes after commits, and no production hardcoding of the historical email.

- [x] **Step 5: Push the completed commits**

```bash
git push origin main
```

Expected: remote `main` advances to the final implementation commit.

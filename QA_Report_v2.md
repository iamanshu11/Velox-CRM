# Velox-CRM — QA Report v2

**Reviewer:** Senior Developer (second-pass audit)  
**Date:** 2026-05-14  
**Scope:** Full codebase — backend (`node-crm/`), database migrations/seeds, frontend (`src/`), Docker config  
**Baseline:** Issues from QA Report v1 have been addressed; this report covers what remains or was newly introduced.

---

## ✅ All Issues from v1 — Verified Fixed

Every item from the first QA report has been resolved. Quick confirmation:

| v1 ID | Issue | Status |
|-------|-------|--------|
| C-1 | customerRoutes and serviceRoutes not registered in app.js | ✅ Fixed |
| C-2 | User enumeration on login (different messages per path) | ✅ Fixed — generic `INVALID_LOGIN_MESSAGE` + timing dummy hash |
| C-3 | No rate limiting on auth endpoints | ✅ Fixed — express-rate-limit, 10/15 min, skipSuccessfulRequests |
| H-1 | No helmet middleware | ✅ Fixed — helmet with crossOriginResourcePolicy cross-origin |
| H-2 | Error handler leaking stack traces in production | ✅ Fixed — production-aware error handler |
| H-3 | Self-deactivation possible | ✅ Fixed — `toggleUserStatus` guard |
| H-4 | JWT stored in localStorage (XSS-readable) | ✅ Fixed — httpOnly cookie, `velox_token` |
| H-5 | AuthProvider not validating session on mount | ✅ Fixed — `getMe()` called on mount, `clearAuth()` on 401 |
| H-6 | No server-side pagination | ✅ Fixed — LIMIT/OFFSET on users and customers |
| H-7 | Customer status not validated as enum | ✅ Fixed — `assertStatus()` + Zod `statusEnum` on frontend |
| M-1 | Login schema enforcing password policy (should be min(1)) | ✅ Fixed |
| M-2 | `useAuth()` wrapper re-rendering on every store change | ✅ Fixed — `useAuthStore` with selectors |
| M-3 | No delete endpoint or UI for customers | ✅ Fixed — `DELETE /api/customers/:id` + delete flow in UI |
| M-4 | Hardcoded CHECK constraint blocking valid service codes | ✅ Fixed — migration 007 drops constraint |
| M-5 | No unique index on customer email | ✅ Fixed — migration 008, partial unique index on active emails |
| M-6 | No focus trap on modals | ✅ Fixed — focus-trap-react + aria-modal |
| M-7 | `replace('_', ' ')` only replacing first underscore | ✅ Fixed — regex `/g` flag throughout |
| no-tests | Zero unit tests | ✅ Fixed — Vitest on backend and frontend |
| L-3 | Seed runs automatically in docker-compose | ✅ Fixed — `profiles: ["seed"]` |
| L-4 | Role-to-home mapping duplicated across files | ✅ Fixed — `src/config/roles.ts` single source of truth |
| L-5 | `formatDate` inconsistent null handling | ✅ Fixed — returns `'—'` on null/undefined/invalid |

---

## 🔴 High — Must Fix Before Production

### H-1 · Production logging in the browser console (`frontend/src/lib/axios.ts`)

**Lines 14, 26, 33** — Every API request and response fires `console.info` / `console.error` unconditionally:

```js
console.info(`[API] ${method} ${config.baseURL ?? ''}${config.url ?? ''} -> pending`)
console.info(`[API] ${method} ${res.config.url ?? ''} -> ${res.status}`)
console.error(`[API] ${method} ${url} -> ${status}`, error.response?.data ?? error.message)
```

This runs in the production browser too. The error logger at line 33 dumps `error.response?.data` into the console — that can include server error messages, partial stack traces, or validation detail that you don't want visible to end-users via DevTools.

**Fix:** Guard behind `import.meta.env.DEV`:

```ts
// Request logger
api.interceptors.request.use((config) => {
  if (import.meta.env.DEV) {
    const method = (config.method ?? 'get').toUpperCase()
    console.info(`[API] ${method} ${config.baseURL ?? ''}${config.url ?? ''} -> pending`)
  }
  return config
})

// Response interceptor — same guard around both console calls
```

---

## 🟠 Medium — Fix Before Launch

### M-1 · `req.params.id` not validated as a positive integer (`customerController.js`, `userController.js`)

`req.params.id` is a raw string from the URL. It flows directly into `Customer.findById(id)` and `toggleUserStatus(req.params.id, ...)`, which pass it as a parameterized query value (`$1`).

PostgreSQL will auto-cast `"42"` → integer fine. But `GET /api/customers/abc` makes PostgreSQL throw `invalid input syntax for type bigint: "abc"`, which the catch block returns as an unhandled 500.

**Fix:** Add a lightweight ID validator in a shared util and call it in both controllers:

```js
// utils/parseId.js
export const parseId = (raw) => {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) {
    throw { status: 400, message: 'Invalid ID — must be a positive integer' }
  }
  return n
}
```

```js
// customerController.js
import { parseId } from '../utils/parseId.js'

export const handleGetCustomerById = async (req, res) => {
  try {
    const id = parseId(req.params.id)
    const customer = await getCustomerDetails(id, req.user)
    ...
  }
}
```

Apply the same to `handleUpdateCustomer`, `handleDeleteCustomer`, and `handleToggleStatus`.

---

### M-2 · `parsePagination` duplicated in two controllers

`userController.js` lines 9–18 and `customerController.js` lines 31–40 are identical copy-pasted functions. If you ever need to change the max-page-size cap or default, you have to remember to update both.

**Fix:** Extract to `src/utils/pagination.js` and import from both controllers.

---

### M-3 · Service assignment status dropdown missing two valid statuses (`CustomerFormModal.tsx` line 50)

```ts
const STATUS_OPTIONS = ['active', 'inactive', 'pending', 'suspended'] as const
```

This constant drives the per-service status `<select>` inside the customer form. The backend `CUSTOMER_STATUSES` enum has six values: `active`, `inactive`, `pending`, `verified`, `suspended`, `archived`. The service-assignment status set is a separate concept, but if you later sync those six statuses to service rows (or if a service row arrives with status `verified` from a sync), the dropdown won't include it.

**Fix:** Either define the service-assignment statuses explicitly on the backend as its own constant and expose it via `/api/services/meta/statuses`, or at minimum add `verified` and `archived` to `STATUS_OPTIONS` so the dropdown is not artificially narrowed.

---

### M-4 · Seed hashes password before checking for existing user (`superAdminSeed.js` lines 33–38)

```js
const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 10)  // line 33 — runs always
const { rows } = await client.query("SELECT id FROM users ...")      // line 35 — check happens after
```

`bcrypt.hash` with cost factor 10 takes ~100ms. For a seed script this is harmless, but it's wasteful when the record already exists (the common case after the first run). More importantly it establishes a pattern that leaks into production code.

**Fix:** Move the hash inside the conditional:

```js
const { rows } = await client.query("SELECT id FROM users ...", [emailNorm])

if (rows.length > 0) {
  const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 10)
  await client.query(`UPDATE users SET ...`, [..., hashedPassword, ...])
  ...
}
```

---

## 🟡 Low — Improve When Convenient

### L-1 · Search is client-side on the current page only (`CustomersPage.tsx`)

The search input filters `data?.items` (at most 20 rows — one page). The hint text says *"Search applies to the current page only"*, which is accurate but a noticeable UX gap. A user searching for a specific customer has to page through results rather than query the full dataset.

**Recommendation:** Add an optional `search` query param to `GET /api/customers` and filter `WHERE LOWER(first_name || ' ' || last_name) ILIKE $3 OR LOWER(email) ILIKE $3` in the SQL. The frontend debounces the input and passes it as a query param. This replaces the current client-side filter and removes the disclaimer.

---

### L-2 · No `COOKIE_SECURE` documentation in `.env.example`

`authController.js` correctly explains that `COOKIE_SECURE` is intentionally decoupled from `NODE_ENV` (so a Docker stack running on localhost with `NODE_ENV=production` still works). However, the `.env.example` file doesn't document this variable at all, so a new deployer setting up a real HTTPS environment has no hint they need to set it.

**Fix:** Add to `.env.example`:

```env
# Set to true in any environment that terminates HTTPS (staging, production).
# Adds the Secure flag to the auth cookie — required for cookies to be sent
# over HTTPS-only connections.
COOKIE_SECURE=false
```

---

### L-3 · No CSRF protection documented or implemented

The current setup relies on `SameSite=Lax` + CORS allowlist for CSRF defence. This is sufficient for modern browsers. However, there is no comment or README section explaining this trade-off, and no `Origin` / `Referer` validation middleware.

If you ever need to support cross-origin embedded requests or older browsers, `SameSite=Lax` alone is not enough. For now this is low risk, but worth a short comment in `authController.js` and a note in the README so future developers don't remove the `sameSite` option thinking it's unimportant.

---

### L-4 · Migration chain does not roll back on failure

`docker-compose.yml`'s migrate service runs:

```sh
psql $DATABASE_URL -f migrations/001_... && psql ... -f 002_... && ...
```

The `&&` chain stops on first error, leaving the DB in a partially migrated state (migrations 1–N applied, N+1 onwards not). There is no transaction wrapping or rollback.

**Recommendation:** Either wrap each migration SQL in `BEGIN; ... COMMIT;` with `\set ON_ERROR_STOP on`, or adopt a lightweight migration tool (e.g., `node-pg-migrate` or `db-migrate`) that tracks which migrations have been applied and supports rollback. This becomes important once you have data in production.

---

### L-5 · Tests don't cover the happy path for customer CRUD

`authRoutes.test.js` and `passwordPolicy.test.js` cover authentication and validation. But there are no tests for:

- `POST /api/customers` (create)  
- `GET /api/customers` (list with pagination)  
- `DELETE /api/customers/:id` (soft delete + auth guard)  
- `PATCH /api/users/:id/toggle-status` (self-deactivation guard)

These are the most business-critical paths. Adding coverage now, while the codebase is small, prevents regression as features are added.

---

## Summary Table

| ID | Severity | File(s) | Issue |
|----|----------|---------|-------|
| H-1 | 🔴 High | `frontend/src/lib/axios.ts` | `console.info`/`console.error` runs unconditionally in production |
| M-1 | 🟠 Medium | `customerController.js`, `userController.js` | `req.params.id` not validated — non-integer causes 500 |
| M-2 | 🟠 Medium | `customerController.js`, `userController.js` | `parsePagination` duplicated — extract to shared util |
| M-3 | 🟠 Medium | `CustomerFormModal.tsx` | Service-assignment status dropdown missing `verified` and `archived` |
| M-4 | 🟠 Medium | `superAdminSeed.js` | `bcrypt.hash` runs before existence check — wasteful on re-runs |
| L-1 | 🟡 Low | `CustomersPage.tsx`, `customerService.ts` | Search only covers current page — no server-side filtering |
| L-2 | 🟡 Low | `.env.example` | `COOKIE_SECURE` undocumented — easy to miss when deploying |
| L-3 | 🟡 Low | `authController.js`, README | CSRF posture not documented |
| L-4 | 🟡 Low | `docker-compose.yml` | Migration chain doesn't roll back on failure |
| L-5 | 🟡 Low | `tests/` | No tests for customer CRUD or toggle-status paths |

---

## Overall Assessment

The codebase has improved significantly from v1. All critical security and functional gaps have been addressed: the cookie-based auth flow is solid, rate limiting is in place, enums are validated at every layer, and the modal accessibility work is correct. The remaining issues are either minor code-quality items (duplicate util, unguarded logging) or missing-but-not-critical features (server-side search, migration rollback). The project is in a good state to deploy to a staging environment once the two Medium items (H-1 and M-1) are resolved.

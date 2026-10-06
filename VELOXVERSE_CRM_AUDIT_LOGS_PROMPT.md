# Velox-CRM — Customer Journey Audit Logs (VeloxVerse API → new CRM screens)

> **For the Claude / developer building this in Velox-CRM.** Everything on the VeloxVerse side is
> **already built, tested and live on the VeloxVerse backend** (steps 1–11 of
> `veloxverse/CUSTOMER-AUDIT-LOG-TODO.md`). Your job is **only the CRM side**: an API client, react-query
> hooks, and the screens in §7. Do not change the VeloxVerse backend; if something is missing, write it
> down as a request (see §11).
>
> Every response shape in this document was captured from the real API (2026-10-06) — customer emails and
> names replaced with placeholders. Read §2 (rules) and §3 (how the CRM reaches VeloxVerse) before writing
> any code.
>
> Repos:
> - **CRM** `~/Desktop/Velox-CRM` — backend `backend/node-crm` (Express, proxy to VeloxVerse), frontend
>   `frontend` (React + Vite + TanStack Query v5 + Tailwind v4, feature folder `src/features/veloxverse-admin`).
> - **VeloxVerse** `~/Desktop/veloxverse/backend` — read-only for you; the API is in
>   `src/routes/admin.audit.routes.ts`, `src/controllers/adminAudit.controller.ts`,
>   `src/services/audit/auditQuery.service.ts`, `src/services/audit/auditAdmin.service.ts`,
>   validation `src/validations/adminAudit.validation.ts`.

---

## 0. Contents

1. Goal — what support and admins can do with this
2. Rules you must follow (security, privacy, roles)
3. How the CRM reaches VeloxVerse (auth, proxy, roles, errors)
4. Concepts — event, journey, request id, severity, actor, masking
5. API reference — every endpoint with query params and a real response
6. Reference data — services, event types, steps, severities + colours, stuck rules, alert types
7. Screens to build (layout, data, behaviour for each)
8. Suggested file layout, types and hooks in the CRM
9. Edge cases and gotchas
10. Test checklist (definition of done)
11. Open questions / things to ask VeloxVerse for

---

## 1. Goal

VeloxVerse now records **what every customer and guest does** in every service (Lounge, Fast Track,
Fitness, Dining, eSIM, VeloxAssist transfers, VeloxClub, account / login, credit / points / promo /
referral, support, billing) and **every error they hit** (API errors, supplier failures, payment declines,
webhook problems, browser crashes, downtime) — with the real reason, a severity, and ids that link a
customer → their booking attempt (journey) → each request → each supplier call → each error.

Admins and support staff use the CRM to:

- **Find out why a customer got stuck**: search by the customer's email, a booking reference, or the
  **support reference** the customer quotes ("Ref: c69b661dbe6e1615" shown on error screens), and see the
  exact chain of events.
- **See a booking attempt end-to-end** (journey timeline: search → checkout → payment → supplier → confirmed
  / failed) and a **customer's full activity**.
- **Act on problems**: stuck customers (e.g. paid but not booked), live error counts, alerts (emails already
  sent by VeloxVerse), daily trends and conversion funnels.
- **Admins only**: change retention / alert settings, manage who receives alert emails (+ send a test
  email), export CSV.

VeloxVerse keeps **detailed events for 5 days** (admin setting, minimum 5) and **daily summaries for 365
days** (admin setting). Older detail is gone by design — screens must handle "no data in range".

---

## 2. Rules you must follow

1. **Never call VeloxVerse from the browser with a secret.** Calls go through the CRM's existing VeloxVerse
   bridge (CRM-issued JWT, see §3). Follow exactly the pattern the existing VeloxVerse-admin pages use.
2. **Roles** (enforced by VeloxVerse, mirror them in the UI):

   | Action | Super admin | Admin | Support |
   |---|---|---|---|
   | View events, details, trace, journeys, timelines, booking trail, stuck, errors, funnels, daily trends, alerts | ✅ | ✅ | ✅ (masked) |
   | Search by customer email | ✅ | ✅ | ✅ (results masked) |
   | See unmasked email, name, IP, browser string | ✅ | ✅ | ❌ (VeloxVerse masks them) |
   | Export CSV | ✅ | ✅ | ❌ (403) |
   | Change retention / alerts on-off / thresholds | ✅ | ✅ | ❌ (403) |
   | Manage alert recipients, send test email | ✅ | ✅ | ❌ (403) |

   Hide admin-only buttons/tabs for support, **and** handle a permission error gracefully anyway (show "You
   don't have permission" — never crash). Note the CRM proxy turns VeloxVerse 401/403 into **502** (§3.3).

   > ⚠️ **The CRM has no support role today** (roles: `super_admin`, `admin`, `employee`, `agent`,
   > `affiliate`), and the proxy lets only `super_admin` / `admin` reach VeloxVerse. Build in two phases:
   > **Phase 1** — admins only (works today, no role work). **Phase 2** — support access, once the team
   > decides which CRM role is "support" (§3.5). Write the UI role-aware from the start
   > (`isAuditAdmin = role in ['super_admin','admin']`) so Phase 2 is a config change.
3. **Masking is done by VeloxVerse.** Support responses already contain `j***@e***.com`, `J. D.`,
   `203.0.113.0/24`, `Chrome on macOS`. **Do not try to unmask, re-fetch the customer elsewhere, or cache
   admin responses and show them to support.** Key react-query caches by role or clear them on logout.
4. **No personal data beyond what the API returns.** Don't join CRM customer records into these screens for
   support users. Never log responses to the browser console in production.
5. **Never render API text as HTML.** Error messages / supplier messages are plain text — render with normal
   JSX text (React escapes it). No `dangerouslySetInnerHTML`.
6. **Dev-only `stack` field.** In development, error replies include a `stack` field. Never show it in the UI.
7. **Every view is audited.** VeloxVerse records who looked at what (event type `admin_access`). That's
   expected — don't try to avoid it, and don't fire duplicate requests (debounce search inputs ~400 ms,
   react-query `staleTime` ≥ 30 s for lists).
8. **Times are UTC on the wire** (ISO 8601). Display in the viewer's local time with the timezone visible
   (e.g. `06 Oct 2026, 14:20:13 IST`), and show the UTC value on hover. Daily summaries are **UTC days**.

---

## 3. How the CRM reaches VeloxVerse

> ⚠️ The CRM-specific details of this section (proxy path, client file, role names) are filled in from the
> current Velox-CRM code — see **§3.4**. If anything there doesn't match what you find, trust the code and
> tell the VeloxVerse team.

### 3.1 Base path

The CRM frontend **never calls VeloxVerse directly**. It calls the CRM backend's proxy, which forwards to
VeloxVerse:

```
browser  →  {VITE_API_URL}/vv-admin/admin/audit/...          (CRM backend, cookie session)
proxy    →  {VELOXVERSE_API_URL}/admin/audit/...             (VELOXVERSE_API_URL already ends in /api/v1)
```

In `frontend/src/features/veloxverse-admin/vvAdminService.ts` that is `` `${VV}/admin/audit/...` `` with
`const VV = '/vv-admin'` and the shared axios `api` from `frontend/src/lib/axios.ts`. Below, paths are
written relative to `/admin/audit`.

### 3.2 Authentication (CRM bridge — already in place for every VeloxVerse admin page; nothing to add)

The proxy (`backend/node-crm/src/middleware/veloxverseProxy.js`, mounted in `backend/node-crm/src/app.js`
as `app.use("/api/vv-admin", authenticate, authorizeRoles("super_admin", "admin"), veloxverseProxy)`):
- forwards the CRM JWT (from the `velox_token` cookie) as `Authorization: Bearer …` — signed HS256 with the
  CRM `JWT_SECRET`, which VeloxVerse knows as `CRM_JWT_SECRET` (`CRM_BRIDGE_ENABLED=true`); payload
  `{ id, role }` with the lowercase CRM role;
- sets `X-CRM-User-Email` (from `VELOXVERSE_BRIDGE_USER_EMAIL`, else `VELOXVERSE_BRIDGE_EMAIL_MAP`, else the
  staff member's own email). VeloxVerse uses it to name the staff member in "who changed settings" / "who
  viewed". ⚠️ If `VELOXVERSE_BRIDGE_USER_EMAIL` is set, **every** staff member is recorded as that one
  email — prefer the map or the default in production;
- passes the query string through as-is (don't add `params` twice), sends a JSON body only for
  POST/PUT/PATCH/DELETE, 30 s timeout.

VeloxVerse maps the CRM `role` claim:

  | CRM `role` claim | VeloxVerse role | Audit-log access |
  |---|---|---|
  | `super_admin` | SUPER_ADMIN | full |
  | `admin` | ADMIN | full |
  | `support` | SUPPORT | read-only, masked |
  | anything else (`employee`, `agent`, `affiliate`) | — | **401** (token not accepted) |

  VeloxVerse already accepts a CRM role literally named `support`; see §3.5 for how support access gets
  turned on.

### 3.3 Response envelope and errors

Success:
```json
{ "success": true, "message": "Audit data fetched", "data": { ... } }
```

Error (all errors carry `requestId` — show it as "Ref: …" in error toasts so VeloxVerse can find it):
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "severity.0", "message": "Invalid enum value. Expected 'info' | 'low' | 'medium' | 'high' | 'critical', received 'bogus'" }],
  "requestId": "0a46f1cd78b513cb"
}
```

**What the CRM proxy does to statuses** (`veloxverseProxy.js`): every status/body is forwarded unchanged
**except** upstream 401/403 → **502** with VeloxVerse's message (so a VeloxVerse auth problem never logs the
CRM user out — the CRM axios interceptor skips the logout redirect for `/vv-admin` URLs), and VeloxVerse
unreachable (`ECONNREFUSED`) → 502 "VeloxVerse service is not available…".

| Status (as the CRM page sees it) | Meaning | UI |
|---|---|---|
| 400 | Bad filter / body (`errors[].field` tells which) | Inline field error or toast |
| 502 with `message` "You do not have permission to access this resource." | VeloxVerse 403 (role not allowed) | "You don't have permission to …" |
| 502 other | VeloxVerse 401 (bridge misconfigured) or VeloxVerse down | Error state with Retry, show the message |
| 404 | Event / recipient not found (or purged by retention) | Empty state "Not found — detailed logs are kept N days" |
| 409 | Recipient email already exists | Inline error on the email field |
| 502 | Test email couldn't be sent (SMTP) | Toast with the message |
| 5xx | VeloxVerse error | Toast "Something went wrong (Ref: …)" + retry |

Every response also has an `x-request-id` header. **Read error messages from the body**, not axios's
generic text: `(err as { response?: { data?: { message?: string; requestId?: string } } })?.response?.data`
— the pattern already used in `pages/VVPointsPage.tsx`. Show `message` + "(Ref: requestId)" with
`useToast().showToast({ type: 'error', title, message })` (the CRM toast supports only `success` | `error`).

### 3.4 CRM integration details (from the current Velox-CRM code)

Found in the current Velox-CRM code (2026-10-06) — follow these patterns:

| Concern | Where / how |
|---|---|
| API client | `frontend/src/features/veloxverse-admin/vvAdminService.ts` — add a `vvAuditService` object next to `vvPointsService` etc. Functions return `data.data` from `VVResponse<T> { success; message; data }`. Use the file's `cleanParams()` to drop empty filters. Existing audit-style calls to mirror: `vvPointsService.getAuditLog`, `vvPricingService.ruleAudit/globalAudit`, `vvClubService.getChangeLog` |
| Data fetching | TanStack Query v5 (`app/providers/QueryProvider.tsx`: `retry: 1`, `staleTime: 60s`, `refetchOnWindowFocus: false`). One hook file per domain → create `features/veloxverse-admin/hooks/useVVAudit.ts` (template: `hooks/useVVReferrals.ts`). Keys `['vv-audit', <endpoint>, params]`; lists `placeholderData: (prev) => prev`; details `enabled: Boolean(id)`; mutations `qc.invalidateQueries({ queryKey: ['vv-audit'] })`. Cursor lists → `useInfiniteQuery` with `getNextPageParam: (p) => p.nextCursor ?? undefined` |
| Types | `features/veloxverse-admin/types.ts` (all VeloxVerse types live there) — add the §8 types in a clearly headed "Audit logs" section (or a new `auditTypes.ts` re-exported from it) |
| Pure helpers | sibling `.ts` files (like `referral.ts`, `promo.ts`) → `audit.ts` (labels, search routing, outcome colours, time formatting); tests next to it (`audit.test.ts`, Vitest — see `referral.test.ts`) |
| UI components | Hand-rolled Tailwind in `frontend/src/components/ui/` (no shadcn / MUI): `Badge` (`success` \| `danger` \| `warning` \| `info` \| `neutral`), `Button`, `Card`/`CardHeader`, `Table` (`columns: {key, header, render}`, `keyField`, `loading`), `Modal`, `ConfirmDialog`, `Pagination`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`, `Input`, `Skeleton`, `Spinner`, `Switch`, `Avatar`. Icons: lucide-react. `cn()` in `lib/utils.ts`. Toasts: `useToast()` (`success` \| `error`). No date picker — use `<Input type="date">` / `type="datetime-local"` (see `VVReferEarnPage.tsx`). Filters: native `<select className={selectClass}>`. `statusBadgeVariant()` in `features/veloxverse-admin/utils.ts` |
| Best page to copy | `ReferralsTab` in `pages/VVReferEarnPage.tsx` (URL-synced filters with `useSearchParams`, local `useQueryPatch` + `DebouncedSearch` (300 ms), selects, date inputs, `ErrorState` with Retry, CSV button, mobile card layout). The helpers are page-local — copy or extract them |
| Existing audit UIs to look like | Points audit log (`VVPointsPage`), Club change log (`VVClubPage`), pricing audit (`VVPricingPage`) |
| Dates | `formatDate`, `formatDateTime`, `timeAgo` in `features/veloxverse-admin/utils.ts` (browser-local timezone). Add a variant that also prints the zone for audit times |
| Routing | `frontend/src/app/Router.tsx` — add routes inside the existing `<RoleGuard allowedRoles={['super_admin','admin']}>` block, shape `{ path: '/dashboard/veloxverse/…', element: <VVAuditLogPage /> }` |
| Sidebar | `frontend/src/config/sidebarConfig.ts` → `SIDEBAR_CONFIG` — add `{ label: 'VV Audit Logs', path: '/dashboard/veloxverse/audit-logs', icon: ScrollText }` to **both** the `super_admin` and `admin` arrays (the "VeloxVerse" header is added automatically for `/dashboard/veloxverse/*`) |
| Existing pages to extend | Customer: `VVUserDetailPage` (`/dashboard/veloxverse/users/:id` — the VeloxVerse user id) · Lounge booking: `VVLoungeBookingDetailPage` (`/dashboard/veloxverse/lounge-bookings/:visitId`) · eSIM: `VVEsimDetailPage` (`/dashboard/veloxverse/esim-orders/:orderNo`) · Transfers: `VVTransfersPage` · Support ticket: `VVSupportDetailPage` |
| Tests | Vitest 4 + jsdom + Testing Library (`frontend/vite.config.ts`, `src/test/setup.ts`), `npm test` |
| Env | CRM backend `VELOXVERSE_API_URL=http://localhost:5005/api/v1`, `JWT_SECRET` (= VeloxVerse `CRM_JWT_SECRET`), `VELOXVERSE_BRIDGE_EMAIL_MAP`; frontend only `VITE_API_URL`. Nothing new needed |

### 3.5 Support access (Phase 2 — needs a decision first)

Today only `super_admin` / `admin` can reach VeloxVerse through the CRM. To let support staff use the audit
log (read-only, masked):

1. **Decide which CRM role is "support"** — either add a new CRM role `support` (DB enum migration +
   `backend/node-crm/src/config/crmRoles.js` + `frontend/src/types/index.ts` `UserRole` + every
   `Record<UserRole, …>` in `frontend/src/config/roles.ts` and `sidebarConfig.ts`), **or** reuse an existing
   role such as `agent` / `employee` (no CRM migration; VeloxVerse adds that name to its `CRM_ROLE_MAP` as
   SUPPORT — a one-line VeloxVerse change, ask the VeloxVerse team).
2. **Widen the proxy only for audit reads.** Keep `app.use("/api/vv-admin", … authorizeRoles("super_admin","admin") …)`
   for everything else; mount, **before it**, a narrower route for the support role:
   ```js
   // backend/node-crm/src/app.js — before the existing /api/vv-admin mount
   const SUPPORT_ROLE = 'support'; // or the role chosen in step 1
   app.use(
     '/api/vv-admin/admin/audit',
     authenticate,
     authorizeRoles('super_admin', 'admin', SUPPORT_ROLE),
     (req, res, next) => {
       // support: GET only, and never settings / recipients / export
       if (req.user.role === SUPPORT_ROLE &&
           (req.method !== 'GET' || /^\/(settings|alert-recipients|export\.csv)/.test(req.path))) {
         return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
       }
       req.url = `/admin/audit${req.url}`; // the proxy builds the upstream URL from req.url
       next();
     },
     veloxverseProxy,
   );
   ```
   (Verify how `veloxverseProxy` builds the target from `req.url` / `req.baseUrl` and adjust the rewrite.)
3. Frontend: allow the support role on the audit routes only (a second `<RoleGuard>` block or widen just
   these routes), add the sidebar entry to the support role's array, hide admin-only UI (§2).
4. VeloxVerse masks support responses itself — no CRM masking code needed.

---

## 4. Concepts

### 4.1 Event
One row = one thing that happened. Key fields (full shape in §5.2):

| Field | Meaning |
|---|---|
| `createdAt` | When (UTC ISO) |
| `service` | Which product area (`lounge`, `esim`, `assist_transfer`, `club`, `auth`, `payment`, `system`…) — §6.1 |
| `eventType` | Kind of row — `step` (business step), `api_error`, `supplier_call`, `payment`, `webhook`, `job`, `frontend_error`, `page_view`, `downtime`, `system_error`, `admin_access` — §6.2 |
| `step` | Exact step name, e.g. `checkout_started`, `payment_declined`, `supplier_timeout` — §6.3 |
| `status` | `success` · `failure` · `warning` · `info` |
| `severity` | `critical` · `high` · `medium` · `low` · `info` (colours §6.4) |
| `source` | Where it was recorded: `backend`, `frontend` (customer's browser), `webhook`, `job`, `admin` |
| `actor` | Who did it: `customer`, `guest`, `admin`, `support`, `system` |
| `supplier` | `dragonpass`, `mint`, `esim`, `travelfusion`, `viatovia`, `email`, `s3` (or null) |
| `userId` + `customer` | The customer (null for anonymous guests / system work). `customer` = `{ id, email, name, role }` (masked for support) |
| `anonId` | The customer's browser id (links a guest's anonymous activity; joined to the account on login) |
| `sessionId` | One browser tab visit |
| `journeyId` | One booking attempt end-to-end (see 4.2) |
| `requestId` | One API request — the **support reference** customers see (16 hex chars) |
| `supplierCallId`, `parentEventId` | Links to a specific supplier call / the step that caused an error |
| `httpMethod`, `route`, `httpStatus` | **Our** API request (route is a pattern, e.g. `/api/v1/lounge/visits/:visitId/cancel`) |
| `referenceType` + `referenceId` | The thing it's about: `payment`, `lounge_visit`, `esim_order`, `esim_topup`, `transfer_booking`, `club_membership`, `support_ticket`, `resource`, `travel_search`… |
| `errorCode`, `errorMessage`, `errorDetails` | The real reason (supplier codes like DragonPass `500.020.009`, ViaTovia `1101`, Mint decline codes). Already redacted — no secrets / cards / documents ever |
| `metadata` | Small extra facts (amounts, counts, `operation`, `upstreamStatus`, `bookingType`…) — show as a key/value list |
| `durationMs` | How long (request / supplier call) |
| `ip`, `userAgent`, `platform`, `appVersion` | Network / device (masked for support) |
| `isSensitiveMasked` | `true` if the redactor removed something from this row |

### 4.2 Journey
A **journey** is one booking attempt: from viewing an item / opening checkout → payment → supplier → result.
All events of that attempt share a `journeyId`, **including** events that happen later without the customer
(Mint webhook, 3DS bank redirect, background jobs, supplier status updates). Use the journey view (§5.5) as
the main "what happened to this booking" screen.

### 4.3 Request id = support reference
Customers see `Something went wrong (Ref: c69b661dbe6e1615)` on server errors, and a crash screen shows
`Reference: ui-3f9a1c2e`. Search box behaviour:
- 16 hex chars (`/^[0-9a-f]{16}$/i`) → open **Trace** (`/trace/:requestId`).
- `ui-` + 8 hex → it's a browser crash: search events with `errorCode=<that value>`.
- UUID → try, in order: journey (`/journeys/:id`), event (`/events/:id`), booking trail with
  `referenceType=payment` (`/bookings/payment/:id`), customer timeline (`/users/:id/timeline`).
- Contains `@` → `GET /events?email=…`.
- Anything else (e.g. `TRF-…`, `N00131`, `ESIM…` order numbers) → `GET /events?referenceId=…`.

### 4.4 Severity
| Severity | Typical examples | VeloxVerse emails? |
|---|---|---|
| **critical** | any 5xx, crash, **paid but not booked**, refund failed, job crashed, downtime | immediately |
| **high** | payment declined, supplier failure / timeout, rejected webhook, card form failed | when it spikes |
| **medium** | 409, no availability, promo / referral rejected, quote expired, rate limited | daily digest |
| **low** | 400 validation, 401 expired session, 404 | daily digest |
| info | normal steps | no |

**Critical rows must stand out**: red badge, pinned at the top of the list (the API returns them separately,
§5.1), count in the page header.

### 4.5 Masking (support)
VeloxVerse masks for support: `customer.email` → `j***@e***.com`, `customer.name` → `J. D.`, `ip` →
`203.0.113.0/24` (IPv6 `/48`), `userAgent` → `Chrome on macOS`. Admins see the stored values. Show a small
"Masked for support" note on screens when the viewer is support.

---

## 5. API reference

All under `/admin/audit`, all `GET` unless stated. Lists use **cursor paging** (newest first): pass
`nextCursor` back as `cursor`; `nextCursor: null` = last page.

### 5.0 `GET /meta` — reference data for filters (admin + support)

Call once on page load (cache 1 h). Real response (`steps` shortened):
```json
{
  "retentionDays": 5,
  "summaryRetentionDays": 365,
  "services": ["auth","lounge","fasttrack","fitness","dining","esim","travel_flight","travel_hotel","travel_car","assist_transfer","club","credit","points","referral","promo","payment","billing","support","profile","notification","system"],
  "eventTypes": ["step","api_error","supplier_call","payment","webhook","job","frontend_error","page_view","downtime","admin_access","system_error"],
  "suppliers": ["dragonpass","mint","esim","travelfusion","viatovia","email","s3"],
  "steps": ["audit_events_searched", "…142 step names, sorted…"],
  "alertTypes": ["critical","spike","supplier_down","payment_issue","downtime","daily_digest"],
  "severities": [
    { "value": "critical", "colour": "#dc2626" },
    { "value": "high", "colour": "#ea580c" },
    { "value": "medium", "colour": "#ca8a04" },
    { "value": "low", "colour": "#2563eb" },
    { "value": "info", "colour": "#64748b" }
  ],
  "stuckRules": [
    { "key": "checkout_abandoned", "description": "Checkout started, no payment attempt", "thresholdMinutes": 30, "severity": "low" },
    { "key": "paid_not_booked", "description": "Paid, booking not confirmed", "thresholdMinutes": 10, "severity": "critical" },
    { "key": "repeated_error", "description": "Same error 3+ times in one journey", "thresholdMinutes": 0, "severity": "high" },
    { "key": "esim_not_ready", "description": "eSIM paid, not ready (no QR)", "thresholdMinutes": 15, "severity": "high" },
    { "key": "transfer_pending", "description": "ViaTovia transfer booking still pending", "thresholdMinutes": 30, "severity": "high" },
    { "key": "prebooking_pending", "description": "DragonPass prebooking still pending", "thresholdMinutes": 60, "severity": "high" },
    { "key": "refund_pending", "description": "Refund outcome still unknown", "thresholdMinutes": 1440, "severity": "high" }
  ]
}
```
Use `retentionDays` for date-picker limits and empty-state text.

### 5.1 `GET /events` — search / list (admin + support)

Query params (all optional; list params accept `a,b,c` **or** repeated `?x=a&x=b`):

| Param | Type | Notes |
|---|---|---|
| `email` | email | Customer's account email (exact, case-insensitive). No such customer → empty list |
| `userId` | uuid | Customer id |
| `anonId` | string ≤ 64 | Browser id (guests) |
| `requestId` | string ≤ 64 | Support reference |
| `journeyId` | uuid | |
| `referenceId` | string ≤ 128 | Payment id, visit id, order no, `TRF-…`, resource id… |
| `service` | list of §6.1 | |
| `eventType` | list of §6.2 | **`admin_access` rows are excluded unless you ask for `eventType=admin_access`** |
| `status` | list: `success,failure,warning,info` | |
| `severity` | list: `critical,high,medium,low,info` | |
| `supplier` | list of §6.1 suppliers | |
| `step` | list of step names (≤ 64 chars each) | |
| `httpStatus` | 100–599 | |
| `errorCode` | string ≤ 64 | e.g. `500.020.009`, `ui-3f9a1c2e` |
| `from`, `to` | ISO date-time | `from` inclusive, `to` exclusive. No default — send a range (e.g. last 24 h) |
| `limit` | 1–200 (default 50) | |
| `cursor` | string | From the previous page |

Response:
```json
{
  "events": [ /* Event objects, §5.2 */ ],
  "nextCursor": "MjAyNi0xMC0wNlQwODo1MjoxMS41ODNafDFmZTdjMjI5LWFiYmEtNDZkNC04MWQwLTEyMTg3MTY4NzEyZA",
  "critical": {
    "count": 0,
    "latest": [ /* up to 10 critical Event objects matching the same filters — first page only */ ]
  }
}
```
`critical` is only filled on the first page (no `cursor`); on later pages it is `{ "count": 0, "latest": [] }` —
keep the first page's value.

### 5.2 Event object (real, admin view)

```json
{
  "id": "34f093c2-fed2-489b-a48b-f1f10a9a655d",
  "createdAt": "2026-10-06T08:52:12.541Z",
  "service": "esim",
  "eventType": "payment",
  "step": "booking_fulfilled",
  "status": "success",
  "severity": "info",
  "source": "backend",
  "actor": "customer",
  "supplier": "mint",
  "userId": "a5d5977b-28c8-470e-8e41-e2e3c32d2507",
  "anonId": null,
  "sessionId": null,
  "journeyId": null,
  "requestId": "9bb7530f8c3ecfb3",
  "supplierCallId": null,
  "parentEventId": null,
  "httpMethod": "GET",
  "route": "/api/v1/payments/3ds-return",
  "httpStatus": null,
  "referenceType": "payment",
  "referenceId": "eee91a6d-b33e-4380-9f93-6175516b3653",
  "errorCode": null,
  "errorMessage": null,
  "errorDetails": null,
  "metadata": { "currency": "INR", "resourceId": "8cdf0e1c-9bdc-4de4-97d8-85a85ca4075b", "amountCents": 5785, "resourceType": "ESIM_ORDER" },
  "durationMs": null,
  "isSensitiveMasked": false,
  "ip": "203.0.113.7",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "platform": null,
  "appVersion": null,
  "customer": { "id": "a5d5977b-28c8-470e-8e41-e2e3c32d2507", "email": "jane.doe@example.com", "name": "Jane Doe", "role": "USER" }
}
```

The same event for **support**:
```json
{ "ip": "203.0.113.0/24", "userAgent": "Chrome on macOS",
  "customer": { "id": "a5d5977b-…", "email": "j***@e***.com", "name": "J. D.", "role": "USER" } }
```

Notes:
- Any field may be `null` — render "—".
- `metadata` / `errorDetails` are small objects with varying keys — render as a key/value list (nested objects
  as JSON in a monospace block). Amounts are **cents** with a `currency` next to them when known; some rows
  hold `amountCents` as a **string** (e.g. `"5785"`) — always `Number()` it.
- `customer.role` can be `USER`, `GUEST`, `ADMIN`, … — show a "Guest" badge for `GUEST`.
- Supplier calls keep the supplier's own HTTP status in `metadata.upstreamStatus` and the operation in
  `metadata.operation` (e.g. `POST /v2/orders/lounges/ePasses/bundle`); `httpStatus` / `route` describe
  **our** request that triggered it.

### 5.3 `GET /events/:id` — one event with what it links to (admin + support)

```json
{
  "event": { /* Event */ },
  "parent": null,
  "children": [ /* Events whose parentEventId = this id */ ],
  "sameRequestEvents": 5,
  "dragonpassApiLog": null,
  "payment": {
    "id": "eee91a6d-b33e-4380-9f93-6175516b3653",
    "status": "FULFILLED",
    "resourceType": "ESIM_ORDER",
    "resourceId": "8cdf0e1c-9bdc-4de4-97d8-85a85ca4075b",
    "amountCents": "5785",
    "currency": "INR",
    "provider": "MINT",
    "createdAt": "2026-10-06T08:51:47.459Z",
    "updatedAt": "2026-10-06T08:52:12.535Z"
  }
}
```
- `dragonpassApiLog` (DragonPass supplier calls only): `{ id, method, endpoint, responseStatus, success, durationMs, errorMessage, createdAt }` — request/response bodies are deliberately not returned.
- `payment`: when the event is about a payment. `status` values: `INITIATED`, `REQUIRES_ACTION`, `FAILED`,
  `CHARGED`, `FULFILLING`, `FULFILLED`, `FULFILLMENT_FAILED`, `REFUNDING`, `REFUNDED`, `RECONCILING`, `ABANDONED`.
- `sameRequestEvents` > 1 → show a link "See all N events of this request" → Trace.
- 404 if the id doesn't exist or was purged.

### 5.4 `GET /trace/:requestId` — everything about one request (admin + support)

```json
{
  "requestId": "9bb7530f8c3ecfb3",
  "customer": { "id": "a5d5977b-…", "email": "j***@e***.com", "name": "J. D.", "role": "USER" },
  "anonId": null,
  "journeyId": null,
  "route": "/api/v1/payments/3ds-return",
  "references": [{ "type": "payment", "id": "eee91a6d-b33e-4380-9f93-6175516b3653" }],
  "supplierCalls": [ /* Events, eventType supplier_call */ ],
  "errors": [ /* Events with status failure */ ],
  "events": [ /* every Event of the request, oldest first */ ]
}
```
Empty `events` → "No events for this reference (older than N days, or mistyped)". A browser-side failure
reported by the customer's browser is linked here too (same `requestId`).

### 5.5 `GET /journeys/:journeyId` — one booking attempt (admin + support)

Real example (a sandbox lounge booking with 3DS):
```json
{
  "journeyId": "beef7e28-f6a8-48c5-ade9-a8623e0d4eaa",
  "customer": { "id": "a5d5977b-…", "email": "jane.doe@example.com", "name": "Jane Doe", "role": "USER" },
  "services": ["lounge"],
  "outcome": "booked",
  "startedAt": "2026-10-06T08:49:55.077Z",
  "endedAt": "2026-10-06T08:50:38.260Z",
  "durationMs": 43183,
  "errors": 0,
  "payments": ["861755f5-d76f-4757-a295-a3cb07523d30"],
  "events": [ /* Events oldest first — the steps were:
    08:49:55 step     prebook_selected
    08:49:55 step     checkout_started
    08:50:13 step     payment_submitted
    08:50:19 payment  payment_3ds_required
    08:50:24 payment  payment_succeeded
    08:50:31 step     booking_confirmed
    08:50:31 step     prebooking_confirmed
    08:50:31 payment  booking_fulfilled
    08:50:38 step     confirmation_email_sent */ ]
}
```
`outcome` values → label + colour:

| `outcome` | Label | Colour |
|---|---|---|
| `booked` | Booked | green |
| `booked_then_cancelled` | Booked, later cancelled | grey |
| `paid_not_booked` | **Paid but not booked** | red (critical) |
| `payment_declined` | Payment declined | orange |
| `payment_in_progress` | Payment in progress | blue |
| `checkout_not_paid` | Checkout not paid | grey |
| `browsing` | Browsing only | grey |

### 5.6 `GET /users/:userId/timeline` and `GET /guests/:anonId/timeline` (admin + support)

Query: `from`, `to`, `service`, `severity`, `limit`, `cursor` (same rules as §5.1). Response = the §5.1 page
plus the customer:
```json
{ "events": [ … ], "nextCursor": null, "critical": { "count": 0, "latest": [] },
  "customer": { "id": "a5d5977b-…", "email": "j***@e***.com", "name": "J. D.", "role": "USER" } }
```
(`customer` is `null` for the guest timeline.) A guest's anonymous browsing done **before** they logged in is
linked to their account automatically (step `history_linked` shows how many events were linked).

### 5.7 `GET /bookings/:referenceType/:referenceId` — a booking's audit trail (admin + support)

`referenceType`: `payment`, `lounge_visit`, `esim_order`, `esim_topup`, `transfer_booking`,
`club_membership`, … `referenceId`: the id / order number. Returns the events directly about it **plus every
journey they belong to** (so you get the whole checkout → payment → supplier story):
```json
{ "referenceType": "payment", "referenceId": "861755f5-d76f-4757-a295-a3cb07523d30",
  "journeys": ["beef7e28-f6a8-48c5-ade9-a8623e0d4eaa"], "events": [ /* 9 Events, oldest first */ ] }
```
Tip: from a payment / booking detail page elsewhere in the CRM, link to this with the payment id.

### 5.8 `GET /stuck` — stuck customers right now (admin + support)

Query: `rules` (list of stuck rule keys), `limit` (per rule, 1–1000, default 200). Response:
```json
{ "items": [
  {
    "rule": "prebooking_pending",
    "severity": "high",
    "description": "DragonPass prebooking still pending",
    "userId": "a5d5977b-28c8-470e-8e41-e2e3c32d2507",
    "journeyId": null,
    "service": "fitness",
    "referenceType": "lounge_visit",
    "referenceId": "59506363-1f8b-4129-b887-784834089857",
    "since": "2026-09-11T08:07:56.911Z",
    "minutesStuck": 36148,
    "details": { "resourceId": "GR0000331", "dragonpassOrderId": "IGC20260911BJ0OGR8" },
    "customer": { "id": "a5d5977b-…", "email": "j***@e***.com", "name": "J. D.", "role": "USER" }
  }
] }
```
Sorted most severe first, then longest stuck. Computed live (not stored). `details` keys per rule:

| Rule | `details` |
|---|---|
| `checkout_abandoned` | `paymentStatus`, `amountCents`, `currency` |
| `paid_not_booked` | `paymentStatus`, `resourceType`, `resourceId`, `amountCents`, `currency` |
| `repeated_error` | `error`, `occurrences`, `lastAt`, `lastMessage` |
| `esim_not_ready` | `orderStatus`, `paymentId` |
| `transfer_pending` | `reservationNo`, `outcomeUnknown`, `paymentId` |
| `prebooking_pending` | `resourceId`, `dragonpassOrderId` |
| `refund_pending` | `paymentId`, `amountCents`, `currency` |

Look-back: informational rules 5 days, money rules (`paid_not_booked`, `transfer_pending`,
`refund_pending`) 30 days.

### 5.9 `GET /errors/summary` — live error counts (admin + support)

Query: `from`, `to` (default: last 24 h), `service` (list). Real response:
```json
{
  "from": "2026-10-05T10:35:38.023Z",
  "to": "2026-10-06T10:35:38.023Z",
  "total": 7,
  "bySeverity": { "low": 6, "high": 1 },
  "byHttpStatusClass": { "4xx": 6, "none": 1 },
  "bySupplier": { "none": 6, "esim": 1 },
  "byService": { "notification": 3, "profile": 3, "esim": 1 },
  "topErrors": [
    { "errorCode": "unauthorized", "message": "Invalid or expired token.", "count": 6 },
    { "errorCode": "200010", "message": "eSIM Access error 200010: the batchOrder has been getting resource, total:[1], success:[0] (POST /open/esim/query)", "count": 1 }
  ]
}
```
`"none"` = errors with no HTTP status / no supplier. Each bucket is capped at the top 20. Clicking a bucket
should open the event list with that filter.

### 5.10 `GET /funnels` — conversion (admin + support)

Query: `service` (one service, optional = all), `from`, `to` (default: last 7 days). Real response:
```json
{
  "from": "2026-09-29T10:35:38.029Z", "to": "2026-10-06T10:35:38.029Z", "service": "lounge",
  "steps": [
    { "step": "search", "events": 0, "journeys": 0, "conversionFromCheckout": null },
    { "step": "checkout_started", "events": 1, "journeys": 1, "conversionFromCheckout": 100 },
    { "step": "payment_submitted", "events": 1, "journeys": 1, "conversionFromCheckout": 100 },
    { "step": "payment_succeeded", "events": 1, "journeys": 1, "conversionFromCheckout": 100 },
    { "step": "booking_confirmed", "events": 1, "journeys": 1, "conversionFromCheckout": 100 }
  ]
}
```
`conversionFromCheckout` is a percentage (one decimal) relative to `checkout_started`; searches aren't tied
to a journey, so `search` has no conversion — show its count only.

### 5.11 `GET /daily-summaries` — trends, up to 365 days (admin + support)

Query: `from`, `to` (`YYYY-MM-DD`, UTC days), `service` (one service or `all`, default `all`). Response
`{ "summaries": [ … ] }`, oldest first, one row per day. Row shape (real, a quiet day):
```json
{
  "id": "7eb64d28-ee58-40b6-839e-5de10fb033ef",
  "date": "2026-10-05",
  "service": "all",
  "totalEvents": 0, "uniqueCustomers": 0, "uniqueGuests": 0,
  "journeysStarted": 0, "journeysCompleted": 0,
  "totalErrors": 0, "bookingFailures": 0, "stuckJourneys": 0,
  "downtimeIncidents": 0, "downtimeMinutes": 0, "alertsSent": 0,
  "errorsBySeverity": {},
  "errorsByHttpStatus": {},
  "errorsBySupplier": {},
  "supplierLatency": {},
  "paymentFailures": { "declines": 0, "byDeclineCode": {}, "paidNotBooked": 0, "refundFailures": 0 },
  "stuckByRule": { "esim_not_ready": 0, "refund_pending": 0, "repeated_error": 0, "paid_not_booked": 0, "transfer_pending": 0, "checkout_abandoned": 0, "prebooking_pending": 0 },
  "topErrors": [],
  "topFailingRoutes": [],
  "frontendErrors": { "byStep": {}, "networkErrors": 0 },
  "funnel": {},
  "createdAt": "2026-10-06T10:00:54.636Z",
  "updatedAt": "2026-10-06T10:00:54.636Z"
}
```
A busy day's JSON columns look like (real values from 06 Oct):
```json
{
  "errorsBySeverity": { "low": 6, "high": 1 },
  "errorsByHttpStatus": { "401": 6, "4xx": 6 },
  "errorsBySupplier": { "esim": 1 },
  "supplierLatency": {
    "mint": { "avgMs": 2230, "p95Ms": 3585, "calls": 4 },
    "dragonpass": { "avgMs": 788, "p95Ms": 2597, "calls": 14 },
    "esim": { "avgMs": 457, "p95Ms": 813, "calls": 2 }
  },
  "funnel": { "checkout_started": 1, "payment_submitted": 1, "payment_succeeded": 2, "booking_confirmed": 1 },
  "topErrors": [{ "errorCode": "unauthorized", "message": "Invalid or expired token.", "count": 6 }],
  "topFailingRoutes": [{ "route": "/api/v1/notifications/unread-count", "httpStatus": 401, "count": 3 }]
}
```
Notes: `errorsByHttpStatus` mixes exact codes (`"401"`) and classes (`"4xx"`) — split by key pattern.
`stuckByRule` is `{}` on back-filled days (a "right now" snapshot taken only when yesterday is summarised).
A summary appears ~1 h after midnight UTC for the previous day. Days with no row = no data (before the audit
log existed / beyond retention).

### 5.12 `GET /alerts` — alerts VeloxVerse raised / emailed (admin + support)

Query: `status` (`open` | `resolved` | `all`, default all), `type` (alert type), `from`, `to` (on
`firstSeenAt`), `limit` (1–500, default 100). Real response:
```json
{
  "openCount": 1,
  "alerts": [
    {
      "id": "5ef909c3-e394-428e-8cf4-24f1b421a787",
      "alertKey": "downtime|system||crm_forms",
      "type": "downtime",
      "severity": "critical",
      "service": "system",
      "supplier": null,
      "errorCode": "crm_forms",
      "recipients": [],
      "subject": "crm_forms is down",
      "firstSeenAt": "2026-10-06T09:50:45.947Z",
      "lastSeenAt": "2026-10-06T10:35:14.773Z",
      "lastSentAt": "2026-10-06T10:23:58.347Z",
      "occurrenceCount": 15,
      "resolvedAt": null,
      "createdAt": "2026-10-06T09:50:45.947Z",
      "updatedAt": "2026-10-06T10:35:14.773Z"
    }
  ]
}
```
- `resolvedAt: null` = still open. `recipients: []` = nobody was emailed (no recipients configured) — show a
  warning "No one received this alert — add recipients in Settings".
- `type: daily_digest` rows are the "digest sent" markers (one per day) — filter them out of the alerts list
  by default, or show them in a separate "Digests" tab.
- Clicking an alert → event list filtered by its `service` / `supplier` / `errorCode` and the
  `firstSeenAt`–`lastSeenAt` window.

### 5.13 `GET /settings` · `PUT /settings` (admin only)

GET response (real):
```json
{ "settings": {
  "retentionDays": 5,
  "summaryRetentionDays": 365,
  "alertsEnabled": true,
  "thresholds": {
    "spikeCount": 10, "spikeWindowMinutes": 15,
    "errorRatePercent": 5, "errorRateWindowMinutes": 5,
    "supplierConsecutiveFailures": 5, "supplierFailureRatePercent": 50, "supplierWindowMinutes": 5,
    "paymentDeclineRatePercent": 30, "paymentWindowMinutes": 15,
    "cooldownMinutes": 30
  },
  "minRetentionDays": 5,
  "updatedBy": null,
  "updatedAt": "2026-10-06T07:43:36.412Z"
} }
```
PUT body — every field optional, unknown keys rejected (400), thresholds may be partial:

| Field | Rule |
|---|---|
| `retentionDays` | integer 5–90 (detailed logs) |
| `summaryRetentionDays` | integer 5–1095, and ≥ `retentionDays` |
| `alertsEnabled` | boolean — turns all alert emails on/off |
| `thresholds.spikeCount` | 1–10000 (same error this many times …) |
| `thresholds.spikeWindowMinutes` | 1–1440 (… within this many minutes) |
| `thresholds.errorRatePercent` / `errorRateWindowMinutes` | 1–100 / 1–1440 (server errors share of requests) |
| `thresholds.supplierConsecutiveFailures` | 1–10000 |
| `thresholds.supplierFailureRatePercent` / `supplierWindowMinutes` | 1–100 / 1–1440 |
| `thresholds.paymentDeclineRatePercent` / `paymentWindowMinutes` | 1–100 / 1–1440 |
| `thresholds.cooldownMinutes` | 5–1440 (max one email per alert per this many minutes) |

Example: `PUT { "retentionDays": 7, "thresholds": { "cooldownMinutes": 45 } }` → 200 with the full updated
`settings`. Bad value → 400:
```json
{ "success": false, "message": "Validation failed",
  "errors": [{ "field": "retentionDays", "message": "Number must be greater than or equal to 5" }], "requestId": "df79454e20692e49" }
```
Changes take effect within ~1 minute. Every change is logged (who, before, after).

### 5.14 Alert recipients (admin only)

| Method + path | Body | Response |
|---|---|---|
| `GET /alert-recipients` | — | `{ "recipients": [Recipient] }` |
| `POST /alert-recipients` | `{ email, name?, alertTypes?, minSeverity?, services?, isActive? }` | 201 `{ "recipient": Recipient }` · 409 duplicate email |
| `PUT /alert-recipients/:id` | any of the same fields | `{ "recipient": Recipient }` · 409 if the new email exists |
| `DELETE /alert-recipients/:id` | — | `{ "deleted": true }` |
| `POST /alert-recipients/:id/test` | — | `{ "sent": true, "email": "ops@example.com" }` · 502 if SMTP failed |

Recipient (real):
```json
{
  "id": "23c11cc9-5b05-4913-8ad3-9c01025cc45f",
  "email": "ops@example.com",
  "name": "Ops on-call",
  "alertTypes": ["critical", "downtime", "daily_digest"],
  "minSeverity": "high",
  "services": [],
  "isActive": true,
  "createdAt": "2026-10-06T10:35:38.057Z",
  "updatedAt": "2026-10-06T10:35:38.057Z"
}
```
Field rules (show these as help text in the form):
- `email` — required on create; stored lower-case; unique (case-insensitive).
- `alertTypes` — any of `critical`, `spike`, `supplier_down`, `payment_issue`, `downtime`, `daily_digest`.
  **Empty = every immediate alert type, but NOT the daily digest.** The digest is opt-in: it must be ticked.
- `minSeverity` — `low` | `medium` | `high` (default) | `critical`: only alerts at least this severe.
  (Not applied to the daily digest.)
- `services` — empty = all services; otherwise only alerts about those services (alerts with no service,
  e.g. downtime, always go).
- `isActive` — false = keep the row but send nothing.
- If **no recipient exists at all**, VeloxVerse sends immediate alerts to a fallback list from its env
  (`AUDIT_ALERT_FALLBACK_EMAILS`) — show an info banner on the empty recipients list explaining that.

### 5.15 `GET /export.csv` (admin only)

Same query params as §5.1 (`limit` / `cursor` ignored). Returns `text/csv; charset=utf-8`, newest first,
**max 10,000 rows**, with headers:
```
Content-Disposition: attachment; filename="audit-log-2026-10-06-10-35.csv"
X-Export-Rows: 26
X-Export-Truncated: false
```
Columns: `created_at, severity, service, event_type, step, status, actor, supplier, http_method, route,
http_status, error_code, error_message, reference_type, reference_id, request_id, journey_id, user_id,
anon_id, duration_ms`. Every value is quoted; values starting with `= + - @` are prefixed with `'`
(spreadsheet-formula safe). 

> ⚠️ **The CRM proxy only forwards JSON** (it parses with axios and re-sends with `res.json()`), so this CSV
> can't pass through it unchanged today. Two options:
>
> **A (recommended) — let the proxy stream this one file.** VeloxVerse's export enforces admin-only, records
> who exported, and is formula-safe. In `veloxverseProxy.js`, for paths ending in `.csv`, request with
> `responseType: 'arraybuffer'` and send the bytes with the upstream `content-type`, `content-disposition`,
> `x-export-rows`, `x-export-truncated` headers (`res.set(...)`, `res.status(r.status).send(Buffer.from(r.data))`).
> Frontend: `api.get(`${VV}/admin/audit/export.csv`, { params, responseType: 'blob' })`, read the filename
> from `content-disposition`, then the Blob/anchor logic of `downloadCsv` in
> `features/veloxverse-admin/csv.ts`. If `x-export-truncated` is `true`, show "Only the newest 10,000 rows
> were exported — narrow the filters". (Expose the `x-export-*` headers in the CRM backend's CORS if it
> restricts exposed headers.)
>
> **B (no proxy change) — build the CSV in the browser** like the existing VeloxVerse pages do:
> `fetchAllPages` over `GET /events` (`limit=200`, follow `nextCursor`, stop at 10,000), then `toCsv(header,
> rows)` + `downloadCsv(filename, csv)` from `csv.ts` (already formula-safe), with the same columns as
> above. Downsides: many requests, and VeloxVerse records it as searches rather than an export. Show the
> button to admins only either way.

---

## 6. Reference data

### 6.1 Services (labels to show)

| `service` | Label |
|---|---|
| `lounge` | VeloxLounge — Lounge |
| `fasttrack` | VeloxLounge — Fast Track |
| `fitness` | VeloxLounge — Fitness |
| `dining` | VeloxLounge — Dining |
| `esim` | VeloxeSIM |
| `assist_transfer` | VeloxAssist — Pick & Drop |
| `club` | VeloxClub |
| `travel_flight` / `travel_hotel` / `travel_car` | VeloxTravel — Flights / Hotels / Cars (not live yet) |
| `auth` | Login & account |
| `profile` | Profile & devices |
| `payment` | Payments |
| `credit` / `points` / `referral` / `promo` | Credit / Points / Referral / Promo codes |
| `billing` | Billing |
| `support` | Support tickets |
| `notification` | Notifications |
| `system` | System |

Suppliers: `dragonpass` DragonPass · `mint` Mint Payments · `esim` eSIM Access · `travelfusion`
Travelfusion · `viatovia` ViaTovia · `email` Email · `s3` File storage.

### 6.2 Event types

| `eventType` | Label | Icon idea |
|---|---|---|
| `step` | Customer step | footprints |
| `page_view` | Page view | eye |
| `api_error` | API error | alert-circle |
| `supplier_call` | Supplier call | plug |
| `payment` | Payment | credit-card |
| `webhook` | Webhook | webhook |
| `job` | Background job | clock |
| `frontend_error` | Browser error | monitor-x |
| `downtime` | Downtime | server-off |
| `system_error` | System error | bug |
| `admin_access` | Staff viewed logs | shield |

### 6.3 Step catalogue (all 142, by group)

Show `step` humanised (`payment_declined` → "Payment declined") unless you add nicer labels.

| Group | Steps |
|---|---|
| HTTP errors (automatic, event type api_error) | `validation_failed` · `unauthorized` · `payment_required` · `forbidden` · `not_found` · `route_not_found` · `conflict` · `rate_limited` · `client_error` · `server_error` · `service_unavailable` · `gateway_error` |
| System (system_error / downtime) | `unhandled_rejection` · `uncaught_exception` · `downtime_started` · `downtime_recovered` |
| Supplier calls (supplier_call) | `supplier_call_succeeded` · `supplier_failed` · `supplier_timeout` · `search_poll_timeout` |
| Payments (payment) | `payment_succeeded` · `payment_declined` · `payment_3ds_required` · `payment_amount_mismatch` · `booking_fulfilled` · `paid_not_fulfilled` · `refund_succeeded` · `refund_failed` · `refund_outcome_unknown` |
| Webhooks (webhook) | `webhook_processed` · `webhook_duplicate` · `webhook_ignored` · `webhook_failed` · `webhook_rejected` |
| Jobs (job) | `job_failed` · `job_item_failed` |
| Common journey steps (step) | `search` · `availability_checked` · `no_availability` · `checkout_started` · `payment_submitted` · `booking_confirmed` · `confirmation_email_sent` · `confirmation_email_failed` · `cancel_requested` · `cancelled` · `cancel_failed` |
| Lounge / Fast Track / Fitness / Dining (step) | `resource_viewed` · `walkin_pass_selected` · `prebook_selected` · `pax_limit_reached` · `benefit_applied` · `epass_issued` · `prebooking_confirmed` · `schedule_viewed` · `fitness_checkin` · `fitness_checkin_failed` · `dragonpass_status_changed` |
| eSIM (step) | `package_selected` · `order_created` · `esim_provisioning` · `esim_ready` · `esim_provisioning_failed` · `topup_started` · `topup_completed` · `topup_failed` · `esim_suspended` · `esim_resumed` |
| VeloxAssist transfers (step) | `place_search` · `quote_received` · `no_quotes` · `quote_expired` · `price_changed` · `transfer_booked` · `transfer_status_changed` |
| VeloxTravel — deferred to Phase 2 (step) | `search_completed` · `results_returned` · `no_results` · `offer_selected` · `price_checked` · `price_changed` · `ticket_issued` · `ticketing_failed` · `book_started` · `booked` · `book_failed` |
| VeloxClub (step) | `tier_viewed` · `upgrade_preview` · `promo_applied` · `promo_rejected` · `membership_activated` · `membership_activation_failed` · `renewal_started` · `renewed` · `renewal_failed` |
| Auth & account (step) | `signup_started` · `otp_sent` · `otp_verified` · `otp_failed` · `otp_expired` · `signup_completed` · `login_succeeded` · `login_failed` · `logout` · `password_reset_requested` · `password_reset_completed` · `guest_login` · `guest_verified` · `guest_upgraded` · `profile_updated` · `avatar_uploaded` · `history_linked` |
| Credit / Points / Referral / Promo (step) | `credit_applied` · `credit_released` · `points_redeemed` · `points_earned` · `referral_validated` · `referral_rejected` · `referral_redeemed` · `promo_validated` · `promo_rejected` · `promo_redeemed` |
| Support / billing / devices (step) | `ticket_created` · `ticket_replied` · `invoice_downloaded` · `statement_exported` · `device_added` · `device_removed` |
| Key page views — browser (page_view) | `service_page_viewed` · `item_viewed` · `checkout_viewed` · `result_viewed` |
| Browser failures (frontend_error) | `network_error` · `request_timeout` · `page_crashed` · `script_error` · `payment_widget_failed` · `three_ds_closed` · `form_validation_failed` |
| Audit-log use by staff (admin_access) | `audit_events_searched` · `audit_record_viewed` · `audit_exported` · `audit_settings_changed` · `audit_recipients_changed` |

### 6.4 Severities

| Severity | Colour | Badge |
|---|---|---|
| critical | `#dc2626` | solid red, white text, pinned |
| high | `#ea580c` | solid orange |
| medium | `#ca8a04` | amber outline |
| low | `#2563eb` | blue outline |
| info | `#64748b` | grey, subtle |

(Also available from `GET /meta` → `severities`.)

### 6.5 Status, source, actor
- `status`: `success` (green check), `failure` (red x), `warning` (amber), `info` (grey dot).
- `source`: `backend` Server · `frontend` Customer's browser · `webhook` Supplier webhook · `job` Background job · `admin` Staff.
- `actor`: `customer` · `guest` · `admin` · `support` · `system`.

---

## 7. Screens to build

Put them under one sidebar entry **"VV Audit Logs"** → `/dashboard/veloxverse/audit-logs` (inside the existing
VeloxVerse section; Phase 1 roles `super_admin` + `admin`, Phase 2 + support). Routes:

| Screen | Path |
|---|---|
| 7.1 List (+ 7.2 drawer via `?event=<id>`) | `/dashboard/veloxverse/audit-logs` |
| 7.3 Trace | `/dashboard/veloxverse/audit-logs/trace/:requestId` |
| 7.4 Journey | `/dashboard/veloxverse/audit-logs/journeys/:journeyId` |
| Guest timeline | `/dashboard/veloxverse/audit-logs/guests/:anonId` |
| 7.7 Stuck | `/dashboard/veloxverse/audit-logs/stuck` |
| 7.8 Errors | `/dashboard/veloxverse/audit-logs/errors` |
| 7.9 Trends | `/dashboard/veloxverse/audit-logs/trends` |
| 7.10 Alerts | `/dashboard/veloxverse/audit-logs/alerts` |
| 7.11 Settings (admin only) | `/dashboard/veloxverse/audit-logs/settings` |

Use a `Tabs` header (List · Stuck · Errors · Trends · Alerts · Settings) on the audit-log pages; 7.5 and 7.6 are
sections added to existing pages. Screens:

### 7.1 Audit log — list (`/…/audit-logs`)
- **Header**: title, "Detailed logs: last N days" (from `/meta`), critical count badge (from
  `critical.count`), **global search box** (behaviour §4.3), date range (default last 24 h; max = retention),
  "Export CSV" (admin only).
- **Filters** (multi-select from `/meta`): service, severity, event type, status, supplier, step
  (searchable), HTTP status, error code, customer email. Put filters in the URL query string so links can be
  shared. "Show staff access" toggle → adds `eventType=admin_access`.
- **Pinned critical panel** (first page only): up to 10 latest critical events, red.
- **Table** (newest first, infinite scroll or "Load more" with `nextCursor`): time · severity badge · service ·
  event type icon · step · status · customer (email or "Guest") · supplier · HTTP status · error code + short
  message (1 line, ellipsis) · reference. Row click → detail drawer (7.2).
- Empty states: "No events in this range" / "Detailed logs older than N days are deleted — see Daily trends".

### 7.2 Event detail drawer (`/events/:id`)
- Header: severity, step, time (local + UTC tooltip), status, source, actor.
- Sections: Customer (link to timeline 7.5) · Ids (journey → 7.4, request → 7.3, session, browser, reference →
  7.6; each copyable) · Error (code, message in monospace, `errorDetails` key/value) · Request (method, route,
  HTTP status, duration) · Supplier (supplier, `metadata.operation`, `metadata.upstreamStatus`, DragonPass log
  summary) · Payment summary · Metadata (key/value) · Device (ip, browser, platform, app version) · Parent /
  children links · "N events in this request" link.
- Masked-for-support note when applicable.

### 7.3 Trace view (`/trace/:requestId`)
A vertical chain: **Customer → Journey → Request (route) → Supplier calls → Errors**, then the full event
list oldest first with relative times (+120 ms). Supplier calls show operation, duration, upstream status,
error code. Errors highlighted. This is the screen support opens when a customer quotes a reference.

### 7.4 Journey timeline (`/journeys/:journeyId`)
- Header: customer, services, **outcome badge** (§5.5), started / ended / duration, errors count, payment
  links (→ booking trail 7.6).
- Vertical timeline oldest → newest; group by phase if you like (Browse / Checkout / Payment / Supplier /
  After booking). Failures in red with the reason inline. Steps recorded by webhook / job show a small
  "system" tag. Show gaps > 5 min ("customer left for 12 min").

### 7.5 Customer "Activity" tab (on `VVUserDetailPage`, `/dashboard/veloxverse/users/:id`)
- `GET /users/:userId/timeline` with infinite scroll; filters: service, severity, date range.
- Top: last 5 days' counts (journeys, errors) and quick links to their journeys.
- Also add an **"Activity" link from guest records** (if the CRM shows guests) → `/guests/:anonId/timeline`.

### 7.6 Booking "Audit trail" (on existing booking / payment detail pages)
- Add an "Audit trail" section/tab → `GET /bookings/:referenceType/:referenceId`:
  - `VVLoungeBookingDetailPage` (`:visitId`) → `lounge_visit` + visitId (or `payment` + the visit's payment id
    if the page has it — gives the full checkout story);
  - `VVEsimDetailPage` (`:orderNo`) → `esim_order` + orderNo;
  - transfers (row detail in `VVTransfersPage`) → `transfer_booking` + order no (`TRF-…`);
  - `VVSupportDetailPage` → `GET /events?referenceId=<case id>` (support tickets are `support_ticket`).
  Show as a compact timeline; link to the journey view.

### 7.7 Stuck customers (`/…/audit-logs/stuck`)
- Table grouped or filterable by rule: severity · rule description · customer · service · reference · stuck for
  (humanised minutes, e.g. "25 days") · since · details (per-rule, §5.8) · actions ("Open journey" if
  `journeyId`, "Open booking trail", "Open customer").
- `paid_not_booked` and other critical rows always on top in red. Auto-refresh every 60 s.
- Empty state: "Nobody is stuck right now 🎉" (or without emoji per CRM style).

### 7.8 Errors dashboard (`/…/audit-logs/errors`)
- `GET /errors/summary` for a chosen range (24 h default; 1 h / 24 h / 7 days quick picks): total, donut by
  severity, bars by service / supplier / HTTP class, top errors table (code, message, count → click filters
  the list).
- `GET /alerts?status=open` count as a banner ("2 open alerts").

### 7.9 Daily trends (`/…/audit-logs/trends`)
- `GET /daily-summaries?from&to&service` (default last 30 days, up to 365): line charts — events, customers,
  journeys started vs completed (conversion %), errors by severity (stacked), booking failures, stuck,
  downtime minutes, supplier p95 latency per supplier, payment declines; top errors of the selected day.
- Service selector (`all` + each service). Funnel card from `GET /funnels` for the selected service / range.
- Note "Days are UTC".

### 7.10 Alerts (`/…/audit-logs/alerts`)
- Tabs Open / Resolved / All; table: severity · type · subject · service / supplier / error code · first seen ·
  last seen · occurrences · emailed to (or warning if empty) · resolved at. Hide `daily_digest` rows (or a
  separate "Digests" tab).

### 7.11 Settings & recipients (admin only, `/…/audit-logs/settings`)
- **Retention**: detailed logs days (5–90), daily summaries days (≥ detailed, ≤ 1095). Explain: "Detailed
  events older than this are deleted after their daily summary is made."
- **Alerts**: on/off switch; thresholds form with plain-language labels (e.g. "Error spike: the same error
  [10] times within [15] minutes"); "Reset to defaults" (defaults in §5.13).
- **Recipients** table + add/edit dialog (email, name, alert-type checkboxes incl. "Daily digest (opt-in)",
  minimum severity, services multi-select, active switch) + "Send test email" + delete (confirm dialog).
- Show who last changed settings (`updatedBy`, `updatedAt`).
- Support users must not see this page (and get 403 anyway).

---

## 8. Suggested CRM code layout

> Follow the existing `features/veloxverse-admin` layout (§3.4):

```
frontend/src/features/veloxverse-admin/
  vvAdminService.ts        // + vvAuditService: one function per endpoint in §5 (cleanParams, VVResponse<T>)
  types.ts                 // + "Audit logs" section with the types below (or auditTypes.ts re-exported)
  audit.ts                 // labels (services, humanised steps, outcomes), severity → Badge variant + colour,
                           // time formatting with zone, search-box routing (§4.3), details formatting per stuck rule
  audit.test.ts            // Vitest: search routing, labels, outcome colours, masking note logic
  hooks/useVVAudit.ts      // useVVAuditMeta, useVVAuditEvents (infinite), useVVAuditEvent, useVVAuditTrace,
                           // useVVAuditJourney, useVVAuditTimeline, useVVAuditBookingTrail, useVVAuditStuck,
                           // useVVAuditErrors, useVVAuditFunnel, useVVAuditSummaries, useVVAuditAlerts,
                           // useVVAuditSettings (+ mutation), useVVAuditRecipients (+ mutations), export
  components/audit/        // SeverityBadge, StatusIcon, EventTypeIcon, CustomerCell, EventTable, EventDrawer,
                           // Timeline, KeyValueList, CopyId, MaskedNote, AuditTabs
  pages/
    VVAuditLogPage.tsx  VVAuditTracePage.tsx  VVAuditJourneyPage.tsx  VVAuditGuestPage.tsx
    VVAuditStuckPage.tsx  VVAuditErrorsPage.tsx  VVAuditTrendsPage.tsx  VVAuditAlertsPage.tsx
    VVAuditSettingsPage.tsx
frontend/src/app/Router.tsx          // + routes (§7)
frontend/src/config/sidebarConfig.ts // + "VV Audit Logs" for super_admin and admin
backend/node-crm/src/middleware/veloxverseProxy.js  // only if CSV option A (§5.15)
backend/node-crm/src/app.js                         // only in Phase 2 (support access, §3.5)
```

Severity → existing `Badge` variants: critical → `danger`, high → `warning`, medium → `warning` (outline /
lighter), low → `info`, info → `neutral` — plus the exact colours of §6.4 if you add a custom badge.

TypeScript types (copy these):

```ts
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type EventStatus = 'success' | 'failure' | 'warning' | 'info';

export interface AuditCustomer { id: string; email: string | null; name: string | null; role: string | null }

export interface AuditEvent {
  id: string; createdAt: string;
  service: string; eventType: string; step: string; status: EventStatus; severity: Severity;
  source: 'backend' | 'frontend' | 'webhook' | 'job' | 'admin';
  actor: 'customer' | 'guest' | 'admin' | 'support' | 'system';
  supplier: string | null;
  userId: string | null; anonId: string | null; sessionId: string | null; journeyId: string | null;
  requestId: string | null; supplierCallId: string | null; parentEventId: string | null;
  httpMethod: string | null; route: string | null; httpStatus: number | null;
  referenceType: string | null; referenceId: string | null;
  errorCode: string | null; errorMessage: string | null; errorDetails: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null; durationMs: number | null; isSensitiveMasked: boolean;
  ip: string | null; userAgent: string | null; platform: string | null; appVersion: string | null;
  customer: AuditCustomer | null;
}

export interface EventPage { events: AuditEvent[]; nextCursor: string | null; critical: { count: number; latest: AuditEvent[] } }

export interface EventDetail {
  event: AuditEvent; parent: AuditEvent | null; children: AuditEvent[]; sameRequestEvents: number;
  dragonpassApiLog: { id: string; method: string; endpoint: string; responseStatus: number | null; success: boolean; durationMs: number | null; errorMessage: string | null; createdAt: string } | null;
  payment: { id: string; status: string; resourceType: string; resourceId: string; amountCents: number | string; currency: string; provider: string; createdAt: string; updatedAt: string } | null;
}

export interface Trace {
  requestId: string; customer: AuditCustomer | null; anonId: string | null; journeyId: string | null; route: string | null;
  references: Array<{ type: string | null; id: string | null }>;
  supplierCalls: AuditEvent[]; errors: AuditEvent[]; events: AuditEvent[];
}

export type JourneyOutcome = 'booked' | 'booked_then_cancelled' | 'paid_not_booked' | 'payment_declined' | 'payment_in_progress' | 'checkout_not_paid' | 'browsing';
export interface Journey {
  journeyId: string; customer: AuditCustomer | null; services: string[]; outcome: JourneyOutcome;
  startedAt: string | null; endedAt: string | null; durationMs: number | null; errors: number; payments: string[]; events: AuditEvent[];
}

export interface StuckItem {
  rule: string; severity: Severity; description: string; userId: string | null; journeyId: string | null; service: string;
  referenceType: string; referenceId: string; since: string; minutesStuck: number; details: Record<string, unknown>; customer: AuditCustomer | null;
}

export interface AuditAlert {
  id: string; alertKey: string; type: string; severity: Severity; service: string | null; supplier: string | null; errorCode: string | null;
  recipients: string[]; subject: string; firstSeenAt: string; lastSeenAt: string; lastSentAt: string | null;
  occurrenceCount: number; resolvedAt: string | null; createdAt: string; updatedAt: string;
}

export interface AuditThresholds {
  spikeCount: number; spikeWindowMinutes: number; errorRatePercent: number; errorRateWindowMinutes: number;
  supplierConsecutiveFailures: number; supplierFailureRatePercent: number; supplierWindowMinutes: number;
  paymentDeclineRatePercent: number; paymentWindowMinutes: number; cooldownMinutes: number;
}
export interface AuditSettings {
  retentionDays: number; summaryRetentionDays: number; alertsEnabled: boolean; thresholds: AuditThresholds;
  minRetentionDays: number; updatedBy: string | null; updatedAt: string;
}

export interface AlertRecipient {
  id: string; email: string; name: string | null; alertTypes: string[]; minSeverity: Severity; services: string[];
  isActive: boolean; createdAt: string; updatedAt: string;
}
```

---

## 9. Edge cases and gotchas

1. **Retention**: events older than `retentionDays` (default 5) are deleted. A link to an old event / journey
   returns 404 / empty — show "Detailed logs are kept N days; see Daily trends for older data".
2. **Guests**: `customer` is null for anonymous activity; `actor` = `guest`; use `anonId` for the guest
   timeline. After login, old anonymous rows get the `userId` (so they move into the customer timeline).
3. **System work on a customer's behalf** (webhooks, jobs, 3DS redirect): `actor` = `system` or `customer`
   with `source` = `job` / `webhook` — the row still has the customer's `userId` and the journey id.
4. **Amounts** are cents; may be strings — `Number()` before formatting; never add different currencies.
5. **Stack traces**: ignore `stack` in error replies (dev only).
6. **Big JSON**: `metadata` ≤ 4 KB; if VeloxVerse had to truncate it you'll see `{ "_truncated": true, "_keys": [...] }`.
   Redacted values appear as `[REDACTED]`; masked emails as `x***@y***.com` — render as-is.
7. **Time zones**: wire = UTC; daily summaries = UTC days; display local with the zone.
8. **Critical panel** only on the first page; keep it while paging.
9. **Staff access rows** (`admin_access`) exist and grow with use — hidden by default; don't count them as
   customer activity.
10. **Rate limits**: these routes share VeloxVerse's general API limit — debounce inputs; don't poll faster
    than every 60 s.
11. **VeloxTravel** services exist in `/meta` but have no data yet (deferred to Phase 2) — keep them in
    filters, they'll start filling later.
12. **`errorsByHttpStatus`** in summaries mixes codes and classes (`"401"` and `"4xx"`).
13. **`daily_digest` alerts** are markers, not incidents (hide by default).

---

## 10. Test checklist (definition of done)

Against VeloxVerse **sandbox / local** with a CRM admin account and a CRM support account:

- [ ] Admin: list loads with last 24 h; filters by service / severity / event type / supplier / step / status /
      HTTP status / error code / email; URL keeps filters; "Load more" pages with no duplicates.
- [ ] Critical events pinned and counted (create one: e.g. stop the VeloxVerse DB briefly in dev, or ask the
      backend team for a seeded critical event).
- [ ] Search box routes correctly for: a 16-hex reference, `ui-xxxxxxxx`, a journey UUID, a payment UUID, an
      email, an order number.
- [ ] Event drawer shows ids (copyable), error, request, supplier (+ DragonPass log summary), payment summary,
      metadata, device; parent / children links work.
- [ ] Trace view for a reference with supplier calls and an error.
- [ ] Journey view for a sandbox lounge booking shows the 9 steps and outcome **Booked**; a declined card
      shows **Payment declined**.
- [ ] Customer Activity tab and booking Audit trail (lounge visit / eSIM order / transfer / payment pages).
- [ ] Stuck page lists items with per-rule details and actions; refreshes every 60 s.
- [ ] Errors dashboard, Daily trends (30 days) and funnel render, including empty days.
- [ ] Alerts: open / resolved tabs; empty-recipients warning; digest rows hidden.
- [ ] Settings: retention 4 → inline error; 7 → saved; thresholds saved; reset to defaults; shows who changed.
- [ ] Recipients: add, duplicate email → error on the field, edit, deactivate, delete (confirm), send test
      email → success toast (and 502 → error toast).
- [ ] CSV export downloads with the right filename; truncated warning when > 10,000 rows.
- [ ] **Phase 2 — support account** (after §3.5): sees masked email / name / IP / browser everywhere; no
      Export button, no Settings page, no recipient actions; direct calls to those endpoints show "no
      permission" (CRM 403, or VeloxVerse 403 surfaced as 502) without crashing.
- [ ] Phase 1: an `employee` / `agent` / `affiliate` CRM user can't open the audit pages (RoleGuard redirect).
- [ ] Caches don't leak between an admin and a support login in the same browser.
- [ ] Error toasts show "Ref: <requestId>"; 401 goes through the normal re-login.
- [ ] No `dangerouslySetInnerHTML`; nothing logged to the console in production.
- [ ] Mobile / narrow widths: tables scroll horizontally; drawers full-screen.

---

## 11. Open questions / ask VeloxVerse for

1. **Which CRM role is "support"** (§3.5) — a new `support` role (VeloxVerse already accepts it) or an
   existing `agent` / `employee` (VeloxVerse must add that name to `CRM_ROLE_MAP`). Until decided, ship
   Phase 1 (admins only).
2. **CSV export**: option A (proxy streams `.csv`) or B (browser-built) — §5.15. A is recommended.
3. `VVUserDetailPage`'s `:id` is the VeloxVerse user id — confirm before wiring 7.5; otherwise use
   `GET /events?email=` and the `customer.id` from the first result.
4. If you need an endpoint or field that doesn't exist (e.g. a free-text search, step labels from the
   backend), write the request down — don't work around it by changing VeloxVerse.
5. Timezone for daily summaries / digest — currently UTC; the client may ask for a local timezone later.

# VeloxVerse Admin → Velox-CRM Integration Plan

## Overview

Embed all 9 VeloxVerse admin modules into the Velox-CRM app as first-class pages. CRM users with `super_admin` or `admin` roles will see a new **"VeloxVerse"** section in the sidebar with access to Analytics, eSIM Orders, Lounge, Transfers, Promo Codes, Pricing Rules, Users, Support, and Settings.

**Auth strategy:** Shared JWT secret between both backends. The CRM backend proxies all VeloxVerse admin API calls, forwarding the CRM user's JWT. The VeloxVerse backend verifies the same JWT and grants access.

---

## Architecture Diagram

```
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Velox-CRM       │         │  Velox-CRM       │         │  VeloxVerse      │
│  Frontend        │────────▶│  Backend (:5001)  │────────▶│  Backend (:5005) │
│  (React/Vite)    │  cookie │  /api/vv-admin/*  │  JWT    │  /api/v1/admin/* │
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

- CRM frontend sends requests to CRM backend at `/api/vv-admin/*`
- CRM backend strips the `/vv-admin` prefix and proxies to VeloxVerse backend at `/api/v1/*`
- The shared JWT secret means the CRM-issued token is valid on VeloxVerse

---

## Phase 1: Backend — Proxy Layer

### 1.1 Environment Config

**File: `backend/node-crm/.env`** — add:

```env
VELOXVERSE_API_URL=http://localhost:5005/api/v1
```

### 1.2 Proxy Middleware

**New file: `backend/node-crm/src/middleware/veloxverseProxy.js`**

An Express middleware that:
1. Accepts requests at `/api/vv-admin/*`
2. Requires `authenticate` + `authorizeRoles('super_admin', 'admin')`
3. Reads the CRM user's JWT from the httpOnly cookie
4. Forwards the request to `VELOXVERSE_API_URL` + the stripped path, with `Authorization: Bearer <jwt>`
5. Streams the VeloxVerse response back to the CRM frontend

Uses `http-proxy-middleware` or a simple `axios` forwarding function.

### 1.3 Route Mounting

**File: `backend/node-crm/src/app.js`** — add:

```js
const veloxverseProxy = require('./middleware/veloxverseProxy');
app.use('/api/vv-admin', authenticate, authorizeRoles('super_admin', 'admin'), veloxverseProxy);
```

### 1.4 Proxied Endpoint Map

The proxy transparently forwards these VeloxVerse admin routes:

| CRM Path (`/api/vv-admin/...`) | VeloxVerse Path (`/api/v1/...`) | Module |
|---|---|---|
| `/admin/analytics/overview` | `/admin/analytics/overview` | Analytics |
| `/admin/analytics/revenue` | `/admin/analytics/revenue` | Analytics |
| `/admin/analytics/growth` | `/admin/analytics/growth` | Analytics |
| `/admin/analytics/popular-packages` | `/admin/analytics/popular-packages` | Analytics |
| `/admin/analytics/recent-orders` | `/admin/analytics/recent-orders` | Analytics |
| `/admin/analytics/order-stats` | `/admin/analytics/order-stats` | Analytics |
| `/admin/analytics/customer-spending` | `/admin/analytics/customer-spending` | Analytics |
| `/admin/esims/orders` | `/admin/esims/orders` | eSIM Orders |
| `/admin/esims/orders/:orderNo` | `/admin/esims/orders/:orderNo` | eSIM Orders |
| `/admin/esims/orders/:orderNo/cancel` | `/admin/esims/orders/:orderNo/cancel` | eSIM Orders |
| `/admin/esims/orders/:orderNo/suspend` | `/admin/esims/orders/:orderNo/suspend` | eSIM Orders |
| `/admin/esims/orders/:orderNo/unsuspend` | `/admin/esims/orders/:orderNo/unsuspend` | eSIM Orders |
| `/lounge/admin/visits` | `/lounge/admin/visits` | Lounge |
| `/lounge/admin/memberships` | `/lounge/admin/memberships` | Lounge |
| `/lounge/admin/stats` | `/lounge/admin/stats` | Lounge |
| `/admin/assist/transfer/bookings` | `/admin/assist/transfer/bookings` | Transfers |
| `/admin/promo-codes` | `/admin/promo-codes` | Promo Codes |
| `/admin/promo-codes/:id` | `/admin/promo-codes/:id` | Promo Codes |
| `/admin/promo-codes/:id/stats` | `/admin/promo-codes/:id/stats` | Promo Codes |
| `/admin/pricing-rules` | `/admin/pricing-rules` | Pricing |
| `/admin/pricing-rules/:id` | `/admin/pricing-rules/:id` | Pricing |
| `/admin/pricing-rules/:id/publish` | `/admin/pricing-rules/:id/publish` | Pricing |
| `/admin/pricing-rules/:id/archive` | `/admin/pricing-rules/:id/archive` | Pricing |
| `/admin/pricing-rules/:id/duplicate` | `/admin/pricing-rules/:id/duplicate` | Pricing |
| `/admin/pricing-rules/:id/audit` | `/admin/pricing-rules/:id/audit` | Pricing |
| `/admin/pricing-audit` | `/admin/pricing-audit` | Pricing |
| `/admin/users` | `/admin/users` | Users |
| `/admin/users/:id` | `/admin/users/:id` | Users |
| `/admin/users/:id/status` | `/admin/users/:id/status` | Users |
| `/admin/users/:id/role` | `/admin/users/:id/role` | Users |
| `/admin/support/tickets` | `/admin/support/tickets` | Support |
| `/admin/support/tickets/:id` | `/admin/support/tickets/:id` | Support |
| `/admin/support/tickets/:id/reply` | `/admin/support/tickets/:id/reply` | Support |
| `/admin/support/tickets/:id/status` | `/admin/support/tickets/:id/status` | Support |
| `/admin/support/statistics` | `/admin/support/statistics` | Support |
| `/admin/support/search` | `/admin/support/search` | Support |
| `/admin/settings` | `/admin/settings` | Settings |
| `/admin/settings/test-smtp` | `/admin/settings/test-smtp` | Settings |
| `/admin/settings/test-esim-api` | `/admin/settings/test-esim-api` | Settings |

### 1.5 JWT Alignment

**Requirement:** Both backends must use the **same `JWT_SECRET`** value in their `.env` files.

The VeloxVerse backend's auth middleware must accept CRM-issued tokens. Two options:

- **Option A (simple):** Set identical `JWT_SECRET` in both `.env` files. The JWT payload structure must match — both should contain at least `{ id, role }`. Since VeloxVerse uses `SUPER_ADMIN`/`ADMIN` and CRM uses `super_admin`/`admin`, the proxy should map the role in the forwarded request header, OR VeloxVerse backend should accept both formats.

- **Option B (recommended):** The CRM proxy generates a new short-lived JWT signed with VeloxVerse's secret, mapping the CRM user's identity. This keeps secrets separate but adds complexity.

**Recommended: Option A** with a role-mapping layer in the proxy that translates `super_admin` → `SUPER_ADMIN` and `admin` → `ADMIN` if needed.

### 1.6 New Backend Dependency

```bash
cd backend/node-crm && npm install axios
```

(axios is used for the proxy forwarding; the CRM backend currently uses `pg` directly)

---

## Phase 2: Frontend — Types

### 2.1 VeloxVerse Types

**New file: `frontend/src/features/veloxverse-admin/types.ts`**

Port the following type definitions from VeloxVerse (adapt to CRM conventions):

```
- AnalyticsOverview, RevenueSeries, GrowthSeries, PopularPackage, RecentActivity, OrderStats, CustomerSpending
- AdminOrderRow, AdminOrderDetail, EsimUsage, Pagination (from esim.types)
- LoungeVisit, LoungeVisitStatus, AdminLoungeMembership, LoungeStats, Paginated (from lounge.types)
- AdminTransferBooking, TransferBookingStatus (from transfer.types)
- PromoCode, PromoCodeStats, CreatePromoCodeInput, PromoDiscountType (from referral.types)
- PricingRule, PricingAuditEntry, ServiceType, RuleType, RuleStatus (from pricing.types)
- AdminUser, AdminUsersPage, AdminUserDetail, Role (from admin-user.types)
- SupportTicket, SupportMessage, SupportStatistics, AdminTicketFilters, AdminSearchResult, SupportStatus, SupportPriority, SupportCategory (from support.types)
- AdminSettings, EsimApiTestResult (from admin-settings.types)
```

All types are copied as-is (they're pure TypeScript interfaces with no framework dependency).

---

## Phase 3: Frontend — API Services

### 3.1 VeloxVerse API Client

**New file: `frontend/src/features/veloxverse-admin/api.ts`**

A single axios-based API module that calls the CRM backend's proxy prefix:

```typescript
import { api } from '@/lib/axios';  // CRM's existing axios instance

const VV = '/vv-admin';  // proxy prefix

export const vvAnalyticsApi = {
  overview:         ()              => api.get(`${VV}/admin/analytics/overview`),
  revenue:          (period: string)=> api.get(`${VV}/admin/analytics/revenue`, { params: { period } }),
  growth:           (period: string)=> api.get(`${VV}/admin/analytics/growth`, { params: { period } }),
  popularPackages:  (limit: number) => api.get(`${VV}/admin/analytics/popular-packages`, { params: { limit } }),
  recentOrders:     (limit: number) => api.get(`${VV}/admin/analytics/recent-orders`, { params: { limit } }),
  orderStats:       ()              => api.get(`${VV}/admin/analytics/order-stats`),
  customerSpending: (limit: number) => api.get(`${VV}/admin/analytics/customer-spending`, { params: { limit } }),
};

export const vvEsimApi = { ... };      // admin esim endpoints
export const vvLoungeApi = { ... };    // admin lounge endpoints
export const vvTransferApi = { ... };  // admin transfer endpoints
export const vvPromoApi = { ... };     // admin promo-codes endpoints
export const vvPricingApi = { ... };   // admin pricing-rules endpoints
export const vvUsersApi = { ... };     // admin users endpoints
export const vvSupportApi = { ... };   // admin support endpoints
export const vvSettingsApi = { ... };  // admin settings endpoints
```

Each function unwraps the `{ success, message, data }` envelope and returns the inner data, matching the VeloxVerse service pattern.

---

## Phase 4: Frontend — React Query Hooks

### 4.1 Hook Files

**New file: `frontend/src/features/veloxverse-admin/hooks/useVVAnalytics.ts`**

Port the TanStack React Query hooks from VeloxVerse's `hooks/analytics/index.ts`, pointing at the new `vvAnalyticsApi` functions. Query keys prefixed with `['vv-analytics', ...]` to avoid collisions with existing CRM queries.

Similarly create:

| New Hook File | Ported From (VeloxVerse) |
|---|---|
| `hooks/useVVAnalytics.ts` | `hooks/analytics/index.ts` |
| `hooks/useVVEsim.ts` | `hooks/esim/index.ts` (admin hooks only) |
| `hooks/useVVLounge.ts` | `hooks/lounge/index.ts` (admin hooks only) |
| `hooks/useVVTransfers.ts` | `hooks/transfer/index.ts` (admin hook only) |
| `hooks/useVVPromo.ts` | `hooks/referral/index.ts` (admin hooks only) |
| `hooks/useVVPricing.ts` | `hooks/admin-pricing.ts` |
| `hooks/useVVUsers.ts` | `hooks/admin-user/index.ts` |
| `hooks/useVVSupport.ts` | `hooks/support/index.ts` (admin hooks only) |
| `hooks/useVVSettings.ts` | `hooks/admin-settings/index.ts` |

---

## Phase 5: Frontend — UI Components

### 5.1 Shared Components

VeloxVerse uses **shadcn/ui** (Radix-based). Velox-CRM uses **hand-rolled Tailwind**. Two options:

**Option A (recommended): Adapt to CRM's existing component style**
- Rewrite the admin pages using CRM's existing `Card`, `Badge`, `Button`, `Input`, `Modal`, `Table`, `Pagination`, `Spinner` components
- Build any missing components (Tabs, Switch, Dialog, Skeleton, Dropdown) in the CRM's style
- This keeps the CRM visually consistent

**Option B: Install shadcn/ui in CRM**
- Faster port but introduces a second component library
- Potential style conflicts with existing hand-rolled components

**Recommended: Option A** — consistency matters more than speed.

### 5.2 Missing UI Components to Build

These components exist in VeloxVerse (shadcn/ui) but not in CRM:

| Component | Used By | Complexity |
|---|---|---|
| `Tabs` | Lounge, Pricing | Medium — tab list + panels |
| `Switch` | Promo Codes, Users | Simple — toggle input |
| `Skeleton` | All pages (loading state) | Simple — animated placeholder |
| `Dialog` | eSIM detail, Pricing history | Medium — modal variant |
| `DropdownMenu` | Support status | Medium — positioned menu |
| `Label` | Settings, Pricing form | Simple — styled label |

**New file: `frontend/src/components/ui/Tabs.tsx`** (etc.)

### 5.3 Charts Component

**New file: `frontend/src/features/veloxverse-admin/components/Charts.tsx`**

Direct port of VeloxVerse's pure-SVG `LineChart` and `BarChart` components. These have zero dependencies — just SVG rendering with Tailwind classes.

---

## Phase 6: Frontend — Admin Pages

### 6.1 Page Components

Each VeloxVerse admin page becomes a React component (no Next.js `'use client'` directive needed — CRM is already client-rendered).

| New File | Ported From | Key Changes |
|---|---|---|
| `pages/VVAnalyticsPage.tsx` | `app/dashboard/admin/analytics/page.tsx` | Replace shadcn → CRM components |
| `pages/VVEsimListPage.tsx` | `app/dashboard/admin/esims/page.tsx` | Use CRM Table + Pagination |
| `pages/VVEsimDetailPage.tsx` | `app/dashboard/admin/esims/[orderNo]/page.tsx` | `useParams()` instead of `use(params)` |
| `pages/VVLoungePage.tsx` | `app/dashboard/admin/lounge/page.tsx` | Use new Tabs component |
| `pages/VVTransfersPage.tsx` | `app/dashboard/admin/transfers/page.tsx` | Use CRM Badge/Table |
| `pages/VVPromoCodesPage.tsx` | `app/dashboard/admin/promo-codes/page.tsx` | Use CRM Modal for create form |
| `pages/VVPricingPage.tsx` | `app/dashboard/admin/pricing/page.tsx` | Most complex — modal + tabs |
| `pages/VVUsersListPage.tsx` | `app/dashboard/admin/users/page.tsx` | Use CRM Table + Pagination |
| `pages/VVUserDetailPage.tsx` | `app/dashboard/admin/users/[id]/page.tsx` | `useParams()` for id |
| `pages/VVSupportListPage.tsx` | `app/dashboard/admin/support/page.tsx` | Use CRM Table + Badge |
| `pages/VVSupportDetailPage.tsx` | `app/dashboard/admin/support/[ticketId]/page.tsx` | Message thread UI |
| `pages/VVSettingsPage.tsx` | `app/dashboard/admin/settings/page.tsx` | Simple read-only cards |

### 6.2 Key Porting Notes

1. **Next.js `use(params)` → React Router `useParams()`**: All dynamic route pages use `useParams()` from `react-router-dom`
2. **`next/link` → React Router `Link`**: Replace `<Link href=...>` with `<Link to=...>`
3. **`next/navigation` → React Router**: Replace `useRouter().push()` with `useNavigate()`
4. **shadcn `<Card>` → CRM `<Card>`**: Props are similar but class names differ
5. **shadcn `<Badge>` → CRM `<Badge>`**: Map `variant` prop values
6. **`sonner` toasts → CRM `ToastProvider`**: Replace `toast.success()` / `toast.error()` with CRM's toast system
7. **`@/components/ui/*` → `@/components/ui/*`**: Same import paths, different implementations
8. **Money formatting**: VeloxVerse mixes USD floats and cents. Keep the same logic — no changes needed

---

## Phase 7: Frontend — Routing

### 7.1 Route Additions

**File: `frontend/src/app/Router.tsx`** — add inside the `RoleGuard allowedRoles={['super_admin', 'admin']}` block:

```tsx
{/* VeloxVerse Admin */}
<Route path="veloxverse/analytics"         element={<VVAnalyticsPage />} />
<Route path="veloxverse/esim-orders"       element={<VVEsimListPage />} />
<Route path="veloxverse/esim-orders/:orderNo" element={<VVEsimDetailPage />} />
<Route path="veloxverse/lounge"            element={<VVLoungePage />} />
<Route path="veloxverse/transfers"         element={<VVTransfersPage />} />
<Route path="veloxverse/promo-codes"       element={<VVPromoCodesPage />} />
<Route path="veloxverse/pricing"           element={<VVPricingPage />} />
<Route path="veloxverse/users"             element={<VVUsersListPage />} />
<Route path="veloxverse/users/:id"         element={<VVUserDetailPage />} />
<Route path="veloxverse/support"           element={<VVSupportListPage />} />
<Route path="veloxverse/support/:ticketId" element={<VVSupportDetailPage />} />
<Route path="veloxverse/settings"          element={<VVSettingsPage />} />
```

---

## Phase 8: Frontend — Sidebar

### 8.1 Sidebar Config Update

**File: `frontend/src/config/sidebarConfig.ts`** — add a "VeloxVerse" section to `super_admin` and `admin` nav arrays:

```typescript
// Add separator/heading + items:
{ label: '── VeloxVerse ──', path: '', icon: Globe },  // section header
{ label: 'Analytics',      path: '/dashboard/veloxverse/analytics',    icon: BarChart3 },
{ label: 'eSIM Orders',    path: '/dashboard/veloxverse/esim-orders',  icon: Smartphone },
{ label: 'Lounge',         path: '/dashboard/veloxverse/lounge',       icon: Armchair },
{ label: 'Transfers',      path: '/dashboard/veloxverse/transfers',    icon: Car },
{ label: 'Promo Codes',    path: '/dashboard/veloxverse/promo-codes',  icon: Tag },
{ label: 'Pricing Rules',  path: '/dashboard/veloxverse/pricing',      icon: DollarSign },
{ label: 'Users',          path: '/dashboard/veloxverse/users',        icon: Users },
{ label: 'Support',        path: '/dashboard/veloxverse/support',      icon: HeadphonesIcon },
{ label: 'Settings',       path: '/dashboard/veloxverse/settings',     icon: Settings },
```

---

## File Summary — All Changes

### Backend (Velox-CRM)

| Action | File | Description |
|---|---|---|
| MODIFY | `.env` | Add `VELOXVERSE_API_URL` |
| MODIFY | `.env.example` | Add `VELOXVERSE_API_URL` |
| CREATE | `src/middleware/veloxverseProxy.js` | Proxy middleware (~60 lines) |
| MODIFY | `src/app.js` (or `server.js`) | Mount proxy route |
| INSTALL | `package.json` | Add `axios` dependency |

### Backend (VeloxVerse)

| Action | File | Description |
|---|---|---|
| MODIFY | `.env` | Ensure `JWT_SECRET` matches CRM |
| MODIFY | CORS config | Add CRM origin to allowed origins |

### Frontend (Velox-CRM)

| Action | File | Description |
|---|---|---|
| CREATE | `src/features/veloxverse-admin/types.ts` | All VV admin types (~200 lines) |
| CREATE | `src/features/veloxverse-admin/api.ts` | All VV API service functions (~250 lines) |
| CREATE | `src/features/veloxverse-admin/hooks/useVVAnalytics.ts` | 7 query hooks |
| CREATE | `src/features/veloxverse-admin/hooks/useVVEsim.ts` | 5 query/mutation hooks |
| CREATE | `src/features/veloxverse-admin/hooks/useVVLounge.ts` | 3 query hooks |
| CREATE | `src/features/veloxverse-admin/hooks/useVVTransfers.ts` | 1 query hook |
| CREATE | `src/features/veloxverse-admin/hooks/useVVPromo.ts` | 3 query/mutation hooks |
| CREATE | `src/features/veloxverse-admin/hooks/useVVPricing.ts` | 8 query/mutation hooks |
| CREATE | `src/features/veloxverse-admin/hooks/useVVUsers.ts` | 4 query/mutation hooks |
| CREATE | `src/features/veloxverse-admin/hooks/useVVSupport.ts` | 5 query/mutation hooks |
| CREATE | `src/features/veloxverse-admin/hooks/useVVSettings.ts` | 3 query/mutation hooks |
| CREATE | `src/features/veloxverse-admin/components/Charts.tsx` | SVG LineChart + BarChart |
| CREATE | `src/features/veloxverse-admin/pages/VVAnalyticsPage.tsx` | Analytics dashboard |
| CREATE | `src/features/veloxverse-admin/pages/VVEsimListPage.tsx` | eSIM orders list |
| CREATE | `src/features/veloxverse-admin/pages/VVEsimDetailPage.tsx` | eSIM order detail |
| CREATE | `src/features/veloxverse-admin/pages/VVLoungePage.tsx` | Lounge visits + memberships |
| CREATE | `src/features/veloxverse-admin/pages/VVTransfersPage.tsx` | Transfer bookings |
| CREATE | `src/features/veloxverse-admin/pages/VVPromoCodesPage.tsx` | Promo code management |
| CREATE | `src/features/veloxverse-admin/pages/VVPricingPage.tsx` | Pricing rules management |
| CREATE | `src/features/veloxverse-admin/pages/VVUsersListPage.tsx` | VeloxVerse users list |
| CREATE | `src/features/veloxverse-admin/pages/VVUserDetailPage.tsx` | User detail + actions |
| CREATE | `src/features/veloxverse-admin/pages/VVSupportListPage.tsx` | Support tickets list |
| CREATE | `src/features/veloxverse-admin/pages/VVSupportDetailPage.tsx` | Ticket detail + replies |
| CREATE | `src/features/veloxverse-admin/pages/VVSettingsPage.tsx` | VeloxVerse settings |
| CREATE | `src/components/ui/Tabs.tsx` | Tabs component (~50 lines) |
| CREATE | `src/components/ui/Switch.tsx` | Toggle switch (~30 lines) |
| CREATE | `src/components/ui/Skeleton.tsx` | Loading skeleton (~15 lines) |
| MODIFY | `src/app/Router.tsx` | Add 12 VeloxVerse routes |
| MODIFY | `src/config/sidebarConfig.ts` | Add 9 VeloxVerse nav items |

**Total: ~5 backend files, ~28 frontend files to create, ~4 files to modify**

---

## Implementation Order

1. **Backend proxy** (Phase 1) — get API connectivity working first
2. **Types** (Phase 2) — foundation for everything else
3. **API services** (Phase 3) — test proxy end-to-end
4. **Hooks** (Phase 4) — data layer ready
5. **Missing UI components** (Phase 5.2) — Tabs, Switch, Skeleton
6. **Charts** (Phase 5.3) — needed by Analytics page
7. **Pages** (Phase 6) — start with Analytics (most visual payoff), then eSIM, then the rest
8. **Routing + Sidebar** (Phase 7-8) — wire it all up
9. **Testing** — verify each page loads and displays data correctly

---

## Risks & Considerations

1. **JWT payload mismatch**: CRM tokens contain `{ id, role }` where role is lowercase (`super_admin`). VeloxVerse expects uppercase (`SUPER_ADMIN`). The proxy or VeloxVerse auth middleware must handle this mapping.

2. **User ID mismatch**: CRM and VeloxVerse have separate user tables. The CRM user's `id` won't exist in VeloxVerse's `users` table. The VeloxVerse admin endpoints must either not require the requesting user to exist in their DB, or a user record must be seeded.

3. **CORS**: VeloxVerse backend must allow requests from the CRM backend's origin (server-to-server, so this is about the proxy's outbound requests — not browser CORS).

4. **Toast library**: VeloxVerse uses `sonner`, CRM uses `react-hot-toast`. All toast calls in ported pages must be converted.

5. **Pagination type**: VeloxVerse uses `{ page, totalPages, total }`, CRM uses `{ items, total, limit, offset }`. The ported pages should use VeloxVerse's format since the data comes from VeloxVerse's API.

6. **Money display**: VeloxVerse admin pages mix dollars (floats) and cents (integers). Keep the original logic — do not normalize during porting.

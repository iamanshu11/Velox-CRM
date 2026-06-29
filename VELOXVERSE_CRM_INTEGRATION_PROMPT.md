# Velox-CRM — VeloxVerse Admin Integration Prompt

## Goal

Add all 9 VeloxVerse admin modules (Analytics, eSIM Orders, Lounge, Transfers, Promo Codes, Pricing Rules, Users, Support, Settings) as first-class pages inside the Velox-CRM app. CRM users with `super_admin` or `admin` roles will see a new **"VeloxVerse"** section in the sidebar. The CRM backend proxies every VeloxVerse admin API call so the frontend only talks to one backend.

---

## Current CRM Architecture (Reference — DO NOT BREAK)

### Backend (Node.js/Express, port 5001)

- **Entry**: `backend/node-crm/src/app.js` — Express app with Helmet, CORS (multi-origin from `ALLOWED_ORIGINS` env), cookie-parser, JSON body parser
- **Routes**: mounted at `/api/*` (auth, users, customers, services, approvals, verification, notifications, velox-esim, forms)
- **Auth**: JWT in httpOnly cookie `velox_token` (7d lifetime). Middleware in `src/middleware/auth.js`:
  - `authenticate` — extracts token from cookie OR `Authorization: Bearer`, verifies with `process.env.JWT_SECRET`, looks up user by `decoded.id` in DB, attaches full user row to `req.user`
  - `authorizeRoles(...roles)` — checks `req.user.role` against allowed list
- **Response envelope**: `{ success: boolean, message: string, data: T }` via `src/utils/response.js` helpers `sendSuccess(res, data, message)` and `sendError(res, message, status)`
- **Database**: PostgreSQL via `pg` pool
- **JWT payload**: `{ id: <user_id>, role: <lowercase_role> }` signed with `JWT_SECRET`

### Frontend (React 18 + Vite, port 5173)

- **Router**: `src/app/Router.tsx` — `createBrowserRouter` (React Router v6 data router)
- **Auth state**: Zustand store (`src/store/authStore.ts`) persisted to localStorage key `crm-auth`, stores `User` object only (no token — token is in cookie)
- **Axios**: `src/lib/axios.ts` — `baseURL: VITE_API_URL || 'http://localhost:5001/api'`, `withCredentials: true`, 401 interceptor clears auth and redirects to `/login`
- **Data fetching**: TanStack React Query v5 (retry=1, staleTime=60s, refetchOnWindowFocus=false)
- **UI components**: Hand-rolled Tailwind CSS v4 components in `src/components/ui/` — `Button`, `Card`/`CardHeader`/`CardDivider`, `Badge`, `Table`, `Modal`, `Pagination`, `Input`, `Spinner`, `Avatar`
- **Toasts**: Custom `ToastProvider` via React Context in `src/app/providers/ToastProvider.tsx`. Hook: `const { showToast } = useToast()`. Call: `showToast({ type: 'success', title: 'Done' })` or `showToast({ type: 'error', title: 'Failed', message: err.message })`
- **Icons**: `lucide-react`
- **Classnames**: `cn()` utility from `src/lib/utils.ts` (clsx + tailwind-merge)
- **Types**: `src/types/index.ts` — `UserRole`, `User`, `ApiResponse<T>`, `Paginated<T>`, `NavItem`, etc.
- **Sidebar**: `src/config/sidebarConfig.ts` — `Record<UserRole, NavItem[]>` read by `src/components/layout/Sidebar.tsx`
- **Roles**: `src/config/roles.ts` — `ALL_ROLES`, `ROLE_HOMES`, role helpers
- **Route guards**: `ProtectedRoute` (requires auth), `RoleGuard` (requires specific roles), `VerificationGate` (forces KYC)
- **Feature structure**: `src/features/<name>/` with `pages/`, `components/`, `hooks/`, service files, types

### Existing UI Component APIs (use these exactly)

```tsx
// Button
<Button variant="primary|secondary|danger|ghost|outline" size="sm|md|lg" loading={bool} onClick={fn}>Label</Button>

// Card
<Card padding="none|sm|md|lg" className="..."><CardHeader title="..." description="..." action={<Button />} />content</Card>

// Badge
<Badge variant="success|danger|warning|info|neutral" dot={bool}>text</Badge>

// Table
<Table columns={[{ key: 'field', header: 'Header', render: (row) => <span>{row.field}</span> }]} data={[...]} keyField="id" loading={bool} emptyMessage="No data" />

// Modal
<Modal open={bool} onClose={fn} title="..." description="..." size="sm|md|lg|xl" footer={<><Button>Cancel</Button><Button>Save</Button></>}>body</Modal>

// Pagination
<Pagination page={num} pageSize={num} total={num} onPageChange={(p) => setPage(p)} />

// Input
<Input label="..." error="..." placeholder="..." leftIcon={<Search />} value={v} onChange={fn} />

// Spinner
<Spinner size="sm|md|lg" label="Loading..." />
```

---

## PART 1 — Backend Changes

### 1.1 Install Dependency

```bash
cd backend/node-crm
npm install axios
```

### 1.2 Environment Variables

**File: `backend/node-crm/.env`** — add at the bottom:

```env
# ── VeloxVerse Admin Bridge ──────────────────────────────────────
# Base URL of the VeloxVerse backend API (with prefix).
VELOXVERSE_API_URL=http://localhost:5005/api/v1
```

**File: `backend/node-crm/.env.example`** — add same block.

### 1.3 Create Proxy Middleware

**New file: `backend/node-crm/src/middleware/veloxverseProxy.js`**

This middleware receives requests at `/api/vv-admin/*`, reads the CRM user's JWT from the httpOnly cookie, and forwards the request to the VeloxVerse backend with `Authorization: Bearer <jwt>`. It also sends `X-CRM-User-Email` so VeloxVerse audit trails show the real email.

```js
import axios from "axios";
import { AUTH_COOKIE_NAME } from "../controllers/authController.js";

const VV_BASE = process.env.VELOXVERSE_API_URL || "http://localhost:5005/api/v1";

/**
 * Forward any request from /api/vv-admin/* to the VeloxVerse backend.
 *
 * The path is forwarded as-is (minus the /api/vv-admin prefix, which is
 * stripped by Express when this is mounted at /api/vv-admin).
 *
 * Auth: the CRM JWT (from the httpOnly cookie) is sent as a Bearer token.
 * VeloxVerse's CRM bridge middleware verifies it with the shared CRM_JWT_SECRET.
 */
export default async function veloxverseProxy(req, res) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  // Build the target URL: req.url is everything after the mount point
  // e.g. if mounted at /api/vv-admin, and the request is /api/vv-admin/admin/analytics/overview
  // then req.url = /admin/analytics/overview
  const targetUrl = `${VV_BASE}${req.url}`;

  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-CRM-User-Email": req.user?.email || "",
      },
      data: ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? req.body : undefined,
      params: req.method === "GET" ? req.query : undefined,
      // Don't let axios parse the response — we stream it as-is
      validateStatus: () => true,
      // Timeout: 30s for long analytics queries
      timeout: 30000,
    });

    // Forward the VeloxVerse response status + body to the CRM frontend
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error("[VV-Proxy] Error forwarding to VeloxVerse:", err.message);
    if (err.code === "ECONNREFUSED") {
      return res.status(502).json({
        success: false,
        message: "VeloxVerse service is not available. Please try again later.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to connect to VeloxVerse service.",
    });
  }
}
```

### 1.4 Mount Proxy Route

**File: `backend/node-crm/src/app.js`** — add the proxy route BEFORE the 404 handler.

Add this import at the top with the other imports:

```js
import veloxverseProxy from "./middleware/veloxverseProxy.js";
import { authenticate, authorizeRoles } from "./middleware/auth.js";
```

Add this route block after the existing `/api/forms` mount (around line 78, before the `// ── Public routes` section):

```js
// ── VeloxVerse Admin Proxy ─────────────────────────────────────────
// Proxies admin API calls to the VeloxVerse backend. Only super_admin
// and admin roles can access these endpoints.
app.use(
  "/api/vv-admin",
  authenticate,
  authorizeRoles("super_admin", "admin"),
  veloxverseProxy
);
```

**That's it for the backend.** The proxy is a transparent pass-through — no new controllers, models, or database changes needed.

---

## PART 2 — Frontend: Types

### 2.1 VeloxVerse Admin Types

**New file: `frontend/src/features/veloxverse-admin/types.ts`**

Copy all type definitions needed for the admin pages. These are pure TypeScript interfaces — no framework dependency.

```ts
// ═══════════════════════════════════════════════════════════════════
// VeloxVerse Admin Types
// Ported from VeloxVerse frontend/src/types/*.types.ts
// ═══════════════════════════════════════════════════════════════════

// ── Analytics ───────────────────────────────────────────────────────
export interface AnalyticsOverview {
  totalRevenueUsd: number
  totalOrders: number
  activeUsers: number
  activeEsims: number
  esimRevenueUsd: number
  esimOrders: number
  loungeRevenueUsd: number
  loungeBookings: number
  benefitRevenueUsd: number
  benefitBookings: number
  totalWalletTopUpsUsd: number
}

export interface TimeSeriesPoint {
  date: string
  amount?: number
  count?: number
}

export interface RevenueSeries {
  period: string
  points: { date: string; amount: number }[]
}

export interface GrowthSeries {
  period: string
  points: { date: string; count: number }[]
}

export interface PopularPackage {
  packageCode: string
  packageName: string
  count: number
  revenueUsd: number
}

export interface RecentActivity {
  orderNo: string
  type: 'ESIM' | 'LOUNGE' | 'BENEFIT'
  description: string
  amountUsd: number
  status: string
  createdAt: string
  customer: { name: string; email: string }
}

export interface OrderStats {
  total: number
  byStatus: Record<string, number>
}

export interface CustomerSpending {
  userId: string
  name: string
  email: string
  totalSpendUsd: number
  esimSpendUsd: number
  loungeSpendUsd: number
  benefitSpendUsd: number
  travelSpendUsd: number
  orderCount: number
}

// ── eSIM Orders ─────────────────────────────────────────────────────
export interface VVPagination {
  page: number
  totalPages: number
  total: number
  limit: number
}

export interface AdminOrderRow {
  orderNo: string
  quantity: number
  createTime: string
  cost: number
  sellingPrice: number
  status: string
}

export interface AdminOrderDetail {
  orderNo: string
  esimTranNo: string
  providerOrderNo?: string
  invoiceNo?: string
  iccid: string
  imsi?: string
  eid?: string
  msisdn?: string
  activationCode?: string
  shortUrl?: string
  apn?: string
  pin?: string
  qrCodeUrl?: string
  smdpStatus?: string
  esimStatus?: string
  smsStatus?: string
  activatedAt?: string
  expiredAt?: string
  status: string
  cost: number
  sellingPrice: number
  paymentMethod: string
  totalVolume?: number
  remainingVolume?: number
  duration?: number
  createTime: string
  customer: { name: string; email: string }
  coverages: { packageCode: string; packageName: string; locationCode: string; volume: number; duration: number }[]
}

// ── Lounge ───────────────────────────────────────────────────────────
export type LoungeVisitStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface LoungeVisit {
  id: string
  userId: string
  loungeName: string
  airportCode: string
  visitDate: string
  guestCount: number
  status: LoungeVisitStatus
  costCents: number
  createdAt: string
  user?: { name: string; email: string }
}

export interface AdminLoungeMembership {
  id: string
  userId: string
  tier: string
  visitsRemaining: number
  status: string
  validTo: string
  createdAt: string
  user: { name: string; email: string }
}

export interface LoungeStats {
  totalRevenueCents: number
  activeMemberships: number
  upcomingVisits: number
  cancelledVisits: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

// ── Transfers ───────────────────────────────────────────────────────
export type TransferBookingStatus = 'PENDING' | 'CONFIRMED' | 'APPROVED' | 'COMPLETED' | 'CANCELLED' | 'FAILED'

export interface AdminTransferBooking {
  orderNo: string
  reservationNo?: string
  customerName: string
  customerEmail: string
  pickupLocation: string
  dropoffLocation: string
  flightArrival?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleSegment?: string
  amountCents: number
  currency: string
  status: TransferBookingStatus
  createdAt: string
}

// ── Promo Codes ─────────────────────────────────────────────────────
export type PromoDiscountType = 'FIXED' | 'PERCENTAGE'

export interface PromoCode {
  id: string
  code: string
  description?: string
  discountType: PromoDiscountType
  discountValue: number
  minPurchaseCents?: number
  maxDiscountCents?: number
  applicableServices: string[]
  maxUses?: number
  maxUsesPerUser?: number
  usageCount: number
  isActive: boolean
  expiresAt?: string
  createdAt: string
}

export interface PromoCodeStats {
  usageCount: number
  uniqueUsers: number
  totalDiscountCents: number
}

export interface CreatePromoCodeInput {
  code: string
  description?: string
  discountType: PromoDiscountType
  discountValue: number
  minPurchaseCents?: number
  maxDiscountCents?: number
  applicableServices: string[]
  maxUses?: number
  maxUsesPerUser?: number
  expiresAt?: string
}

// ── Pricing Rules ───────────────────────────────────────────────────
export type VVServiceType = 'ALL' | 'LOUNGE' | 'DINING' | 'FAST_TRACK' | 'FITNESS' | 'TRANSFER' | 'FLIGHT' | 'HOTEL' | 'CAR_RENTAL' | 'ESIM'
export type VVRuleType = 'PROFIT_MARGIN' | 'SURGE_PRICING' | 'REFUND_PROTECTION'
export type VVRuleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface PricingRule {
  id: string
  serviceType: VVServiceType
  ruleType: VVRuleType
  config: Record<string, unknown>
  currency: string
  isActive: boolean
  priority: number
  status: VVRuleStatus
  effectiveFrom?: string
  effectiveTo?: string
  createdById?: string
  createdByEmail?: string
  updatedById?: string
  updatedByEmail?: string
  createdAt: string
  updatedAt: string
}

export interface PricingAuditEntry {
  id: string
  ruleId: string
  action: 'CREATED' | 'UPDATED' | 'STATUS_CHANGE' | 'DELETED'
  oldConfig?: Record<string, unknown>
  newConfig?: Record<string, unknown>
  oldStatus?: string
  newStatus?: string
  changedById?: string
  changedByEmail?: string
  changeReason?: string
  createdAt: string
}

// ── Users ───────────────────────────────────────────────────────────
export type VVUserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER'

export interface VVAdminUser {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: VVUserRole
  isActive: boolean
  isVerified: boolean
  createdAt: string
}

export interface VVAdminUsersPage {
  users: VVAdminUser[]
  pagination: VVPagination
}

export interface VVAdminUserDetail {
  user: VVAdminUser
  wallet: { balance: number; balanceCents: number; currency: string; lastUpdated: string }
  orders: { orderNo: string; packageName: string; status: string; sellingPrice: number }[]
  devices: { id: string; name: string; brand?: string; model?: string; deviceType: string; esimCompatible?: boolean }[]
}

// ── Support ─────────────────────────────────────────────────────────
export type VVSupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type VVSupportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type VVSupportCategory = 'BILLING' | 'TECHNICAL' | 'ACCOUNT' | 'ESIM' | 'OTHER'

export interface VVSupportTicket {
  id: string
  caseId: string
  subject: string
  category: VVSupportCategory
  priority: VVSupportPriority
  status: VVSupportStatus
  userId: string
  customer: { name: string; email: string }
  messages: VVSupportMessage[]
  createdAt: string
  updatedAt: string
}

export interface VVSupportMessage {
  id: string
  ticketId: string
  senderId: string
  senderRole: 'USER' | 'ADMIN'
  message: string
  createdAt: string
}

export interface VVSupportStatistics {
  total: number
  open: number
  inProgress: number
  resolved: number
  closed: number
}

export interface VVAdminTicketFilters {
  status?: VVSupportStatus
  priority?: VVSupportPriority
  category?: VVSupportCategory
}

export interface VVAdminSearchResult {
  id: string
  caseId: string
  type: 'TICKET' | 'ESIM' | 'LOUNGE' | 'BENEFIT'
  subject: string
  status: string
}

// ── Settings ────────────────────────────────────────────────────────
export interface VVAdminSettings {
  esim: { configured: boolean; credentialsSource: string; apiUrl: string }
  email: { configured: boolean; provider: string; fromAddress: string }
}

export interface VVEsimApiTestResult {
  ok: boolean
  message: string
  balance?: number
}
```

---

## PART 3 — Frontend: API Service Layer

### 3.1 VeloxVerse API Service

**New file: `frontend/src/features/veloxverse-admin/vvAdminService.ts`**

All API calls go through the CRM's existing axios instance to `/vv-admin/*`. The proxy adds auth and forwards to VeloxVerse.

```ts
import api from '@/lib/axios'
import type {
  AnalyticsOverview, RevenueSeries, GrowthSeries, PopularPackage,
  RecentActivity, OrderStats, CustomerSpending,
  AdminOrderRow, AdminOrderDetail, VVPagination,
  LoungeVisit, AdminLoungeMembership, LoungeStats, Paginated,
  AdminTransferBooking,
  PromoCode, PromoCodeStats, CreatePromoCodeInput,
  PricingRule, PricingAuditEntry,
  VVAdminUser, VVAdminUsersPage, VVAdminUserDetail, VVUserRole,
  VVSupportTicket, VVSupportStatistics, VVAdminTicketFilters, VVAdminSearchResult,
  VVAdminSettings, VVEsimApiTestResult,
} from './types'

// Standard VeloxVerse API envelope
interface VVResponse<T> { success: boolean; message: string; data: T }

const VV = '/vv-admin'

// ── Analytics ───────────────────────────────────────────────────────
export const vvAnalyticsService = {
  async getOverview() {
    const { data } = await api.get<VVResponse<{ overview: AnalyticsOverview }>>(`${VV}/admin/analytics/overview`)
    return data.data.overview
  },
  async getRevenue(period: string) {
    const { data } = await api.get<VVResponse<{ revenue: RevenueSeries }>>(`${VV}/admin/analytics/revenue`, { params: { period } })
    return data.data.revenue
  },
  async getGrowth(period: string) {
    const { data } = await api.get<VVResponse<{ growth: GrowthSeries }>>(`${VV}/admin/analytics/growth`, { params: { period } })
    return data.data.growth
  },
  async getPopularPackages(limit = 10) {
    const { data } = await api.get<VVResponse<{ packages: PopularPackage[] }>>(`${VV}/admin/analytics/popular-packages`, { params: { limit } })
    return data.data.packages
  },
  async getRecentOrders(limit = 10) {
    const { data } = await api.get<VVResponse<{ orders: RecentActivity[] }>>(`${VV}/admin/analytics/recent-orders`, { params: { limit } })
    return data.data.orders
  },
  async getOrderStats() {
    const { data } = await api.get<VVResponse<{ stats: OrderStats }>>(`${VV}/admin/analytics/order-stats`)
    return data.data.stats
  },
  async getCustomerSpending(limit = 20) {
    const { data } = await api.get<VVResponse<{ customers: CustomerSpending[] }>>(`${VV}/admin/analytics/customer-spending`, { params: { limit } })
    return data.data.customers
  },
}

// ── eSIM Orders ─────────────────────────────────────────────────────
export const vvEsimService = {
  async getOrders(page = 1, limit = 20) {
    const { data } = await api.get<VVResponse<{ orders: AdminOrderRow[]; pagination: VVPagination }>>(`${VV}/admin/esims/orders`, { params: { page, limit } })
    return data.data
  },
  async getOrderDetail(orderNo: string) {
    const { data } = await api.get<VVResponse<{ order: AdminOrderDetail }>>(`${VV}/admin/esims/orders/${encodeURIComponent(orderNo)}`)
    return data.data.order
  },
  async cancelEsim(orderNo: string) {
    const { data } = await api.post<VVResponse<{ orderNo: string; status: string; refunded: boolean; refundAmount: number }>>(`${VV}/admin/esims/orders/${encodeURIComponent(orderNo)}/cancel`)
    return data.data
  },
  async suspendEsim(orderNo: string) {
    const { data } = await api.post<VVResponse<{ orderNo: string; status: string; iccid: string }>>(`${VV}/admin/esims/orders/${encodeURIComponent(orderNo)}/suspend`)
    return data.data
  },
  async unsuspendEsim(orderNo: string) {
    const { data } = await api.post<VVResponse<{ orderNo: string; status: string; iccid: string }>>(`${VV}/admin/esims/orders/${encodeURIComponent(orderNo)}/unsuspend`)
    return data.data
  },
}

// ── Lounge ───────────────────────────────────────────────────────────
export const vvLoungeService = {
  async getVisits(params: { page?: number; limit?: number; airport?: string; status?: string } = {}) {
    const { data } = await api.get<VVResponse<Paginated<LoungeVisit>>>(`${VV}/lounge/admin/visits`, { params })
    return data.data
  },
  async getMemberships() {
    const { data } = await api.get<VVResponse<{ memberships: AdminLoungeMembership[] }>>(`${VV}/lounge/admin/memberships`)
    return data.data.memberships
  },
  async getStats() {
    const { data } = await api.get<VVResponse<{ stats: LoungeStats }>>(`${VV}/lounge/admin/stats`)
    return data.data.stats
  },
}

// ── Transfers ───────────────────────────────────────────────────────
export const vvTransferService = {
  async getBookings(status?: string) {
    const { data } = await api.get<VVResponse<{ bookings: AdminTransferBooking[] }>>(`${VV}/admin/assist/transfer/bookings`, { params: status ? { status } : undefined })
    return data.data.bookings
  },
}

// ── Promo Codes ─────────────────────────────────────────────────────
export const vvPromoService = {
  async list(params: { status?: string; page?: number; limit?: number } = {}) {
    const { data } = await api.get<VVResponse<{ promoCodes: PromoCode[]; pagination: VVPagination }>>(`${VV}/admin/promo-codes`, { params })
    return data.data
  },
  async create(input: CreatePromoCodeInput) {
    const { data } = await api.post<VVResponse<{ promoCode: PromoCode }>>(`${VV}/admin/promo-codes`, input)
    return data.data.promoCode
  },
  async update(id: string, patch: Partial<CreatePromoCodeInput>) {
    const { data } = await api.patch<VVResponse<{ promoCode: PromoCode }>>(`${VV}/admin/promo-codes/${id}`, patch)
    return data.data.promoCode
  },
  async getStats(id: string) {
    const { data } = await api.get<VVResponse<PromoCodeStats>>(`${VV}/admin/promo-codes/${id}/stats`)
    return data.data
  },
}

// ── Pricing Rules ───────────────────────────────────────────────────
export const vvPricingService = {
  async list(status?: string) {
    const { data } = await api.get<VVResponse<{ rules: PricingRule[] }>>(`${VV}/admin/pricing-rules`, { params: status ? { status } : undefined })
    return data.data.rules
  },
  async get(id: string) {
    const { data } = await api.get<VVResponse<{ rule: PricingRule; audits: PricingAuditEntry[] }>>(`${VV}/admin/pricing-rules/${id}`)
    return data.data
  },
  async create(rule: Partial<PricingRule> & { changeReason?: string }) {
    const { data } = await api.post<VVResponse<{ rule: PricingRule }>>(`${VV}/admin/pricing-rules`, rule)
    return data.data.rule
  },
  async update(id: string, rule: Partial<PricingRule> & { changeReason?: string }) {
    const { data } = await api.put<VVResponse<{ rule: PricingRule }>>(`${VV}/admin/pricing-rules/${id}`, rule)
    return data.data.rule
  },
  async publish(id: string) {
    const { data } = await api.post<VVResponse<{ rule: PricingRule }>>(`${VV}/admin/pricing-rules/${id}/publish`)
    return data.data.rule
  },
  async archive(id: string) {
    const { data } = await api.post<VVResponse<{ rule: PricingRule }>>(`${VV}/admin/pricing-rules/${id}/archive`)
    return data.data.rule
  },
  async duplicate(id: string) {
    const { data } = await api.post<VVResponse<{ rule: PricingRule }>>(`${VV}/admin/pricing-rules/${id}/duplicate`)
    return data.data.rule
  },
  async remove(id: string, changeReason: string) {
    const { data } = await api.delete<VVResponse<{ rule: PricingRule }>>(`${VV}/admin/pricing-rules/${id}`, { data: { changeReason } })
    return data.data.rule
  },
  async ruleAudit(id: string) {
    const { data } = await api.get<VVResponse<{ audits: PricingAuditEntry[] }>>(`${VV}/admin/pricing-rules/${id}/audit`)
    return data.data.audits
  },
  async globalAudit(limit = 20) {
    const { data } = await api.get<VVResponse<{ audits: PricingAuditEntry[] }>>(`${VV}/admin/pricing-audit`, { params: { limit } })
    return data.data.audits
  },
}

// ── Users ───────────────────────────────────────────────────────────
export const vvUsersService = {
  async list(page = 1, search?: string, limit = 20) {
    const { data } = await api.get<VVResponse<VVAdminUsersPage>>(`${VV}/admin/users`, { params: { page, limit, ...(search ? { search } : {}) } })
    return data.data
  },
  async get(id: string) {
    const { data } = await api.get<VVResponse<VVAdminUserDetail>>(`${VV}/admin/users/${id}`)
    return data.data
  },
  async setStatus(id: string, isActive: boolean) {
    const { data } = await api.patch<VVResponse<{ user: VVAdminUser }>>(`${VV}/admin/users/${id}/status`, { isActive })
    return data.data.user
  },
  async setRole(id: string, role: VVUserRole) {
    const { data } = await api.patch<VVResponse<{ user: VVAdminUser }>>(`${VV}/admin/users/${id}/role`, { role })
    return data.data.user
  },
}

// ── Support ─────────────────────────────────────────────────────────
export const vvSupportService = {
  async list(filters: VVAdminTicketFilters = {}) {
    const { data } = await api.get<VVResponse<{ tickets: VVSupportTicket[] }>>(`${VV}/admin/support/tickets`, { params: filters })
    return data.data.tickets
  },
  async get(id: string) {
    const { data } = await api.get<VVResponse<{ ticket: VVSupportTicket }>>(`${VV}/admin/support/tickets/${encodeURIComponent(id)}`)
    return data.data.ticket
  },
  async reply(id: string, message: string) {
    const { data } = await api.post<VVResponse<{ ticket: VVSupportTicket }>>(`${VV}/admin/support/tickets/${encodeURIComponent(id)}/reply`, { message })
    return data.data.ticket
  },
  async updateStatus(id: string, status: string) {
    const { data } = await api.patch<VVResponse<{ ticket: VVSupportTicket }>>(`${VV}/admin/support/tickets/${encodeURIComponent(id)}/status`, { status })
    return data.data.ticket
  },
  async getStatistics() {
    const { data } = await api.get<VVResponse<{ statistics: VVSupportStatistics }>>(`${VV}/admin/support/statistics`)
    return data.data.statistics
  },
  async search(q: string) {
    const { data } = await api.get<VVResponse<{ results: VVAdminSearchResult[] }>>(`${VV}/admin/support/search`, { params: { q } })
    return data.data.results
  },
}

// ── Settings ────────────────────────────────────────────────────────
export const vvSettingsService = {
  async get() {
    const { data } = await api.get<VVResponse<{ settings: VVAdminSettings }>>(`${VV}/admin/settings`)
    return data.data.settings
  },
  async testSmtp() {
    const { data } = await api.post<VVResponse<{ sentTo: string }>>(`${VV}/admin/settings/test-smtp`)
    return data.data
  },
  async testEsimApi() {
    const { data } = await api.post<VVResponse<VVEsimApiTestResult>>(`${VV}/admin/settings/test-esim-api`)
    return data.data
  },
}
```

---

## PART 4 — Frontend: React Query Hooks

### 4.1 Hook Files

Create one hook file per module. Each follows the CRM's existing pattern: TanStack React Query v5, query keys prefixed with `vv-` to avoid collisions.

**New files to create** (all under `frontend/src/features/veloxverse-admin/hooks/`):

| File | Service | Hooks |
|------|---------|-------|
| `useVVAnalytics.ts` | `vvAnalyticsService` | `useVVOverview`, `useVVRevenue(period)`, `useVVGrowth(period)`, `useVVPopularPackages(limit)`, `useVVRecentOrders(limit)`, `useVVOrderStats`, `useVVCustomerSpending(limit)` |
| `useVVEsim.ts` | `vvEsimService` | `useVVEsimOrders(page, limit)`, `useVVEsimDetail(orderNo)`, `useVVCancelEsim()`, `useVVSuspendEsim()`, `useVVUnsuspendEsim()` |
| `useVVLounge.ts` | `vvLoungeService` | `useVVLoungeVisits(params)`, `useVVLoungeMemberships()`, `useVVLoungeStats()` |
| `useVVTransfers.ts` | `vvTransferService` | `useVVTransferBookings(status?)` |
| `useVVPromo.ts` | `vvPromoService` | `useVVPromoCodes(status?)`, `useVVCreatePromo()`, `useVVUpdatePromo()` |
| `useVVPricing.ts` | `vvPricingService` | `useVVPricingRules(status?)`, `useVVPricingRule(id)`, `useVVGlobalAudit(limit?)`, `useVVCreateRule()`, `useVVUpdateRule()`, `useVVPublishRule()`, `useVVArchiveRule()`, `useVVDuplicateRule()`, `useVVDeleteRule()` |
| `useVVUsers.ts` | `vvUsersService` | `useVVUsers(page, search)`, `useVVUserDetail(id)`, `useVVSetUserStatus()`, `useVVSetUserRole()` |
| `useVVSupport.ts` | `vvSupportService` | `useVVSupportTickets(filters)`, `useVVSupportTicket(id)`, `useVVSupportStats()`, `useVVSupportSearch(query)`, `useVVReplyTicket()`, `useVVUpdateTicketStatus()` |
| `useVVSettings.ts` | `vvSettingsService` | `useVVSettings()`, `useVVTestSmtp()`, `useVVTestEsimApi()` |

**Pattern for each hook file** (example for analytics):

```ts
import { useQuery } from '@tanstack/react-query'
import { vvAnalyticsService } from '../vvAdminService'

export function useVVOverview() {
  return useQuery({
    queryKey: ['vv-analytics', 'overview'],
    queryFn: () => vvAnalyticsService.getOverview(),
  })
}

export function useVVRevenue(period: string) {
  return useQuery({
    queryKey: ['vv-analytics', 'revenue', period],
    queryFn: () => vvAnalyticsService.getRevenue(period),
  })
}

// ... repeat for each hook
```

**Pattern for mutation hooks** (example for eSIM):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { vvEsimService } from '../vvAdminService'

export function useVVCancelEsim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderNo: string) => vvEsimService.cancelEsim(orderNo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vv-esim'] })
    },
  })
}
```

---

## PART 5 — Frontend: New UI Components

VeloxVerse admin pages use Tabs, Switch, and Skeleton which don't exist in the CRM's component library. Build them in the CRM's style.

### 5.1 Tabs Component

**New file: `frontend/src/components/ui/Tabs.tsx`**

```tsx
import { useState, createContext, useContext, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

interface TabsProps {
  defaultValue: string
  value?: string
  onChange?: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ defaultValue, value, onChange, children, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue)
  const activeTab = value ?? internal
  const setActiveTab = (tab: string) => {
    setInternal(tab)
    onChange?.(tab)
  }
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-1 border-b border-gray-200', className)}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext)!
  const isActive = ctx.activeTab === value
  return (
    <button
      type="button"
      onClick={() => ctx.setActiveTab(value)}
      className={cn(
        'px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2',
        isActive
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext)!
  if (ctx.activeTab !== value) return null
  return <div className={cn('pt-4', className)}>{children}</div>
}
```

### 5.2 Switch Component

**New file: `frontend/src/components/ui/Switch.tsx`**

```tsx
import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  className?: string
}

export default function Switch({ checked, onChange, disabled = false, label, className }: SwitchProps) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  )
}
```

### 5.3 Skeleton Component

**New file: `frontend/src/components/ui/Skeleton.tsx`**

```tsx
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-gray-200', className)} />
  )
}
```

### 5.4 Charts Component (SVG)

**New file: `frontend/src/features/veloxverse-admin/components/Charts.tsx`**

Direct port of VeloxVerse's pure-SVG `LineChart` and `BarChart`. These have zero external dependencies — they render SVG with Tailwind classes. Port the exact implementation from `veloxverse/frontend/src/components/admin/Charts.tsx`.

The charts accept this interface:
```ts
interface ChartProps {
  points: { label: string; value: number }[]
  valuePrefix?: string  // e.g. "$" for currency
}
```

And render an SVG with viewBox `0 0 600 200`, gridlines, labeled axes, and either a line+area (LineChart) or bars (BarChart).

---

## PART 6 — Frontend: Page Components

### 6.1 All Pages to Create

**All pages go in `frontend/src/features/veloxverse-admin/pages/`**

Each page is ported from the VeloxVerse Next.js admin pages with these adaptations:

1. Remove `'use client'` directive (CRM is already client-rendered)
2. Replace `next/link` → `import { Link } from 'react-router-dom'` (`href` → `to`)
3. Replace `next/navigation` → `import { useNavigate, useParams } from 'react-router-dom'`
4. Replace `use(params)` → `useParams()` for dynamic route parameters
5. Replace shadcn/ui components → CRM components:
   - `<Card>` → `import { Card, CardHeader } from '@/components/ui/Card'`
   - `<Badge variant="...">` → `import Badge from '@/components/ui/Badge'` with CRM variant names (`success`/`danger`/`warning`/`info`/`neutral`)
   - `<Button>` → `import Button from '@/components/ui/Button'` with CRM variants
   - `<Input>` → `import Input from '@/components/ui/Input'`
   - `<Dialog>` → `import Modal from '@/components/ui/Modal'`
   - `<Tabs>`/`<TabsList>`/`<TabsTrigger>`/`<TabsContent>` → from new `@/components/ui/Tabs`
   - `<Switch>` → from new `@/components/ui/Switch`
   - `<Skeleton>` → from new `@/components/ui/Skeleton`
6. Replace `toast.success(msg)` / `toast.error(msg)` (sonner) → `showToast({ type: 'success', title: msg })` / `showToast({ type: 'error', title: 'Error', message: msg })` using `import { useToast } from '@/app/providers/ToastProvider'`
7. Replace VeloxVerse hooks → new VV hooks from `../hooks/useVV*.ts`
8. Replace VeloxVerse services → new VV service from `../vvAdminService.ts`
9. Replace VeloxVerse types → from `../types.ts`

### 6.2 Page List

| File | Source | Dynamic Route Param | Notes |
|------|--------|-------------------|-------|
| `VVAnalyticsPage.tsx` | `admin/analytics/page.tsx` | — | Period selector, overview cards, charts, tables |
| `VVEsimListPage.tsx` | `admin/esims/page.tsx` | — | Paginated orders table |
| `VVEsimDetailPage.tsx` | `admin/esims/[orderNo]/page.tsx` | `orderNo` | QR code, identifiers, data plan, admin actions |
| `VVLoungePage.tsx` | `admin/lounge/page.tsx` | — | Stats row, Tabs for Visits/Memberships |
| `VVTransfersPage.tsx` | `admin/transfers/page.tsx` | — | Status filter, bookings table |
| `VVPromoCodesPage.tsx` | `admin/promo-codes/page.tsx` | — | Create form modal, promo list with stats |
| `VVPricingPage.tsx` | `admin/pricing/page.tsx` | — | Most complex — rule cards, create/edit modal, audit trail |
| `VVUsersListPage.tsx` | `admin/users/page.tsx` | — | Search + paginated table |
| `VVUserDetailPage.tsx` | `admin/users/[id]/page.tsx` | `id` | Profile card, role/status toggles, orders, devices |
| `VVSupportListPage.tsx` | `admin/support/page.tsx` | — | Stats, search, filter dropdowns, tickets table |
| `VVSupportDetailPage.tsx` | `admin/support/[ticketId]/page.tsx` | `ticketId` | Message thread, status dropdown, reply form |
| `VVSettingsPage.tsx` | `admin/settings/page.tsx` | — | Read-only config display, test buttons |

---

## PART 7 — Frontend: Routing

### 7.1 Route Additions

**File: `frontend/src/app/Router.tsx`**

**Step 1 — Add imports at the top** (after existing page imports):

```tsx
// VeloxVerse Admin
import VVAnalyticsPage from '@/features/veloxverse-admin/pages/VVAnalyticsPage'
import VVEsimListPage from '@/features/veloxverse-admin/pages/VVEsimListPage'
import VVEsimDetailPage from '@/features/veloxverse-admin/pages/VVEsimDetailPage'
import VVLoungePage from '@/features/veloxverse-admin/pages/VVLoungePage'
import VVTransfersPage from '@/features/veloxverse-admin/pages/VVTransfersPage'
import VVPromoCodesPage from '@/features/veloxverse-admin/pages/VVPromoCodesPage'
import VVPricingPage from '@/features/veloxverse-admin/pages/VVPricingPage'
import VVUsersListPage from '@/features/veloxverse-admin/pages/VVUsersListPage'
import VVUserDetailPage from '@/features/veloxverse-admin/pages/VVUserDetailPage'
import VVSupportListPage from '@/features/veloxverse-admin/pages/VVSupportListPage'
import VVSupportDetailPage from '@/features/veloxverse-admin/pages/VVSupportDetailPage'
import VVSettingsPage from '@/features/veloxverse-admin/pages/VVSettingsPage'
```

**Step 2 — Add routes inside the `<RoleGuard allowedRoles={['super_admin', 'admin']}>` children array** (after the Form Builder routes, around line 65):

```tsx
              // ── VeloxVerse Admin ────────────────────────────────────
              { path: '/dashboard/veloxverse/analytics',              element: <VVAnalyticsPage /> },
              { path: '/dashboard/veloxverse/esim-orders',            element: <VVEsimListPage /> },
              { path: '/dashboard/veloxverse/esim-orders/:orderNo',   element: <VVEsimDetailPage /> },
              { path: '/dashboard/veloxverse/lounge',                 element: <VVLoungePage /> },
              { path: '/dashboard/veloxverse/transfers',              element: <VVTransfersPage /> },
              { path: '/dashboard/veloxverse/promo-codes',            element: <VVPromoCodesPage /> },
              { path: '/dashboard/veloxverse/pricing',                element: <VVPricingPage /> },
              { path: '/dashboard/veloxverse/users',                  element: <VVUsersListPage /> },
              { path: '/dashboard/veloxverse/users/:id',              element: <VVUserDetailPage /> },
              { path: '/dashboard/veloxverse/support',                element: <VVSupportListPage /> },
              { path: '/dashboard/veloxverse/support/:ticketId',      element: <VVSupportDetailPage /> },
              { path: '/dashboard/veloxverse/settings',               element: <VVSettingsPage /> },
```

---

## PART 8 — Frontend: Sidebar Configuration

### 8.1 Update Sidebar Config

**File: `frontend/src/config/sidebarConfig.ts`**

**Step 1 — Add new icon imports:**

```ts
import {
  LayoutDashboard,
  Users,
  Settings,
  UserCircle,
  ContactRound,
  ShieldCheck,
  FormInput,
  // VeloxVerse section
  BarChart3,
  Smartphone,
  Armchair,
  Car,
  Tag,
  DollarSign,
  Headphones,
  Globe,
} from 'lucide-react'
```

**Step 2 — Add VeloxVerse items to both `super_admin` and `admin` arrays.** Add these entries after the existing `Settings` entry in each array:

```ts
    // ── VeloxVerse ──
    { label: 'VV Analytics',   path: '/dashboard/veloxverse/analytics',    icon: BarChart3 },
    { label: 'VV eSIM Orders', path: '/dashboard/veloxverse/esim-orders',  icon: Smartphone },
    { label: 'VV Lounge',      path: '/dashboard/veloxverse/lounge',       icon: Armchair },
    { label: 'VV Transfers',   path: '/dashboard/veloxverse/transfers',    icon: Car },
    { label: 'VV Promo Codes', path: '/dashboard/veloxverse/promo-codes',  icon: Tag },
    { label: 'VV Pricing',     path: '/dashboard/veloxverse/pricing',      icon: DollarSign },
    { label: 'VV Users',       path: '/dashboard/veloxverse/users',        icon: Users },
    { label: 'VV Support',     path: '/dashboard/veloxverse/support',      icon: Headphones },
    { label: 'VV Settings',    path: '/dashboard/veloxverse/settings',     icon: Globe },
```

### 8.2 Add Section Separator in Sidebar

**File: `frontend/src/components/layout/Sidebar.tsx`**

The sidebar currently renders `navItems` in a flat list. To visually separate the CRM and VeloxVerse sections, update the nav rendering to detect VeloxVerse items (paths starting with `/dashboard/veloxverse/`) and insert a section header before them.

Replace the nav items mapping block (around line 77-89) with:

```tsx
          {(() => {
            let vvHeaderShown = false
            return navItems.map((item) => {
              const isVV = item.path.startsWith('/dashboard/veloxverse/')
              const showHeader = isVV && !vvHeaderShown
              if (showHeader) vvHeaderShown = true
              return (
                <div key={item.path}>
                  {showHeader && !shouldCollapse && (
                    <p className="px-3 mt-5 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                      VeloxVerse
                    </p>
                  )}
                  {showHeader && shouldCollapse && (
                    <div className="my-3 mx-2 border-t border-gray-200" />
                  )}
                  <SidebarNavItem
                    item={item}
                    collapsed={shouldCollapse}
                    onClick={onMobileClose}
                  />
                </div>
              )
            })
          })()}
```

---

## PART 9 — Complete File Summary

### Backend — Velox-CRM (`backend/node-crm/`)

| Action | File | Description |
|--------|------|-------------|
| INSTALL | `package.json` | `npm install axios` |
| MODIFY | `.env` | Add `VELOXVERSE_API_URL=http://localhost:5005/api/v1` |
| MODIFY | `.env.example` | Add same variable |
| CREATE | `src/middleware/veloxverseProxy.js` | Proxy middleware (~50 lines) |
| MODIFY | `src/app.js` | Add import + mount proxy at `/api/vv-admin` (~5 lines) |

### Frontend — Velox-CRM (`frontend/`)

| Action | File | Description |
|--------|------|-------------|
| CREATE | `src/features/veloxverse-admin/types.ts` | All VeloxVerse admin type definitions (~280 lines) |
| CREATE | `src/features/veloxverse-admin/vvAdminService.ts` | All API service functions (~200 lines) |
| CREATE | `src/features/veloxverse-admin/hooks/useVVAnalytics.ts` | 7 query hooks |
| CREATE | `src/features/veloxverse-admin/hooks/useVVEsim.ts` | 2 queries + 3 mutations |
| CREATE | `src/features/veloxverse-admin/hooks/useVVLounge.ts` | 3 queries |
| CREATE | `src/features/veloxverse-admin/hooks/useVVTransfers.ts` | 1 query |
| CREATE | `src/features/veloxverse-admin/hooks/useVVPromo.ts` | 1 query + 2 mutations |
| CREATE | `src/features/veloxverse-admin/hooks/useVVPricing.ts` | 3 queries + 5 mutations |
| CREATE | `src/features/veloxverse-admin/hooks/useVVUsers.ts` | 2 queries + 2 mutations |
| CREATE | `src/features/veloxverse-admin/hooks/useVVSupport.ts` | 3 queries + 2 mutations |
| CREATE | `src/features/veloxverse-admin/hooks/useVVSettings.ts` | 1 query + 2 mutations |
| CREATE | `src/features/veloxverse-admin/components/Charts.tsx` | SVG LineChart + BarChart (~120 lines) |
| CREATE | `src/features/veloxverse-admin/pages/VVAnalyticsPage.tsx` | Analytics dashboard |
| CREATE | `src/features/veloxverse-admin/pages/VVEsimListPage.tsx` | eSIM orders list |
| CREATE | `src/features/veloxverse-admin/pages/VVEsimDetailPage.tsx` | eSIM order detail |
| CREATE | `src/features/veloxverse-admin/pages/VVLoungePage.tsx` | Lounge admin |
| CREATE | `src/features/veloxverse-admin/pages/VVTransfersPage.tsx` | Transfer bookings |
| CREATE | `src/features/veloxverse-admin/pages/VVPromoCodesPage.tsx` | Promo codes |
| CREATE | `src/features/veloxverse-admin/pages/VVPricingPage.tsx` | Pricing rules |
| CREATE | `src/features/veloxverse-admin/pages/VVUsersListPage.tsx` | VeloxVerse users list |
| CREATE | `src/features/veloxverse-admin/pages/VVUserDetailPage.tsx` | User detail |
| CREATE | `src/features/veloxverse-admin/pages/VVSupportListPage.tsx` | Support tickets list |
| CREATE | `src/features/veloxverse-admin/pages/VVSupportDetailPage.tsx` | Ticket detail + chat |
| CREATE | `src/features/veloxverse-admin/pages/VVSettingsPage.tsx` | VeloxVerse settings |
| CREATE | `src/components/ui/Tabs.tsx` | Tabs component (~70 lines) |
| CREATE | `src/components/ui/Switch.tsx` | Toggle switch (~35 lines) |
| CREATE | `src/components/ui/Skeleton.tsx` | Loading skeleton (~10 lines) |
| MODIFY | `src/app/Router.tsx` | Add 12 VeloxVerse route entries + imports |
| MODIFY | `src/config/sidebarConfig.ts` | Add 9 nav items + icon imports to super_admin & admin |
| MODIFY | `src/components/layout/Sidebar.tsx` | Add VeloxVerse section separator |

**Total: 5 backend files (1 new, 4 modified) + 30 frontend files (27 new, 3 modified)**

---

## PART 10 — Implementation Order

1. **Backend proxy** (Part 1) — `npm install axios`, create proxy middleware, mount route, add env var
2. **Types** (Part 2) — create `types.ts` — foundation for everything
3. **API service** (Part 3) — create `vvAdminService.ts` — test proxy end-to-end
4. **New UI components** (Part 5) — Tabs, Switch, Skeleton — needed by pages
5. **Charts** (Part 5.4) — needed by Analytics page
6. **Hooks** (Part 4) — all 9 hook files
7. **Pages** (Part 6) — start with `VVSettingsPage` (simplest, good smoke test), then `VVAnalyticsPage`, then the rest
8. **Routing** (Part 7) — add routes to Router.tsx
9. **Sidebar** (Part 8) — add nav items and section separator
10. **End-to-end testing** — start both backends, log in as super_admin, navigate each VeloxVerse page

---

## PART 11 — Key Porting Reference

### Badge Variant Mapping

VeloxVerse uses shadcn variants. Map to CRM `BadgeVariant`:

| VeloxVerse (shadcn) | CRM Badge | Use Case |
|---------------------|-----------|----------|
| `variant="default"` | `variant="neutral"` | Default state |
| `variant="secondary"` | `variant="info"` | In progress |
| `variant="destructive"` | `variant="danger"` | Error/cancelled/failed |
| `variant="outline"` | `variant="neutral"` | Outline state |
| Green/success coloring | `variant="success"` | Active/completed/profit |
| Yellow/warning coloring | `variant="warning"` | Pending/expiring |

### Status → Badge Mapping (common across pages)

```ts
function statusBadgeVariant(status: string): BadgeVariant {
  const s = status.toUpperCase()
  if (['ACTIVE', 'COMPLETED', 'PUBLISHED', 'RESOLVED'].includes(s)) return 'success'
  if (['PENDING', 'DRAFT', 'OPEN', 'CONFIRMED'].includes(s)) return 'warning'
  if (['CANCELLED', 'FAILED', 'ARCHIVED', 'CLOSED', 'EXPIRED'].includes(s)) return 'danger'
  if (['IN_PROGRESS', 'APPROVED', 'SUSPENDED'].includes(s)) return 'info'
  return 'neutral'
}
```

Create this as a shared utility at `frontend/src/features/veloxverse-admin/utils.ts` and import in every page.

### Money Formatting

VeloxVerse admin pages mix two formats — keep the original logic:
- **Dollars (floats)**: Analytics revenue, eSIM costs/prices, customer spending → `$${value.toFixed(2)}`
- **Cents (integers)**: Lounge costs, transfer amounts, promo discounts → `$${(cents / 100).toFixed(2)}`

### Toast Migration

Every VeloxVerse page that uses `toast` (from `sonner`) must be converted:

```ts
// VeloxVerse (sonner):
toast.success('Rule published')
toast.error('Failed to publish')

// CRM (ToastProvider):
const { showToast } = useToast()
showToast({ type: 'success', title: 'Rule published' })
showToast({ type: 'error', title: 'Failed to publish', message: err.message })
```

---

## PART 12 — Prerequisites (VeloxVerse Side)

Before this CRM integration works, the **VeloxVerse backend** must have its CRM bridge changes applied (see `VELOXVERSE_CRM_BRIDGE_PROMPT.md` in the veloxverse repo). Specifically:

1. `CRM_BRIDGE_ENABLED=true` in VeloxVerse `.env`
2. `CRM_JWT_SECRET` set to the same value as Velox-CRM's `JWT_SECRET`
3. `CRM_ALLOWED_ORIGINS` includes the CRM backend URL
4. The `crmBridge.middleware.ts` must be created and wired into all admin route files
5. CORS updated to allow CRM origins

Without these VeloxVerse changes, the proxy will receive 401 responses from VeloxVerse for every request.

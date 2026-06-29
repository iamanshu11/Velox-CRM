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

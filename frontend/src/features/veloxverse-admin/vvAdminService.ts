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

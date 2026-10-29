import { canAccess } from '@/config/routeAccess'
import type { UserRole } from '@/types'

export interface GuideLink {
  label: string
  to: string
}

export interface GuideTopic {
  /** Used in shareable links: <page>?guide=<id>. */
  id: string
  section: string
  title: string
  summary: string
  /** The topic's own page. Shown only to roles that can open it; none = everyone. */
  page?: string
  steps: string[]
  /** "Go to…" links; each is also hidden from roles that can't open it. */
  links: GuideLink[]
}

// Steps quote the pages' real labels. Keep them in sync when a page's wording changes.
export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'getting-around',
    section: 'Getting started',
    title: 'Getting around the CRM',
    summary: 'The menu, notifications and this guide.',
    steps: [
      'Use the menu on the left (on a phone, tap the menu button at the top) to open any page. You only see the pages your role allows.',
      'The bell at the top shows notifications for you; a number means some are unread. Open it and choose "Mark all read" to clear them.',
      'Open your name at the top right for this Quick Guide, to replay the welcome tour, or to sign out.',
      'To share a topic with a colleague, open it here and choose "Copy link".',
    ],
    links: [],
  },
  {
    id: 'customers',
    section: 'Customers',
    title: 'Find, add or edit a customer',
    summary: 'Customer records in the CRM.',
    page: '/dashboard/customers',
    steps: [
      'Open Customers and type in "Search by name, email, phone, city…".',
      'To add someone, choose "Add Customer", fill in the form and save.',
      'On a row, choose "View" to see the details, "Edit" to change them, or "Delete" to remove the record (you will be asked to confirm).',
      'If you see the account filter, pick "Registered users" or "Guests" to narrow the list.',
    ],
    links: [{ label: 'Customers', to: '/dashboard/customers' }],
  },
  {
    id: 'app-users',
    section: 'Customers',
    title: 'Look up an app user or guest',
    summary: 'VeloxVerse accounts: spending, bookings, block, country.',
    page: '/dashboard/veloxverse/users',
    steps: [
      'Open App Users and search by name or email. Use the status filter for Active, Blocked or Inactive accounts.',
      'Open a user to see Total spent, Total refunded, Points balance, their bookings, support tickets and activity log.',
      'To correct where they live, choose "Change" next to "Country (current residency)", pick the country, add a reason and save. This works for guests too.',
      'To stop someone using the app, choose "Block". "Unblock" lets them back in.',
    ],
    links: [{ label: 'App Users', to: '/dashboard/veloxverse/users' }],
  },
  {
    id: 'support-tickets',
    section: 'Customers',
    title: 'Answer a support ticket',
    summary: 'Find a case and respond.',
    page: '/dashboard/veloxverse/support',
    steps: [
      'Open Support. If you have a case ID, enter it in "Search by Case ID" and choose "Search".',
      'Otherwise filter by status, priority or category, or search by subject, case ID or customer.',
      'Choose "View" on a ticket to read it and reply.',
    ],
    links: [{ label: 'Support Tickets', to: '/dashboard/veloxverse/support' }],
  },
  {
    id: 'approvals',
    section: 'Customers',
    title: 'Raise or review a request',
    summary: 'Operational requests that need approval.',
    page: '/dashboard/approvals',
    steps: [
      'Open Approvals and choose "New request", fill in the details and "Submit".',
      'Tick "Only my requests" to see just yours; choose "View" to follow one.',
      'Admins can "Approve" or "Reject" (with an optional note), "Move to review" or "Mark completed".',
    ],
    links: [{ label: 'Approvals', to: '/dashboard/approvals' }],
  },
  {
    id: 'bookings',
    section: 'Bookings & money',
    title: 'Check a lounge or benefit booking',
    summary: 'Lounge, dining, fast track, fitness and memberships.',
    page: '/dashboard/veloxverse/lounge',
    steps: [
      'Open Lounge and pick a tab: Lounge, Dining, Fast Track, Fitness, All or Memberships.',
      'Search by email, name, order no. or ePass ID, or filter by airport (e.g. LGW).',
      'Open a booking to see the customer, payment, pricing, cancellation, emails sent and its audit trail.',
    ],
    links: [
      { label: 'Lounge', to: '/dashboard/veloxverse/lounge' },
      { label: 'Memberships', to: '/dashboard/veloxverse/lounge?tab=memberships' },
    ],
  },
  {
    id: 'payments-refunds',
    section: 'Bookings & money',
    title: 'Payments, refunds and reports',
    summary: 'Find a payment or refund and export a report.',
    page: '/dashboard/veloxverse/payments',
    steps: [
      'Open Payments and search by order, customer, transaction ref, invoice or promo. Filter by outcome, service, provider or "Refunded".',
      'Choose a row to open "Payment details".',
      'Open Refunds to follow refunds by status; the "Failed" and "Stuck" cards show the ones that need attention.',
      'Open Reconciliation to compare our bookings with the supplier\'s ("Mismatch", "Missing there", "Missing here").',
      'For a report, set your filters and choose "Export CSV".',
    ],
    links: [
      { label: 'Payments', to: '/dashboard/veloxverse/payments' },
      { label: 'Refunds', to: '/dashboard/veloxverse/refunds' },
      { label: 'Reconciliation', to: '/dashboard/veloxverse/reconciliation' },
    ],
  },
  {
    id: 'pickdrop-inbox',
    section: 'Bookings & money',
    title: 'Send Pick & Drop emails',
    summary: 'Turn ViaTovia emails into customer emails.',
    page: '/dashboard/veloxverse/pickdrop/emails',
    steps: [
      'Open Pick & Drop Emails. "To review" lists drafts waiting for you; "Check inbox now" fetches new ViaTovia emails.',
      'Open a draft and compare "ViaTovia said" with "Details check" and the "Customer email".',
      'Choose "Send email" (or Ctrl/Cmd + Enter), or "Discard" if it shouldn\'t go out.',
      'Use "Unmatched" for emails we couldn\'t link to an order, and "Sent & history" for what already went out.',
    ],
    links: [
      { label: 'To review', to: '/dashboard/veloxverse/pickdrop/emails' },
      { label: 'ViaTovia inbox', to: '/dashboard/veloxverse/pickdrop/emails/inbox' },
    ],
  },
  {
    id: 'country-rules',
    section: 'Rules & rewards',
    title: 'Country rules for services',
    summary: 'Which services each country can use.',
    page: '/dashboard/veloxverse/country-availability',
    steps: [
      'Open Country Availability. The "Services" tab shows each service and where it is offered.',
      'Use "Preview a country" to see what a customer in that country gets.',
      '"Change history" shows who changed what, and when.',
    ],
    links: [{ label: 'Country Availability', to: '/dashboard/veloxverse/country-availability' }],
  },
  {
    id: 'promo-codes',
    section: 'Rules & rewards',
    title: 'Create a promo code',
    summary: 'Discount codes for the app.',
    page: '/dashboard/veloxverse/promo-codes',
    steps: [
      'Open Promo Codes and choose "New code".',
      'Fill in the code details and choose "Create".',
      'On a code, use "View details", "Edit" or "Stats" to see how often it was used.',
    ],
    links: [{ label: 'Promo Codes', to: '/dashboard/veloxverse/promo-codes' }],
  },
  {
    id: 'pricing-rewards',
    section: 'Rules & rewards',
    title: 'Pricing, Club, points and referrals',
    summary: 'Prices and rewards customers see.',
    page: '/dashboard/veloxverse/pricing',
    steps: [
      'Pricing: a new rule starts as a Draft. Publish it when it is ready; "Rule history" shows earlier changes.',
      'Club: "Prices by country", "Members" and the Club "Promo Codes" are tabs on the VeloxClub page.',
      'Points: set "Earning Rules" and "Global Settings" — choose "Review Changes", then "Save Changes".',
      'Refer & Earn: see "Top referrers" and "Referrals", and export them with "Export CSV".',
    ],
    links: [
      { label: 'Pricing', to: '/dashboard/veloxverse/pricing' },
      { label: 'Club', to: '/dashboard/veloxverse/club' },
      { label: 'Points', to: '/dashboard/veloxverse/points' },
      { label: 'Refer & Earn', to: '/dashboard/veloxverse/refer-earn' },
    ],
  },
  {
    id: 'audit-logs',
    section: 'Monitoring',
    title: 'Trace what happened to a customer',
    summary: 'Audit and API logs.',
    page: '/dashboard/veloxverse/audit-logs',
    steps: [
      'Open Audit Logs and search by support reference, customer email, or a journey, payment or event id, then choose "Find".',
      'Pick a time range (e.g. "Last 24 h") and use "Filters" to narrow it down.',
      'Open an event for its details; "Request (support ref)" leads to the full request trace.',
      'The tabs along the top cover "API Logs", "Stuck customers", "Errors", "Daily trends" and "Alerts".',
    ],
    links: [
      { label: 'Audit Logs', to: '/dashboard/veloxverse/audit-logs' },
      { label: 'API Logs', to: '/dashboard/veloxverse/audit-logs/api' },
    ],
  },
  {
    id: 'forms',
    section: 'Forms',
    title: 'Build a form and read submissions',
    summary: 'Lead-capture forms, submissions and leads.',
    page: '/dashboard/forms',
    steps: [
      'Open Form Builder. On a form, use "Edit", "Embed code", "Submissions" or "Analytics".',
      'In the form editor, choose what happens on submit — for example "Redirect to a Payment link" to send people to a payment page.',
      'In "Submissions", filter by status and choose "Export CSV" for a report.',
      'Open Leads to search all leads by email or name.',
    ],
    links: [
      { label: 'Form Builder', to: '/dashboard/forms' },
      { label: 'Leads', to: '/dashboard/forms/leads' },
    ],
  },
  {
    id: 'staff',
    section: 'Your team & account',
    title: 'Add a team member and set their role',
    summary: 'Staff accounts and roles.',
    page: '/dashboard/employees',
    steps: [
      'Open Users and choose "Add User".',
      'Fill in Full Name, Email Address and Password, then pick a Role. You can only give roles your own role is allowed to create.',
      'Choose "Create User".',
    ],
    links: [{ label: 'Users', to: '/dashboard/employees' }],
  },
  {
    id: 'verification',
    section: 'Your team & account',
    title: 'Verify your account',
    summary: 'Upload your documents and track them.',
    page: '/dashboard/verification',
    steps: [
      'Open Verification. "Required Documents" lists what you need to send.',
      'Choose "Upload Document" for each one; "Document Status" shows where each stands.',
      'Once you are verified, My Profile shows your dashboard.',
    ],
    links: [
      { label: 'Verification', to: '/dashboard/verification' },
      { label: 'My Profile', to: '/dashboard/me' },
    ],
  },
]

/** The topics `role` may see, each with only the links it can open. */
export function guideTopicsForRole(role: UserRole | null | undefined): GuideTopic[] {
  if (!role) return []
  return GUIDE_TOPICS.filter((topic) => !topic.page || canAccess(role, topic.page)).map((topic) => ({
    ...topic,
    links: topic.links.filter((link) => canAccess(role, link.to)),
  }))
}

/** Shareable link to a topic: its own page with ?guide=<id> (a topic without a page: the current page). */
export function topicShareUrl(topic: GuideTopic, location: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  const url = new URL(topic.page ?? location.pathname, location.origin)
  url.searchParams.set('guide', topic.id)
  return url.toString()
}

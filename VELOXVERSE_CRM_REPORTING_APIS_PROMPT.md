# VeloxVerse prompt — Admin reporting APIs for the CRM

**Repo:** veloxverse (`backend/`), branch off `uat`
**Consumer:** Velox CRM, through its `/vv-admin` proxy (existing CRM bridge JWT).
**Scope:** backend only. Admin roles only (`super_admin`, `admin`). The CRM `support` role must get 403 on every endpoint below.

**Already done, no change needed:** Lounge (`/lounge/admin/visits` + `/lounge/admin/visits/export.csv`) and Pick & Drop (`/admin/assist/transfer/bookings` + `/export.csv`) already support `search`, `status`, `from` and `to`, and CSV export. The CRM will wire those up on its own side.

## Conventions (every new or changed endpoint)

- **List filters:** build them with `reportListShape` + `withDateRange` (`validations/adminReport.validation.ts`), like the Lounge and Transfer admin lists.
- **CSV export:** every list gets a matching `GET …/export.csv`. It takes the same filters as the list and returns `text/csv`. Cap it at 10,000 rows and set `x-export-rows` and `x-export-truncated`, the same convention as the Lounge, Transfer and audit exports. Register it before any `/:id` route.
- **Money:** return integer cents plus a currency code. Never return values pre-converted at today's FX rate. Use the real Mint AUD charge (`payments` / `paymentRefunds`) wherever one exists.
- **Responses:** use the existing `sendSuccess` envelope and the same `pagination` object as the current admin lists.
- **Compatibility:** only add optional params. Don't change any existing path or response shape.

---

## Phase 1 — Filters + export on the remaining lists

### 1a. BUG: eSIM orders ignores search, status and dates

- **Endpoint:** `GET /admin/esims/orders` (`controllers/admin.esim.controller.ts` → `allOrders`).
- **Problem:** the handler only reads `page` and `limit`, then calls `adminOrderService.getAllOrders(page, limit)`. The CRM already sends `search` and `status`, but they're dropped. Admins can only search the 20 orders on screen.
- **Fix:**
  - Validate the query with `withDateRange({ ...reportListShape, status })`.
  - `search` should match order no, customer email, customer name and ICCID.
  - Filter `status`, `from` and `to` in the DB query.
- **Add** `GET /admin/esims/orders/export.csv`. Columns: order no, created at, customer email/name, package, country/region, status, amount + currency, AUD card charge, promo code, discount.

### 1b. App users: date filter + export

- **Endpoint:** `GET /admin/users` (`admin.user.controller.ts` → `list`) only reads `page`, `limit` and `search`.
- **Add filters:**
  - `from`/`to` on signup date
  - `status` (active/suspended)
  - `role`
- **Add** `GET /admin/users/export.csv`. Columns: id, name, email, phone, country, signup date, status, role, club tier, points balance, lifetime spend (AUD).

### 1c. Support tickets: date filter + export

- **Endpoint:** `GET /admin/support/tickets` (`supportController.adminList`) only reads `status`, `priority` and `category`.
- **Add filters:** `from`/`to` on created date, and `search` (ticket/case id, customer email, subject).
- **Add** `GET /admin/support/tickets/export.csv`. Columns: case id, created at, customer email, subject, category, priority, status, last reply at, resolved at.

---

## Phase 2 — Revenue by service

`GET /admin/analytics/revenue-by-service?from&to` (+ `export.csv`)

Today `/admin/analytics/revenue` returns one combined series, and the CRM converts it at today's FX rate. The CRM needs real numbers split by service.

### Per-service row

Return one row per paid service: `esim`, `lounge`, `benefit`, `pickdrop`, `club`, plus any others. Each row has:

- `ordersCount`, `customersCount`
- `grossByCurrency: { [currency]: cents }`: the amount in the currency the customer paid
- `cardChargedAudCents`: actual Mint AUD charged
- `creditUsedCents`: wallet/credit portion
- `refundedAudCents`, `refundsCount`: from `paymentRefunds` with status refunded
- `promoDiscountCents` (by currency), `promoOrdersCount`
- `netAudCents` = `cardChargedAudCents` − `refundedAudCents`
- `averageOrderAudCents`

### Also return

- `totals`: the same fields summed across services.
- `byDay[]`: `{ date, service, netAudCents }` for charts.
- `nonCardOrders`: orders paid only by credit or points, counted separately. Don't FX-estimate them.

---

## Phase 3 — Payments ledger + refunds report

There's no admin-wide list today. `/billing/transactions/:id` is per-customer, and `/admin/billing/users/:userId/activity` is per-user only.

### 3a. `GET /admin/billing/transactions` (+ `export.csv`)

- **One row per payment / payment attempt.** Fields:
  - id, date, service, order/booking ref
  - customer id + email
  - amount + currency, AUD charged, credit portion
  - Mint reference
  - status (`succeeded | failed | pending`), failure reason
- **Filters:** `from`, `to`, `service`, `status`, `search` (ref, email, Mint reference).
- **Summary block:** count and AUD total per status.

### 3b. `GET /admin/billing/refunds` (+ `export.csv`)

- **Source:** the `paymentRefunds` model.
- **Fields:**
  - id, requested at, completed at, service, order ref, customer email
  - `totalAmountCents` + `currency`, `mintPortionCents`, `creditPortionCents`, `chargeAmountCents` + `chargeCurrency`
  - status, `providerRefundReference`, `reason`
  - initiated by: admin email, or `system`
- **Filters:** `from`, `to`, `service`, `status`, `search`.
- **Summary block:** count and AUD total per status.

---

## Phase 4 — Supplier reconciliation (+ supplier health)

### 4a. `GET /admin/reconciliation?supplier=&from&to` (+ `export.csv`)

**Suppliers:** `esimaccess`, `dragonpass`, `viatovia`, `mint`.

**Compare** our records against the supplier for the period and return:

- `matched` count
- `mismatches[]`, each with:
  - `ref`
  - `ourStatus`, `supplierStatus`
  - `ourAmountCents`, `supplierCostCents`, currency
  - `issue`: `missing_at_supplier | missing_here | status_mismatch | amount_mismatch`
- `totals`: our revenue (AUD), supplier cost, margin.

**Supplier cost:** we don't appear to store a supplier cost per order today. Where cost or supplier status isn't stored or can't be fetched, say so in your reply. Return those fields as `null`; never estimate them.

### 4b. Supplier checks in the existing health endpoint (optional)

- **Today:** `GET /health` (`routes/index.ts`, `runSystemHealthChecks`) returns 200 or 503 and checks the database and CRM forms. The CRM will poll it for its own "VeloxVerse is down" alerts, so no new endpoint is required.
- **If cheap:** add `timedCheck` entries for eSIM Access, DragonPass, Mint and the ViaTovia Gmail inbox.
  - Use a 3s timeout or less per check, and cache the result for 30s.
  - Mark supplier checks as non-critical: they report `ok:false` without turning the whole response into a 503.
  - Include `ms` and `detail` as today.

---

## Test

1. `GET /admin/esims/orders?search=<order no that is on page 3>` returns it. `status` and `from`/`to` narrow results server-side.
2. Every new `export.csv` matches its filtered list, and the truncation headers are correct above 10,000 rows.
3. `revenue-by-service` totals equal the sum of Mint AUD charges for the same range, and net = charged − refunded.
4. A refunded eSIM appears in `/admin/billing/refunds` (refunded) and in `/admin/billing/transactions`.
5. Reconciliation flags a booking deliberately missing at the supplier.
6. A support-role bridge token gets 403 on every new endpoint.
7. Existing tests pass, and new endpoints have tests.

## Reply with (the CRM is built against exactly this)

For each endpoint:
- final path
- query params
- one example JSON response
- CSV column list

Also list any supplier whose cost or status data isn't available for reconciliation.

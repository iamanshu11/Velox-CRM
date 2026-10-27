# VeloxVerse prompt — Phase 3: admin payments list + refunds report

**Repo:** `veloxverse` backend, branch `feature/crm-reporting` (on top of the uncommitted Phase 1 and 2 work there).
**Consumer:** Velox CRM → two new pages, **Payments** and **Refunds**, under VeloxVerse → Business.
**Routes:** add to `routes/admin.billing.routes.ts` (mounted at `/api/v1/admin/billing`).
- Access is `authorize(ADMIN, SUPER_ADMIN)` only. The CRM support role must get 403.
- Register every `export.csv` route **before** any `/:id` route.

Three new list/detail endpoints plus two CSV exports. Reuse the Phase 1 helpers:
- `parseQuery`, `reportListShape` and `withDateRange` (`validations/adminReport.validation.ts`)
- `createdBetween`, `likePattern` and `matchingUserIds` (`helpers/adminListFilters.ts`)
- `capRows`, `toCsvExport`, `csvMoney`, `sendCsv` and `CSV_EXPORT_MAX_ROWS` (`helpers/csvExport.ts`)

**Before building:** show the user the plan below (which tables and fields feed each number, and what's excluded) and wait for their OK, as for any money total.

---

## Shared conventions

- **Money is integer cents in JSON**, named `…Cents`, with a sibling currency field. Never floats, and never a total summed across currencies.
- **Customer-currency amounts:** `Payment.amountCents` / `currency` and `PaymentRefund.totalAmountCents` / `currency`.
- **Real card money (AUD):** `Payment.chargeAmountCents` / `chargeCurrency` and `PaymentRefund.chargeAmountCents` / `chargeCurrency`. These are the only source for AUD totals; never convert at today's rate.
- **Dates:** ISO strings. `from` / `to` are ISO instants: `from` inclusive, `to` exclusive, `from >= to` returns 400.
- **Order number:** add `orderNo` (string or null) to each row, resolved from `resourceType` + `resourceId`. **Batch it:** one query per resource type per page, never one per row.

  | `resourceType` | Table and field for `orderNo` | Also return |
  |---|---|---|
  | `ESIM_ORDER` | `EsimOrder.orderNo` | |
  | `ESIM_TOPUP` | `EsimTopup.orderId` | |
  | `TRANSFER` | `TransferBooking.orderNo` | |
  | `LOUNGE_VISIT` | `LoungeVisit.orderId` | `visitId` (the CRM links to `/lounge-bookings/:visitId`) |
  | `CLUB_MEMBERSHIP` | `ClubMembership.orderNo` | |
  | `FLIGHT_BOOKING` | its booking reference, if one exists | |

  - **Check:** whether `Payment.resourceId` is really the visit id for lounge payments, or whether visits point back via `metadata.paymentId`. Resolve whichever way the code actually links them, and say which in your reply.
  - **Missing rows:** if the resource row no longer exists, use null.
- **Customer:** `customer: { id, email, name } | null`. Use a batched `User` lookup, or a Sequelize include with `attributes: ['id', 'email', 'firstName', 'lastName']`. Never select password or token columns.
- **Outcome filter** (`outcome` param, so the CRM doesn't hardcode status lists):

  | `outcome` | Payment statuses |
  |---|---|
  | `paid` | `PAYMENT_BILLABLE_STATUSES` (CHARGED, FULFILLING, FULFILLED, FULFILLMENT_FAILED, REFUNDING, REFUNDED, RECONCILING) |
  | `pending` | INITIATED, REQUIRES_ACTION |
  | `failed` | FAILED, ABANDONED |
  | none | all statuses |

  Also return `outcome` on each row, using the same mapping.

---

## 1. `GET /admin/billing/payments` — every payment across all customers

**Query params:**

| Param | Values |
|---|---|
| `page`, `limit` | as Phase 1 (limit max 100) |
| `search` | payment id, `providerReference` (Mint transaction id), `invoiceNumber`, `promoCode`, the resolved order no., or the customer's email / name (`matchingUserIds`) |
| `from`, `to` | on `Payment.createdAt` |
| `outcome` | `paid` \| `pending` \| `failed` |
| `status` | one or more `PaymentStatus` values, comma-separated. AND-ed with `outcome` |
| `service` | one or more `PaymentResourceType` values, comma-separated |
| `provider` | `MINT` \| `STRIPE` |
| `refunded` | `true` = has at least one SUCCEEDED refund; `false` = none |

- **Order no. search:** look up matching resource ids per type first (`orderNo` / `orderId` iLike), then filter `resourceId IN (…)`.
- **Order:** `createdAt` DESC, `id` DESC.

**Response:** `{ payments: PaymentRow[], pagination: { page, limit, total, totalPages }, summary }`

`PaymentRow` fields:

| Field | Source |
|---|---|
| `id`, `createdAt`, `updatedAt` | Payment |
| `status`, `outcome` | Payment.status and the mapping above |
| `service` | `resourceType` |
| `resourceId`, `orderNo`, `visitId` | see conventions |
| `customer` | see conventions |
| `provider`, `providerReference`, `invoiceNumber` | Payment |
| `currency`, `amountCents` | card part, in the customer's currency |
| `creditAppliedCents`, `pointsAppliedCents`, `clubDiscountCents`, `promoDiscountCents`, `promoCode` | Payment |
| `orderTotalCents` | `amountCents + creditAppliedCents` (the full price, as on the statement) |
| `chargeAmountCents`, `chargeCurrency`, `fxRate` | the AUD actually charged; null when none |
| `refund` | `{ count, succeededCents, succeededChargeCents, pendingCount, failedCount, withheldCents }`, built from this payment's `PaymentRefund` rows. `succeededCents` is in `currency` and `succeededChargeCents` in AUD; both sum SUCCEEDED rows only. `withheldCents` is `Payment.metadata.refundWithheldCents` or null; it is kept money such as the $8 flexible fee, not a refund |

**`summary`** is computed over **all** rows matching the filters, not just this page, and only from `outcome = paid` payments:

| Field | Meaning |
|---|---|
| `paidCount` | number of matching `paid` payments |
| `chargedAudCents` | sum of `chargeAmountCents` for those payments |
| `refundedAudCents` | sum of SUCCEEDED `PaymentRefund.chargeAmountCents` belonging to those payments, **whenever the refund happened** |
| `netAudCents` | `chargedAudCents − refundedAudCents` |
| `withoutAudCount` | matching `paid` payments with null `chargeAmountCents` (wallet / points-only, or pre-AUD). Counted, never converted |

> This summary deliberately differs from Analytics' card-charges. There, refunds are counted on the date they happened (cash basis). Here they're tied to the payments listed. Put that sentence in the code comment; the CRM shows it as a note.

## 2. `GET /admin/billing/payments/export.csv`

Same filters as the list, without `page` / `limit`. Newest first, max 10,000 rows (`capRows`), sent with `sendCsv`.

Columns:

```
created_at, payment_id, status, outcome, service, order_no, customer_email, customer_name,
provider, provider_reference, invoice_number, currency, amount, credit_applied, points_applied,
club_discount, promo_code, promo_discount, order_total, charge_currency, charge_amount, fx_rate,
refunded_amount, refunded_charge_amount, refund_count, refund_pending_count, withheld_amount
```

- Money columns use `csvMoney(cents)`.
- `refunded_*` sums SUCCEEDED refunds only.
- Use the service code (`ESIM_ORDER`, …) for `service`. Don't call `describe()` per row in the export.

## 3. `GET /admin/billing/payments/:id` — one payment, for a CRM detail drawer

Returns `{ payment: PaymentRow & { description, metadata }, refunds: RefundRow[], attempts: AttemptRow[] }`. Unknown id returns 404.

- **`description`:** from `getPaymentDescription()` (`services/billing.service.ts`).
- **`metadata`:** pass through only these keys: `refundWithheldCents`, `cardBrand`, `previousStatus`, `source`. Nothing else, in case of sensitive provider data.
- **`refunds`:** this payment's refunds as `RefundRow` (section 4), newest first.
- **`attempts`:** from `PaymentAttempt`, oldest first: `{ id, createdAt, source, providerStatus, providerReference }`. **Never include `raw`.**

---

## 4. `GET /admin/billing/refunds` — refunds report (rows = `PaymentRefund`)

**Query params:**

| Param | Values |
|---|---|
| `page`, `limit` | as Phase 1 |
| `search` | refund id, payment id, `providerRefundReference`, the resolved order no., or customer email / name (customer = `Payment.userId`) |
| `from`, `to` | on `PaymentRefund.createdAt` |
| `status` | `PENDING` \| `SUCCEEDED` \| `FAILED`, comma-separated allowed |
| `service` | `PaymentResourceType`, comma-separated (from the parent payment) |
| `initiatedBy` | `customer` \| `staff` \| `system` (see `initiatedBy` below) |
| `stuck` | `true` = PENDING and older than 24 hours |

**Order:** `createdAt` DESC, `id` DESC.

**Response:** `{ refunds: RefundRow[], pagination, summary }`

`RefundRow` fields:

| Field | Source |
|---|---|
| `id`, `createdAt`, `updatedAt`, `status` | PaymentRefund |
| `stuck` | boolean: PENDING and `createdAt` more than 24h ago |
| `paymentId`, `service`, `orderNo`, `visitId`, `customer` | from the parent payment, resolved as in the conventions |
| `currency`, `totalAmountCents`, `creditPortionCents`, `mintPortionCents` | customer currency |
| `chargeAmountCents`, `chargeCurrency` | the AUD refunded to the card; null when none |
| `providerRefundReference`, `reason` | PaymentRefund |
| `initiatedBy` | `{ kind: 'customer' \| 'staff' \| 'system', userId, email }` |
| `payment` | `{ amountCents, currency, chargeAmountCents, chargeCurrency, withheldCents }` from the parent payment, so the CRM can show "refunded X of Y, kept Z" |

**`initiatedBy.kind`:**
- `system` when `initiatedByUserId` is null.
- `customer` when it equals the payment's `userId`.
- `staff` when it's anyone else.

Check this against how refunds are actually created (customer cancel, admin cancel, supplier cancellation job), and tell me if the mapping is wrong anywhere.

**`summary`** covers all matching refunds, not just the page:

| Field | Meaning |
|---|---|
| `count` | all matching refunds |
| `succeededCount`, `pendingCount`, `failedCount`, `stuckCount` | counts per status, plus stuck |
| `succeededAudCents` | sum of `chargeAmountCents` where SUCCEEDED |
| `pendingAudCents` | sum of `chargeAmountCents` where PENDING |
| `withoutAudCount` | matching refunds with null `chargeAmountCents` |

## 5. `GET /admin/billing/refunds/export.csv`

Same filters, no paging. Newest first, max 10,000 rows.

Columns:

```
created_at, refund_id, status, stuck, service, order_no, payment_id, customer_email, customer_name,
currency, total_amount, credit_portion, card_portion, charge_currency, charge_amount,
payment_amount, payment_charge_amount, withheld_amount, provider_refund_reference, reason,
initiated_by, initiated_by_email
```

---

## Unchanged — don't touch

- The existing `GET /admin/billing/users/:userId/summary` and `/activity`, the customer billing endpoints, and `card-charges`.
- **Refund amounts are what was actually refunded** (`PaymentRefund.chargeAmountCents` / `totalAmountCents`). The $8 flexible booking fee withheld on cancellations (`services/payment/flexibleFee.ts`, `splitRefundWithholding`) appears only as `withheldCents`, never as refunded money.

## Performance

- **Indexes:** check for indexes on `payments.createdAt`, `payments.userId`, `payments(resourceType, resourceId)`, `payment_refunds.createdAt` and `payment_refunds.paymentId`. If any is missing, add a migration following this repo's existing migration convention, and tell the user it must be run on deploy.
- **Summaries:** compute them with SQL aggregates (`SUM`, `COUNT`) over the same `where`, not by loading every row.

## Tests (new file `tests/adminBillingReports.test.ts`)

1. **Query schemas:** valid input parses; each of these gives a 400:
   - a bad `outcome`, `status`, `service` or `initiatedBy` value
   - a reversed range
   - `limit` over 100
2. **Filters reach the database on page 3:** with `Payment.findAndCountAll` / `PaymentRefund.findAndCountAll` mocked, check that search (including order-no and customer matches), `outcome` → status list, `service`, dates, `refunded` and `stuck` are in the `where` clause, and that offset is 40.
3. **Payment summary:**
   - `netAudCents = chargedAudCents − refundedAudCents`
   - only `paid` payments are counted
   - a payment with null `chargeAmountCents` goes to `withoutAudCount` and isn't added
4. **Refund rows:**
   - a cancellation that withheld $8 shows the refunded `chargeAmountCents` as refunded and the $8 only in `payment.withheldCents`
   - `stuck` is true only for PENDING refunds older than 24h
   - `initiatedBy.kind` gives `system`, `customer` and `staff` in the three cases above
5. **Order numbers:** resolved with one query per resource type, not per row (assert the call count). A missing resource gives null.
6. **Detail endpoint:** `attempts` never contains `raw`; `metadata` contains only the allowed keys; an unknown id gives 404.
7. **Exports:**
   - header rows match the columns above exactly
   - the limit is `CSV_EXPORT_MAX_ROWS + 1`
   - no password, token or `raw` fields are selected
8. **Access:** the routes require ADMIN or SUPER_ADMIN; SUPPORT gets 403.
9. Run `npx tsc --noEmit` and `npm test`; all must pass.

## Reply with

- For each endpoint: final path, query params and allowed values, and an example JSON response (one row is enough) including `summary`.
- How lounge payments link to their visit (`resourceId` or `metadata.paymentId`).
- Whether the `initiatedBy` mapping holds for every refund path.
- Any migration added (file name), and whether it must be run on deploy.
- The test count, and anything you couldn't do and why.

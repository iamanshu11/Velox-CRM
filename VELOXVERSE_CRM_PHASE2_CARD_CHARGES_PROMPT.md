# VeloxVerse prompt — Phase 2: date ranges + promo discounts on `card-charges`

**Repo:** `veloxverse` backend, branch `feature/crm-reporting` (on top of the uncommitted Phase 1 work there).
**Endpoint:** `GET /api/v1/admin/analytics/card-charges` (`analyticsService.cardCharges`, `controllers/admin.analytics.controller.ts`).
**Consumer:** Velox CRM → Analytics → "Card money collected (AUD)" panel.

Two additions to this one endpoint. Everything it returns today must keep the same name and meaning; only add.

**Before building:** show the user the plan below (which tables and fields feed each number, and what's excluded) and wait for their OK, as for any money total.

---

## 1. Calendar date ranges (`from` / `to`)

Today the endpoint only takes `period` (`7d`, `30d`, `90d`, `12m`, or none for all time), so the CRM can't show "Last month", "This month" or custom dates.

**Add:** `from` and `to` query params, ISO instants. Same convention as Phase 1:
- `from` is inclusive and `to` is exclusive.
- The CRM sends the admin's local start of the first day, and the local start of the day after the last day.

Rules:
- Parse with `parseQuery` and a zod schema in `validations/`. Use `reportListShape.from` / `.to` and `withDateRange`, so `from >= to` returns 400.
- `period` must be one of `7d | 30d | 90d | 12m` when sent. Anything else returns 400; today an unknown value silently becomes 30 days.
- Sending `period` together with `from` or `to` returns 400.
- With neither, the window is all time, as now.
- Use `createdBetween(range)` from `helpers/adminListFilters.ts` for the window.
- **Which date each figure is counted on (unchanged, cash basis):**
  - Charges are counted by `Payment.createdAt`.
  - Refunds are counted by `PaymentRefund.createdAt`.
  - A refund issued in October for a September charge therefore counts in October.
  - Keep this, and state it in the code comment.

**Add to the response:** `range: { from: string | null, to: string | null }`, the effective window as ISO strings.
- For `period`, `from` is now minus N days and `to` is null.
- For all time, both are null.
- The CRM uses this field to detect that the deployed VeloxVerse supports ranges. If it's missing, the CRM warns that the figures are all-time, so always send it.

## 2. Promo discounts given, in AUD

`Payment.promoDiscountCents` is the discount a promo code took off the order, in the **customer's currency** (`Payment.currency`). `promoCode` is the code. The endpoint doesn't total it today.

**Add** these fields, both at the top level (all services) and on each `byService[]` row:

| Field | Type | Meaning |
|---|---|---|
| `promoDiscount` | number, AUD, 2 dp | Sum of promo discounts, converted to AUD at **that payment's own charge rate** |
| `promoOrderCount` | integer | Payments in the window with `promoDiscountCents > 0` that went into `promoDiscount` |

**Add at the top level only:** `promoWithoutAud`, an integer count of promo payments that couldn't be converted (see below).

How each number is built:
- **Which payments count:** status in `PAYMENT_BILLABLE_STATUSES`, `promoDiscountCents > 0`, created in the window.
  - Include payments with `amountCents = 0` (a 100%-off promo).
  - The existing charged query filters `amountCents > 0`, so this needs **its own query**. Don't change the charged query.
- **AUD per payment:**
  - `round(promoDiscountCents × chargeAmountCents / amountCents)`, using the FX rate frozen on the payment (MC-1). Never use today's rate.
  - When `chargeAmountCents` is null or `amountCents` is 0, there's no rate. Don't convert, don't estimate; add 1 to `promoWithoutAud`.
- **Already AUD:** if `currency` is already `AUD`, use `promoDiscountCents` as it is.
- **Grouping:** by `Payment.resourceType`, the same as the charged buckets. A service that only has promo payments and no charged payment still gets a `byService` row, with zeros for the charge fields.
- **Sort order:** stays by `charged` descending.

## Response after the change (example)

```json
{
  "cardCharges": {
    "currency": "AUD",
    "period": "range",
    "range": { "from": "2026-09-30T14:00:00.000Z", "to": "2026-10-31T13:00:00.000Z" },
    "charged": 12450.5,
    "refunded": 820,
    "net": 11630.5,
    "paymentCount": 311,
    "refundCount": 12,
    "promoDiscount": 640.25,
    "promoOrderCount": 58,
    "byService": [
      { "service": "ESIM", "charged": 6200, "refunded": 120, "net": 6080, "paymentCount": 190, "refundCount": 3, "promoDiscount": 410, "promoOrderCount": 40 },
      { "service": "LOUNGE", "charged": 4100.5, "refunded": 700, "net": 3400.5, "paymentCount": 96, "refundCount": 9, "promoDiscount": 230.25, "promoOrderCount": 18 }
    ],
    "paymentsWithoutAud": 0,
    "refundsWithoutAud": 0,
    "promoWithoutAud": 0
  }
}
```

`period` values:
- unchanged for `period` requests (`"30d"` etc.)
- `"all"` when no filter is sent
- `"range"` when `from` or `to` is sent

## Unchanged — don't touch

- **Refunds:**
  - Keep `PaymentRefund.status = SUCCEEDED` with `mintPortionCents > 0`.
  - Keep summing `PaymentRefund.chargeAmountCents`, the AUD actually refunded.
  - The withheld $8 flexible booking fee (`services/payment/flexibleFee.ts`, `splitRefundWithholding`) is therefore never counted as refunded. Keep it that way.
- **Wallet / points-only orders:** they have no `chargeAmountCents` and stay out of `charged`, as now (`paymentsWithoutAud`). No FX estimate.
- **Who can call it:** admin / super admin only. The CRM support role must not reach it; the CRM proxy already blocks it.

## Tests (`tests/adminReports.test.ts` or a new `tests/cardChargesRange.test.ts`)

1. **Totals:**
   - `charged` equals the sum of the mocked payments' `chargeAmountCents` / 100.
   - `net` equals `charged − refunded`.
   - The top-level totals equal the sum of the `byService` rows, for each field.
2. **Dates:**
   - `from` / `to` reach both queries as `>= from` and `< to`.
   - `from >= to` returns 400.
   - `period` with `from` returns 400.
   - An unknown `period` returns 400.
   - `range` is echoed back in the response.
3. **Promo:**
   - INR 1000.00 discount, `amountCents` 50000 INR, `chargeAmountCents` 900 AUD → `promoDiscount` 18.00. That's 100000 × 900 / 50000 = 1800 cents.
   - An AUD payment is used as it is.
   - A null `chargeAmountCents` or 0 `amountCents` counts in `promoWithoutAud` and isn't added.
   - A 100%-off payment (`amountCents` 0) is still found by the promo query.
4. **Refunds:** a refund with the $8 fee withheld counts only its refunded `chargeAmountCents`.
5. Run `npx tsc --noEmit` and `npm test`; all must pass.

## Reply with

- The final query params and response, if anything differs from the above.
- The test count.
- Anything you couldn't do, and why.

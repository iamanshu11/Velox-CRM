# Velox CRM eSIM Flow -- Extended Requirements

## Business Rules

### Payment Handling

-   eSIM provider does NOT receive customer payment details.
-   Provider deducts cost from agent wallet.
-   Provider only knows eSIM identifiers (orderNo / esimTranNo / ICCID).

### Refund Rules

-   Refund allowed ONLY before activation.
-   If activateTime exists or plan activated -\> no refund.

### Top-up Rules

-   Top-up is a separate order.
-   Must be linked to original purchased plan.

Example: Original Plan -\> booking_id = 100 Top-up -\> parent_booking_id
= 100

## Customer Portal

Customer sees: - Activation QR code - Activation code - Activation
steps - Plan details - Status - Expiry date

## Frontend Flow

Select Plan -\> Enter Name / Email / Phone -\> Purchase -\> Show QR +
Activation -\> View History -\> Top-up -\> Refund request (if not
activated)

## Backend Flow

Fetch Packages -\> Create Order -\> Query Profile -\> Save booking -\>
Save esim_subscription -\> Return QR

## Tables

bookings - customer_name - customer_email - customer_phone -
parent_booking_id (for topups) - status

esim_subscriptions - order_no - esim_tran_no - iccid - activation_code -
qr_code_url - activate_time - esim_status - refund_eligible

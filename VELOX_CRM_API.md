# Velox eSIM — CRM API Documentation

> **Base URL:** `http://localhost:5000` (Velox eSIM platform) / your production domain  
> **Velox-CRM API:** `http://localhost:5001` (this repo — proxies eSIM data at `/api/velox-esim/*` for super_admin/admin only)
> **Authentication:** API Key via `x-api-key` header — no user login required.

---

## Authentication

All CRM API calls are secured with a **shared API key**.  
Your CRM backend must send the key in every request header:

```
x-api-key: <your_CRM_API_KEY>
```

> The API key is configured on the Velox backend in `.env` under `CRM_API_KEY`.  
> Ask the Velox team for the key value — **never expose it in the browser or frontend code.**  
> Always call these endpoints from your **CRM backend (port 5001)**, not directly from the CRM frontend.

---

## Quick Test — Are You Connected?

Run this `curl` command from your terminal to confirm you can reach Velox and the key works:

```bash
curl -X GET http://localhost:5000/api/crm/customers \
  -H "x-api-key: velox-crm-secret-change-this-to-something-random"
```

**✅ Success response:**
```json
{
  "success": true,
  "message": "CRM customers retrieved",
  "data": {
    "customers": [...],
    "pagination": { "total": 5, "page": 1, "limit": 50, "pages": 1 }
  }
}
```

**❌ Wrong or missing key:**
```json
{
  "success": false,
  "message": "Invalid or missing API key. Send your key in the x-api-key header."
}
```

---

## Endpoints

---

### 1. Get All Customers

Returns a paginated list of all customers with their **name, email, phone, and full eSIM purchase history**.

```
GET /api/crm/customers
x-api-key: <your_key>
```

#### Query Parameters

| Parameter | Type   | Default | Description                           |
|-----------|--------|---------|---------------------------------------|
| `page`    | number | `1`     | Page number                           |
| `limit`   | number | `50`    | Records per page (max 100)            |
| `search`  | string | —       | Search by name, email, or phone       |

#### Example Requests

```bash
# All customers
curl http://localhost:5000/api/crm/customers \
  -H "x-api-key: YOUR_KEY"

# With pagination
curl "http://localhost:5000/api/crm/customers?page=2&limit=20" \
  -H "x-api-key: YOUR_KEY"

# Search by name or email
curl "http://localhost:5000/api/crm/customers?search=john" \
  -H "x-api-key: YOUR_KEY"

# Search by phone number
curl "http://localhost:5000/api/crm/customers?search=%2B91987" \
  -H "x-api-key: YOUR_KEY"
```

#### Example in Node.js (CRM Backend)

```js
const axios = require('axios');

const response = await axios.get('http://localhost:5000/api/crm/customers', {
  headers: {
    'x-api-key': process.env.VELOX_API_KEY
  },
  params: {
    page: 1,
    limit: 50,
    search: ''  // optional
  }
});

const { customers, pagination } = response.data.data;
console.log(`Total customers: ${pagination.total}`);
```

#### Full Response

```json
{
  "success": true,
  "message": "CRM customers retrieved",
  "data": {
    "customers": [
      {
        "id": "clx1a2b3c4d",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+91 9876543210",
        "country": "India",
        "isActive": true,
        "registeredAt": "2025-01-10T08:00:00.000Z",
        "totalOrders": 2,
        "totalSpent": 45.00,
        "lastPurchaseAt": "2025-05-01T10:30:00.000Z",
        "purchases": [
          {
            "orderId": "clx9z8y7x6",
            "orderNo": "ORD-1746789012-abc123",
            "planCode": "JP_5GB_30D",
            "planName": "Japan 5GB 30 Days",
            "planType": "country_specific",
            "countryCode": "JP",
            "region": null,
            "amountPaid": 15.00,
            "currency": "USD",
            "status": "active",
            "purchasedAt": "2025-05-01T10:30:00.000Z"
          },
          {
            "orderId": "clx8w7v6u5",
            "orderNo": "ORD-1746500000-xyz456",
            "planCode": "ASIA_10GB_30D",
            "planName": "Asia Regional 10GB 30 Days",
            "planType": "regional",
            "countryCode": null,
            "region": "Asia",
            "amountPaid": 30.00,
            "currency": "USD",
            "status": "active",
            "purchasedAt": "2025-04-01T09:00:00.000Z"
          }
        ]
      }
    ],
    "pagination": {
      "total": 120,
      "page": 1,
      "limit": 50,
      "pages": 3
    }
  }
}
```

---

### 2. Get Single Customer

Returns the full CRM profile for one specific customer.

```
GET /api/crm/customers/:id
x-api-key: <your_key>
```

#### URL Parameter

| Parameter | Description                                      |
|-----------|--------------------------------------------------|
| `id`      | The customer `id` from the customer list response |

#### Example Requests

```bash
# curl
curl http://localhost:5000/api/crm/customers/clx1a2b3c4d \
  -H "x-api-key: YOUR_KEY"
```

```js
// Node.js
const response = await axios.get(
  `http://localhost:5000/api/crm/customers/${customerId}`,
  { headers: { 'x-api-key': process.env.VELOX_API_KEY } }
);
const { customer } = response.data.data;
```

#### Full Response

```json
{
  "success": true,
  "message": "CRM customer retrieved",
  "data": {
    "customer": {
      "id": "clx1a2b3c4d",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+91 9876543210",
      "country": "India",
      "countryCode": "IN",
      "isActive": true,
      "registeredAt": "2025-01-10T08:00:00.000Z",
      "totalOrders": 2,
      "totalSpent": 45.00,
      "lastPurchaseAt": "2025-05-01T10:30:00.000Z",
      "purchases": [
        {
          "orderId": "clx9z8y7x6",
          "orderNo": "ORD-1746789012-abc123",
          "planCode": "JP_5GB_30D",
          "planName": "Japan 5GB 30 Days",
          "planType": "country_specific",
          "countryCode": "JP",
          "region": null,
          "amountPaid": 15.00,
          "currency": "USD",
          "status": "active",
          "purchasedAt": "2025-05-01T10:30:00.000Z"
        }
      ]
    }
  }
}
```

---

## Field Reference

### Customer Object

| Field             | Type             | Description                                                    |
|-------------------|------------------|----------------------------------------------------------------|
| `id`              | string           | Unique customer ID — use this for `GET /customers/:id`        |
| `name`            | string           | Customer's full name                                           |
| `email`           | string           | Customer's email address                                       |
| `phone`           | string \| null   | Phone number — `null` if customer didn't provide one          |
| `country`         | string \| null   | Country name based on signup location                          |
| `countryCode`     | string \| null   | ISO country code e.g. `"IN"`, `"US"` *(single endpoint only)* |
| `isActive`        | boolean          | `true` = active account, `false` = deactivated                |
| `registeredAt`    | ISO 8601 string  | When the customer created their account                        |
| `totalOrders`     | number           | Total number of paid eSIM purchases                            |
| `totalSpent`      | number           | Total amount spent (USD)                                       |
| `lastPurchaseAt`  | ISO 8601 \| null | Date of most recent purchase, `null` if never purchased        |
| `purchases`       | array            | All eSIM purchases — see Purchase Object below                 |

### Purchase Object

| Field          | Type             | Description                                                              |
|----------------|------------------|--------------------------------------------------------------------------|
| `orderId`      | string           | Internal Velox order ID                                                  |
| `orderNo`      | string           | Human-readable order number e.g. `"ORD-1746789012-abc123"`              |
| `planCode`     | string \| null   | Plan code from eSIM provider e.g. `"JP_5GB_30D"`                        |
| `planName`     | string           | Human-readable plan name e.g. `"Japan 5GB 30 Days"`                     |
| `planType`     | string           | `"country_specific"` or `"regional"` — see Plan Type section below      |
| `countryCode`  | string \| null   | Country code e.g. `"JP"` — only set when `planType = country_specific`  |
| `region`       | string \| null   | Region name e.g. `"Asia"` — only set when `planType = regional`         |
| `amountPaid`   | number           | Amount paid in USD                                                       |
| `currency`     | string           | Currency code e.g. `"USD"`                                              |
| `status`       | string           | `"active"`, `"completed"`, or `"processing"`                            |
| `purchasedAt`  | ISO 8601 string  | When the purchase was made                                               |

---

## Plan Type Explained

| `planType`           | What it means                              | Fields to read              | Example plans                          |
|----------------------|--------------------------------------------|-----------------------------|----------------------------------------|
| `country_specific`   | Works in one specific country only         | `countryCode` e.g. `"JP"`  | Japan 5GB, India 3GB, USA Unlimited    |
| `regional`           | Works across multiple countries            | `region` e.g. `"Asia"`     | All Asian, Europe Multi-Country, Global|

```js
// Example: categorise purchases in your CRM
purchases.forEach(p => {
  if (p.planType === 'country_specific') {
    console.log(`Country plan → ${p.countryCode}`);  // e.g. "JP"
  } else {
    console.log(`Regional plan → ${p.region}`);       // e.g. "Asia"
  }
});
```

---

## Phone Number Availability

Phone is captured when a customer registers or updates their profile on Velox.  
If `phone` is `null`, the customer signed up before phone was added or did not provide it.

Customers can add/update their phone via:
```
PUT /api/auth/profile
Cookie: accessToken=<user_token>
Body: { "phone": "+91 9876543210" }
```

---

## Error Reference

| HTTP Code | Message                                                    | Fix                                           |
|-----------|------------------------------------------------------------|-----------------------------------------------|
| `401`     | Invalid or missing API key                                 | Check `x-api-key` header value                |
| `404`     | Customer not found                                         | Check the customer `id` is correct            |
| `500`     | CRM_API_KEY is not configured on the server                | Velox team needs to set `CRM_API_KEY` in .env |
| `500`     | Internal server error                                      | Check Velox backend logs                      |

---

## CRM Backend Setup (.env)

Add these two lines to your CRM backend `.env`:

```bash
VELOX_API_URL=http://localhost:5000
VELOX_API_KEY=velox-crm-secret-change-this-to-something-random
```

> Replace the key value with the exact string the Velox team shares with you.

---

## Testing Checklist

Use this to confirm everything is working end-to-end:

- [ ] **Step 1** — Velox backend is running on `http://localhost:5000`
- [ ] **Step 2** — Run the quick test `curl` command and confirm `"success": true`
- [ ] **Step 3** — Call `GET /api/crm/customers` and confirm `customers` array is returned
- [ ] **Step 4** — Pick any customer `id` from the list and call `GET /api/crm/customers/:id`
- [ ] **Step 5** — Confirm `name`, `email`, `phone` fields are present on each customer
- [ ] **Step 6** — Confirm each purchase has `planType` = `"country_specific"` or `"regional"`
- [ ] **Step 7** — Test search: `GET /api/crm/customers?search=<email>` returns the correct customer
- [ ] **Step 8** — Test wrong key: send `x-api-key: wrongkey` and confirm `401` is returned

---

## Summary

| What you need         | How to get it                                      |
|-----------------------|----------------------------------------------------|
| All customers + plans | `GET /api/crm/customers`                          |
| One customer detail   | `GET /api/crm/customers/:id`                      |
| Search a customer     | `GET /api/crm/customers?search=<name/email/phone>`|
| Authenticate          | Header: `x-api-key: <key from Velox team>`        |
| Phone is missing      | Customer hasn't added it yet on Velox             |

---

*Velox eSIM Platform · CRM Integration Docs · v1.0*

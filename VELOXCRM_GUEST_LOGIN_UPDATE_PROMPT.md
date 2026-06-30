# Velox-CRM — Guest Login Display Update Prompt

## Context

VeloxVerse is adding a **Guest Login** feature (see `veloxverse/VELOXVERSE_GUEST_LOGIN_PROMPT.md`). Guest users have:

- Role: `GUEST` (new enum value in VeloxVerse's `users` table)
- `firstName` / `lastName`: **NULL** (guests don't provide names)
- `fullName`: returns `'Guest User'` from backend when names are null
- `guestExpiresAt`: TIMESTAMPTZ, 30-day expiry window
- `isVerified`: `false` (OTP proves session access, not permanent email ownership)
- `password`: NULL (passwordless login via OTP)

The CRM already proxies to VeloxVerse admin APIs via the bridge middleware. **No backend, bridge, or proxy changes are needed** — GUEST users don't authenticate through the CRM, and the bridge only maps `admin`/`super_admin` roles. All changes below are **frontend display-only** so the CRM's VeloxVerse Users admin pages correctly render guest accounts.

---

## Changes Required (3 files)

### 1. Update Types

**File: `frontend/src/features/veloxverse-admin/types.ts`**

Add `GUEST` to the role union and make name fields nullable to match the VeloxVerse backend response:

```diff
-export type VVUserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER'
+export type VVUserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER' | 'GUEST'

 export interface VVAdminUser {
   id: string
-  firstName: string
-  lastName: string
-  fullName: string
+  firstName: string | null
+  lastName: string | null
+  fullName: string | null
   email: string
   role: VVUserRole
   isActive: boolean
   isVerified: boolean
   createdAt: string
+  guestExpiresAt?: string | null
 }
```

### 2. Update Users List Page

**File: `frontend/src/features/veloxverse-admin/pages/VVUsersListPage.tsx`**

**Name column** — fallback to email when `fullName` is null (guests have no name):

```diff
       render: (row: VVAdminUser) => (
         <Link
           to={`/dashboard/veloxverse/users/${row.id}`}
           className="font-medium text-gray-900 hover:text-indigo-600"
         >
-          {row.fullName}
+          {row.fullName || row.email}
         </Link>
       ),
```

**Role column** — show a colored badge for GUEST so admins can spot guest accounts:

```diff
       render: (row: VVAdminUser) => (
-        <span className="text-gray-500">{row.role}</span>
+        <Badge variant={row.role === 'GUEST' ? 'warning' : 'neutral'}>
+          {row.role}
+        </Badge>
       ),
```

### 3. Update User Detail Page

**File: `frontend/src/features/veloxverse-admin/pages/VVUserDetailPage.tsx`**

**Name display** — fallback for null `fullName`:

```diff
                 <h1 className="text-xl font-bold text-gray-900">
-                  {data.user.fullName}
+                  {data.user.fullName || 'Guest User'}
                 </h1>
```

**Roles dropdown** — add GUEST so it appears in the role selector:

```diff
-const ROLES: VVUserRole[] = ['USER', 'ADMIN', 'SUPER_ADMIN']
+const ROLES: VVUserRole[] = ['GUEST', 'USER', 'ADMIN', 'SUPER_ADMIN']
```

**Guest expiry** — show expiry date in the profile card (add after the "Joined" line):

```tsx
{data.user.role === 'GUEST' && data.user.guestExpiresAt && (
  <p className="mt-1 text-xs text-amber-600">
    Guest expires {formatDate(data.user.guestExpiresAt)}
  </p>
)}
```

---

## File Change Summary

| Action | File | Description |
|--------|------|-------------|
| MODIFY | `frontend/src/features/veloxverse-admin/types.ts` | Add `GUEST` to VVUserRole, make names nullable, add `guestExpiresAt` |
| MODIFY | `frontend/src/features/veloxverse-admin/pages/VVUsersListPage.tsx` | Fallback for null names, GUEST role badge |
| MODIFY | `frontend/src/features/veloxverse-admin/pages/VVUserDetailPage.tsx` | Fallback for null names, GUEST in roles dropdown, show expiry |

**Total: 3 files, all display-only. No backend or bridge changes.**

---

## Implementation Order

1. Implement VeloxVerse guest login first (see `veloxverse/VELOXVERSE_GUEST_LOGIN_PROMPT.md`)
2. Update `types.ts` — add GUEST role, nullable names, guestExpiresAt field
3. Update `VVUsersListPage.tsx` — null name fallback, GUEST badge
4. Update `VVUserDetailPage.tsx` — null name fallback, GUEST in dropdown, expiry display
5. **Test**: Create a guest account in VeloxVerse → open CRM → go to VeloxVerse Users → verify guest shows with email instead of blank name → click into detail → verify expiry date shows

---

## What NOT to Change

- **Do NOT modify** the CRM bridge middleware (`crmBridge.middleware.ts`) — GUEST role is irrelevant to the bridge
- **Do NOT modify** the CRM proxy (`veloxverseProxy.js`) — it forwards requests as-is
- **Do NOT modify** the CRM backend or database — the CRM has no guest concept in its own auth
- **Do NOT modify** Docker Compose or `.env` files — no new config needed

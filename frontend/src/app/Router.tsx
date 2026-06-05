import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/routes/ProtectedRoute'
import RoleGuard from '@/routes/RoleGuard'
import VerificationGate from '@/routes/VerificationGate'
import AppLayout from '@/components/layout/AppLayout'
import AuthLayout from '@/components/layout/AuthLayout'
import LoginPage from '@/features/auth/pages/LoginPage'
import SuperAdminDashboard from '@/features/dashboard/super-admin/SuperAdminDashboard'
import EmployeeDashboard from '@/features/dashboard/employee/EmployeeDashboard'
import EmployeesPage from '@/features/employees/pages/EmployeesPage'
import SettingsPage from '@/features/settings/pages/SettingsPage'
import CustomersPage from '@/features/customers/pages/CustomersPage'
import ApprovalsPage from '@/features/approvals/pages/ApprovalsPage'
import VerificationDashboardPage from '@/features/verification/pages/VerificationDashboardPage'
import VerificationReviewPage from '@/features/verification/pages/VerificationReviewPage'
import DashboardRedirect from './DashboardRedirect'

const router = createBrowserRouter([
  // ── Public ──────────────────────────────────────────────────────
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },

  // ── Authenticated ────────────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            // Confines unverified employees/agents/affiliates to the
            // Verification Dashboard until their account is activated.
            element: <VerificationGate />,
            children: [
          // Smart role-based redirect
          { path: '/dashboard', element: <DashboardRedirect /> },

          // Super Admin routes
          {
            element: <RoleGuard allowedRoles={['super_admin', 'admin']} />,
            children: [
              { path: '/dashboard/admin', element: <SuperAdminDashboard /> },
              { path: '/dashboard/settings', element: <SettingsPage /> },
              { path: '/dashboard/verification-review', element: <VerificationReviewPage /> },
            ],
          },

          // Backward-compat redirect: /dashboard/velox-esim → /dashboard/customers
          { path: '/dashboard/velox-esim', element: <Navigate to="/dashboard/customers" replace /> },

          // User management route for creator roles
          {
            element: <RoleGuard allowedRoles={['super_admin', 'admin', 'employee']} />,
            children: [{ path: '/dashboard/employees', element: <EmployeesPage /> }],
          },

          {
            element: <RoleGuard allowedRoles={['super_admin', 'admin', 'employee', 'agent', 'affiliate']} />,
            children: [
              { path: '/dashboard/customers', element: <CustomersPage /> },
              { path: '/dashboard/approvals', element: <ApprovalsPage /> },
            ],
          },

          // Verification dashboard for users who must complete KYC.
          {
            element: <RoleGuard allowedRoles={['employee', 'agent', 'affiliate']} />,
            children: [
              { path: '/dashboard/verification', element: <VerificationDashboardPage /> },
              { path: '/dashboard/me', element: <EmployeeDashboard /> },
            ],
          },
            ],
          },

          // ──────────────────────────────────────────────────────────
          // FUTURE ROLES — add here, zero structural changes needed
          // {
          //   element: <RoleGuard allowedRoles={['affiliate']} />,
          //   children: [{ path: '/dashboard/affiliate', element: <AffiliateDashboard /> }],
          // },
          // ──────────────────────────────────────────────────────────
        ],
      },
    ],
  },

  // ── Catch-all ────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/login" replace /> },
])

export default function Router() {
  return <RouterProvider router={router} />
}

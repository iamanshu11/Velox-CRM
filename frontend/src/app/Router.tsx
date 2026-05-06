import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/routes/ProtectedRoute'
import RoleGuard from '@/routes/RoleGuard'
import AppLayout from '@/components/layout/AppLayout'
import AuthLayout from '@/components/layout/AuthLayout'
import LoginPage from '@/features/auth/pages/LoginPage'
import SuperAdminDashboard from '@/features/dashboard/super-admin/SuperAdminDashboard'
import EmployeeDashboard from '@/features/dashboard/employee/EmployeeDashboard'
import EmployeesPage from '@/features/employees/pages/EmployeesPage'
import SettingsPage from '@/features/settings/pages/SettingsPage'
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
          // Smart role-based redirect
          { path: '/dashboard', element: <DashboardRedirect /> },

          // Super Admin routes
          {
            element: <RoleGuard allowedRoles={['super_admin']} />,
            children: [
              { path: '/dashboard/admin', element: <SuperAdminDashboard /> },
              { path: '/dashboard/employees', element: <EmployeesPage /> },
              { path: '/dashboard/settings', element: <SettingsPage /> },
            ],
          },

          // Employee routes
          {
            element: <RoleGuard allowedRoles={['employee']} />,
            children: [{ path: '/dashboard/me', element: <EmployeeDashboard /> }],
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

import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import PageLoader from '@/components/PageLoader'
import RequireRole from '@/components/RequireRole'

// Every panel is its own chunk: a customer scanning a QR code only downloads the
// customer code, and staff only download the panel they actually open.
const CustomerRoutes = lazy(() => import('./panels/customer/CustomerRoutes'))
const StaffLayout = lazy(() => import('./StaffLayout'))
const RoleSelect = lazy(() => import('./pages/RoleSelect'))
const Login = lazy(() => import('./pages/Login'))
const ChefPanel = lazy(() => import('./panels/chef/ChefPanel'))
const ReceptionPanel = lazy(() => import('./panels/reception/ReceptionPanel'))
const AdminPanel = lazy(() => import('./panels/admin/AdminPanel'))

export default function App() {
  return (
    // reducedMotion="user": framer-motion honours the OS "reduce motion" setting
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Customers: no login, straight from the table QR code */}
          <Route path="/r/*" element={<CustomerRoutes />} />

          {/* Staff: everything below shares one Firebase auth session */}
          <Route element={<StaffLayout />}>
            <Route path="/" element={<RoleSelect />} />
            <Route path="/login/:role" element={<Login />} />
            <Route path="/chef" element={<RequireRole panel="chef"><ChefPanel /></RequireRole>} />
            <Route path="/reception" element={<RequireRole panel="reception"><ReceptionPanel /></RequireRole>} />
            <Route path="/admin/*" element={<RequireRole panel="admin"><AdminPanel /></RequireRole>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </MotionConfig>
  )
}

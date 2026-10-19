import { Routes, Route, useLocation } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import MenuPage from './pages/MenuPage'
import TableVerify from './pages/TableVerify'
import CartPage from './pages/CartPage'
import OrderConfirmed from './pages/OrderConfirmed'
import Notice from '@/components/Notice'
import PageTransition from '@/components/PageTransition'

/**
 * Customer app — mounted at /r/*. No login: the table QR code opens
 * /r/<restaurantId>/table/<tableNumber> directly.
 */
export default function CustomerRoutes() {
  const location = useLocation()
  return (
    <CartProvider>
      <div className="theme-customer">
        <PageTransition key={location.pathname}>
        <Routes>
          <Route path=":restaurantId/table/:tableId" element={<TableVerify />} />
          <Route path=":restaurantId/table/:tableId/menu" element={<MenuPage />} />
          <Route path=":restaurantId/table/:tableId/cart" element={<CartPage />} />
          <Route path=":restaurantId/table/:tableId/confirmed" element={<OrderConfirmed />} />
          <Route
            path="*"
            element={
              <Notice
                icon="📱"
                title="Scan your table's QR code"
                body="Open the camera on your phone and scan the QR code placed on your table to see the menu."
              />
            }
          />
        </Routes>
        </PageTransition>
      </div>
    </CartProvider>
  )
}

import { Routes, Route } from 'react-router-dom'
import MenuPage from './pages/MenuPage'
import TableVerify from './pages/TableVerify'
import CartPage from './pages/CartPage'
import OrderConfirmed from './pages/OrderConfirmed'
import { CartProvider } from './context/CartContext'

function App() {
  return (
    <CartProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
        <Routes>
          <Route path="/:restaurantId/table/:tableId" element={<TableVerify />} />
          <Route path="/:restaurantId/table/:tableId/menu" element={<MenuPage />} />
          <Route path="/:restaurantId/table/:tableId/cart" element={<CartPage />} />
          <Route path="/:restaurantId/table/:tableId/confirmed" element={<OrderConfirmed />} />
          <Route path="/" element={<MenuPage />} />
        </Routes>
      </div>
    </CartProvider>
  )
}

export default App

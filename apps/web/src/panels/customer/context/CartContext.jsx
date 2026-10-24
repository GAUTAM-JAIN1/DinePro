import { createContext, useContext, useState } from 'react'
import { lineTotal, sumRupees } from '../../../lib/money'

const CartContext = createContext()

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([])

  const getCartKey = (item) => item.cartKey || `${item.id}:${item.variant || 'base'}`

  // Add item to cart
  const addToCart = (item) => {
    setCartItems(prev => {
      const cartKey = getCartKey(item)
      const existing = prev.find(i => getCartKey(i) === cartKey)
      if (existing) {
        return prev.map(i =>
          getCartKey(i) === cartKey ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { ...item, cartKey, quantity: 1 }]
    })
  }

  const updateItemInstructions = (cartKey, specialInstructions) => {
    setCartItems(prev =>
      prev.map(item =>
        getCartKey(item) === cartKey ? { ...item, specialInstructions } : item
      )
    )
  }

  // Remove one quantity
  const removeFromCart = (cartKey) => {
    setCartItems(prev => {
      const existing = prev.find(i => getCartKey(i) === cartKey)
      if (!existing) return prev
      if (existing.quantity === 1) {
        return prev.filter(i => getCartKey(i) !== cartKey)
      }
      return prev.map(i =>
        getCartKey(i) === cartKey ? { ...i, quantity: i.quantity - 1 } : i
      )
    })
  }

  // Clear entire cart
  const clearCart = () => setCartItems([])

  // Total amount
  // Bug #28: summed in paise, so the cart total never shows float noise.
  const totalAmount = sumRupees(cartItems.map(lineTotal))

  // Total items count
  const totalItems = cartItems.reduce(
    (sum, item) => sum + item.quantity, 0
  )

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateItemInstructions,
      clearCart,
      totalAmount,
      totalItems
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}

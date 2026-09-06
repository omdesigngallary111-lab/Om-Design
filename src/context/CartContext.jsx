import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from './AuthContext.jsx'
import {
  addToCart as addToCartRequest,
  fetchCartCount,
  isInCart as isInCartRequest,
  removeFromCart as removeFromCartRequest,
} from '../lib/cart.js'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user, session } = useAuth()
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const refreshCount = useCallback(async () => {
    if (!user?.id) {
      setCount(0)
      return 0
    }
    const { count: next } = await fetchCartCount(user.id)
    setCount(next)
    return next
  }, [user?.id])

  useEffect(() => {
    let active = true
    if (!user?.id) {
      setCount(0)
      return undefined
    }
    setLoading(true)
    fetchCartCount(user.id).then(({ count: next }) => {
      if (!active) return
      setCount(next)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id])

  const addItem = useCallback(
    async (designId) => {
      if (!user?.id) return { error: 'Please sign in to add designs to your cart.' }
      const { error } = await addToCartRequest(user.id, designId)
      if (!error) await refreshCount()
      return { error }
    },
    [user?.id, refreshCount],
  )

  const removeItem = useCallback(
    async (designId) => {
      if (!user?.id) return { error: 'Please sign in.' }
      const { error } = await removeFromCartRequest(user.id, designId)
      if (!error) await refreshCount()
      return { error }
    },
    [user?.id, refreshCount],
  )

  const checkInCart = useCallback(
    async (designId) => {
      if (!user?.id) return { inCart: false, error: null }
      return isInCartRequest(user.id, designId)
    },
    [user?.id],
  )

  const value = useMemo(
    () => ({
      count,
      loading,
      session,
      refreshCount,
      addItem,
      removeItem,
      checkInCart,
    }),
    [count, loading, session, refreshCount, addItem, removeItem, checkInCart],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

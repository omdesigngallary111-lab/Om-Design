import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

/**
 * Auth-gated add-to-cart control.
 * variant="full" — product detail; variant="icon" — compact for cards if needed later.
 */
export default function AddToCartButton({
  designId,
  redirectPath,
  variant = 'full',
  className = '',
}) {
  const { session } = useAuth()
  const { addItem, removeItem, checkInCart } = useCart()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [inCart, setInCart] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    if (!session) {
      setInCart(false)
      return undefined
    }
    checkInCart(designId).then(({ inCart: next }) => {
      if (active) setInCart(next)
    })
    return () => {
      active = false
    }
  }, [session, designId, checkInCart])

  const handleClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!session) {
      navigate('/login', { state: { from: redirectPath } })
      return
    }

    setBusy(true)
    if (inCart) {
      const { error } = await removeItem(designId)
      setBusy(false)
      if (error) {
        showToast(error, { type: 'error' })
        return
      }
      setInCart(false)
      showToast('Removed from cart.', { type: 'success', duration: 2500 })
      return
    }

    const { error } = await addItem(designId)
    setBusy(false)
    if (error) {
      showToast(error, { type: 'error' })
      return
    }
    setInCart(true)
    showToast('Added to cart.', { type: 'success', duration: 2500 })
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-pressed={inCart}
        aria-label={inCart ? 'Remove from cart' : 'Add to cart'}
        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-card
                    transition-colors disabled:opacity-60 ${
                      inCart
                        ? 'bg-maroon text-ivory'
                        : 'bg-white/90 text-maroon hover:bg-white'
                    } ${className}`}
      >
        <CartGlyph filled={inCart} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`btn-outline disabled:opacity-60 ${className}`}
    >
      {busy ? 'Please wait…' : inCart ? 'Remove from cart' : 'Add to cart'}
    </button>
  )
}

function CartGlyph({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden>
      <path
        d="M6 6h15l-1.5 9h-12z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M6 6 5 3H2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="9" cy="20" r="1.25" fill="currentColor" />
      <circle cx="18" cy="20" r="1.25" fill="currentColor" />
    </svg>
  )
}

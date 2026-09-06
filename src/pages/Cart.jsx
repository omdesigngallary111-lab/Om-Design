import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Seo from '../components/Seo.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { fetchCartDesigns } from '../lib/cart.js'
import { callEdgeFunction, loadRazorpayCheckoutScript } from '../lib/razorpay.js'

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export default function Cart() {
  const navigate = useNavigate()
  const { user, profile, session, configured, refreshProfile } = useAuth()
  const { removeItem, refreshCount } = useCart()
  const { showToast } = useToast()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState(null)

  const [couponInput, setCouponInput] = useState('')
  const [appliedCode, setAppliedCode] = useState(null)
  const [offerPreview, setOfferPreview] = useState(null)
  const [offerLoading, setOfferLoading] = useState(false)
  const [offerMessage, setOfferMessage] = useState('')

  const [buying, setBuying] = useState(false)
  const [walletBuying, setWalletBuying] = useState(false)
  const [downloads, setDownloads] = useState(null)

  const loadCart = useCallback(async () => {
    if (!user?.id) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { items: rows, error: err } = await fetchCartDesigns(user.id)
    setItems(rows)
    setError(err ?? '')
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    loadCart()
  }, [loadCart])

  const subtotal = useMemo(
    () =>
      items.reduce((sum, row) => {
        const price = Number(row.design?.price || 0)
        return sum + (Number.isFinite(price) ? price : 0)
      }, 0),
    [items],
  )

  const refreshOfferPreview = useCallback(
    async (code = null) => {
      if (!configured || subtotal <= 0) {
        setOfferPreview(null)
        return
      }
      setOfferLoading(true)
      try {
        const result = await callEdgeFunction(
          'validate-offer',
          { code: code || null, order_amount: subtotal },
          session?.access_token,
        )
        if (result?.applicable) {
          setOfferPreview(result)
          setOfferMessage(
            result.code
              ? `Code ${result.code} applied — ${result.discount_percentage}% off.`
              : `Automatic offer applied — ${result.discount_percentage}% off.`,
          )
        } else {
          setOfferPreview(null)
          if (code) setOfferMessage(result?.reason || 'This offer cannot be applied.')
          else setOfferMessage('')
        }
      } catch (err) {
        setOfferPreview(null)
        if (code) {
          setOfferMessage(err instanceof Error ? err.message : 'Could not validate offer')
        } else {
          setOfferMessage('')
        }
      } finally {
        setOfferLoading(false)
      }
    },
    [configured, subtotal, session?.access_token],
  )

  useEffect(() => {
    if (!configured || subtotal <= 0) {
      setOfferPreview(null)
      setAppliedCode(null)
      setCouponInput('')
      setOfferMessage('')
      return
    }
    setAppliedCode(null)
    setCouponInput('')
    refreshOfferPreview(null)
  }, [configured, subtotal, items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const payable = useMemo(() => {
    if (offerPreview?.applicable) {
      return {
        original: Number(offerPreview.original_amount ?? subtotal),
        discount: Number(offerPreview.discount_amount ?? 0),
        final: Number(offerPreview.final_amount ?? subtotal),
      }
    }
    return { original: subtotal, discount: 0, final: subtotal }
  }, [offerPreview, subtotal])

  const walletBalance = Number(profile?.wallet_balance ?? 0)
  const isFree = items.length > 0 && payable.final === 0
  const canPayWithWallet = !!session && walletBalance >= payable.final && payable.final > 0

  const handleRemove = async (designId) => {
    setRemovingId(designId)
    const { error: err } = await removeItem(designId)
    setRemovingId(null)
    if (err) {
      showToast(err, { type: 'error' })
      return
    }
    setItems((prev) => prev.filter((row) => row.designId !== designId))
    showToast('Removed from cart.', { type: 'success', duration: 2200 })
  }

  const applyCoupon = async (e) => {
    e.preventDefault()
    const code = couponInput.trim()
    if (!code) return
    setAppliedCode(code)
    await refreshOfferPreview(code)
  }

  const handleClaimFree = async () => {
    if (!session?.access_token) {
      navigate('/login', { state: { from: '/cart' } })
      return
    }
    if (!items.length || !isFree) return

    setDownloads(null)
    setBuying(true)
    try {
      const res = await callEdgeFunction(
        'claim-free-order',
        { from_cart: true, offer_code: appliedCode || null },
        session.access_token,
      )
      setDownloads(res.downloads || [])
      await refreshCount()
      setItems([])
      showToast('Free downloads are ready.', { type: 'success' })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not claim free order', {
        type: 'error',
      })
    } finally {
      setBuying(false)
    }
  }

  const handleWalletPay = async () => {
    if (!session?.access_token) {
      navigate('/login', { state: { from: '/cart' } })
      return
    }
    if (!canPayWithWallet) {
      showToast('Wallet balance is not enough for this purchase.', { type: 'error' })
      return
    }
    if (!items.length) return

    setDownloads(null)
    setWalletBuying(true)
    try {
      const res = await callEdgeFunction(
        'purchase-with-wallet',
        { from_cart: true, offer_code: appliedCode || null },
        session.access_token,
      )
      setDownloads(res.downloads || [])
      await refreshProfile()
      await refreshCount()
      setItems([])
      showToast('Paid with wallet. Downloads are ready.', { type: 'success' })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Wallet purchase failed', {
        type: 'error',
      })
    } finally {
      setWalletBuying(false)
    }
  }

  const handleRazorpayPay = async () => {
    if (!session?.access_token) {
      navigate('/login', { state: { from: '/cart' } })
      return
    }
    if (!items.length) return

    setDownloads(null)
    setBuying(true)
    try {
      await loadRazorpayCheckoutScript()
      const createRes = await callEdgeFunction(
        'create-razorpay-order',
        { from_cart: true, offer_code: appliedCode || null },
        session.access_token,
      )

      const rzp = new window.Razorpay({
        key: createRes.key_id,
        order_id: createRes.razorpay_order_id,
        amount: createRes.amount,
        currency: createRes.currency,
        name: 'Om Design & Classes',
        description: `${createRes.item_count || items.length} embroidery designs`,
        prefill: {
          name: profile?.full_name || user?.email || 'Customer',
          email: profile?.email || user?.email || '',
          contact: profile?.phone || '',
        },
        handler: async function (response) {
          try {
            const verifyRes = await callEdgeFunction(
              'verify-razorpay-payment',
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                clear_cart: true,
              },
              session.access_token,
            )
            setDownloads(verifyRes.downloads || [])
            await refreshCount()
            setItems([])
            showToast('Payment successful. Downloads are ready.', { type: 'success' })
          } catch (err) {
            showToast(
              err instanceof Error ? err.message : 'Payment verification failed',
              { type: 'error' },
            )
          } finally {
            setBuying(false)
          }
        },
        modal: {
          ondismiss: function () {
            setBuying(false)
            showToast('Payment cancelled.', { type: 'info' })
          },
        },
      })
      rzp.open()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Checkout failed', { type: 'error' })
      setBuying(false)
    }
  }

  return (
    <>
      <Seo title="Cart" description="Review designs in your cart and checkout securely." noIndex />

      <section className="bg-ivory px-6 pt-14 pb-8 md:pt-16 md:pb-10">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow text-gold-dark">Checkout</p>
          <h1 className="mt-3 text-3xl md:text-4xl">Your cart</h1>
          <p className="mt-3 max-w-xl text-sm text-ink-soft md:text-base">
            Add designs, remove what you don’t need, then pay once. Each design gets its own
            download after payment.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-8 md:py-10">
        {downloads?.length > 0 && (
          <div className="mb-8 rounded-2xl border border-teal/25 bg-white p-5 shadow-sm md:p-6">
            <h2 className="text-xl font-display text-ink">Payment complete</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Download each file below. Links expire in 10 minutes — regenerate anytime from My
              Account.
            </p>
            <ul className="mt-5 space-y-3">
              {downloads.map((d) => (
                <li
                  key={d.order_item_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/8 bg-sand/30 px-4 py-3"
                >
                  <span className="font-semibold text-ink">{d.design_name}</span>
                  <a
                    href={d.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary !px-4 !py-2 text-xs"
                  >
                    Download
                  </a>
                </li>
              ))}
            </ul>
            <Link to="/account" className="mt-4 inline-block text-sm font-semibold text-maroon hover:underline">
              View order history
            </Link>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-sand" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-maroon">{error}</p>
        ) : items.length === 0 && !downloads?.length ? (
          <div className="rounded-2xl border border-ink/8 bg-white px-6 py-16 text-center shadow-sm">
            <p className="font-display text-2xl text-ink">Your cart is empty</p>
            <p className="mt-2 text-sm text-ink-soft">Browse the catalogue and add designs you want.</p>
            <Link to="/designs" className="btn-primary mt-6 inline-flex">
              Browse designs
            </Link>
          </div>
        ) : items.length > 0 ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-10">
            <div className="space-y-4">
              {items.map(({ designId, design }) => {
                const unavailable = !design.is_active || !design.design_file_url
                return (
                  <article
                    key={designId}
                    className="flex gap-4 rounded-2xl border border-ink/8 bg-white p-4 shadow-sm md:gap-5 md:p-5"
                  >
                    <Link
                      to={`/designs/${design.slug}`}
                      className="h-24 w-20 shrink-0 overflow-hidden rounded-md bg-sand sm:h-28 sm:w-24"
                    >
                      {design.thumbnail_url ? (
                        <img
                          src={design.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/designs/${design.slug}`}
                            className="font-display text-lg text-ink hover:text-maroon sm:text-xl"
                          >
                            {design.name}
                          </Link>
                          <p className="mt-1 text-xs text-ink-soft">
                            {[design.design_id ? `#${design.design_id}` : null, design.file_format]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {unavailable && (
                            <p className="mt-2 text-xs font-semibold text-maroon">
                              Unavailable — remove this item to checkout.
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums text-maroon">
                          {formatMoney(design.price)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={removingId === designId}
                        onClick={() => handleRemove(designId)}
                        className="mt-3 text-xs font-semibold text-ink-soft underline-offset-2 hover:text-maroon hover:underline disabled:opacity-60"
                      >
                        {removingId === designId ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            <aside className="h-fit rounded-2xl border border-ink/8 bg-white p-5 shadow-sm lg:sticky lg:top-28">
              <h2 className="text-sm font-semibold text-ink">Order summary</h2>
              <p className="mt-1 text-xs text-ink-soft">
                {items.length} {items.length === 1 ? 'design' : 'designs'}
              </p>

              <form onSubmit={applyCoupon} className="mt-5 space-y-2">
                <label htmlFor="cart-coupon" className="block text-xs font-semibold text-ink">
                  Have a coupon?
                </label>
                <div className="flex gap-2">
                  <input
                    id="cart-coupon"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter code"
                    className="min-w-0 flex-1 rounded-lg border border-ink/12 bg-ivory/60 px-3 py-2 text-sm
                               focus:border-maroon/40 focus:outline-none focus:ring-2 focus:ring-maroon/10"
                  />
                  <button
                    type="submit"
                    disabled={offerLoading || !couponInput.trim()}
                    className="rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-ivory hover:bg-maroon disabled:opacity-60"
                  >
                    Apply
                  </button>
                </div>
                {offerMessage && (
                  <p className={`text-xs ${offerPreview?.applicable ? 'text-teal' : 'text-maroon'}`}>
                    {offerMessage}
                  </p>
                )}
              </form>

              <div className="mt-5 space-y-2 border-t border-ink/8 pt-4 text-sm">
                <div className="flex justify-between text-ink-soft">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMoney(payable.original)}</span>
                </div>
                {payable.discount > 0 && (
                  <div className="flex justify-between text-teal">
                    <span>Discount</span>
                    <span className="tabular-nums">−{formatMoney(payable.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-ink">
                  <span>Total</span>
                  <span className="tabular-nums">{formatMoney(payable.final)}</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {isFree ? (
                  <button
                    type="button"
                    onClick={handleClaimFree}
                    disabled={buying || walletBuying}
                    className="btn-primary w-full disabled:opacity-60"
                  >
                    {buying ? 'Preparing…' : 'Get free downloads'}
                  </button>
                ) : (
                  <>
                    {canPayWithWallet && (
                      <button
                        type="button"
                        onClick={handleWalletPay}
                        disabled={buying || walletBuying}
                        className="btn-outline w-full disabled:opacity-60"
                      >
                        {walletBuying
                          ? 'Paying…'
                          : `Pay with Wallet (${formatMoney(payable.final)})`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleRazorpayPay}
                      disabled={buying || walletBuying}
                      className="btn-primary w-full disabled:opacity-60"
                    >
                      {buying ? 'Processing…' : `Pay with Razorpay (${formatMoney(payable.final)})`}
                    </button>
                  </>
                )}
              </div>

              {session && !isFree && !canPayWithWallet && payable.final > 0 && (
                <p className="mt-3 text-xs text-ink-soft">
                  Wallet ({formatMoney(walletBalance)}) is below this total — use Razorpay.
                </p>
              )}
              {isFree && (
                <p className="mt-3 text-xs text-ink-soft">
                  Everything in this cart is free — no payment required.
                </p>
              )}
            </aside>
          </div>
        ) : null}
      </div>
    </>
  )
}

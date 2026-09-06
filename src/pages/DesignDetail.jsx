import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fetchDesignBySlug } from '../lib/catalog.js'
import { sanitizeHtml, stripHtml } from '../lib/html.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import WishlistButton from '../components/WishlistButton.jsx'
import AddToCartButton from '../components/AddToCartButton.jsx'
import Seo from '../components/Seo.jsx'
import { callEdgeFunction, loadRazorpayCheckoutScript } from '../lib/razorpay.js'

const specRows = (design) => [
  ['Design ID', design.design_id],
  ['Design type', design.design_types?.name],
  ['File format', design.file_format],
  ['Area', design.area],
  ['Needle', design.needle],
  ['Stitch count', design.stitch_count?.toLocaleString()],
  ['Size', design.size_mm ? `${design.size_mm} mm` : null],
]

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export default function DesignDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { configured, session, profile, user, refreshProfile } = useAuth()
  const { showToast } = useToast()

  const [design, setDesign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeImage, setActiveImage] = useState(0)

  const [buying, setBuying] = useState(false)
  const [walletBuying, setWalletBuying] = useState(false)
  const [signedUrl, setSignedUrl] = useState(null)
  const [downloads, setDownloads] = useState([])

  const [couponInput, setCouponInput] = useState('')
  const [appliedCode, setAppliedCode] = useState(null)
  const [offerPreview, setOfferPreview] = useState(null)
  const [offerLoading, setOfferLoading] = useState(false)
  const [offerMessage, setOfferMessage] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setNotFound(false)
    fetchDesignBySlug(slug).then(({ design: d }) => {
      if (!active) return
      if (!d) {
        setNotFound(true)
      } else {
        setDesign(d)
        setActiveImage(0)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [slug])

  const refreshOfferPreview = async (code = null) => {
    if (!configured || !design?.price) {
      setOfferPreview(null)
      return
    }
    setOfferLoading(true)
    try {
      const result = await callEdgeFunction(
        'validate-offer',
        {
          code: code || null,
          order_amount: Number(design.price),
        },
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
        if (code) {
          setOfferMessage(result?.reason || 'This offer cannot be applied.')
        } else {
          setOfferMessage('')
        }
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
  }

  useEffect(() => {
    if (!design?.price || !configured) return
    setAppliedCode(null)
    setCouponInput('')
    refreshOfferPreview(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design?.id, design?.price, configured])

  const payable = useMemo(() => {
    const original = Number(design?.price || 0)
    if (offerPreview?.applicable) {
      return {
        original,
        discount: Number(offerPreview.discount_amount || 0),
        final: Number(offerPreview.final_amount || original),
        percentage: Number(offerPreview.discount_percentage || 0),
      }
    }
    return { original, discount: 0, final: original, percentage: 0 }
  }, [design?.price, offerPreview])

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) {
      setAppliedCode(null)
      await refreshOfferPreview(null)
      return
    }
    setAppliedCode(code)
    await refreshOfferPreview(code)
  }

  const handleClearCoupon = async () => {
    setCouponInput('')
    setAppliedCode(null)
    await refreshOfferPreview(null)
  }

  const walletBalance = Number(profile?.wallet_balance ?? 0)
  const isFree = payable.final === 0
  const canPayWithWallet = !!session && walletBalance >= payable.final && payable.final > 0

  const handleClaimFree = async () => {
    if (!configured) {
      showToast('Checkout is available once Supabase is connected.', { type: 'info' })
      return
    }
    if (!session?.access_token) {
      showToast('Please sign in to download designs.', { type: 'info' })
      navigate('/login', { state: { from: `/designs/${slug}` } })
      return
    }
    if (!design?.id || !isFree) return

    setSignedUrl(null)
    setDownloads([])
    setBuying(true)
    try {
      const res = await callEdgeFunction(
        'claim-free-order',
        {
          design_id: design.id,
          offer_code: appliedCode || null,
        },
        session.access_token,
      )
      setSignedUrl(res.signed_url)
      setDownloads(res.downloads || [])
      showToast('Free download is ready.', { type: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start free download'
      showToast(msg, { type: 'error' })
    } finally {
      setBuying(false)
    }
  }

  const handleBuyWithWallet = async () => {
    if (!configured) {
      showToast('Checkout is available once Supabase is connected.', { type: 'info' })
      return
    }
    if (!session?.access_token) {
      showToast('Please sign in to purchase designs.', { type: 'info' })
      navigate('/login', { state: { from: `/designs/${slug}` } })
      return
    }
    if (!design?.id) return
    if (!canPayWithWallet) {
      showToast('Wallet balance is not enough for this purchase.', { type: 'error' })
      return
    }

    setSignedUrl(null)
    setDownloads([])
    setWalletBuying(true)
    try {
      const res = await callEdgeFunction(
        'purchase-with-wallet',
        {
          design_id: design.id,
          offer_code: appliedCode || null,
        },
        session.access_token,
      )
      setSignedUrl(res.signed_url)
      setDownloads(res.downloads || [])
      await refreshProfile()
      showToast('Paid with wallet. Download is ready.', { type: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Wallet purchase failed'
      showToast(msg, { type: 'error' })
    } finally {
      setWalletBuying(false)
    }
  }

  const handleBuyNow = async () => {
    if (!configured) {
      showToast('Checkout is available once Supabase is connected.', { type: 'info' })
      return
    }
    if (!session?.access_token) {
      showToast('Please sign in to purchase designs.', { type: 'info' })
      navigate('/login', { state: { from: `/designs/${slug}` } })
      return
    }
    if (!design?.id) return

    setSignedUrl(null)
    setDownloads([])
    setBuying(true)

    try {
      await loadRazorpayCheckoutScript()

      const createPayload = {
        design_id: design.id,
        offer_code: appliedCode || null,
      }
      const createRes = await callEdgeFunction(
        'create-razorpay-order',
        createPayload,
        session.access_token,
      )

      const { razorpay_order_id, amount, currency, key_id } = createRes

      const rzp = new window.Razorpay({
        key: key_id,
        order_id: razorpay_order_id,
        amount,
        currency,
        name: 'Om Design & Classes',
        description: design.name,
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
              },
              session.access_token,
            )

            setSignedUrl(verifyRes.signed_url)
            setDownloads(verifyRes.downloads || [])
            showToast('Payment successful. Download is ready.', { type: 'success' })
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Payment verification failed'
            showToast(msg, { type: 'error' })
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
      const msg = err instanceof Error ? err.message : 'Checkout failed'
      showToast(msg, { type: 'error' })
      setBuying(false)
    }
  }

  if (loading) {
    return <div className="max-w-6xl mx-auto px-6 py-24 text-center text-ink-soft">Loading…</div>
  }

  if (notFound) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl mb-3">Design not found</h1>
        <p className="text-ink-soft mb-6">It may have been removed or the link is out of date.</p>
        <Link to="/designs" className="btn-primary">
          Browse all designs
        </Link>
      </div>
    )
  }

  const gallery = design.gallery_urls?.length ? design.gallery_urls : [design.thumbnail_url]

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
      <Seo
        title={design.name}
        description={
          stripHtml(design.description) ||
          `${design.name} — a machine-embroidery design from Om Design & Classes.`
        }
      />
      <nav className="text-xs text-ink-soft mb-8 flex flex-wrap gap-2" aria-label="Breadcrumb">
        <Link to="/designs" className="hover:text-maroon">Designs</Link>
        {design.categories?.slug && (
          <>
            <span>/</span>
            <Link to={`/designs?category=${design.categories.slug}`} className="hover:text-maroon">
              {design.categories.name}
            </Link>
          </>
        )}
        {design.categories?.slug && design.subcategories?.slug && (
          <>
            <span>/</span>
            <Link
              to={`/designs?category=${design.categories.slug}&subcategory=${design.subcategories.slug}`}
              className="hover:text-maroon"
            >
              {design.subcategories.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-ink">{design.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-12">
        <div>
          <div className="relative aspect-square bg-sand rounded-sm overflow-hidden flex items-center justify-center">
            {design.design_id && (
              <div
                className="pointer-events-none absolute left-0 top-0 z-10 flex items-stretch shadow-[2px_2px_10px_rgba(45,32,24,0.12)]"
                aria-label={`Design ID ${design.design_id}`}
              >
                <span className="w-1 bg-gold" aria-hidden />
                <span className="bg-white px-3 py-2 font-body text-sm font-semibold tabular-nums tracking-wide text-maroon">
                  {design.design_id}
                </span>
              </div>
            )}
            {gallery[activeImage] ? (
              <img
                src={gallery[activeImage]}
                alt={`${design.name} — view ${activeImage + 1}`}
                loading="eager"
                className="img-design"
              />
            ) : (
              <p className="text-xs text-ink-soft/60">[ product image slot {activeImage + 1} ]</p>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-3 mt-4">
              {gallery.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`View image ${i + 1}`}
                  className={`w-16 h-16 rounded-sm bg-sand border-2 overflow-hidden flex items-center justify-center ${
                    activeImage === i ? 'border-maroon' : 'border-transparent'
                  }`}
                >
                  {img ? (
                    <img src={img} alt="" className="img-design" />
                  ) : (
                    <span className="text-[10px] text-ink-soft/60">{i + 1}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {(design.subcategories?.name || design.categories?.name) && (
            <p className="eyebrow">
              {[design.categories?.name, design.subcategories?.name].filter(Boolean).join(' · ')}
            </p>
          )}
          <h1 className="text-3xl md:text-4xl mt-2">{design.name}</h1>

          <div className="mt-4">
            {payable.discount > 0 ? (
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="text-2xl text-maroon font-semibold">{formatMoney(payable.final)}</p>
                <p className="text-base text-ink-soft line-through">{formatMoney(payable.original)}</p>
                <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                  {payable.percentage}% off
                </span>
              </div>
            ) : (
              <p className="text-2xl text-maroon font-semibold">{formatMoney(payable.original)}</p>
            )}
            <p className="text-xs text-ink-soft mt-1">
              Catalog price stays the same — discounts apply at checkout only.
            </p>
          </div>

          {design.description ? (
            <div
              className="rich-content text-ink-soft leading-relaxed mt-5"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(design.description) }}
            />
          ) : null}

          <dl className="mt-8 border-t border-ink/10 divide-y divide-ink/10">
            {specRows(design)
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="flex justify-between py-3 text-sm">
                  <dt className="text-ink-soft">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
          </dl>

          {design.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {design.tags.map((tag) => (
                <span key={tag} className="text-xs bg-sand text-ink-soft px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {configured && (
            <div className="mt-8 rounded-xl border border-ink/10 bg-sand/40 p-4 space-y-3">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-ink">Have a coupon?</p>
                  <p className="text-xs text-ink-soft mt-0.5">
                    Optional — automatic offers still apply when no code is entered.
                  </p>
                </div>
                {appliedCode && (
                  <button
                    type="button"
                    onClick={handleClearCoupon}
                    className="text-xs font-semibold text-maroon hover:underline"
                  >
                    Clear code
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="flex-1 border border-ink/15 rounded-sm px-4 py-2.5 text-sm bg-white
                             focus:outline-none focus:border-maroon"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={offerLoading}
                  className="btn-outline !rounded-sm !py-2.5 disabled:opacity-60"
                >
                  {offerLoading ? 'Checking…' : 'Apply'}
                </button>
              </div>
              {offerMessage && (
                <p className={`text-xs ${offerPreview?.applicable ? 'text-teal' : 'text-maroon'}`}>
                  {offerMessage}
                </p>
              )}
              <div className="pt-2 border-t border-ink/10 space-y-1.5 text-sm">
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
                  <span>Total due</span>
                  <span className="tabular-nums">{formatMoney(payable.final)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4 mt-9 items-start">
            <AddToCartButton
              designId={design.id}
              redirectPath={`/designs/${slug}`}
            />
            {isFree ? (
              <button
                onClick={handleClaimFree}
                className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={buying || walletBuying}
              >
                {buying ? 'Preparing…' : 'Get free download'}
              </button>
            ) : (
              <>
                {canPayWithWallet && (
                  <button
                    onClick={handleBuyWithWallet}
                    className="btn-outline disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={buying || walletBuying}
                  >
                    {walletBuying ? 'Paying…' : `Pay with Wallet (${formatMoney(payable.final)})`}
                  </button>
                )}
                <button
                  onClick={handleBuyNow}
                  className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={buying || walletBuying}
                >
                  {buying ? 'Processing…' : `Buy now (${formatMoney(payable.final)})`}
                </button>
              </>
            )}
            <WishlistButton designId={design.id} redirectPath={`/designs/${slug}`} />
          </div>

          {session && !isFree && !canPayWithWallet && payable.final > 0 && (
            <p className="mt-3 text-xs text-ink-soft">
              Wallet balance ({formatMoney(walletBalance)}) is below the total due — use Razorpay to complete this purchase.
            </p>
          )}

          {isFree && (
            <p className="mt-3 text-xs text-ink-soft">
              This design is free — sign in and download instantly. No payment required.
            </p>
          )}

          {(downloads.length > 0 || signedUrl) && (
            <div className="mt-5 space-y-3">
              {downloads.length > 0 ? (
                downloads.map((d) => (
                  <a
                    key={d.order_item_id}
                    href={d.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary inline-flex !rounded-xl !py-2.5 !px-5 mr-2"
                  >
                    Download {d.design_name || 'file'}
                  </a>
                ))
              ) : (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary inline-flex !rounded-xl !py-2.5 !px-5"
                >
                  Download your file
                </a>
              )}
            </div>
          )}

          {!configured && (
            <p className="text-xs text-ink-soft/70 mt-4">
              Wishlist, cart and checkout will start working once Supabase is connected.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  )
}

import Modal from '../Modal.jsx'
import Badge from './Badge.jsx'

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusVariant(status) {
  if (status === 'paid') return 'paid'
  if (status === 'pending') return 'pending'
  if (status === 'failed') return 'failed'
  return 'draft'
}

function paymentLabel(method) {
  if (method === 'razorpay') return 'Razorpay'
  if (method === 'wallet') return 'Wallet'
  if (method === 'free') return 'Free'
  return method || '—'
}

function getLineItems(order) {
  const items = order?.order_items
  if (Array.isArray(items) && items.length > 0) {
    return items.map((item) => ({
      id: item.id || item.design_id,
      name: item.design_name || item.designs?.name || 'Design',
      unitPrice: Number(item.unit_price || 0),
      thumbnailUrl: item.designs?.thumbnail_url || null,
      slug: item.designs?.slug || null,
    }))
  }
  if (order?.designs?.name) {
    return [
      {
        id: order.designs.id || 'legacy',
        name: order.designs.name,
        unitPrice: Number(order.amount || 0),
        thumbnailUrl: order.designs.thumbnail_url || null,
        slug: order.designs.slug || null,
      },
    ]
  }
  return []
}

function ProductThumb({ src, alt }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain p-1"
        loading="lazy"
      />
    )
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-sand text-ink-soft"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="h-7 w-7 opacity-45"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    </div>
  )
}

/**
 * Admin order detail — products with photos, totals, offer / discount, payment.
 */
export default function OrderDetailModal({ order, open, onClose }) {
  if (!order) return null

  const customer = order.profiles || {}
  const offer = order.offers || null
  const lines = getLineItems(order)
  const subtotal = lines.reduce((sum, row) => sum + row.unitPrice, 0)
  const paid = Number(order.amount || 0)
  const discount = Math.max(0, Math.round((subtotal - paid) * 100) / 100)
  const hasDiscount = discount > 0 || Boolean(offer)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Order #${order.id.slice(0, 8)}`}
      description={formatDate(order.created_at)}
      footer={
        <button type="button" onClick={onClose} className="btn-admin">
          Close
        </button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
          <span className="rounded-lg border border-ink/10 bg-sand/50 px-2.5 py-1 text-xs font-semibold text-ink-soft">
            {paymentLabel(order.payment_method)}
          </span>
          <span className="rounded-lg border border-ink/10 bg-sand/50 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink">
            {formatMoney(paid)}
          </span>
        </div>

        <section className="rounded-xl border border-ink/8 bg-sand/25 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            Customer
          </p>
          <p className="mt-1.5 text-sm font-semibold text-ink">
            {customer.full_name || '—'}
          </p>
          <div className="mt-1 space-y-0.5 text-xs text-ink-soft">
            {customer.phone ? <p>{customer.phone}</p> : null}
            {customer.email ? <p className="break-all">{customer.email}</p> : null}
            {!customer.phone && !customer.email ? <p>No contact info</p> : null}
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Products
            </p>
            <p className="text-xs font-semibold text-ink-soft">
              {lines.length} item{lines.length === 1 ? '' : 's'}
            </p>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink-soft">
              No product lines on this order.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {lines.map((row, index) => (
                <li
                  key={row.id || `${row.name}-${index}`}
                  className="flex items-center gap-3.5 rounded-xl border border-ink/8 bg-white p-3 sm:gap-4 sm:p-3.5"
                >
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sand ring-1 ring-ink/5 sm:h-28 sm:w-28">
                    <ProductThumb src={row.thumbnailUrl} alt={row.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-ink">
                      {row.name}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      Item {index + 1}
                      {row.slug ? ` · ${row.slug}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 self-start pt-0.5 text-sm font-bold tabular-nums text-ink sm:self-center sm:pt-0">
                    {formatMoney(row.unitPrice)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-ink/8 bg-sand/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            Payment summary
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-soft">Items subtotal</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatMoney(subtotal)}
              </dd>
            </div>

            {hasDiscount ? (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-ink-soft">
                  Discount
                  {offer?.code ? (
                    <span className="mt-0.5 block text-[11px] font-semibold text-maroon">
                      {offer.code}
                      {offer.discount_percentage != null
                        ? ` · ${Number(offer.discount_percentage)}%`
                        : ''}
                    </span>
                  ) : null}
                </dt>
                <dd className="font-semibold tabular-nums text-teal">
                  −{formatMoney(discount)}
                </dd>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-2.5">
              <dt className="font-semibold text-ink">Amount paid</dt>
              <dd className="text-base font-bold tabular-nums text-maroon">
                {formatMoney(paid)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-ink/8 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Order ID
            </p>
            <code className="mt-1.5 block break-all text-xs text-ink">
              {order.id}
            </code>
          </div>
          <div className="rounded-xl border border-ink/8 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Payment ref
            </p>
            <code className="mt-1.5 block break-all text-xs text-ink">
              {order.razorpay_order_id || '—'}
            </code>
          </div>
        </section>
      </div>
    </Modal>
  )
}

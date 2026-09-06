import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { updateProfile } from '../lib/auth.js'
import { supabase } from '../lib/supabaseClient.js'
import Section from '../components/Section.jsx'
import Seo from '../components/Seo.jsx'
import Pagination from '../components/Pagination.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useClientPagination } from '../hooks/useClientPagination.js'
import { callEdgeFunction } from '../lib/razorpay.js'

/**
 * JUDGMENT CALL: phone and email are contact/profile fields here.
 * Login credentials live in Supabase Auth (email + password). Changing
 * email here does not change the sign-in email unless you also call
 * auth.updateUser — keep them in sync manually or extend this form later.
 */
export default function Account() {
  const { user, profile, refreshProfile, configured, session } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' })
  const [status, setStatus] = useState('idle') // idle | saving | saved | error
  const [error, setError] = useState('')

  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [ordersError, setOrdersError] = useState('')
  const [downloadingKey, setDownloadingKey] = useState(null)
  const [downloadUrls, setDownloadUrls] = useState({})
  const { pageItems, page, setPage, pageSize, setPageSize, total } =
    useClientPagination(orders)

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
      })
    }
  }, [profile])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('saving')
    setError('')
    const { error: err } = await updateProfile(user.id, {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
    })
    if (err) {
      setStatus('error')
      setError(err)
      return
    }
    await refreshProfile()
    setStatus('saved')
    showToast('Account details saved.', { type: 'success' })
  }

  useEffect(() => {
    if (!configured || !user?.id) {
      setOrdersLoading(false)
      return
    }

    let active = true
    setOrdersLoading(true)
    setOrdersError('')

    supabase
      .from('orders')
      .select(
        `
        id,
        status,
        amount,
        created_at,
        design_id,
        payment_method,
        order_items (
          id,
          design_id,
          design_name,
          unit_price
        )
      `,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(async ({ data, error: err }) => {
        if (!active) return
        if (err) {
          // Fallback if migration 024 not applied yet — keep account usable.
          const legacy = await supabase
            .from('orders')
            .select('id,status,amount,created_at,design_id,payment_method')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (!active) return
          if (legacy.error) {
            setOrdersError(legacy.error.message)
            setOrdersLoading(false)
            return
          }

          const rows = legacy.data ?? []
          const designIds = rows.map((o) => o.design_id).filter(Boolean)
          const { data: designs } = designIds.length
            ? await supabase.from('designs').select('id,name').in('id', designIds)
            : { data: [] }
          const designMap = new Map((designs ?? []).map((d) => [d.id, d.name]))

          setOrders(
            rows.map((o) => ({
              ...o,
              items: o.design_id
                ? [
                    {
                      id: o.id,
                      design_id: o.design_id,
                      design_name: designMap.get(o.design_id) || 'Design',
                    },
                  ]
                : [],
            })),
          )
          setOrdersLoading(false)
          return
        }

        const rows = data ?? []
        const missingDesignIds = rows
          .filter((o) => !(o.order_items?.length) && o.design_id)
          .map((o) => o.design_id)
        const { data: designs } = missingDesignIds.length
          ? await supabase.from('designs').select('id,name').in('id', missingDesignIds)
          : { data: [] }
        const designMap = new Map((designs ?? []).map((d) => [d.id, d.name]))

        setOrders(
          rows.map((o) => {
            const items =
              o.order_items?.length > 0
                ? o.order_items
                : o.design_id
                  ? [
                      {
                        id: o.id,
                        design_id: o.design_id,
                        design_name: designMap.get(o.design_id) || 'Design',
                      },
                    ]
                  : []
            return { ...o, items }
          }),
        )
        setOrdersLoading(false)
      })

    return () => {
      active = false
    }
  }, [configured, user?.id])

  const handleGetDownloadLink = async (orderId, orderItemId) => {
    if (!session?.access_token) {
      showToast('Please sign in again to download.', { type: 'error' })
      return
    }
    const key = `${orderId}:${orderItemId || 'all'}`
    setDownloadingKey(key)
    try {
      const payload = { order_id: orderId }
      // Only pass order_item_id when it is a real order_items row (not legacy synthetic).
      if (orderItemId && orderItemId !== orderId) {
        payload.order_item_id = orderItemId
      }
      const res = await callEdgeFunction(
        'request-order-download-url',
        payload,
        session.access_token,
      )

      const next = { ...downloadUrls }
      if (res.downloads?.length) {
        for (const d of res.downloads) {
          next[`${orderId}:${d.order_item_id}`] = d.signed_url
        }
        if (res.signed_url && orderItemId) {
          next[key] = res.signed_url
        }
      } else if (res.signed_url) {
        next[key] = res.signed_url
      }
      setDownloadUrls(next)
      showToast('Download link is ready.', { type: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create download link'
      showToast(msg, { type: 'error' })
    } finally {
      setDownloadingKey(null)
    }
  }

  return (
    <Section eyebrow="Your account" title="My Account" align="left">
      <Seo title="My Account" noIndex />
      {!configured && (
        <div className="mb-6 text-sm bg-gold-light/30 border border-gold-dark/30 text-ink rounded-sm px-4 py-3 max-w-xl">
          Supabase isn&rsquo;t connected yet — this form is fully wired but
          has nothing to save to until the project URL and anon key are
          added.
        </div>
      )}

      {configured && (
        <div className="mb-8 max-w-xl rounded-xl border border-ink/10 bg-white px-5 py-4">
          <p className="text-xs uppercase tracking-wider text-ink-soft">Wallet balance</p>
          <p className="mt-2 text-3xl font-display text-maroon tabular-nums">
            {new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 2,
            }).format(Number(profile?.wallet_balance ?? 0))}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            Use your wallet at checkout when the balance fully covers the total.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <div>
          <label htmlFor="full_name" className="block text-sm font-semibold mb-1.5">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            value={form.full_name}
            onChange={handleChange}
            className="w-full border border-ink/15 rounded-sm px-4 py-2.5 text-sm
                       focus:outline-none focus:border-maroon bg-white"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="w-full border border-ink/15 rounded-sm px-4 py-2.5 text-sm
                       focus:outline-none focus:border-maroon bg-white"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-semibold mb-1.5">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            className="w-full border border-ink/15 rounded-sm px-4 py-2.5 text-sm
                       focus:outline-none focus:border-maroon bg-white"
          />
          <p className="text-xs text-ink-soft/70 mt-1.5">
            Changing this updates your contact record only — it won&rsquo;t
            change the number you sign in with.
          </p>
        </div>

        {status === 'error' && (
          <p className="text-sm text-maroon">{error}</p>
        )}

        <button type="submit" disabled={status === 'saving'} className="btn-primary disabled:opacity-60">
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="mt-10 pt-8 border-t border-ink/10">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-display leading-tight">Your orders</h2>
            <p className="text-sm text-ink-soft mt-1">
              Paid orders include short-lived signed download links for each design.
            </p>
          </div>
        </div>

        {!configured ? (
          <p className="mt-6 text-sm bg-gold-light/30 border border-gold-dark/30 text-ink rounded-sm px-4 py-3 max-w-xl">
            Supabase isn&rsquo;t connected yet — order history will appear once your project is configured.
          </p>
        ) : ordersLoading ? (
          <div className="mt-6 bg-white rounded-xl border border-ink/10 overflow-hidden">
            <div className="px-4 py-3 text-xs text-ink-soft uppercase tracking-widest2 bg-sand/50 border-b border-ink/10">
              Loading orders…
            </div>
            <div className="divide-y divide-ink/5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-4 flex gap-3 items-center animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-sand" />
                  <div className="flex-1">
                    <div className="h-3 bg-ink/10 rounded w-1/2" />
                    <div className="h-3 bg-ink/5 rounded w-2/3 mt-2" />
                  </div>
                  <div className="w-24 h-8 bg-ink/10 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : ordersError ? (
          <p className="mt-6 text-sm text-maroon">{ordersError}</p>
        ) : orders.length === 0 ? (
          <p className="mt-6 text-sm text-ink-soft">No orders yet. Purchase a design to see it here.</p>
        ) : (
          <>
            <div className="mt-6 space-y-4">
              {pageItems.map((o) => {
                const statusTone =
                  o.status === 'paid'
                    ? 'bg-teal/10 text-teal'
                    : o.status === 'failed'
                      ? 'bg-maroon/10 text-maroon'
                      : 'bg-ink/10 text-ink-soft'
                return (
                  <article
                    key={o.id}
                    className="rounded-xl border border-ink/10 bg-white overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 bg-sand/40 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusTone}`}>
                          {o.status}
                        </span>
                        <span className="text-sm text-ink-soft capitalize">
                          {o.payment_method || '—'} · ₹{o.amount}
                        </span>
                      </div>
                      <span className="text-xs text-ink-soft">
                        {o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}
                      </span>
                    </div>

                    <ul className="divide-y divide-ink/5">
                      {(o.items?.length ? o.items : [{ id: o.id, design_name: 'Design' }]).map(
                        (item) => {
                          const key = `${o.id}:${item.id}`
                          const url = downloadUrls[key]
                          const busy = downloadingKey === key
                          return (
                            <li
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                            >
                              <p className="font-semibold text-ink">{item.design_name || 'Design'}</p>
                              {o.status !== 'paid' ? (
                                <span className="text-xs text-ink-soft">—</span>
                              ) : url ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-primary inline-flex !rounded-xl !py-2 !px-4 text-xs"
                                >
                                  Download
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleGetDownloadLink(o.id, item.id)}
                                  className="btn-outline inline-flex !rounded-xl !py-2 !px-4 text-xs disabled:opacity-60"
                                >
                                  {busy ? 'Generating…' : 'Get download link'}
                                </button>
                              )}
                            </li>
                          )
                        },
                      )}
                    </ul>
                  </article>
                )
              })}
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    </Section>
  )
}

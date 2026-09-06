import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Section from '../components/Section.jsx'
import Card from '../components/Card.jsx'
import Seo from '../components/Seo.jsx'
import { BestSellerBadge, PinBadge } from '../components/DesignBadges.jsx'
import Pagination from '../components/Pagination.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useClientPagination } from '../hooks/useClientPagination.js'
import { fetchWishlistDesigns, removeFromWishlist } from '../lib/wishlist.js'

export default function Wishlist() {
  const { user, configured } = useAuth()
  const { showToast } = useToast()
  const [designs, setDesigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)
  const { pageItems, page, setPage, pageSize, setPageSize, total } =
    useClientPagination(designs)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchWishlistDesigns(user.id).then(({ designs: d }) => {
      setDesigns(d)
      setLoading(false)
    })
  }, [user])

  const handleRemove = async (designId) => {
    setRemovingId(designId)
    const { error } = await removeFromWishlist(user.id, designId)
    setRemovingId(null)
    if (!error) {
      setDesigns((prev) => prev.filter((d) => d.id !== designId))
      showToast('Removed from wishlist.', { type: 'info' })
    }
  }

  return (
    <Section eyebrow="Saved for later" title="My Wishlist" align="left">
      <Seo title="My Wishlist" noIndex />
      {!configured && (
        <div className="mb-8 text-sm bg-gold-light/30 border border-gold-dark/30 text-ink rounded-sm px-4 py-3 max-w-xl">
          Supabase isn&rsquo;t connected yet — your wishlist has nowhere
          to load from until the project URL and anon key are added.
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-sand rounded-sm animate-pulse" />
          ))}
        </div>
      ) : designs.length === 0 ? (
        <div className="py-8">
          <p className="text-ink-soft mb-4">Nothing saved yet.</p>
          <Link to="/designs" className="btn-primary">
            Browse designs
          </Link>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pageItems.map((d) => (
              <Card
                key={d.id}
                to={`/designs/${d.slug}`}
                image={d.thumbnail_url}
                imageAlt={d.name}
                eyebrow={d.file_format}
                title={d.name}
                description={d.description}
                topLeft={d.is_best_seller ? <BestSellerBadge /> : null}
                topRight={d.is_pinned ? <PinBadge /> : null}
                footer={
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-maroon">₹{d.price}</p>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRemove(d.id)
                      }}
                      disabled={removingId === d.id}
                      className="text-xs text-ink-soft underline underline-offset-4 hover:text-maroon disabled:opacity-60"
                    >
                      {removingId === d.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                }
              />
            ))}
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
    </Section>
  )
}

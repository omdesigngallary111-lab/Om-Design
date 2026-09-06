import { Navigate, useParams } from 'react-router-dom'

/**
 * Legacy /categories/:slug bookmarks redirect into the catalogue
 * with that category pre-selected in the filters.
 */
export default function CategoryDetail() {
  const { slug } = useParams()
  if (!slug) return <Navigate to="/designs" replace />
  return <Navigate to={`/designs?category=${encodeURIComponent(slug)}`} replace />
}

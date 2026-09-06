import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Section from '../components/Section.jsx'
import CategoryCard from '../components/CategoryCard.jsx'
import Seo from '../components/Seo.jsx'
import { fetchCategories } from '../lib/catalog.js'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchCategories().then(({ categories: c }) => {
      if (active) {
        setCategories(c)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <Seo
        title="Browse Designs by Category"
        description="Bridal borders, floral motifs, geometric jaal and festive booti — browse the full embroidery design collection by category."
      />
      <section className="bg-ivory px-6 pt-16 pb-10 md:pt-20 md:pb-12">
        <div className="max-w-6xl mx-auto">
          <p className="eyebrow text-gold-dark">Collections</p>
          <h1 className="text-4xl md:text-5xl mt-3">Browse by category</h1>
          <p className="mt-4 text-ink-soft max-w-xl leading-relaxed">
            Pick a category to open all matching designs, or search the full catalogue.          </p>
          <div className="mt-8 h-px bg-gold/30" />
        </div>
      </section>

      <Section tone="ivory" className="!pt-6">
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-sand rounded-lg animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-center text-ink-soft">
            No categories yet — check back soon.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                to={`/designs?category=${cat.slug}`}
                name={cat.name}
                description={cat.description}
                image={cat.image_url}
              />
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <Link to="/designs" className="text-maroon font-semibold text-sm underline underline-offset-4">
            Or search the full catalogue
          </Link>
        </div>
      </Section>
    </>
  )
}

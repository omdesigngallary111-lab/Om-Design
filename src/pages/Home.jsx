import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import Section from "../components/Section.jsx";
import Card from "../components/Card.jsx";
import CategoryCard from "../components/CategoryCard.jsx";
import HeroCarousel, {
  HERO_MEDIA_CLASS,
  StaticHomeHero,
} from "../components/HeroCarousel.jsx";
import Seo from "../components/Seo.jsx";
import WishlistButton from "../components/WishlistButton.jsx";
import { stripHtml } from "../lib/html.js";
import {
  fetchActiveCarouselSlides,
  fetchCategories,
  fetchDesigns,
} from "../lib/catalog.js";

const steps = [
  {
    n: "01",
    title: "Choose a design",
    body: "Browse by category, motif or format, and preview the stitch-out before you buy.",
  },
  {
    n: "02",
    title: "Download your files",
    body: "Get machine-ready DST, EMB, DHE or DHP files, sized and digitised for clean production.",
  },
  {
    n: "03",
    title: "Stitch it out",
    body: "Load the file onto your machine and bring the design to life on saree, dupatta or fabric.",
  },
];

const testimonials = [
  {
    quote:
      "The stitch count and sizing notes were spot on — the border ran perfectly on my first try.",
    name: "Radhika M.",
    role: "Boutique owner, Surat",
  },
  {
    quote:
      "Files are clean and well-digitised. My machine never skips a beat on these designs.",
    name: "Priya S.",
    role: "Home embroiderer",
  },
  {
    quote:
      "I use these designs across my whole bridal line now. Consistent quality every time.",
    name: "Anjali K.",
    role: "Designer, Ahmedabad",
  },
];

export default function Home() {
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [slides, setSlides] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCategories(),
      fetchDesigns({ page: 1, pageSize: 30 }),
      fetchActiveCarouselSlides(),
    ]).then(([catRes, desRes, slideRes]) => {
      if (!active) return;
      setCategories(catRes.categories ?? []);
      const all = desRes.designs ?? [];
      const featured = all.filter((d) => d.is_featured);
      const rest = all.filter((d) => !d.is_featured);
      setDesigns([...featured, ...rest].slice(0, 6));
      setSlides(slideRes.slides ?? []);
      setLoadingCatalog(false);
      setHeroReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Seo
        brandFirst
        path="/"
        title="Embroidery Designs & Classes in Surat"
        description="Buy machine-ready embroidery designs (DST, EMB, DHE, DHP) for sarees & fabric, or join embroidery classes in Varachha, Surat. Crafted by Om Design & Classes."
      />

      {!heroReady ? (
        <section className={`${HERO_MEDIA_CLASS} bg-maroon-dark`} aria-busy="true">
          <div className="absolute inset-0 animate-pulse bg-ink/70" />
        </section>
      ) : slides.length > 0 ? (
        <HeroCarousel slides={slides} />
      ) : (
        <StaticHomeHero />
      )}

      <Section
        eyebrow="Collections"
        title="Featured categories"
        subtitle="Bridal borders, motifs, jaal and booti — grouped the way workshops actually shop."
        tone="ivory"
      >
        {loadingCatalog ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-sand rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.slice(0, 3).map((cat) => (
              <CategoryCard
                key={cat.id}
                to={`/categories/${cat.slug}`}
                name={cat.name}
                description={cat.description}
                image={cat.image_url}
              />
            ))}
          </div>
        )}
        <div className="text-center mt-10">
          <Link
            to="/categories"
            className="text-maroon font-semibold text-sm underline underline-offset-4"
          >
            View all categories
          </Link>
        </div>
      </Section>

      <Section
        eyebrow="The catalogue"
        title="Featured designs"
        subtitle="A first look at stitch-ready files — prices in ₹, formats listed on each card."
        tone="sand"
      >
        {loadingCatalog ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] bg-ivory rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : designs.length === 0 ? (
          <p className="text-center text-ink-soft">
            Designs will appear here as the catalogue fills.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {designs.map((d) => (
              <Card
                key={d.id}
                to={`/designs/${d.slug}`}
                image={d.thumbnail_url}
                imageAlt={d.name}
                eyebrow={
                  d.design_id
                    ? `#${d.design_id} · ${d.file_format}`
                    : d.file_format
                }
                title={d.name}
                description={stripHtml(d.description)}
                footer={<p className="font-semibold text-maroon">₹{d.price}</p>}
                topRight={
                  <WishlistButton
                    designId={d.id}
                    variant="icon"
                    redirectPath={`${location.pathname}${location.search}`}
                  />
                }
              />
            ))}
          </div>
        )}
        <div className="text-center mt-10">
          <Link to="/designs" className="btn-primary">
            Browse all designs
          </Link>
        </div>
      </Section>

      <Section
        eyebrow="How it works"
        title="From our drawing table to your fabric"
        subtitle="Three steps. No guesswork on stitch count, size or file format."
        tone="ivory"
      >
        <div className="grid md:grid-cols-3 gap-8 md:gap-10">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-left bg-white rounded-lg border border-ink/5 shadow-sm p-6 md:p-7"
            >
              <span className="font-display text-3xl text-gold-dark">
                {step.n}
              </span>
              <h3 className="text-xl mt-4">{step.title}</h3>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </Section>

      <section className="bg-sand">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-0 md:gap-0 items-stretch">
          <div className="relative min-h-[280px] md:min-h-[420px] bg-maroon overflow-hidden">
            <div className="absolute inset-0 page-hero-gradient opacity-90" />
            <div className="relative h-full flex flex-col justify-end p-8 md:p-10 text-ivory">
              <p className="eyebrow text-gold-light">The studio</p>
              <p className="font-display text-3xl md:text-4xl mt-3 leading-tight">
                A drawing table, twenty years of thread
              </p>
            </div>
          </div>
          <div className="bg-maroon-dark text-ivory p-8 md:p-12 flex flex-col justify-center">
            <h2 className="text-3xl md:text-4xl text-ivory leading-tight">
              Rooted in craft, built for the machine age
            </h2>
            <p className="mt-5 text-ivory/80 leading-relaxed">
              Om Design &amp; Classes began as a hand-embroidery teaching studio
              before machine digitisation ever entered the room. That order
              matters — every design still starts as a drawn motif, tested by
              hand, before it&rsquo;s translated into stitch paths.
            </p>
            <p className="mt-4 text-ivory/80 leading-relaxed">
              The machine changed the tool, not the standard.
            </p>
            <Link
              to="/about"
              className="btn-ghost-light mt-8 self-start !py-2.5 !px-5"
            >
              Read our story
            </Link>
          </div>
        </div>
      </section>

      <Section eyebrow="From the hoop" title="Workshops that trust the files">
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {testimonials.map((t) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-lg shadow-card border border-ink/5 p-7 text-left"
            >
              <blockquote className="font-display text-lg text-ink leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-ink-soft/70">{t.role}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </Section>
    </>
  );
}

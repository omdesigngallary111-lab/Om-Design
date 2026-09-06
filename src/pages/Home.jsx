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
import { BestSellerBadge, PinBadge } from "../components/DesignBadges.jsx";
import { stripHtml } from "../lib/html.js";
import {
  fetchActiveCarouselSlides,
  fetchCategories,
  fetchDesigns,
} from "../lib/catalog.js";
import { LOGO_SRC, STUDIO } from "../data/studio.js";

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
      "We’ve been buying from Om Design & Classes for months. Files are consistent, support is quick and they understand real production needs.",
    name: "Heer Vaghani",
  },
  {
    quote:
      "Design banavanu kam bov j saru che. Design banavine ape ema machine dhaga pn ocha kape ane production pan avr che. Ane lengha ma creation pn bov saru ape che. Ek var jarur visit karvi.",
    name: "Jemish Sutariya",
  },
  {
    quote:
      "Excellent embroidery design classes! Simple lessons, great support from teachers, and easy-to-understand software. Definitely recommend for beginners.",
    name: "Jash Navadiya",
  },
  {
    quote:
      "An outstanding experience at Om Design & Classes! I highly recommend them — my experience here was truly fantastic across the board.",
    name: "Ayush Kevadiya",
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
      fetchDesigns({ page: 1, pageSize: 6, featuredOnly: true }),
      fetchActiveCarouselSlides(),
    ]).then(([catRes, desRes, slideRes]) => {
      if (!active) return;
      setCategories(catRes.categories ?? []);
      setDesigns(desRes.designs ?? []);
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
                to={`/designs?category=${cat.slug}`}
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
            Mark designs as Featured in admin to show them here.
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
                topLeft={d.is_best_seller ? <BestSellerBadge /> : null}
                topRight={
                  <div className="flex flex-col items-end gap-2">
                    {d.is_pinned ? <PinBadge /> : null}
                    <WishlistButton
                      designId={d.id}
                      variant="icon"
                      redirectPath={`${location.pathname}${location.search}`}
                    />
                  </div>
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
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-0 items-stretch">
          {/* Visual brand panel — reads like a photo, not a text block */}
          <div className="relative min-h-[300px] md:min-h-[420px] overflow-hidden bg-maroon">
            <div className="absolute inset-0 page-hero-gradient opacity-95" aria-hidden />
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse at 30% 35%, rgba(251,246,238,0.18), transparent 55%)",
              }}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-full flex-col items-center justify-center px-8 py-12 text-center"
            >
              <img
                src={LOGO_SRC}
                alt={STUDIO.name}
                width={140}
                height={140}
                className="h-28 w-28 object-contain drop-shadow-sm md:h-36 md:w-36"
              />
              <p className="mt-6 font-display text-2xl text-ivory md:text-3xl lg:text-4xl">
                {STUDIO.name}
              </p>
              <p className="mt-3 max-w-[22rem] text-sm font-semibold uppercase tracking-[0.14em] text-gold-light md:text-base">
                Meet for make design from sketch &amp; catalog
              </p>
            </motion.div>
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
        <div className="grid gap-6 sm:grid-cols-2 md:gap-8">
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
                <p className="text-sm font-semibold tracking-wide text-maroon">
                  {t.name}
                </p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </Section>
    </>
  );
}

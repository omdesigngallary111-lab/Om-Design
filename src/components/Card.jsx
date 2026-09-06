import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function Card({
  image,
  imageAlt = '',
  eyebrow,
  title,
  description,
  footer,
  href,
  to,
  topLeft,
  topRight,
}) {
  const commonProps = {
    whileHover: { y: -6 },
    transition: { duration: 0.25, ease: 'easeOut' },
    className:
      'group flex flex-col bg-white rounded-lg overflow-hidden shadow-card border border-ink/5 h-full',
  }

  const content = (
    <>
      <div className="relative aspect-[4/5] bg-sand overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={imageAlt}
            loading="lazy"
            decoding="async"
            className="img-design transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center px-6">
            <span className="font-display text-gold/45 text-xl md:text-2xl tracking-wide text-center leading-snug">
              {title || 'Design'}
            </span>
          </div>
        )}
        {topLeft && (
          <div className="absolute top-3 left-3 z-[1] pointer-events-none">{topLeft}</div>
        )}
        {topRight && <div className="absolute top-3 right-3 z-[1]">{topRight}</div>}
      </div>
      <div className="p-5 flex flex-col gap-1.5 flex-1">
        {eyebrow && <p className="eyebrow text-[11px]">{eyebrow}</p>}
        {title && <h3 className="text-lg font-display leading-snug">{title}</h3>}
        {description && (
          <p className="text-sm text-ink-soft leading-relaxed line-clamp-2">{description}</p>
        )}
        {footer && <div className="mt-auto pt-4">{footer}</div>}
      </div>
    </>
  )

  if (to) {
    return (
      <motion.div {...commonProps}>
        <Link to={to} className="contents">
          {content}
        </Link>
      </motion.div>
    )
  }

  if (href) {
    return (
      <motion.a href={href} {...commonProps}>
        {content}
      </motion.a>
    )
  }

  return <motion.div {...commonProps}>{content}</motion.div>
}

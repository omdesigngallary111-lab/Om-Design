const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function Svg({ className = 'w-5 h-5', children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      {...stroke}
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconDashboard(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </Svg>
  )
}

export function IconPackage(props) {
  return (
    <Svg {...props}>
      <path d="M16.5 9.4 7.5 4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05" />
      <path d="M12 22.08V12" />
    </Svg>
  )
}

export function IconFolder(props) {
  return (
    <Svg {...props}>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9l-.81-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
    </Svg>
  )
}

export function IconUsers(props) {
  return (
    <Svg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

export function IconPlus(props) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function IconSearch(props) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </Svg>
  )
}

export function IconPencil(props) {
  return (
    <Svg {...props}>
      <path d="M17 3a2.4 2.4 0 0 1 3.4 3.4L8.5 18.3 3 19.5l1.2-5.5Z" />
      <path d="m15 5 4 4" />
    </Svg>
  )
}

export function IconTrash(props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </Svg>
  )
}

export function IconX(props) {
  return (
    <Svg {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  )
}

export function IconImage(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 15-4.5-4.5L7 20" />
    </Svg>
  )
}

export function IconFile(props) {
  return (
    <Svg {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </Svg>
  )
}

export function IconUpload(props) {
  return (
    <Svg {...props}>
      <path d="M12 16V6" />
      <path d="m8 10 4-4 4 4" />
      <path d="M4 18h16" />
    </Svg>
  )
}

export function IconAlert(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </Svg>
  )
}

export function IconArrowLeft(props) {
  return (
    <Svg {...props}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </Svg>
  )
}

export function IconMenu(props) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  )
}

export function IconOrders(props) {
  return (
    <Svg {...props}>
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1.25" />
      <circle cx="18" cy="20" r="1.25" />
    </Svg>
  )
}

export function IconSparkle(props) {
  return (
    <Svg {...props}>
      <path d="M12 3l1.6 4.8L18.5 9.5 13.6 11.2 12 16l-1.6-4.8L5.5 9.5l4.9-1.7z" />
      <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </Svg>
  )
}

export function IconLayers(props) {
  return (
    <Svg {...props}>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </Svg>
  )
}

export function IconShapes(props) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <circle cx="17.5" cy="6.5" r="3.5" />
      <path d="M8.5 20.5 3.5 14h10z" />
      <rect x="14" y="13" width="7" height="8" rx="1.5" />
    </Svg>
  )
}

export function IconTag(props) {
  return (
    <Svg {...props}>
      <path d="M20.6 13.4 12.1 21.9a2 2 0 0 1-2.8 0L2 14.6V4h10.6l8 8a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </Svg>
  )
}

export function IconChevronDown(props) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  )
}

/** Ruler / sizing — used for Area & Needle admin */
export function IconRuler(props) {
  return (
    <Svg {...props}>
      <path d="M4 8h16v8H4z" />
      <path d="M8 8v3M12 8v5M16 8v3M20 8v5" />
    </Svg>
  )
}

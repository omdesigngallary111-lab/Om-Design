import { IconSearch } from './icons.jsx'

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  filters,
  activeFilter,
  onFilter,
  actions = null,
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 lg:flex-nowrap">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{placeholder}</span>
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="admin-input !py-2 !pl-9 !text-xs sm:!text-sm"
        />
      </label>

      {actions}

      {filters?.length ? (
        <div
          className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5"
          role="tablist"
        >
          {filters.map((f) => {
            const active = activeFilter === f.value
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilter(f.value)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold tracking-wide
                            transition-all duration-150 ${
                              active
                                ? 'bg-maroon text-ivory shadow-sm'
                                : 'border border-ink/10 bg-white text-ink-soft hover:border-ink/20 hover:text-ink'
                            }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

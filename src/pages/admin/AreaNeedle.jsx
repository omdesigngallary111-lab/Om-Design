import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/Modal.jsx'
import Pagination from '../../components/Pagination.jsx'
import Seo from '../../components/Seo.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useAdminFormModal } from '../../hooks/useAdminFormModal.js'
import { useClientPagination } from '../../hooks/useClientPagination.js'
import {
  fetchAllDesignAreas,
  createDesignArea,
  updateDesignArea,
  deleteDesignArea,
  fetchAllDesignNeedles,
  createDesignNeedle,
  updateDesignNeedle,
  deleteDesignNeedle,
} from '../../lib/admin.js'
import PageHeader from '../../components/admin/PageHeader.jsx'
import SearchBar from '../../components/admin/SearchBar.jsx'
import Badge from '../../components/admin/Badge.jsx'
import EmptyState from '../../components/admin/EmptyState.jsx'
import Alert from '../../components/admin/Alert.jsx'
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx'
import { Field, Toggle, FormSection } from '../../components/admin/FormControls.jsx'
import { AdminTable, ActionsCell, RowActions } from '../../components/admin/AdminTable.jsx'
import { TableSkeleton } from '../../components/admin/Skeleton.jsx'
import { IconPlus, IconRuler } from '../../components/admin/icons.jsx'

const emptyForm = {
  name: '',
  is_active: true,
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const TABS = [
  { id: 'area', label: 'Area' },
  { id: 'needle', label: 'Needle' },
]

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

/**
 * Admin CRUD for Area and Needle options used on the product form
 * and storefront filters. Defaults are seeded in migration 023.
 */
export default function AreaNeedle() {
  const { showToast } = useToast()
  const [tab, setTab] = useState('area')
  const [areas, setAreas] = useState([])
  const [needles, setNeedles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const {
    modalOpen,
    closeModal,
    openCreate,
    openEdit: openEditModal,
    editingId,
    form,
    setForm,
    fieldErrors,
    setFieldErrors,
  } = useAdminFormModal('area-needle', { emptyForm })

  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const isArea = tab === 'area'
  const rows = isArea ? areas : needles
  const entityLabel = isArea ? 'Area' : 'Needle'
  const entityLabelLower = isArea ? 'area' : 'needle'

  const load = () => {
    setLoading(true)
    Promise.all([fetchAllDesignAreas(), fetchAllDesignNeedles()]).then(
      ([areaRes, needleRes]) => {
        setAreas(areaRes.areas)
        setNeedles(needleRes.needles)
        setError(areaRes.error || needleRes.error || '')
        setLoading(false)
      },
    )
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false
      if (!q) return true
      return String(row.name || '')
        .toLowerCase()
        .includes(q)
    })
  }, [rows, query, statusFilter])

  const { pageItems, page, setPage, pageSize, setPageSize, total } =
    useClientPagination(filtered, {
      resetKey: `${tab}|${query}|${statusFilter}`,
    })

  const switchTab = (next) => {
    setTab(next)
    setQuery('')
    setStatusFilter('all')
    closeModal()
    setPendingDelete(null)
  }

  const openEdit = (row) => {
    openEditModal(row.id, {
      name: row.name ?? '',
      is_active: row.is_active !== false,
    })
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = `${entityLabel} is required`
    return next
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validate()
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      is_active: !!form.is_active,
    }
    const { error: err } = editingId
      ? isArea
        ? await updateDesignArea(editingId, payload)
        : await updateDesignNeedle(editingId, payload)
      : isArea
        ? await createDesignArea(payload)
        : await createDesignNeedle(payload)
    setSaving(false)
    if (err) {
      const message = /duplicate|unique/i.test(err)
        ? `This ${entityLabelLower} already exists.`
        : err
      setError(message)
      showToast(message, { type: 'error' })
      return
    }
    closeModal()
    showToast(
      editingId ? `${entityLabel} updated.` : `${entityLabel} created.`,
      { type: 'success' },
    )
    load()
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    const { error: err } = isArea
      ? await deleteDesignArea(pendingDelete.id)
      : await deleteDesignNeedle(pendingDelete.id)
    setDeleting(false)
    if (err) {
      setError(err)
      showToast(err, { type: 'error' })
    } else {
      showToast(
        `${entityLabel} deleted. Products using it were cleared.`,
        { type: 'info' },
      )
      load()
    }
    setPendingDelete(null)
  }

  const tableColumns = [
    { key: 'name', label: entityLabel },
    { key: 'created', label: 'Created at' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', align: 'right' },
  ]

  return (
    <div>
      <Seo title="Area & Needle" noIndex />
      <PageHeader
        title="Area & Needle"
        description="Options for the product form and catalogue filters. Defaults are pre-loaded; add or edit as needed."
        action={
          <button type="button" onClick={() => openCreate()} className="btn-admin">
            <IconPlus className="w-4 h-4" />
            Add {entityLabel}
          </button>
        }
      />

      <div className="mb-5 flex gap-1 rounded-xl bg-sand/60 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-ivory text-maroon shadow-sm'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs font-normal text-ink-soft">
              ({t.id === 'area' ? areas.length : needles.length})
            </span>
          </button>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder={`Search ${entityLabelLower}s…`}
        filters={STATUS_FILTERS}
        activeFilter={statusFilter}
        onFilter={setStatusFilter}
      />

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : rows.length === 0 ? (
        <div className="admin-card">
          <EmptyState
            icon={<IconRuler className="w-7 h-7" />}
            title={`No ${entityLabelLower}s yet`}
            description={
              isArea
                ? 'Add hoop sizes like 100 mm or 200 mm for the product form.'
                : 'Add needle counts (1–12) for the product form.'
            }
            action={
              <button type="button" onClick={() => openCreate()} className="btn-admin">
                <IconPlus className="w-4 h-4" />
                Add {entityLabel}
              </button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-card">
          <EmptyState
            icon={<IconRuler className="w-7 h-7" />}
            title="No matches"
            description="Try a different search or status filter."
          />
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <AdminTable columns={tableColumns} minWidth={560}>
              {pageItems.map((row) => (
                <tr
                  key={row.id}
                  className="group hover:bg-sand/40 transition-colors duration-150"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-ink truncate max-w-[16rem]" title={row.name}>
                      {row.name}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft whitespace-nowrap">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <Badge variant={row.is_active ? 'active' : 'draft'}>
                      {row.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <ActionsCell>
                    <RowActions
                      onEdit={() => openEdit(row)}
                      onDelete={() => setPendingDelete(row)}
                    />
                  </ActionsCell>
                </tr>
              ))}
            </AdminTable>
          </div>

          <div className="md:hidden space-y-3">
            {pageItems.map((row) => (
              <article key={row.id} className="admin-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{row.name}</p>
                    <p className="text-xs text-ink-soft mt-0.5">{formatDate(row.created_at)}</p>
                    <div className="mt-2">
                      <Badge variant={row.is_active ? 'active' : 'draft'}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <RowActions
                    onEdit={() => openEdit(row)}
                    onDelete={() => setPendingDelete(row)}
                  />
                </div>
              </article>
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

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
        description={
          isArea
            ? 'Shown on the product form and as a catalogue filter (e.g. 100 mm).'
            : 'Shown on the product form and as a catalogue filter (e.g. 1–12).'
        }
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="btn-ghost"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="area-needle-form"
              disabled={saving}
              className="btn-admin"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : `Create ${entityLabelLower}`}
            </button>
          </>
        }
      >
        <form id="area-needle-form" onSubmit={handleSubmit} className="space-y-5">
          <FormSection title="Details">
            <Field
              label={entityLabel}
              htmlFor="area-needle-name"
              error={fieldErrors.name}
              hint={isArea ? 'Include the unit, e.g. 200 mm.' : 'Usually a number from 1 to 12.'}
            >
              <input
                id="area-needle-name"
                value={form.name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, name: e.target.value }))
                  if (fieldErrors.name) setFieldErrors((err) => ({ ...err, name: undefined }))
                }}
                className="admin-input"
                placeholder={isArea ? 'e.g. 200 mm' : 'e.g. 6'}
                autoFocus
              />
            </Field>
            <Toggle
              checked={form.is_active}
              onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              label="Active"
              description="Inactive options stay on existing products but are hidden from new selections and filters."
            />
          </FormSection>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => !deleting && setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={`Delete ${entityLabelLower}`}
        description={
          pendingDelete
            ? `Delete “${pendingDelete.name}”? Products using this ${entityLabelLower} will have the field cleared.`
            : ''
        }
        confirmLabel={`Delete ${entityLabelLower}`}
      />
    </div>
  )
}

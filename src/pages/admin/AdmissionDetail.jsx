import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Modal from '../../components/Modal.jsx'
import Seo from '../../components/Seo.jsx'
import Alert from '../../components/admin/Alert.jsx'
import Badge from '../../components/admin/Badge.jsx'
import ConfirmDialog from '../../components/admin/ConfirmDialog.jsx'
import PageHeader from '../../components/admin/PageHeader.jsx'
import { IconArrowLeft } from '../../components/admin/icons.jsx'
import AdmissionPrintDocument from '../../components/admission/AdmissionPrintDocument.jsx'
import AdmissionPdfExport from '../../components/admission/AdmissionPdfExport.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import {
  fetchAdmissionById,
  updateAdmission,
  createAdmissionInstallment,
  updateAdmissionInstallment,
  deleteAdmissionInstallment,
  deleteAdmission,
  getAdmissionAssetSignedUrl,
  getAdmissionAssetSignedUrls,
} from '../../lib/admin.js'
import { canDeleteAdmissions, canEditAdmissions } from '../../lib/roles.js'

const STATUS_OPTIONS = ['pending', 'reviewed', 'enrolled', 'rejected']

function statusVariant(status) {
  if (status === 'pending') return 'pending'
  if (status === 'reviewed') return 'reviewed'
  if (status === 'enrolled') return 'enrolled'
  if (status === 'rejected') return 'rejected'
  return 'draft'
}

function FieldRow({ label, value }) {
  return (
    <div className="py-2 border-b border-ink/5 last:border-0">
      <dt className="text-xs font-semibold text-ink-soft uppercase tracking-wide">{label}</dt>
      <dd className="text-sm mt-0.5 whitespace-pre-wrap">{value || '—'}</dd>
    </div>
  )
}

export default function AdmissionDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { showToast } = useToast()
  const canEdit = canEditAdmissions(profile?.role)
  const canDelete = canDeleteAdmissions(profile?.role)

  const [admission, setAdmission] = useState(null)
  const [installments, setInstallments] = useState([])
  const [photoUrl, setPhotoUrl] = useState(null)
  const [aadhaarUrls, setAadhaarUrls] = useState([])
  const [signatureUrl, setSignatureUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfLanguage, setPdfLanguage] = useState('gu')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { admission: row, installments: inst, error: err } = await fetchAdmissionById(id)
    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    setAdmission(row)
    setInstallments(inst)
    setPdfLanguage(row?.preferred_language === 'en' ? 'en' : 'gu')

    if (row?.student_photo_url) {
      const { url } = await getAdmissionAssetSignedUrl(row.student_photo_url)
      setPhotoUrl(url)
    } else {
      setPhotoUrl(null)
    }
    if (row?.aadhaar_card_urls?.length) {
      const { urls } = await getAdmissionAssetSignedUrls(row.aadhaar_card_urls)
      setAadhaarUrls(urls)
    } else {
      setAadhaarUrls([])
    }
    if (row?.student_signature_url) {
      const { url } = await getAdmissionAssetSignedUrl(row.student_signature_url)
      setSignatureUrl(url)
    } else {
      setSignatureUrl(null)
    }
    setError('')
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (location.state?.justCreated) {
      showToast('Admission saved. Download the PDF when ready.', { type: 'success' })
      window.history.replaceState({}, document.title)
    }
  }, [location.state?.justCreated, showToast])

  const handleStatusChange = async (e) => {
    if (!canEdit) return
    const status = e.target.value
    setStatusSaving(true)
    const { admission: updated, error: err } = await updateAdmission(id, { status })
    setStatusSaving(false)
    if (err) {
      showToast(err, { type: 'error' })
      return
    }
    setAdmission(updated)
    showToast('Status updated', { type: 'success' })
  }

  const handleAddInstallment = async () => {
    if (!canEdit) return
    const { installment, error: err } = await createAdmissionInstallment(id, {
      sort_order: installments.length,
      installment_date: null,
      amount: null,
      received_by: '',
    })
    if (err) {
      showToast(err, { type: 'error' })
      return
    }
    setInstallments((rows) => [...rows, installment])
  }

  const handleInstallmentChange = async (rowId, field, value) => {
    if (!canEdit) return
    setInstallments((rows) =>
      rows.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)),
    )
  }

  const saveInstallment = async (row) => {
    if (!canEdit) return
    const payload = {
      installment_date: row.installment_date || null,
      amount: row.amount === '' || row.amount == null ? null : Number(row.amount),
      received_by: row.received_by || null,
      sort_order: row.sort_order ?? 0,
    }
    const { installment, error: err } = await updateAdmissionInstallment(row.id, payload)
    if (err) {
      showToast(err, { type: 'error' })
      return
    }
    setInstallments((rows) => rows.map((r) => (r.id === row.id ? installment : r)))
  }

  const removeInstallment = async (rowId) => {
    if (!canEdit) return
    const { error: err } = await deleteAdmissionInstallment(rowId)
    if (err) {
      showToast(err, { type: 'error' })
      return
    }
    setInstallments((rows) => rows.filter((r) => r.id !== rowId))
    showToast('Installment removed', { type: 'success' })
  }

  const handleDelete = async () => {
    if (!canDelete) return
    setDeleting(true)
    const { error: err } = await deleteAdmission(id)
    setDeleting(false)
    setConfirmDelete(false)
    if (err) {
      showToast(err, { type: 'error' })
      return
    }
    showToast('Admission deleted', { type: 'success' })
    navigate('/admin/admissions', { replace: true })
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center" role="status">
        <div className="w-8 h-8 border-2 border-maroon/30 border-t-maroon rounded-full animate-spin" />
      </div>
    )
  }

  if (!admission) {
    return (
      <>
        <Seo title="Admission" noIndex />
        <Alert>{error || 'Admission not found'}</Alert>
        <Link to="/admin/admissions" className="text-sm font-semibold text-maroon mt-4 inline-flex items-center gap-1">
          <IconArrowLeft className="w-4 h-4" /> Back to admissions
        </Link>
      </>
    )
  }

  return (
    <AdmissionPdfExport
      admission={admission}
      installments={installments}
      language={pdfLanguage}
      photoUrl={photoUrl}
      aadhaarUrls={aadhaarUrls}
      signatureUrl={signatureUrl}
      onError={(msg) => showToast(msg, { type: 'error' })}
    >
      {({ download, downloading }) => (
        <>
          <Seo title={`Admission #${admission.form_number ?? ''}`} noIndex />
          <Link
            to="/admin/admissions"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-maroon mb-4"
          >
            <IconArrowLeft className="w-4 h-4" /> Admissions
          </Link>

          <PageHeader
            title={admission.student_name}
            description={`Form #${admission.form_number ?? '—'} · ${admission.student_mobile}`}
            action={
              <div className="flex flex-wrap items-center gap-3">
                {canEdit ? (
                  <select
                    value={admission.status}
                    disabled={statusSaving}
                    onChange={handleStatusChange}
                    className="border border-ink/15 rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <Badge variant={statusVariant(admission.status)}>{admission.status}</Badge>
                )}
                {canEdit && (
                  <Link
                    to={`/admin/admissions/${id}/edit`}
                    className="btn-outline !text-xs !py-2"
                  >
                    Edit
                  </Link>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="btn-danger !text-xs !py-2 !rounded-sm"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary !text-xs !py-2"
                  onClick={() => setPdfOpen(true)}
                >
                  Download PDF
                </button>
              </div>
            }
          />

          {error && <Alert className="mb-4">{error}</Alert>}

          <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
            <div className="bg-white rounded-xl border border-ink/8 p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft mb-3">Application</h2>
              <dl>
                <FieldRow label="Form number" value={admission.form_number} />
                <FieldRow label="Mobile" value={admission.student_mobile} />
                <FieldRow label="Father mobile" value={admission.father_mobile} />
                <FieldRow label="Current address" value={admission.current_address} />
                <FieldRow label="Permanent address" value={admission.permanent_address} />
                <FieldRow label="Reference" value={admission.reference_details} />
                <FieldRow
                  label="Class time"
                  value={
                    admission.class_start_time && admission.class_end_time
                      ? `${admission.class_start_time} – ${admission.class_end_time}`
                      : null
                  }
                />
                <FieldRow label="Batch type" value={admission.batch_type} />
                <FieldRow label="Package" value={admission.package} />
                <FieldRow
                  label="Join date"
                  value={
                    admission.join_date
                      ? new Date(`${admission.join_date}T00:00:00`).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : null
                  }
                />
                <FieldRow label="Aadhaar images" value={admission.aadhaar_card_urls?.length || null} />
                <FieldRow label="Language" value={admission.preferred_language} />
                <FieldRow
                  label="Submitted"
                  value={new Date(admission.submitted_at).toLocaleString('en-IN')}
                />
              </dl>
            </div>

            <div className="space-y-4">
              {photoUrl && (
                <div className="bg-white rounded-xl border border-ink/8 p-4">
                  <p className="text-xs font-bold uppercase text-ink-soft mb-2">Photo</p>
                  <img src={photoUrl} alt="" className="w-full rounded-lg border border-ink/10" />
                </div>
              )}
              {signatureUrl && (
                <div className="bg-white rounded-xl border border-ink/8 p-4">
                  <p className="text-xs font-bold uppercase text-ink-soft mb-2">Signature</p>
                  <img src={signatureUrl} alt="" className="w-full rounded-lg border border-ink/10 bg-white" />
                </div>
              )}
              {aadhaarUrls.length > 0 && (
                <div className="bg-white rounded-xl border border-ink/8 p-4">
                  <p className="text-xs font-bold uppercase text-ink-soft mb-3">Aadhaar images</p>
                  <div className="grid grid-cols-1 gap-3">
                    {aadhaarUrls.map((url, index) => (
                      <img
                        key={url}
                        src={url}
                        alt={`Aadhaar ${index + 1}`}
                        className="w-full rounded-lg border border-ink/10 bg-white"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 bg-white rounded-xl border border-ink/8 p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Fee installments</h2>
              {canEdit && (
                <button type="button" className="btn-secondary !text-xs !py-2" onClick={handleAddInstallment}>
                  Add row
                </button>
              )}
            </div>

            {installments.length === 0 ? (
              <p className="text-sm text-ink-soft">
                {canEdit
                  ? 'No installments recorded yet. Add rows as payments are collected.'
                  : 'No installments recorded yet.'}
              </p>
            ) : canEdit ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-ink-soft border-b border-ink/10">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Received by</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((row) => (
                      <tr key={row.id} className="border-b border-ink/5">
                        <td className="py-2 pr-3">
                          <input
                            type="date"
                            value={row.installment_date ?? ''}
                            onChange={(e) => handleInstallmentChange(row.id, 'installment_date', e.target.value)}
                            onBlur={(e) =>
                              saveInstallment({ ...row, installment_date: e.target.value })
                            }
                            className="border border-ink/15 rounded-lg px-2 py-1.5 text-sm w-full min-w-[130px]"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.amount ?? ''}
                            onChange={(e) => handleInstallmentChange(row.id, 'amount', e.target.value)}
                            onBlur={(e) =>
                              saveInstallment({ ...row, amount: e.target.value })
                            }
                            className="border border-ink/15 rounded-lg px-2 py-1.5 text-sm w-full min-w-[100px]"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="text"
                            value={row.received_by ?? ''}
                            onChange={(e) => handleInstallmentChange(row.id, 'received_by', e.target.value)}
                            onBlur={(e) =>
                              saveInstallment({ ...row, received_by: e.target.value })
                            }
                            className="border border-ink/15 rounded-lg px-2 py-1.5 text-sm w-full min-w-[120px]"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeInstallment(row.id)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-ink-soft border-b border-ink/10">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2">Received by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((row) => (
                      <tr key={row.id} className="border-b border-ink/5">
                        <td className="py-2 pr-3">{row.installment_date || '—'}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {row.amount != null ? `₹${row.amount}` : '—'}
                        </td>
                        <td className="py-2">{row.received_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Modal open={pdfOpen} onClose={() => setPdfOpen(false)} title="Admission PDF" size="xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="inline-flex rounded-xl border border-ink/10 bg-sand p-1">
                <button
                  type="button"
                  onClick={() => setPdfLanguage('en')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                    pdfLanguage === 'en' ? 'bg-maroon text-ivory' : 'text-ink-soft'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setPdfLanguage('gu')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                    pdfLanguage === 'gu' ? 'bg-maroon text-ivory' : 'text-ink-soft'
                  }`}
                >
                  ગુજરાતી
                </button>
              </div>
              <button
                type="button"
                className="btn-primary !text-xs !py-2"
                disabled={downloading}
                onClick={async () => {
                  await download()
                  showToast('PDF downloaded', { type: 'success' })
                }}
              >
                {downloading ? 'Generating PDF…' : 'Download PDF'}
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-sand rounded-xl p-4">
              <AdmissionPrintDocument
                admission={admission}
                installments={installments}
                language={pdfLanguage}
                photoUrl={photoUrl}
                aadhaarUrls={aadhaarUrls}
                signatureUrl={signatureUrl}
              />
            </div>
          </Modal>

          <ConfirmDialog
            open={confirmDelete}
            onClose={() => !deleting && setConfirmDelete(false)}
            onConfirm={handleDelete}
            title="Delete admission"
            description={`Permanently delete form #${admission.form_number ?? ''} for ${admission.student_name}? This cannot be undone.`}
            confirmLabel="Delete"
            loading={deleting}
          />
        </>
      )}
    </AdmissionPdfExport>
  )
}

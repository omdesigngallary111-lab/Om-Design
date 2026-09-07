import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Seo from '../../components/Seo.jsx'
import Alert from '../../components/admin/Alert.jsx'
import PageHeader from '../../components/admin/PageHeader.jsx'
import { IconArrowLeft } from '../../components/admin/icons.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { fetchAdmissionById, updateAdmission } from '../../lib/admin.js'

const BATCH_TYPES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const STATUS_OPTIONS = ['pending', 'reviewed', 'enrolled', 'rejected']
const MOBILE_RE = /^[6-9]\d{9}$/

const inputClass =
  'w-full border border-ink/12 rounded-xl px-4 py-3 text-sm bg-white transition-all duration-150 focus:outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/10'

/**
 * Admin-only edit of admission text fields and status.
 * Photos / signature / Aadhaar are not replaced here — recreate if assets must change.
 */
export default function AdmissionEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)

  useEffect(() => {
    let active = true
    fetchAdmissionById(id).then(({ admission, error: err }) => {
      if (!active) return
      if (err || !admission) {
        setError(err || 'Admission not found')
        setLoading(false)
        return
      }
      setForm({
        student_name: admission.student_name || '',
        student_mobile: admission.student_mobile || '',
        father_mobile: admission.father_mobile || '',
        current_address: admission.current_address || '',
        permanent_address: admission.permanent_address || '',
        reference_details: admission.reference_details || '',
        class_start_time: admission.class_start_time || '',
        class_end_time: admission.class_end_time || '',
        batch_type: admission.batch_type || '',
        package: admission.package || '',
        join_date: admission.join_date || '',
        preferred_language: admission.preferred_language === 'en' ? 'en' : 'gu',
        status: admission.status || 'pending',
        form_number: admission.form_number,
      })
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form) return

    if (!form.student_name.trim()) {
      showToast('Student name is required.', { type: 'error' })
      return
    }
    if (!MOBILE_RE.test(form.student_mobile)) {
      showToast('Enter a valid 10-digit student mobile.', { type: 'error' })
      return
    }
    if (form.father_mobile && !MOBILE_RE.test(form.father_mobile)) {
      showToast('Enter a valid 10-digit father mobile, or leave blank.', { type: 'error' })
      return
    }

    setSaving(true)
    const { admission, error: err } = await updateAdmission(id, {
      student_name: form.student_name.trim(),
      student_mobile: form.student_mobile.trim(),
      father_mobile: form.father_mobile.trim() || null,
      current_address: form.current_address.trim(),
      permanent_address: form.permanent_address.trim(),
      reference_details: form.reference_details.trim() || null,
      class_start_time: form.class_start_time || null,
      class_end_time: form.class_end_time || null,
      batch_type: form.batch_type || null,
      package: form.package.trim() || null,
      join_date: form.join_date || null,
      preferred_language: form.preferred_language,
      status: form.status,
    })
    setSaving(false)

    if (err) {
      showToast(err, { type: 'error' })
      return
    }

    showToast('Admission updated', { type: 'success' })
    navigate(`/admin/admissions/${admission.id}`, { replace: true })
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center" role="status">
        <div className="w-8 h-8 border-2 border-maroon/30 border-t-maroon rounded-full animate-spin" />
      </div>
    )
  }

  if (!form) {
    return (
      <>
        <Seo title="Edit admission" noIndex />
        <Alert>{error || 'Admission not found'}</Alert>
        <Link to="/admin/admissions" className="text-sm font-semibold text-maroon mt-4 inline-flex">
          Back to admissions
        </Link>
      </>
    )
  }

  return (
    <div>
      <Seo title={`Edit admission #${form.form_number ?? ''}`} noIndex />
      <Link
        to={`/admin/admissions/${id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-maroon mb-4"
      >
        <IconArrowLeft className="w-4 h-4" /> Back to admission
      </Link>

      <PageHeader
        title="Edit admission"
        description={`Form #${form.form_number ?? '—'} — text fields and status. Photos are unchanged.`}
      />

      <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
        <div className="bg-white rounded-xl border border-ink/8 p-5 space-y-4">
          <div>
            <label className="admin-label" htmlFor="student_name">Student name</label>
            <input
              id="student_name"
              className={inputClass}
              value={form.student_name}
              onChange={(e) => setField('student_name', e.target.value)}
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label" htmlFor="student_mobile">Student mobile</label>
              <input
                id="student_mobile"
                className={inputClass}
                value={form.student_mobile}
                onChange={(e) => setField('student_mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
            </div>
            <div>
              <label className="admin-label" htmlFor="father_mobile">Father mobile</label>
              <input
                id="father_mobile"
                className={inputClass}
                value={form.father_mobile}
                onChange={(e) => setField('father_mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>
          </div>
          <div>
            <label className="admin-label" htmlFor="current_address">Current address</label>
            <textarea
              id="current_address"
              rows={3}
              className={inputClass}
              value={form.current_address}
              onChange={(e) => setField('current_address', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="admin-label" htmlFor="permanent_address">Permanent address</label>
            <textarea
              id="permanent_address"
              rows={3}
              className={inputClass}
              value={form.permanent_address}
              onChange={(e) => setField('permanent_address', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="admin-label" htmlFor="reference_details">Reference</label>
            <textarea
              id="reference_details"
              rows={2}
              className={inputClass}
              value={form.reference_details}
              onChange={(e) => setField('reference_details', e.target.value)}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label" htmlFor="class_start_time">Class start</label>
              <input
                id="class_start_time"
                type="time"
                className={inputClass}
                value={form.class_start_time}
                onChange={(e) => setField('class_start_time', e.target.value)}
              />
            </div>
            <div>
              <label className="admin-label" htmlFor="class_end_time">Class end</label>
              <input
                id="class_end_time"
                type="time"
                className={inputClass}
                value={form.class_end_time}
                onChange={(e) => setField('class_end_time', e.target.value)}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label" htmlFor="batch_type">Batch type</label>
              <select
                id="batch_type"
                className={inputClass}
                value={form.batch_type}
                onChange={(e) => setField('batch_type', e.target.value)}
              >
                <option value="">—</option>
                {BATCH_TYPES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label" htmlFor="package">Package</label>
              <input
                id="package"
                className={inputClass}
                value={form.package}
                onChange={(e) => setField('package', e.target.value)}
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label" htmlFor="join_date">Join date</label>
              <input
                id="join_date"
                type="date"
                className={inputClass}
                value={form.join_date}
                onChange={(e) => setField('join_date', e.target.value)}
              />
            </div>
            <div>
              <label className="admin-label" htmlFor="preferred_language">Language</label>
              <select
                id="preferred_language"
                className={inputClass}
                value={form.preferred_language}
                onChange={(e) => setField('preferred_language', e.target.value)}
              >
                <option value="gu">Gujarati</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label" htmlFor="status">Status</label>
              <select
                id="status"
                className={inputClass}
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-admin" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <Link to={`/admin/admissions/${id}`} className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

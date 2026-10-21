/** Shared admission form options (New + Edit). */
export const BATCH_TYPES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'Full Time']

/** Same admission form; each type has its own form-number series (assigned on save). */
export const ADMISSION_TYPES = [
  {
    id: 'student',
    label: 'Student',
    detail: 'Class admission for a student.',
  },
  {
    id: 'sketcher',
    label: 'Sketcher',
    detail: 'Admission for a sketcher.',
  },
  {
    id: 'emcad',
    label: 'Emcad',
    detail: 'Admission for Emcad.',
  },
]

export function admissionTypeLabel(type) {
  return ADMISSION_TYPES.find((row) => row.id === type)?.label || 'Student'
}

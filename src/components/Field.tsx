import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  error?: string
  full?: boolean
  children: ReactNode
}

export default function Field({ label, error, full = false, children }: FieldProps) {
  return (
    <div className={full ? 'field field-full' : 'field'}>
      <label className="field-label">{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}
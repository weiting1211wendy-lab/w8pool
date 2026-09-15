import CopyButton from './CopyButton'
import EditableText from './EditableText'

interface ProfileFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  readOnly?: boolean
}

export default function ProfileField({
  label,
  value,
  onChange,
  multiline,
  readOnly,
}: ProfileFieldProps) {
  return (
    <div className="profile-field">
      <div className="profile-field-head">
        <span className="profile-field-label">{label}</span>
        <CopyButton getText={() => value} className="copy-btn-inline" />
      </div>
      <EditableText
        value={value}
        onChange={onChange}
        multiline={multiline}
        readOnly={readOnly}
      />
    </div>
  )
}

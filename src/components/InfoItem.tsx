interface InfoItemProps {
  label: string
  value: string
  multiline?: boolean
}

export default function InfoItem({ label, value, multiline = false }: InfoItemProps) {
  if (!value) return null
  return (
    <div className="info-item">
      <div className="info-label">{label}</div>
      <div className={multiline ? 'info-value multiline' : 'info-value'}>{value}</div>
    </div>
  )
}
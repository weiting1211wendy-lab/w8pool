import CustomFieldsEditor from './CustomFieldsEditor'
import type { CustomField } from '../../types'

interface CustomFieldsBlockProps {
  items: CustomField[]
  onChange: (items: CustomField[]) => void
  readOnly: boolean
}

export default function CustomFieldsBlock({
  items,
  onChange,
  readOnly,
}: CustomFieldsBlockProps) {
  if (readOnly && items.length === 0) return null
  return (
    <div className="profile-sublist">
      {!readOnly && (
        <span className="profile-sublist-label">自定义字段</span>
      )}
      <CustomFieldsEditor items={items} onChange={onChange} readOnly={readOnly} />
    </div>
  )
}

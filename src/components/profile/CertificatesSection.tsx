import { useState } from 'react'
import CustomFieldsBlock from './CustomFieldsBlock'
import SectionCard from './SectionCard'
import SimpleListEditor from './SimpleListEditor'
import { bulletLines, customFieldsText, joinSection } from './serialize'
import type { CustomField, TextItem } from '../../types'

interface CertificatesSectionProps {
  items: TextItem[]
  onChange: (items: TextItem[]) => void
  customFields: CustomField[]
  onCustomFieldsChange: (items: CustomField[]) => void
}

export default function CertificatesSection({
  items,
  onChange,
  customFields,
  onCustomFieldsChange,
}: CertificatesSectionProps) {
  const [editing, setEditing] = useState(false)
  const readOnly = !editing
  const copyText = () =>
    joinSection(bulletLines(items), customFieldsText(customFields))

  return (
    <SectionCard
      title="证书"
      copyText={copyText}
      readOnly={readOnly}
      actions={
        <button
          type="button"
          className="btn btn-outline btn-sm section-edit-btn"
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? '保存' : '编辑'}
        </button>
      }
    >
      {items.length === 0 && readOnly && (
        <p className="page-desc">暂无证书。</p>
      )}
      <SimpleListEditor
        items={items}
        onChange={onChange}
        addPlaceholder="添加证书，如法律职业资格证"
        readOnly={readOnly}
      />
      <CustomFieldsBlock
        items={customFields}
        onChange={onCustomFieldsChange}
        readOnly={readOnly}
      />
    </SectionCard>
  )
}

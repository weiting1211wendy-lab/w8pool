import { useState } from 'react'
import CopyButton from './CopyButton'
import CustomFieldsBlock from './CustomFieldsBlock'
import EditableText from './EditableText'
import SectionCard from './SectionCard'
import SimpleListEditor from './SimpleListEditor'
import { useDragSort } from './useDragSort'
import { customFieldsText, joinSection, skillCategoryText } from './serialize'
import { generateId } from '../../utils/helpers'
import type { CustomField, SkillCategory } from '../../types'

interface SkillsSectionProps {
  items: SkillCategory[]
  onChange: (items: SkillCategory[]) => void
  customFields: CustomField[]
  onCustomFieldsChange: (items: CustomField[]) => void
}

export default function SkillsSection({
  items,
  onChange,
  customFields,
  onCustomFieldsChange,
}: SkillsSectionProps) {
  const [editing, setEditing] = useState(false)
  const readOnly = !editing
  const { dragStart, dragOver, dragEnd } = useDragSort(items, onChange)

  const addCategory = () =>
    onChange([
      ...items,
      { id: generateId(), name: '', skills: [] },
    ])

  const updateCategory = (id: string, patch: Partial<SkillCategory>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const removeCategory = (id: string) => {
    if (!window.confirm('确认删除该技能分类？')) return
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <SectionCard
      title="专业技能"
      onAdd={addCategory}
      copyText={() =>
        joinSection(
          items.map(skillCategoryText).join('\n\n'),
          customFieldsText(customFields),
        )
      }
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
      {items.length === 0 ? (
        <p className="page-desc">
          暂无技能分类，点击「+ 新增」添加分类（如法律实务、法律科技、其他技能）。
        </p>
      ) : (
        <div className="profile-entry-list">
          {items.map((category, index) => (
            <div
              key={category.id}
              className="profile-entry"
              onDragOver={dragOver(index)}
            >
              <div className="profile-entry-head">
                {!readOnly && (
                  <span
                    className="drag-handle"
                    draggable
                    onDragStart={dragStart(index)}
                    onDragEnd={dragEnd}
                  >
                    ⋮⋮
                  </span>
                )}
                <EditableText
                  value={category.name}
                  onChange={(v) => updateCategory(category.id, { name: v })}
                  className="profile-entry-title"
                  placeholder="技能分类名称"
                  readOnly={readOnly}
                />
                <CopyButton
                  getText={() => skillCategoryText(category)}
                  label="复制本条"
                  className="copy-btn-inline"
                />
                {!readOnly && (
                  <button
                    type="button"
                    className="mini-delete"
                    onClick={() => removeCategory(category.id)}
                  >
                    删除
                  </button>
                )}
              </div>
              <SimpleListEditor
                items={category.skills}
                onChange={(skills) =>
                  updateCategory(category.id, { skills })
                }
                addPlaceholder="添加技能"
                readOnly={readOnly}
              />
            </div>
          ))}
        </div>
      )}
      <CustomFieldsBlock
        items={customFields}
        onChange={onCustomFieldsChange}
        readOnly={readOnly}
      />
    </SectionCard>
  )
}

import { useState } from 'react'
import CopyButton from './CopyButton'
import CustomFieldsBlock from './CustomFieldsBlock'
import EditableText from './EditableText'
import ProfileField from './ProfileField'
import SectionCard from './SectionCard'
import { useDragSort } from './useDragSort'
import { customFieldsText, educationEntryText, joinSection } from './serialize'
import { generateId } from '../../utils/helpers'
import type { CustomField, EducationEntry } from '../../types'

interface EducationSectionProps {
  items: EducationEntry[]
  onChange: (items: EducationEntry[]) => void
  customFields: CustomField[]
  onCustomFieldsChange: (items: CustomField[]) => void
}

export default function EducationSection({
  items,
  onChange,
  customFields,
  onCustomFieldsChange,
}: EducationSectionProps) {
  const [editing, setEditing] = useState(false)
  const readOnly = !editing
  const { dragStart, dragOver, dragEnd } = useDragSort(items, onChange)

  const addEntry = () =>
    onChange([
      ...items,
      {
        id: generateId(),
        school: '',
        schoolTag: '',
        degree: '',
        major: '',
        researchDirection: '',
        start: '',
        end: '',
        performance: '',
        notes: '',
      },
    ])

  const updateEntry = (id: string, patch: Partial<EducationEntry>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const removeEntry = (id: string) => {
    if (!window.confirm('确认删除该条教育经历？')) return
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <SectionCard
      title="教育背景"
      onAdd={addEntry}
      copyText={() =>
        joinSection(
          items.map(educationEntryText).join('\n\n'),
          customFieldsText(customFields),
        )
      }
      readOnly={readOnly}
      defaultCollapsed={false}
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
        <p className="page-desc">暂无教育经历，点击「+ 新增」开始添加。</p>
      ) : (
        <div className="profile-entry-list">
          {items.map((entry, index) => (
            <div
              key={entry.id}
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
                  value={entry.school}
                  onChange={(v) => updateEntry(entry.id, { school: v })}
                  className="profile-entry-title"
                  placeholder="学校名称"
                  readOnly={readOnly}
                />
                <CopyButton
                  getText={() => educationEntryText(entry)}
                  label="复制本条"
                  className="copy-btn-inline"
                />
                {!readOnly && (
                  <button
                    type="button"
                    className="mini-delete"
                    onClick={() => removeEntry(entry.id)}
                  >
                    删除
                  </button>
                )}
              </div>
              <div className="profile-field-grid">
                <ProfileField
                  label="学校标签"
                  value={entry.schoolTag}
                  onChange={(v) => updateEntry(entry.id, { schoolTag: v })}
                  readOnly={readOnly}
                />
                <ProfileField
                  label="学历"
                  value={entry.degree}
                  onChange={(v) => updateEntry(entry.id, { degree: v })}
                  readOnly={readOnly}
                />
                <ProfileField
                  label="专业"
                  value={entry.major}
                  onChange={(v) => updateEntry(entry.id, { major: v })}
                  readOnly={readOnly}
                />
                <ProfileField
                  label="研究方向"
                  value={entry.researchDirection}
                  onChange={(v) =>
                    updateEntry(entry.id, { researchDirection: v })
                  }
                  readOnly={readOnly}
                />
                <ProfileField
                  label="开始时间"
                  value={entry.start}
                  onChange={(v) => updateEntry(entry.id, { start: v })}
                  readOnly={readOnly}
                />
                <ProfileField
                  label="结束时间"
                  value={entry.end}
                  onChange={(v) => updateEntry(entry.id, { end: v })}
                  readOnly={readOnly}
                />
                <ProfileField
                  label="成绩/排名"
                  value={entry.performance}
                  onChange={(v) => updateEntry(entry.id, { performance: v })}
                  readOnly={readOnly}
                />
              </div>
              <ProfileField
                label="备注"
                value={entry.notes}
                onChange={(v) => updateEntry(entry.id, { notes: v })}
                multiline
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

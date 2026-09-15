import { useState } from 'react'
import CopyButton from './CopyButton'
import CustomFieldsBlock from './CustomFieldsBlock'
import EditableText from './EditableText'
import ProfileField from './ProfileField'
import SectionCard from './SectionCard'
import SimpleListEditor from './SimpleListEditor'
import { useDragSort } from './useDragSort'
import { customFieldsText, experienceEntryText, joinSection } from './serialize'
import { generateId } from '../../utils/helpers'
import type { CustomField, ExperienceEntry } from '../../types'

interface ExperienceSectionProps {
  items: ExperienceEntry[]
  onChange: (items: ExperienceEntry[]) => void
  customFields: CustomField[]
  onCustomFieldsChange: (items: CustomField[]) => void
}

export default function ExperienceSection({
  items,
  onChange,
  customFields,
  onCustomFieldsChange,
}: ExperienceSectionProps) {
  const [editing, setEditing] = useState(false)
  const readOnly = !editing
  const { dragStart, dragOver, dragEnd } = useDragSort(items, onChange)

  const addEntry = () =>
    onChange([
      ...items,
      {
        id: generateId(),
        company: '',
        companyType: '',
        department: '',
        position: '',
        start: '',
        end: '',
        bullets: [],
      },
    ])

  const updateEntry = (id: string, patch: Partial<ExperienceEntry>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const removeEntry = (id: string) => {
    if (!window.confirm('确认删除该条经历？')) return
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <SectionCard
      title="实习/工作经历"
      onAdd={addEntry}
      copyText={() =>
        joinSection(
          items.map(experienceEntryText).join('\n\n'),
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
        <p className="page-desc">暂无经历，点击「+ 新增」开始添加。</p>
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
                  value={entry.company}
                  onChange={(v) => updateEntry(entry.id, { company: v })}
                  className="profile-entry-title"
                  placeholder="单位名称"
                  readOnly={readOnly}
                />
                <CopyButton
                  getText={() => experienceEntryText(entry)}
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
                  label="单位类型"
                  value={entry.companyType}
                  onChange={(v) => updateEntry(entry.id, { companyType: v })}
                  readOnly={readOnly}
                />
                <ProfileField
                  label="部门"
                  value={entry.department}
                  onChange={(v) => updateEntry(entry.id, { department: v })}
                  readOnly={readOnly}
                />
                <ProfileField
                  label="岗位"
                  value={entry.position}
                  onChange={(v) => updateEntry(entry.id, { position: v })}
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
              </div>
              <div className="profile-sublist">
                <span className="profile-sublist-label">工作内容要点</span>
                <SimpleListEditor
                  items={entry.bullets}
                  onChange={(bullets) =>
                    updateEntry(entry.id, { bullets })
                  }
                  addPlaceholder="添加工作内容要点"
                  readOnly={readOnly}
                />
              </div>
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

import { useState } from 'react'
import CopyButton from './CopyButton'
import CustomFieldsBlock from './CustomFieldsBlock'
import EditableText from './EditableText'
import ProfileField from './ProfileField'
import SectionCard from './SectionCard'
import { useDragSort } from './useDragSort'
import { customFieldsText, joinSection, projectEntryText } from './serialize'
import { generateId } from '../../utils/helpers'
import type { CustomField, ProjectEntry } from '../../types'

interface ProjectsSectionProps {
  items: ProjectEntry[]
  onChange: (items: ProjectEntry[]) => void
  customFields: CustomField[]
  onCustomFieldsChange: (items: CustomField[]) => void
}

export default function ProjectsSection({
  items,
  onChange,
  customFields,
  onCustomFieldsChange,
}: ProjectsSectionProps) {
  const [editing, setEditing] = useState(false)
  const readOnly = !editing
  const { dragStart, dragOver, dragEnd } = useDragSort(items, onChange)

  const addEntry = () =>
    onChange([
      ...items,
      {
        id: generateId(),
        title: '',
        type: '',
        achievement: '',
        start: '',
        end: '',
        description: '',
      },
    ])

  const updateEntry = (id: string, patch: Partial<ProjectEntry>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const removeEntry = (id: string) => {
    if (!window.confirm('确认删除该项目/论文？')) return
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <SectionCard
      title="项目与研究经历"
      onAdd={addEntry}
      copyText={() =>
        joinSection(
          items.map(projectEntryText).join('\n\n'),
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
        <p className="page-desc">暂无项目/论文，点击「+ 新增」开始添加。</p>
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
                  value={entry.title}
                  onChange={(v) => updateEntry(entry.id, { title: v })}
                  className="profile-entry-title"
                  placeholder="项目/论文标题"
                  readOnly={readOnly}
                />
                <CopyButton
                  getText={() => projectEntryText(entry)}
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
                  label="类型"
                  value={entry.type}
                  onChange={(v) => updateEntry(entry.id, { type: v })}
                  readOnly={readOnly}
                />
                <ProfileField
                  label="奖项/成果"
                  value={entry.achievement}
                  onChange={(v) => updateEntry(entry.id, { achievement: v })}
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
              <ProfileField
                label="详细描述"
                value={entry.description}
                onChange={(v) => updateEntry(entry.id, { description: v })}
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

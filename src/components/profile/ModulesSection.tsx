import { useState } from 'react'
import CopyButton from './CopyButton'
import CustomFieldsBlock from './CustomFieldsBlock'
import EditableText from './EditableText'
import SectionCard from './SectionCard'
import { useDragSort } from './useDragSort'
import { customFieldsText, joinSection, profileModuleText } from './serialize'
import { generateId } from '../../utils/helpers'
import type { CustomField, ProfileModule } from '../../types'

interface ModulesSectionProps {
  items: ProfileModule[]
  onChange: (items: ProfileModule[]) => void
  customFields: CustomField[]
  onCustomFieldsChange: (items: CustomField[]) => void
}

export default function ModulesSection({
  items,
  onChange,
  customFields,
  onCustomFieldsChange,
}: ModulesSectionProps) {
  const [editing, setEditing] = useState(false)
  const readOnly = !editing
  const { dragStart, dragOver, dragEnd } = useDragSort(items, onChange)

  const addModule = () =>
    onChange([...items, { id: generateId(), title: '', content: '' }])

  const updateModule = (id: string, patch: Partial<ProfileModule>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const removeModule = (id: string) => {
    if (!window.confirm('确认删除该模块？')) return
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <SectionCard
      title="自定义模块"
      onAdd={addModule}
      copyText={() =>
        joinSection(
          items.map(profileModuleText).join('\n\n'),
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
          暂无自定义模块，可添加「语言能力」「作品链接」「个人评价」「兴趣爱好」等任意模块。
        </p>
      ) : (
        <div className="profile-entry-list">
          {items.map((module, index) => (
            <div
              key={module.id}
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
                  value={module.title}
                  onChange={(v) => updateModule(module.id, { title: v })}
                  className="profile-entry-title"
                  placeholder="模块标题"
                  readOnly={readOnly}
                />
                <CopyButton
                  getText={() => profileModuleText(module)}
                  label="复制本条"
                  className="copy-btn-inline"
                />
                {!readOnly && (
                  <button
                    type="button"
                    className="mini-delete"
                    onClick={() => removeModule(module.id)}
                  >
                    删除
                  </button>
                )}
              </div>
              <EditableText
                value={module.content}
                onChange={(v) => updateModule(module.id, { content: v })}
                multiline
                placeholder="模块内容，支持换行"
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

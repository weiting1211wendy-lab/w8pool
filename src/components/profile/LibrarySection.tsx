import { useState } from 'react'
import CopyButton from './CopyButton'
import EditableText from './EditableText'
import SectionCard from './SectionCard'
import { useDragSort } from './useDragSort'
import { generateId } from '../../utils/helpers'
import type { LibraryEntry } from '../../types'

interface LibrarySectionProps {
  items: LibraryEntry[]
  onChange: (items: LibraryEntry[]) => void
}

export default function LibrarySection({
  items,
  onChange,
}: LibrarySectionProps) {
  const [editing, setEditing] = useState(false)
  const readOnly = !editing
  const { dragStart, dragOver, dragEnd } = useDragSort(items, onChange)

  const addEntry = () =>
    onChange([...items, { id: generateId(), label: '', value: '' }])

  const updateEntry = (id: string, patch: Partial<LibraryEntry>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const removeEntry = (id: string) => {
    if (!window.confirm('确认删除该字段？')) return
    onChange(items.filter((item) => item.id !== id))
  }

  const copyText = () =>
    items
      .map((entry) =>
        [entry.label.trim(), entry.value.trim()].filter(Boolean).join('：'),
      )
      .filter(Boolean)
      .join('\n')

  return (
    <SectionCard
      title="求职资料库"
      onAdd={addEntry}
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
      <p className="page-desc">
        私密资料，仅在你编辑时可见，不在展示模式下显示。
      </p>
      {items.length === 0 ? (
        <p className="page-desc">
          暂无资料，点击「+ 新增」添加（如姓名、手机号、邮箱、当前所在地、学校、学历、专业、毕业届次、求职方向）。
        </p>
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
                <div className="library-row">
                  <EditableText
                    value={entry.label}
                    onChange={(v) => updateEntry(entry.id, { label: v })}
                    className="library-label"
                    placeholder="字段名"
                    readOnly={readOnly}
                  />
                  <EditableText
                    value={entry.value}
                    onChange={(v) => updateEntry(entry.id, { value: v })}
                    className="library-value"
                    placeholder="内容"
                    readOnly={readOnly}
                  />
                  <CopyButton getText={() => entry.value} />
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
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

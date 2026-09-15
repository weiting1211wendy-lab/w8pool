import { useState } from 'react'
import CopyButton from './CopyButton'
import EditableText from './EditableText'
import { useDragSort } from './useDragSort'
import { customFieldsText } from './serialize'
import { generateId } from '../../utils/helpers'
import type { CustomField } from '../../types'

interface CustomFieldsEditorProps {
  items: CustomField[]
  onChange: (items: CustomField[]) => void
  readOnly?: boolean
}

export default function CustomFieldsEditor({
  items,
  onChange,
  readOnly,
}: CustomFieldsEditorProps) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const { dragStart, dragOver, dragEnd } = useDragSort(items, onChange)

  const add = () => {
    const l = label.trim()
    const v = value.trim()
    if (!l && !v) {
      setError('请填写字段名或内容')
      return
    }
    onChange([...items, { id: generateId(), label: l, value: v }])
    setLabel('')
    setValue('')
    setError('')
  }

  const updateItem = (id: string, patch: Partial<CustomField>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const removeItem = (id: string) => {
    if (!window.confirm('确认删除该自定义字段？')) return
    onChange(items.filter((item) => item.id !== id))
  }

  if (readOnly && items.length === 0) return null

  return (
    <div className="custom-fields">
      {items.length > 0 && (
        <div className="custom-fields-list">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="custom-field-row"
              onDragOver={dragOver(index)}
            >
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
                value={item.label}
                onChange={(v) => updateItem(item.id, { label: v })}
                className="custom-field-label"
                placeholder="字段名"
                readOnly={readOnly}
              />
              <EditableText
                value={item.value}
                onChange={(v) => updateItem(item.id, { value: v })}
                className="custom-field-value"
                placeholder="内容"
                readOnly={readOnly}
              />
              <CopyButton getText={() => customFieldsText([item])} />
              {!readOnly && (
                <button
                  type="button"
                  className="mini-delete"
                  onClick={() => removeItem(item.id)}
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <div className="custom-fields-add">
          <input
            className="field-input"
            value={label}
            placeholder="自定义字段名"
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="field-input"
            value={value}
            placeholder="内容"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
            }}
          />
          <button type="button" className="btn btn-outline" onClick={add}>
            + 添加
          </button>
        </div>
      )}
      {error && !readOnly && <p className="form-error">{error}</p>}
    </div>
  )
}

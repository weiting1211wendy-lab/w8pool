import { useState } from 'react'
import CopyButton from './CopyButton'
import EditableText from './EditableText'
import { useDragSort } from './useDragSort'
import { generateId } from '../../utils/helpers'
import type { TextItem } from '../../types'

interface SimpleListEditorProps {
  items: TextItem[]
  onChange: (items: TextItem[]) => void
  addPlaceholder?: string
  readOnly?: boolean
}

export default function SimpleListEditor({
  items,
  onChange,
  addPlaceholder,
  readOnly,
}: SimpleListEditorProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const { dragStart, dragOver, dragEnd } = useDragSort(items, onChange)

  const add = () => {
    const value = text.trim()
    if (!value) {
      setError('请填写内容')
      return
    }
    onChange([...items, { id: generateId(), text: value }])
    setText('')
    setError('')
  }

  const updateItem = (id: string, value: string) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, text: value } : item)),
    )

  const removeItem = (id: string) => {
    if (!window.confirm('确认删除该项？')) return
    onChange(items.filter((item) => item.id !== id))
  }

  if (readOnly && items.length === 0) return null

  return (
    <div className="simple-list">
      {items.length > 0 && (
        <ul className="simple-list-items">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="simple-list-row"
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
                value={item.text}
                onChange={(value) => updateItem(item.id, value)}
                className="simple-list-text"
                readOnly={readOnly}
              />
              <CopyButton
                getText={() => item.text}
                className="copy-btn-inline"
              />
              {!readOnly && (
                <button
                  type="button"
                  className="mini-delete"
                  onClick={() => removeItem(item.id)}
                >
                  删除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="simple-list-add">
          <input
            className="field-input"
            value={text}
            placeholder={addPlaceholder || '新增一条'}
            onChange={(e) => setText(e.target.value)}
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

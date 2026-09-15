import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

interface EditableTextProps {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
  className?: string
  readOnly?: boolean
}

export default function EditableText({
  value,
  onChange,
  multiline,
  placeholder,
  className,
  readOnly,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!editing) return
    if (multiline) textareaRef.current?.focus()
    else inputRef.current?.focus()
  }, [editing, multiline])

  if (readOnly) {
    if (!value) return <span className="editable-empty">—</span>
    if (multiline) return <div className={className}>{value}</div>
    return <span className={className}>{value}</span>
  }

  const commit = () => {
    onChange(draft)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Escape') cancel()
    if (!multiline && e.key === 'Enter') commit()
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          className="field-textarea editable-field"
          rows={3}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      )
    }
    return (
      <input
        ref={inputRef}
        className="field-input editable-field"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    )
  }

  return (
    <span
      className={className ? `editable ${className}` : 'editable'}
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      title="点击编辑"
    >
      {value || (
        <span className="editable-empty">{placeholder || '未填写'}</span>
      )}
    </span>
  )
}

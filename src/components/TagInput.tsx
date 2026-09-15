import { useState } from 'react'
import type { KeyboardEvent } from 'react'

interface TagInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export default function TagInput({ values, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState('')

  const addTag = () => {
    const value = draft.trim()
    if (value && !values.includes(value)) {
      onChange([...values, value])
    }
    setDraft('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="tag-input">
      {values.map((value) => (
        <span key={value} className="tag">
          {value}
          <button
            type="button"
            className="tag-remove"
            aria-label={`删除 ${value}`}
            onClick={() => onChange(values.filter((item) => item !== value))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-input-field"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addTag}
      />
    </div>
  )
}
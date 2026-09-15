import { useState } from 'react'
import { useAppData } from '../hooks/useAppData'
import { formatDate, generateId } from '../utils/helpers'
import type { StickyNote } from '../types'

export default function StickyNotes() {
  const [rawNotes, setNotes] = useAppData('sticky-notes', [])
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const addNote = () => {
    const title = text.trim()
    if (!title) {
      setError('请填写便签内容')
      return
    }
    const now = new Date().toISOString()
    setNotes((prev) => [
      {
        id: generateId(),
        title,
        done: false,
        createdAt: now,
        updatedAt: now,
        completedAt: '',
      },
      ...(Array.isArray(prev) ? prev : []),
    ])
    setText('')
    setError('')
  }

  const toggleNote = (note: StickyNote) => {
    const now = new Date().toISOString()
    const nextDone = !note.done
    setNotes((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
        item.id === note.id
          ? {
              ...item,
              done: nextDone,
              updatedAt: now,
              completedAt: nextDone ? (item.completedAt || now) : '',
            }
          : item,
      ),
    )
  }

  const deleteNote = (note: StickyNote) => {
    if (!window.confirm('确认删除这条便签？')) return
    setNotes((prev) => (Array.isArray(prev) ? prev : []).filter((item) => item.id !== note.id))
  }

  const notes = (Array.isArray(rawNotes) ? rawNotes : []).filter(
    (note): note is StickyNote => Boolean(note && typeof note === 'object'),
  )
  const sorted = [...notes].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
  })

  return (
    <div className="card dash-card sticky-card">
      <div className="section-head">
        <h2 className="section-title">便签</h2>
        <span className="sticky-count">
          {notes.filter((note) => !note.done).length} 条待办
        </span>
      </div>
      <div className="sticky-input-row">
        <input
          className="field-input"
          value={text}
          placeholder="记录重要事项，回车添加"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addNote()
          }}
        />
        <button type="button" className="btn" onClick={addNote}>
          添加
        </button>
      </div>
      {error && <p className="sticky-error">{error}</p>}
      {sorted.length === 0 ? (
        <p className="page-desc">暂无便签。</p>
      ) : (
        <ul className="sticky-list">
          {sorted.map((note) => (
            <li key={note.id} className="sticky-item">
              <input
                type="checkbox"
                className="task-checkbox"
                checked={note.done}
                onChange={() => toggleNote(note)}
              />
              <span
                className={note.done ? 'sticky-title done' : 'sticky-title'}
              >
                {note.title}
              </span>
              <span className="sticky-time">
                {formatDate(note.createdAt)}
              </span>
              <button
                type="button"
                className="sticky-delete"
                onClick={() => deleteNote(note)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

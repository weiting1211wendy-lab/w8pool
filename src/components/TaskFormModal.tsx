import { useState } from 'react'
import type { FormEvent } from 'react'
import Field from './Field'
import { TASK_TYPES } from '../constants/taskTypes'
import { generateId } from '../utils/helpers'
import type { Task } from '../types'

interface TaskFormModalProps {
  task: Task | null
  applicationId: string
  onClose: () => void
  onSubmit: (task: Task) => void
}

export default function TaskFormModal({
  task,
  applicationId,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [taskType, setTaskType] = useState(task?.taskType ?? '其他')
  const [deadline, setDeadline] = useState(task?.deadline ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [titleError, setTitleError] = useState('')
  const [deadlineError, setDeadlineError] = useState('')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setTitleError('')
    setDeadlineError('')
    if (!title.trim()) {
      setTitleError('请填写任务标题')
      return
    }
    if (!deadline) {
      setDeadlineError('请设置目标日期')
      return
    }
    const now = new Date().toISOString()
    onSubmit({
      id: task?.id ?? generateId(),
      title: title.trim(),
      taskType,
      applicationId,
      deadline,
      done: task?.done ?? false,
      notes: notes.trim(),
      createdAt: task?.createdAt ?? now,
      updatedAt: now,
      completedAt: task?.completedAt ?? '',
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
      >
        <h2 className="section-title">{task ? '编辑任务' : '新增任务'}</h2>
        <div className="form-grid">
          <Field label="任务标题" full error={titleError}>
            <input
              className="field-input"
              value={title}
              placeholder="如：完成网申投递"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="任务类型">
            <select
              className="field-input"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
            >
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="目标日期" error={deadlineError}>
            <input
              type="date"
              className="field-input"
              value={deadline}
              required
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>
          <Field label="任务备注" full>
            <textarea
              className="field-textarea"
              rows={3}
              value={notes}
              placeholder="笔试链接、准备要点等，支持换行"
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn">
            {task ? '保存修改' : '新增任务'}
          </button>
        </div>
      </form>
    </div>
  )
}

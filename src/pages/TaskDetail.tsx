import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import TaskFormModal from '../components/TaskFormModal'
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
} from '../constants/applicationStatus'
import { sampleApplications } from '../data/sampleData'
import { useAppData } from '../hooks/useAppData'
import { useAccountApplications } from '../hooks/useAccountApplications'
import { useAppPath } from '../hooks/useAppPath'
import { updateApplicationProgress } from '../utils/progressUpdate'
import {
  addDays,
  formatDate,
  normalizeApplication,
  normalizeTask,
  today,
} from '../utils/helpers'
import type { ApplicationStatus, Task } from '../types'

const IS_DATE = /^\d{4}-\d{2}-\d{2}$/
const TASK_LIMIT_PER_JOB = 20

export default function TaskDetail() {
  const { applicationId } = useParams()
  const appPath = useAppPath()
  const [rawApplications, setApplications] = useAccountApplications(sampleApplications)
  const applications = useMemo(
    () => rawApplications.map(normalizeApplication).filter((app) => !app.deletedAt),
    [rawApplications],
  )
  const [rawTasks, setTasks] = useAppData('tasks', [])
  const tasks = useMemo(() => rawTasks.map(normalizeTask), [rawTasks])
  const [, setEvents] = useAppData('application-events', [])
  const [formState, setFormState] = useState<{
    open: boolean
    task: Task | null
  }>({ open: false, task: null })

  const app = applications.find((item) => item.id === applicationId)

  if (!app) {
    return (
      <section>
        <Link to={appPath('/tasks')} className="back-link">
          ← 返回任务集合
        </Link>
        <h1 className="page-title">未找到该岗位</h1>
        <p className="page-desc">该岗位可能已被删除。</p>
      </section>
    )
  }

  const appTasks = tasks.filter((task) => task.applicationId === app.id)
  const sorted = [...appTasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done) return b.completedAt.localeCompare(a.completedAt)
    const aKey = IS_DATE.test(a.deadline) ? a.deadline : '9999-12-31'
    const bKey = IS_DATE.test(b.deadline) ? b.deadline : '9999-12-31'
    if (aKey !== bKey) return aKey.localeCompare(bKey)
    return a.createdAt.localeCompare(b.createdAt)
  })

  const todayStr = today()
  const in3 = addDays(new Date(), 3)

  const updateProgress = (toStatus: ApplicationStatus) => {
    updateApplicationProgress(app, toStatus, setApplications, setEvents)
  }

  const toggleDone = (task: Task) => {
    const now = new Date().toISOString()
    const nextDone = !task.done
    const updated: Task = {
      ...task,
      done: nextDone,
      updatedAt: now,
      completedAt: nextDone ? (task.completedAt || now) : '',
    }
    setTasks((prev) =>
      prev.map((item) => (item.id === task.id ? updated : item)),
    )
  }

  const handleSubmitTask = (task: Task) => {
    setTasks((prev) => {
      const exists = prev.some((item) => item.id === task.id)
      if (!exists && prev.filter((item) => item.applicationId === app.id).length >= TASK_LIMIT_PER_JOB) {
        window.alert(`单个岗位最多创建 ${TASK_LIMIT_PER_JOB} 个任务。`)
        return prev
      }
      return exists
        ? prev.map((item) => (item.id === task.id ? task : item))
        : [...prev, task]
    })
    setFormState({ open: false, task: null })
  }

  const handleDelete = (task: Task) => {
    if (!window.confirm('确认删除该任务？')) return
    setTasks((prev) => prev.filter((item) => item.id !== task.id))
  }

  return (
    <section>
      <Link to={appPath('/tasks')} className="back-link">
        ← 返回任务集合
      </Link>

      <div className="detail-header">
        <div>
          <h1 className="page-title">
            {app.companyName} · {app.jobTitle}
          </h1>
          <div className="detail-header-meta">
            <StatusBadge status={app.applicationStatus} />
            <Link
              to={`${appPath(`/applications/${app.id}`)}?nb`}
              className="link-btn"
              target={window.innerWidth > 767 ? '_blank' : undefined}
            >
              查看岗位详情 →
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (appTasks.length >= TASK_LIMIT_PER_JOB) {
              window.alert(`单个岗位最多创建 ${TASK_LIMIT_PER_JOB} 个任务。`)
              return
            }
            setFormState({ open: true, task: null })
          }}
        >
          + 新增任务
        </button>
      </div>

      <div className="card status-update">
        <h2 className="section-title">求职进度</h2>
        <p className="page-desc">
          手动点选该岗位当前的求职进度，将同步更新投递状态与实际投递日期（选「已投递」时填写当天）并写入时间线。
        </p>
        <div className="status-options">
          {APPLICATION_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={
                status === app.applicationStatus
                  ? 'status-btn active'
                  : 'status-btn'
              }
              disabled={status === app.applicationStatus}
              onClick={() => updateProgress(status)}
            >
              {APPLICATION_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          该岗位还没有任务。
          点击「+ 新增任务」为该岗位创建任务。
        </div>
      ) : (
        <ul className="task-list">
          {sorted.map((task) => {
            const isOverdue =
              !task.done &&
              IS_DATE.test(task.deadline) &&
              task.deadline < todayStr
            const isDueSoon =
              !task.done &&
              IS_DATE.test(task.deadline) &&
              task.deadline >= todayStr &&
              task.deadline <= in3
            return (
              <li key={task.id} className={`task-item${isOverdue ? ' task-item-overdue' : ''}${isDueSoon ? ' task-item-soon' : ''}${task.done ? ' task-item-done' : ''}`}>
                <input
                  type="checkbox"
                  className="task-checkbox"
                  checked={task.done}
                  onChange={() => toggleDone(task)}
                />
                <div className="task-main">
                  <div className="task-head">
                    <span
                      className={task.done ? 'task-title done' : 'task-title'}
                    >
                      {task.title}
                    </span>
                    <span className="task-type-badge">{task.taskType}</span>
                    {isOverdue && (
                      <span className="urgent-tag urgent-overdue">已过期</span>
                    )}
                    {isDueSoon && (
                      <span className="urgent-tag urgent-soon">临近目标日期</span>
                    )}
                  </div>
                  <div className="task-meta">
                    <span
                      className={
                        isOverdue
                          ? 'task-deadline deadline-overdue'
                          : isDueSoon
                            ? 'task-deadline deadline-soon'
                            : 'task-deadline'
                      }
                    >
                      目标日期：{task.deadline || '未设置'}
                    </span>
                    {task.done && task.completedAt && (
                      <span className="task-completed">
                        完成于 {formatDate(task.completedAt)}
                      </span>
                    )}
                  </div>
                  {task.notes && <div className="task-notes">{task.notes}</div>}
                </div>
                <div className="task-actions">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setFormState({ open: true, task })}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-danger"
                    onClick={() => handleDelete(task)}
                  >
                    删除
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {formState.open && (
        <TaskFormModal
          task={formState.task}
          applicationId={app.id}
          onClose={() => setFormState({ open: false, task: null })}
          onSubmit={handleSubmitTask}
        />
      )}
    </section>
  )
}

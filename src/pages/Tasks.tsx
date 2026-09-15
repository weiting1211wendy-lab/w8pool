import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { sampleApplications } from '../data/sampleData'
import { useAppData } from '../hooks/useAppData'
import { useAccountApplications } from '../hooks/useAccountApplications'
import { useAppPath } from '../hooks/useAppPath'
import {
  addDays,
  normalizeApplication,
  normalizeTask,
} from '../utils/helpers'
import type { Application, ApplicationStatus } from '../types'
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
} from '../constants/applicationStatus'

const IS_DATE = /^\d{4}-\d{2}-\d{2}$/

interface Collection {
  app: Application
  totalTasks: number
  doneCount: number
  pendingCount: number
  earliestDeadline: string
  pendingTasks: Array<{ title: string; deadline: string }>
}

function renderPriority(app: Application) {
  if (!app.priority) return <span className="priority-stars priority-none">—</span>
  return (
    <span className="priority-stars" title={`Priority ${app.priority}/5`}>
      {'★'.repeat(app.priority)}
    </span>
  )
}

export default function Tasks() {
  const appPath = useAppPath()
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'ddl' | 'priority'>('ddl')
  const [progressFilter, setProgressFilter] = useState<ApplicationStatus | ''>('')
  const in3 = addDays(new Date(), 3)
  const in7 = addDays(new Date(), 7)
  const [rawApplications] = useAccountApplications(sampleApplications)
  const applications = useMemo(
    () => rawApplications.map(normalizeApplication).filter((app) => !app.deletedAt),
    [rawApplications],
  )
  const [rawTasks] = useAppData('tasks', [])
  const tasks = useMemo(() => rawTasks.map(normalizeTask), [rawTasks])

  const collections: Collection[] = applications
    .filter((app) => app.screeningStatus === 'selected')
    .map((app) => {
      const appTasks = tasks.filter((task) => task.applicationId === app.id)
      const totalTasks = appTasks.length
      const doneCount = appTasks.filter((task) => task.done).length
      const pendingCount = totalTasks - doneCount
      const pendingTasks = appTasks
        .filter((task) => !task.done)
        .map((task) => ({ title: task.title, deadline: task.deadline }))
      const pendingDeadlines = appTasks
        .filter((task) => !task.done && IS_DATE.test(task.deadline))
        .map((task) => task.deadline)
        .sort()
      return {
        app,
        totalTasks,
        doneCount,
        pendingCount,
        earliestDeadline: pendingDeadlines[0] ?? '9999-12-31',
        pendingTasks,
      }
    })

  const filtered = collections.filter((c) => {
    if (progressFilter && c.app.applicationStatus !== progressFilter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      c.app.companyName.toLowerCase().includes(q) ||
      c.app.jobTitle.toLowerCase().includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'priority') {
      if (a.app.priority !== b.app.priority) {
        return b.app.priority - a.app.priority
      }
      return a.earliestDeadline.localeCompare(b.earliestDeadline)
    }
    if (a.earliestDeadline !== b.earliestDeadline) {
      return a.earliestDeadline.localeCompare(b.earliestDeadline)
    }
    if (a.pendingCount !== b.pendingCount) {
      return b.pendingCount - a.pendingCount
    }
    return a.app.companyName.localeCompare(b.app.companyName)
  })

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': collections.length }
    for (const c of collections) {
      const s = c.app.applicationStatus
      counts[s] = (counts[s] ?? 0) + 1
    }
    return counts
  }, [collections])

  const companyGroups = useMemo(() => {
    const groups = new Map<string, Collection[]>()
    for (const item of sorted) {
      const company = item.app.companyName || '未命名企业'
      const group = groups.get(company) ?? []
      group.push(item)
      groups.set(company, group)
    }
    return [...groups.entries()].map(([company, items]) => ({ company, items }))
  }, [sorted])

  const taskSummary = useMemo(() => ({
    companies: new Set(collections.map((item) => item.app.companyName || '未命名企业')).size,
    positions: collections.length,
    tasks: collections.reduce((total, item) => total + item.totalTasks, 0),
  }), [collections])

  return (
    <section>
      <div className="toolbar">
        <div>
          <h1 className="page-title">我的任务</h1>
          <p className="page-desc">
            决定推进的岗位将自动创建母任务卡片，点击卡片可进行子任务的创建与管理。
          </p>
        </div>
      </div>

      <div className="task-summary" aria-label="任务汇总">
        <div className="task-summary-item"><span>目标企业</span><strong>{taskSummary.companies}</strong><em>家</em></div>
        <div className="task-summary-item"><span>推进岗位</span><strong>{taskSummary.positions}</strong><em>个</em></div>
        <div className="task-summary-item"><span>全部任务</span><strong>{taskSummary.tasks}</strong><em>项</em></div>
      </div>

      {collections.length === 0 ? (
        <div className="empty-state">
          还没有任务集合。到我的岗位池详情页把岗位标记为「决定推进」，即可在此为该岗位创建和管理任务。
        </div>
      ) : (
        <>
          <div className="result-bar">
            <span className="result-left">
              <input
                className="field-input"
                value={query}
                placeholder="搜索企业名称 / 岗位名称"
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
            <span className="result-actions">
              <span className="result-select-label">排序</span>
              <select
                className="field-input filter-select"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as 'ddl' | 'priority')
                }
              >
                <option value="ddl">按目标日期</option>
                <option value="priority">按 Priority</option>
              </select>
            </span>
          </div>

          <div className="view-tabs" role="tablist">
            <button
              type="button"
              className={`view-tab ${progressFilter === '' ? 'active' : ''}`}
              onClick={() => setProgressFilter('')}
            >
              全部 · {statusCounts[''] ?? 0}
            </button>
            {APPLICATION_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`view-tab ${progressFilter === s ? 'active' : ''}`}
                onClick={() => setProgressFilter(progressFilter === s ? '' : s)}
              >
                {APPLICATION_STATUS_LABELS[s]} · {statusCounts[s] ?? 0}
              </button>
            ))}
          </div>

          {sorted.length === 0 ? (
            <div className="empty-state">
              没有符合检索条件的任务集合。
            </div>
          ) : (
            <div className="company-task-groups">
              {companyGroups.map(({ company, items }) => (
                <section className="company-task-group" key={company}>
                  <div className="company-task-group-head">
                    <h2>{company}</h2>
                    <span>{items.length} 个岗位任务</span>
                  </div>
                  <div className="collection-list">
              {items.map(({ app, totalTasks, doneCount, pendingCount, pendingTasks }) => {
                const pct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0
                return (
                <Link
                  key={app.id}
                  to={`${appPath(`/tasks/${app.id}`)}?nb`}
                  className="collection-card"
                  target={window.innerWidth > 767 ? '_blank' : undefined}
                >
                  <div className="collection-main">
                    <div className="collection-title">
                      {app.companyName} · {app.jobTitle}
                    </div>
                    <div className="collection-meta">
                      <span className="collection-location">
                        {app.location || '—'}
                      </span>
                      <StatusBadge status={app.applicationStatus} />
                      <span className="collection-priority">
                        {renderPriority(app)}
                      </span>
                    </div>
                  </div>
                  <div className="collection-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{width: `${pct}%`}} />
                    </div>
                    <div className="collection-stats-row">
                      <span className="stat-done">已完成 {doneCount}</span>
                      <span className="stat-pending">待完成 {pendingCount}</span>
                    </div>
                  </div>
                  {pendingTasks.length > 0 && (
                    <ul className="pending-tasks-list">
                      {pendingTasks.map((t, i) => {
                        const isUrgent = IS_DATE.test(t.deadline) && t.deadline <= in3
                        const isSoon = IS_DATE.test(t.deadline) && t.deadline <= in7
                        return (
                        <li key={i} className={isUrgent ? 'pending-task-row pending-task-urgent' : isSoon ? 'pending-task-row pending-task-soon' : 'pending-task-row'}>
                          <span className="pending-task-name">{t.title}</span>
                          <span className={`pending-task-ddl ddl-deadline ${isUrgent ? 'ddl-urgent' : isSoon ? 'ddl-soon' : ''}`}>{IS_DATE.test(t.deadline) ? t.deadline : '—'}</span>
                        </li>
                      )})}
                    </ul>
                  )}
                </Link>
              )})}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

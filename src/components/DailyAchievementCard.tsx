import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMode } from '../hooks/useMode'
import { useAppData } from '../hooks/useAppData'
import { useAccountApplications } from '../hooks/useAccountApplications'
import { useAppPath } from '../hooks/useAppPath'
import { sampleApplications } from '../data/sampleData'
import { normalizeApplication, normalizeTask, today } from '../utils/helpers'
import type { Task } from '../types'

interface AchievementDetail {
  id: string
  type: string
  targetType: string
  targetId: string | null
  targetTitle: string | null
  summary: string
  metadata: Record<string, unknown>
  createdAt: string
}

interface AchievementSummary {
  addedJobs: number
  importedJobs: number
  sharedJobs: number
  screeningActions: number
  progressUpdates: number
  completedTasks: number
  noteOrTagUpdates: number
  totalActions: number
}

interface CalendarDay {
  date: string
  totalActions: number
  addedJobs: number
  completedTasks: number
}

interface CalendarScheduleState {
  total: number
  pending: number
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const STAT_CONFIG = [
  { key: 'addedJobs', label: '新增岗位', type: 'job-created' },
  { key: 'screeningActions', label: '筛选动作', type: 'job-screening-changed' },
  { key: 'progressUpdates', label: '更新进度', type: 'job-progress-changed' },
  { key: 'sharedJobs', label: '主动共享', type: 'job-shared-to-group' },
  { key: 'noteOrTagUpdates', label: '备注/标签/星级', type: 'job-note-updated' },
] as const

const SCREENING_LABELS: Record<string, string> = {
  to_review: '待筛选',
  maybe: '待定',
  selected: '决定推进',
  skipped: '暂不考虑',
}

const PROGRESS_LABELS: Record<string, string> = {
  pending: '待投递',
  submitted: '已投递',
  written_test: '笔试',
  interview: '面试',
  offer: 'Offer',
  rejected: '未通过',
}

const EMPTY_HINTS: Record<string, string> = {
  'job-created': '这一天还没有新增岗位。可以通过手动录入、批量导入，或从群组岗位池纳入新的机会。',
  'job-screening-changed': '这一天还没有筛选动作。可以去我的岗位池，把岗位标记为待定、决定推进或暂不考虑。',
  'job-progress-changed': '这一天还没有更新求职进度。可以在岗位详情或任务详情中更新投递、笔试、面试等阶段。',
  'job-shared-to-group': '这一天还没有主动共享岗位。可以把适合共享的岗位汇入群组岗位池。',
  'job-note-updated': '这一天还没有维护备注、标签或星级。可以在岗位详情中补充判断依据。',
}

const DETAIL_VISIBLE_COUNT = 5
const SCHEDULE_VISIBLE_COUNT = 3

function getDayRange(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const start = new Date(year, month - 1, day, 0, 0, 0, 0)
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1, 0, 0, 0, 0)
  const end = new Date(year, month + 1, 1, 0, 0, 0, 0)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const grid: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) grid.push(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(d)
  return grid
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const PREVIEW_CALENDAR: CalendarDay[] = (() => {
  const days: CalendarDay[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = formatDate(d.getFullYear(), d.getMonth(), d.getDate())
    const hasData = i === 0 || i === 1 || i === 3 || i === 6 || i === 9
    days.push({
      date: dateStr,
      totalActions: hasData ? (i === 0 ? 32 : 3 + (i % 5)) : 0,
      addedJobs: hasData ? (i === 0 ? 11 : 1) : 0,
      completedTasks: hasData ? (i === 0 ? 2 : 0) : 0,
    })
  }
  return days
})()

const PREVIEW_DETAILS: AchievementDetail[] = [
  { id: '1', type: 'job-created', targetType: 'job', targetId: null, targetTitle: '字节跳动 · 前端开发', summary: '新增岗位：字节跳动 · 前端开发', metadata: {}, createdAt: new Date().toISOString().slice(0, 11) + '09:32:00' },
  { id: '2', type: 'job-imported', targetType: 'job', targetId: null, targetTitle: null, summary: '批量导入：新增 8 条，拦截重复 3 条', metadata: { added: 8, skipped: 3 }, createdAt: new Date().toISOString().slice(0, 11) + '10:15:00' },
  { id: '3', type: 'job-screening-changed', targetType: 'job', targetId: null, targetTitle: '晨曦律所 · 法务合规管培生', summary: '筛选状态变更：selected', metadata: { from: 'to_review', to: 'selected' }, createdAt: new Date().toISOString().slice(0, 11) + '11:20:00' },
  { id: '4', type: 'job-screening-changed', targetType: 'job', targetId: null, targetTitle: '恒正咨询 · 合规顾问助理', summary: '筛选状态变更：maybe', metadata: { from: 'to_review', to: 'maybe' }, createdAt: new Date().toISOString().slice(0, 11) + '11:42:00' },
  { id: '5', type: 'job-screening-changed', targetType: 'job', targetId: null, targetTitle: '博远资本 · 投后法务专员', summary: '筛选状态变更：selected', metadata: { from: 'to_review', to: 'selected' }, createdAt: new Date().toISOString().slice(0, 11) + '13:15:00' },
  { id: '6', type: 'job-screening-changed', targetType: 'job', targetId: null, targetTitle: '云图科技 · 知识产权专员', summary: '筛选状态变更：skipped', metadata: { from: 'to_review', to: 'skipped' }, createdAt: new Date().toISOString().slice(0, 11) + '14:05:00' },
  { id: '7', type: 'job-screening-changed', targetType: 'job', targetId: null, targetTitle: '方圆法务 · 合同管理专员', summary: '筛选状态变更：selected', metadata: { from: 'maybe', to: 'selected' }, createdAt: new Date().toISOString().slice(0, 11) + '14:20:00' },
  { id: '8', type: 'job-screening-changed', targetType: 'job', targetId: null, targetTitle: '同信银行 · 法律事务岗', summary: '筛选状态变更：maybe', metadata: { from: 'to_review', to: 'maybe' }, createdAt: new Date().toISOString().slice(0, 11) + '14:36:00' },
  { id: '9', type: 'job-progress-changed', targetType: 'job', targetId: null, targetTitle: '晨曦律所 · 法务合规管培生', summary: '进度变更：已投递', metadata: { from: 'pending', to: 'submitted' }, createdAt: new Date().toISOString().slice(0, 11) + '15:10:00' },
  { id: '10', type: 'job-note-updated', targetType: 'job', targetId: null, targetTitle: '博远资本 · 投后法务专员', summary: '更新备注：补充投递判断', metadata: {}, createdAt: new Date().toISOString().slice(0, 11) + '16:45:00' },
]

export default function DailyAchievementCard() {
  const mode = useMode()
  const appPath = useAppPath()
  const todayStr = today()
  const todayObj = new Date()
  const todayDateStr = formatDate(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate())

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const parts = todayStr.split('-')
    return { year: Number(parts[0]), month: Number(parts[1]) - 1 }
  })
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [summary, setSummary] = useState<AchievementSummary | null>(null)
  const [details, setDetails] = useState<AchievementDetail[]>([])
  const [detailLimitedMessage, setDetailLimitedMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [calModalOpen, setCalModalOpen] = useState(false)
  const [showAllBoardItems, setShowAllBoardItems] = useState(false)
  const [isMobileBoard, setIsMobileBoard] = useState(false)
  const [rawApplications] = useAccountApplications(sampleApplications)
  const applications = useMemo(
    () => rawApplications.map(normalizeApplication).filter((app) => !app.deletedAt),
    [rawApplications],
  )
  const [rawTasks, setTasks] = useAppData('tasks', [])
  const tasks = useMemo(() => rawTasks.map(normalizeTask), [rawTasks])
  const applicationMap = useMemo(() => new Map(applications.map((app) => [app.id, app])), [applications])

  const monthLabel = `${calendarMonth.year}年${calendarMonth.month + 1}月`
  const grid = useMemo(() => getMonthGrid(calendarMonth.year, calendarMonth.month), [calendarMonth])
  const calendarDayMap = useMemo(() => new Map(calendarDays.map((d) => [d.date, d])), [calendarDays])
  const scheduleDayMap = useMemo(() => {
    const map = new Map<string, CalendarScheduleState>()
    tasks.forEach((task) => {
      if (!task.deadline) return
      const current = map.get(task.deadline) ?? { total: 0, pending: 0 }
      current.total += 1
      if (!task.done) current.pending += 1
      map.set(task.deadline, current)
    })
    return map
  }, [tasks])
  const filteredDetails = useMemo(() => {
    if (!expandedType) return []
    return details.filter((d) => {
      if (expandedType === 'job-created') return d.type === 'job-created' || d.type === 'job-imported' || d.type === 'job-copied-from-group'
      if (expandedType === 'job-note-updated') return d.type === 'job-note-updated' || d.type === 'job-tags-updated' || d.type === 'job-priority-changed'
      return d.type === expandedType
    })
  }, [details, expandedType])

  const visibleDetails = showAllBoardItems || isMobileBoard ? filteredDetails : filteredDetails.slice(0, DETAIL_VISIBLE_COUNT)

  const selectedSchedule = useMemo(() => {
    return tasks
      .filter((task) => task.deadline === selectedDate && task.applicationId && applicationMap.has(task.applicationId))
      .map((task) => ({ task, app: applicationMap.get(task.applicationId!)! }))
      .sort((a, b) => Number(a.task.done) - Number(b.task.done) || a.app.companyName.localeCompare(b.app.companyName) || a.task.title.localeCompare(b.task.title))
  }, [applicationMap, selectedDate, tasks])

  const scheduleDone = selectedSchedule.filter(({ task }) => task.done).length
  const scheduleTotal = selectedSchedule.length
  const schedulePending = scheduleTotal - scheduleDone
  const visibleSchedule = showAllBoardItems || isMobileBoard ? selectedSchedule : selectedSchedule.slice(0, SCHEDULE_VISIBLE_COUNT)
  const canExpandBoard = !isMobileBoard && (filteredDetails.length > DETAIL_VISIBLE_COUNT || selectedSchedule.length > SCHEDULE_VISIBLE_COUNT)
  const isPastSelectedDate = selectedDate < todayDateStr

  const toggleScheduleTask = (task: Task) => {
    const now = new Date().toISOString()
    setTasks((prev) => prev.map((item) => {
      if (item.id !== task.id) return item
      const done = !item.done
      return { ...item, done, completedAt: done ? now : '', updatedAt: now }
    }))
  }

  const displayValue = (key: keyof AchievementSummary) => {
    if (!summary) return 0
    if (key === 'addedJobs') return summary.addedJobs + summary.importedJobs
    return summary[key]
  }

  const displayTotal = summary
    ? summary.addedJobs + summary.importedJobs + summary.sharedJobs + summary.screeningActions + summary.progressUpdates + summary.noteOrTagUpdates
    : 0

  const achievementTitle = selectedDate === todayDateStr ? '今日成就' : `${selectedDate} 成就`

  const renderDetailSummary = (detail: AchievementDetail) => {
    const from = typeof detail.metadata.from === 'string' ? detail.metadata.from : ''
    const to = typeof detail.metadata.to === 'string' ? detail.metadata.to : ''
    if (detail.type === 'job-screening-changed' && (from || to)) {
      const fromText = from ? (SCREENING_LABELS[from] ?? from) : '—'
      const toText = to ? (SCREENING_LABELS[to] ?? to) : '—'
      return `筛选：${fromText} → ${toText}`
    }
    if (detail.type === 'job-progress-changed' && (from || to)) {
      const fromText = from ? (PROGRESS_LABELS[from] ?? from) : '—'
      const toText = to ? (PROGRESS_LABELS[to] ?? to) : '—'
      return `进度：${fromText} → ${toText}`
    }
    return detail.summary
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const update = () => {
      const mobile = media.matches
      setIsMobileBoard(mobile)
      if (mobile) setShowAllBoardItems(true)
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (mode === 'preview') {
      setCalendarDays(PREVIEW_CALENDAR)
      setSummary({ addedJobs: 3, importedJobs: 8, sharedJobs: 0, screeningActions: 12, progressUpdates: 4, completedTasks: 2, noteOrTagUpdates: 3, totalActions: 32 })
      setDetails(PREVIEW_DETAILS)
      setDetailLimitedMessage('')
      return
    }
    const y = calendarMonth.year
    const m = calendarMonth.month + 1
    const monthStr = `${y}-${String(m).padStart(2, '0')}`
    const { startAt, endAt } = getMonthRange(calendarMonth.year, calendarMonth.month)
    const tzOffset = new Date().getTimezoneOffset()
    void fetch(`/api/workspace/achievements/calendar?month=${monthStr}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}&tzOffset=${tzOffset}`)
      .then(async (r) => { if (!r.ok) throw new Error(); return await r.json() as { days: CalendarDay[] } })
      .then((data) => setCalendarDays(data.days))
      .catch(() => setCalendarDays([]))
  }, [mode, calendarMonth])

  useEffect(() => {
    if (mode === 'preview') {
      if (selectedDate === todayStr) {
        setSummary({ addedJobs: 3, importedJobs: 8, sharedJobs: 0, screeningActions: 12, progressUpdates: 4, completedTasks: 2, noteOrTagUpdates: 3, totalActions: 32 })
        setDetails(PREVIEW_DETAILS)
        setDetailLimitedMessage('')
      } else {
        setSummary({ addedJobs: 0, importedJobs: 0, sharedJobs: 0, screeningActions: 0, progressUpdates: 0, completedTasks: 0, noteOrTagUpdates: 0, totalActions: 0 })
        setDetails([])
        setDetailLimitedMessage('')
      }
      return
    }
    if (selectedDate > todayDateStr) {
      setLoading(false)
      setExpandedType(null)
      setShowAllBoardItems(isMobileBoard)
      setSummary({ addedJobs: 0, importedJobs: 0, sharedJobs: 0, screeningActions: 0, progressUpdates: 0, completedTasks: 0, noteOrTagUpdates: 0, totalActions: 0 })
      setDetails([])
      setDetailLimitedMessage('')
      return
    }
    const { startAt, endAt } = getDayRange(selectedDate)
    setLoading(true)
    setExpandedType(null)
    setShowAllBoardItems(false)
    setDetailLimitedMessage('')
    void fetch(`/api/workspace/achievements?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`)
      .then(async (r) => { if (!r.ok) throw new Error(); return await r.json() as { summary: AchievementSummary; details: AchievementDetail[]; detailLimited?: boolean; message?: string } })
      .then((data) => { setSummary(data.summary); setDetails(data.details); setDetailLimitedMessage(data.detailLimited ? (data.message ?? '该日期已超过 30 天，仅保留成就汇总，不再展示详细条目。') : '') })
      .catch(() => { setSummary(null); setDetails([]); setDetailLimitedMessage('') })
      .finally(() => setLoading(false))
  }, [isMobileBoard, mode, selectedDate, todayDateStr, todayStr])

  const renderCalendar = () => (
    <>
      <div className="cal-header">
        <button type="button" className="cal-nav" onClick={() => setCalendarMonth((p) => ({ year: p.month === 0 ? p.year - 1 : p.year, month: p.month === 0 ? 11 : p.month - 1 }))}>←</button>
        <span className="cal-month">{monthLabel}</span>
        <button type="button" className="cal-nav" onClick={() => setCalendarMonth((p) => ({ year: p.month === 11 ? p.year + 1 : p.year, month: p.month === 11 ? 0 : p.month + 1 }))}>→</button>
      </div>
      <div className="cal-weekdays">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="cal-grid">
        {grid.map((day, i) => {
          if (day === null) return <span key={`e${i}`} className="cal-cell cal-empty" />
          const dateStr = formatDate(calendarMonth.year, calendarMonth.month, day)
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === todayDateStr
          const dayData = calendarDayMap.get(dateStr)
          const scheduleData = scheduleDayMap.get(dateStr)
          const hasDot = (dayData?.totalActions ?? 0) > 0 || (scheduleData?.total ?? 0) > 0
          const hasPendingSchedule = (scheduleData?.pending ?? 0) > 0
          return (
            <button
              key={dateStr}
              type="button"
              className={`cal-cell${isSelected ? ' cal-selected' : ''}${isToday ? ' cal-today' : ''}${hasDot ? ' cal-has-data' : ''}${hasPendingSchedule ? ' cal-has-pending' : ''}`}
              onClick={() => { setSelectedDate(dateStr); if (calModalOpen) setCalModalOpen(false) }}
            >
              {day}
              {hasDot && <span className="cal-dot" />}
            </button>
          )
        })}
      </div>
    </>
  )

  return (
    <div className="card dash-card achievement-card">
      <div className="achievement-layout">
        <div className="achievement-calendar ach-cal-desktop">
          {renderCalendar()}
        </div>
        <div className="achievement-detail-panel">
          <div className="ach-cal-mobile-row">
            <span className="ach-date-label">{selectedDate === todayDateStr ? '今天' : selectedDate}</span>
            <button type="button" className="btn btn-outline ach-cal-open-btn" onClick={() => setCalModalOpen(true)}>📅 日历</button>
          </div>
          <h3 className="achievement-date-title ach-date-desktop">{achievementTitle}</h3>
          {loading ? (
            <p className="page-desc">加载中…</p>
          ) : summary ? (
            <>
              <div className="achievement-stats">
                {STAT_CONFIG.map(({ key, label, type }) => (
                  <button
                    key={key}
                    type="button"
                    className={`ach-stat${expandedType === type ? ' ach-stat-active' : ''}`}
                    onClick={() => setExpandedType(expandedType === type ? null : type)}
                  >
                    <span className="ach-value">{displayValue(key)}</span>
                    <span className="ach-label">{label}</span>
                  </button>
                ))}
                <div className="ach-stat ach-total">
                  <span className="ach-value">{displayTotal}</span>
                  <span className="ach-label">累计推进</span>
                </div>
              </div>
              {detailLimitedMessage && (
                <p className="achievement-retention-hint">{detailLimitedMessage}</p>
              )}
              {displayTotal === 0 && !detailLimitedMessage && (
                <p className="page-desc achievement-empty-hint">这一天还没有记录到推进动作。可以先录入岗位、筛选机会或维护备注标签。</p>
              )}
              {expandedType && (
                <div className="achievement-detail-expand">
                  {detailLimitedMessage ? (
                    <p className="page-desc">{detailLimitedMessage}</p>
                  ) : filteredDetails.length > 0 ? (
                    <div className="achievement-timeline">
                      {visibleDetails.map((d) => (
                        <div key={d.id} className="ach-timeline-item">
                          <span className="ach-time">{d.createdAt.slice(11, 16)}</span>
                          <span className="ach-summary">
                            {d.targetTitle && <b className="ach-target-title">{d.targetTitle}</b>}
                            <span>{renderDetailSummary(d)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="page-desc">{EMPTY_HINTS[expandedType] ?? '这一天还没有对应操作。可以继续推进一个小步骤，让看板记录你的进展。'}</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="page-desc">暂时无法读取这一天的看板数据，请稍后重试。</p>
          )}
        </div>
        <div className="daily-schedule-panel">
          <div className="schedule-head">
            <div>
              <h3 className="achievement-date-title schedule-title-line">
                <span>{selectedDate === todayDateStr ? '今日日程' : `${selectedDate} 日程`}</span>
                <span className="schedule-info-wrap">
                  <button type="button" className="schedule-info-icon" aria-label="查看日程说明">?</button>
                  <span className="schedule-tooltip">如需新增日程，请前往「我的任务」创建任务，并为任务设置对应的目标日期。</span>
                </span>
              </h3>
            </div>
            <div className="schedule-count-group" aria-label="日程完成情况">
              <span className="schedule-count-chip schedule-done-chip">{scheduleDone} 已完成</span>
              <span className="schedule-count-chip schedule-pending-chip">{schedulePending} 未完成</span>
            </div>
          </div>
          {selectedSchedule.length === 0 ? (
            <p className="page-desc">这一天暂无日程。<Link className="inline-blue-link" to={appPath('/tasks')}>创建任务</Link>并设置目标日期后会自动出现在这里。</p>
          ) : (
            <div className="schedule-list">
              {visibleSchedule.map(({ task, app }) => {
                const overdue = !task.done && isPastSelectedDate
                return (
                  <div key={task.id} className={`schedule-item${task.done ? ' schedule-done' : ''}${overdue ? ' schedule-overdue' : ''}`}>
                    <input
                      type="checkbox"
                      className="task-checkbox schedule-checkbox"
                      checked={task.done}
                      onChange={() => toggleScheduleTask(task)}
                      aria-label={`完成 ${task.title}`}
                    />
                    <Link to={appPath(`/tasks/${app.id}`)} className="schedule-link">
                      <span className="schedule-job">{app.companyName} · {app.jobTitle}</span>
                      <span className="schedule-task">{task.title}</span>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      {canExpandBoard && (
        <button
          type="button"
          className="board-expand-btn"
          title={showAllBoardItems ? '收起' : '展开全部'}
          onClick={() => setShowAllBoardItems((value) => !value)}
        >
          <span>{showAllBoardItems ? '⌃ 收起' : '⌄ 展开全部'}</span>
        </button>
      )}
      {calModalOpen && (
        <div className="modal-backdrop" onClick={() => setCalModalOpen(false)}>
          <div className="modal ach-cal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="modal-title">选择日期</h2>
              <button type="button" className="modal-close" onClick={() => setCalModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              {renderCalendar()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

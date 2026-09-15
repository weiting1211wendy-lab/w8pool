import { useEffect, useMemo, useState } from 'react'
import { useMode } from '../hooks/useMode'
import { today } from '../utils/helpers'

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

interface Props {
  open: boolean
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  'job-created': '新增岗位',
  'job-imported': '批量导入',
  'job-copied-to-personal': '纳入岗位',
  'job-shared-to-group': '共享岗位',
  'job-screening-changed': '筛选变更',
  'job-progress-changed': '进度更新',
  'job-note-updated': '备注更新',
  'job-tags-updated': '标签更新',
  'job-priority-changed': '星级更新',
  'task-completed': '完成任务',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

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

const PREVIEW_DAYS: CalendarDay[] = (() => {
  const days: CalendarDay[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = formatDate(d.getFullYear(), d.getMonth(), d.getDate())
    const hasData = i === 0 || Math.random() > 0.4
    days.push({
      date: dateStr,
      totalActions: hasData ? Math.floor(Math.random() * 15) + 1 : 0,
      addedJobs: hasData ? Math.floor(Math.random() * 5) : 0,
      completedTasks: hasData ? Math.floor(Math.random() * 3) : 0,
    })
  }
  return days
})()

const PREVIEW_DETAILS: AchievementDetail[] = [
  { id: '1', type: 'job-created', targetType: 'job', targetId: null, targetTitle: '字节跳动 · 前端开发', summary: '新增岗位：字节跳动 · 前端开发', metadata: {}, createdAt: new Date().toISOString().slice(0, 11) + '09:32:00' },
  { id: '2', type: 'job-imported', targetType: 'job', targetId: null, targetTitle: null, summary: '批量导入：新增 8 条，拦截重复 3 条', metadata: { added: 8, skipped: 3 }, createdAt: new Date().toISOString().slice(0, 11) + '10:15:00' },
  { id: '3', type: 'job-screening-changed', targetType: 'job', targetId: null, targetTitle: null, summary: '筛选状态变更：selected', metadata: { from: 'to_review', to: 'selected' }, createdAt: new Date().toISOString().slice(0, 11) + '14:20:00' },
  { id: '4', type: 'task-completed', targetType: 'task', targetId: null, targetTitle: '美团法务简历调整', summary: '完成任务：美团法务简历调整', metadata: {}, createdAt: new Date().toISOString().slice(0, 11) + '16:45:00' },
]

export default function DailyAchievementModal({ open, onClose }: Props) {
  const mode = useMode()
  const todayStr = today()
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const parts = todayStr.split('-')
    return { year: Number(parts[0]), month: Number(parts[1]) - 1 }
  })
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [summary, setSummary] = useState<AchievementSummary | null>(null)
  const [details, setDetails] = useState<AchievementDetail[]>([])
  const [loading, setLoading] = useState(false)

  const monthLabel = `${calendarMonth.year}年${calendarMonth.month + 1}月`
  const grid = useMemo(() => getMonthGrid(calendarMonth.year, calendarMonth.month), [calendarMonth])

  useEffect(() => {
    if (!open) return
    if (mode === 'preview') {
      setCalendarDays(PREVIEW_DAYS)
      if (selectedDate === todayStr) {
        setSummary({ addedJobs: 3, importedJobs: 8, sharedJobs: 0, screeningActions: 12, progressUpdates: 4, completedTasks: 2, noteOrTagUpdates: 3, totalActions: 32 })
        setDetails(PREVIEW_DETAILS)
      } else {
        setSummary({ addedJobs: 0, importedJobs: 0, sharedJobs: 0, screeningActions: 0, progressUpdates: 0, completedTasks: 0, noteOrTagUpdates: 0, totalActions: 0 })
        setDetails([])
      }
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
  }, [open, mode, calendarMonth, selectedDate, todayStr])

  useEffect(() => {
    if (!open || mode === 'preview') return
    const { startAt, endAt } = getDayRange(selectedDate)
    setLoading(true)
    void fetch(`/api/workspace/achievements?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`)
      .then(async (r) => { if (!r.ok) throw new Error(); return await r.json() as { summary: AchievementSummary; details: AchievementDetail[] } })
      .then((data) => { setSummary(data.summary); setDetails(data.details) })
      .catch(() => { setSummary(null); setDetails([]) })
      .finally(() => setLoading(false))
  }, [open, mode, selectedDate])

  if (!open) return null

  const todayObj = new Date()
  const todayDateStr = formatDate(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate())
  const calendarDayMap = new Map(calendarDays.map((d) => [d.date, d]))

  const canGoNext = calendarMonth.year < todayObj.getFullYear() || (calendarMonth.year === todayObj.getFullYear() && calendarMonth.month < todayObj.getMonth())

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal achievement-modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-head">
          <h2 className="section-title">每日成就</h2>
          <button type="button" className="link-btn" onClick={onClose}>关闭</button>
        </div>
        <p className="page-desc">记录每天真正推进过的求职动作，只统计当前账户的私有操作。</p>
        <div className="achievement-layout">
          <div className="achievement-calendar">
            <div className="cal-header">
              <button type="button" className="cal-nav" onClick={() => setCalendarMonth((p) => ({ year: p.month === 0 ? p.year - 1 : p.year, month: p.month === 0 ? 11 : p.month - 1 }))}>←</button>
              <span className="cal-month">{monthLabel}</span>
              <button type="button" className="cal-nav" disabled={!canGoNext} onClick={() => setCalendarMonth((p) => ({ year: p.month === 11 ? p.year + 1 : p.year, month: p.month === 11 ? 0 : p.month + 1 }))}>→</button>
            </div>
            <div className="cal-weekdays">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
            <div className="cal-grid">
              {grid.map((day, i) => {
                if (day === null) return <span key={`e${i}`} className="cal-cell cal-empty" />
                const dateStr = formatDate(calendarMonth.year, calendarMonth.month, day)
                const isFuture = dateStr > todayDateStr
                const isSelected = dateStr === selectedDate
                const isToday = dateStr === todayDateStr
                const dayData = calendarDayMap.get(dateStr)
                const hasDot = (dayData?.totalActions ?? 0) > 0
                return (
                  <button
                    key={dateStr}
                    type="button"
                    className={`cal-cell${isSelected ? ' cal-selected' : ''}${isToday ? ' cal-today' : ''}${isFuture ? ' cal-disabled' : ''}${hasDot ? ' cal-has-data' : ''}`}
                    disabled={isFuture}
                    onClick={() => setSelectedDate(dateStr)}
                  >
                    {day}
                    {hasDot && <span className="cal-dot" />}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="achievement-detail-panel">
            <h3 className="achievement-date-title">{selectedDate === todayDateStr ? '今天' : selectedDate}</h3>
            {loading ? (
              <p className="page-desc">加载中…</p>
            ) : summary && summary.totalActions > 0 ? (
              <>
                <div className="achievement-stats">
                  <div className="ach-stat"><span className="ach-value">{summary.addedJobs}</span><span className="ach-label">新增岗位</span></div>
                  <div className="ach-stat"><span className="ach-value">{summary.screeningActions}</span><span className="ach-label">筛选动作</span></div>
                  <div className="ach-stat"><span className="ach-value">{summary.progressUpdates}</span><span className="ach-label">更新进度</span></div>
                  <div className="ach-stat"><span className="ach-value">{summary.completedTasks}</span><span className="ach-label">完成任务</span></div>
                  <div className="ach-stat"><span className="ach-value">{summary.importedJobs}</span><span className="ach-label">批量导入</span></div>
                  <div className="ach-stat"><span className="ach-value">{summary.sharedJobs}</span><span className="ach-label">主动共享</span></div>
                  <div className="ach-stat"><span className="ach-value">{summary.noteOrTagUpdates}</span><span className="ach-label">备注/标签/星级</span></div>
                  <div className="ach-stat ach-total"><span className="ach-value">{summary.totalActions}</span><span className="ach-label">累计推进</span></div>
                </div>
                <div className="achievement-timeline">
                  {details.map((d) => (
                    <div key={d.id} className="ach-timeline-item">
                      <span className="ach-time">{d.createdAt.slice(11, 16)}</span>
                      <span className="ach-type-badge">{TYPE_LABELS[d.type] ?? d.type}</span>
                      <span className="ach-summary">
                        {d.targetTitle && <b className="ach-target-title">{d.targetTitle}</b>}
                        <span>{d.summary}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="page-desc">这一天还没有记录到推进动作。</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

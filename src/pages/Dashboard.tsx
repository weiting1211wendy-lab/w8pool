import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import EditableText from '../components/profile/EditableText'
import DailyAchievementCard from '../components/DailyAchievementCard'
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
} from '../constants/applicationStatus'
import { sampleApplications } from '../data/sampleData'
import { ROBOT_JOBS } from '../data/robotJobs'
import { useAppData } from '../hooks/useAppData'
import { useAccountApplications } from '../hooks/useAccountApplications'
import { useAppPath } from '../hooks/useAppPath'
import { useAuth } from '../hooks/useAuth'
import { useMode } from '../hooks/useMode'
import {
  addDays,
  deadlineKind,
  normalizeApplication,
  normalizeTask,
  today,
} from '../utils/helpers'
import type { ApplicationStatus } from '../types'

const IS_DATE = /^\d{4}-\d{2}-\d{2}$/

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending: '#9ca3af',
  submitted: '#6d28d9',
  written_test: '#b45309',
  interview: '#7c3aed',
  offer: '#15803d',
  rejected: '#b91c1c',
}

export default function Dashboard() {
  const appPath = useAppPath()
  const { user } = useAuth()
  const mode = useMode()
  const [rawApplications] = useAccountApplications(sampleApplications)
  const applications = useMemo(
    () => rawApplications.map(normalizeApplication).filter((app) => !app.deletedAt),
    [rawApplications],
  )
  const [rawTasks] = useAppData('tasks', [])
  const tasks = useMemo(() => rawTasks.map(normalizeTask), [rawTasks])
  const [motto, setMotto] = useAppData('motto', '')

  const todayStr = today()
  const in3 = addDays(new Date(), 3)
  const in7 = addDays(new Date(), 7)
  const in15 = addDays(new Date(), 15)
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const dateLabel = `${todayStr} 星期${weekdays[new Date().getDay()]}`

  const isOverdue = (app: { deadline: string }) =>
    deadlineKind(app.deadline) === 'dated' && app.deadline < todayStr
  const pendingScreening = applications.filter(
    (app) => app.screeningStatus === 'to_review' && !isOverdue(app),
  ).length
  const selectedScreening = applications.filter(
    (app) => app.screeningStatus === 'selected',
  ).length
  const activeTasks = tasks.filter((task) => !task.done).length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
  const displayName = mode === 'preview' ? '访客' : (user?.displayName || user?.username || '你')

  const statusCounts = Object.fromEntries(
    APPLICATION_STATUSES.map((status) => [
      status,
      applications.filter((app) => app.screeningStatus === 'selected' && app.applicationStatus === status).length,
    ]),
  ) as Record<ApplicationStatus, number>

  const totalJobs = applications.filter((app) => app.screeningStatus === 'selected').length
  const upcomingDeadlines = applications
    .filter(
      (app) =>
        IS_DATE.test(app.deadline) &&
        app.deadline >= todayStr &&
        app.deadline <= in15,
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline))

  return (
    <>
    <section>
      <div className="dashboard-head">
        <h1 className="page-title">{greeting}，{displayName}</h1>
        <p className="dash-date">{dateLabel}</p>
        <p className="page-desc">今天也为理想的下一站，推进一点点。</p>
        <EditableText
          value={motto}
          onChange={(v) => setMotto(v)}
          className="dash-motto"
          placeholder="写一句心情寄语…"
        />
      </div>

      {applications.length === 0 ? (
        <div className="empty-state dashboard-empty">
          <p className="dash-empty-title">
            欢迎来到 W8Pool！
          </p>
          <p className="page-desc">
              岗位池还很安静，先录入第一条机会吧。
          </p>
          <Link to={appPath('/applications/new')} className="btn">
            + 录入第一条岗位
          </Link>
        </div>
      ) : (
        <>
          <div className="stat-grid">
            <Link to={appPath('/applications')} className="stat-card stat-hero stat-link">
              <p className="stat-label">我的岗位池</p>
              <p className="stat-value">{applications.length}</p>
            </Link>
            <Link to={appPath('/applications?view=to_review')} className="stat-card stat-purple-1 stat-link">
              <p className="stat-label">待筛选岗位</p>
              <p className="stat-value">{pendingScreening}</p>
            </Link>
            <Link to={appPath('/applications?view=selected')} className="stat-card stat-purple-2 stat-link">
              <p className="stat-label">推进岗位</p>
              <p className="stat-value">{selectedScreening}</p>
            </Link>
            <Link to={appPath('/tasks')} className="stat-card stat-purple-3 stat-link">
              <p className="stat-label">待推进事项</p>
              <p className="stat-value">{activeTasks}</p>
            </Link>
          </div>

          <DailyAchievementCard />

          <div className="dash-grid dashboard-main-row">
            <div className="card dash-card robot-dynamic-card">
              <div className="section-head">
                <h2 className="section-title">智巡岗位 Robot 动态</h2>
              </div>
              {mode === 'preview' ? (
                <>
                  <div className="robot-dyn-row">
                    <span className="robot-dyn-label">当前状态</span>
                    <b className="robot-dyn-value">已开启</b>
                  </div>
                  <div className="robot-dyn-row">
                    <span className="robot-dyn-label">最近运行</span>
                    <b className="robot-dyn-value">今日 09:00</b>
                  </div>
                  <div className="robot-dyn-row">
                    <span className="robot-dyn-label">本次待审核岗位</span>
                    <b className="robot-dyn-value">{ROBOT_JOBS.length} 条</b>
                  </div>
                </>
              ) : (
                <p className="page-desc">自动巡检外部岗位源，发现匹配岗位后进入审核池等待你确认。</p>
              )}
              <Link to={appPath('/robot')} className="btn btn-gradient robot-entry">进入智巡岗位 Robot →</Link>
            </div>
            <div className="card dash-card">
              <h2 className="section-title">投递进度</h2>
              <div className="progress-list">
                {APPLICATION_STATUSES.map((status) => {
                  const count = statusCounts[status]
                  const pct = totalJobs
                    ? Math.round((count / totalJobs) * 100)
                    : 0
                  return (
                    <div key={status} className="progress-row">
                      <span className="progress-label">
                        <span
                          className="progress-dot"
                          style={{ background: STATUS_COLORS[status] }}
                        />
                        {APPLICATION_STATUS_LABELS[status]}
                      </span>
                      <div className="progress-track">
                        <div
                          className="progress-bar"
                          style={{
                            width: `${pct}%`,
                            background: STATUS_COLORS[status],
                          }}
                        />
                      </div>
                      <span className="progress-count">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="card dash-card">
            <div className="section-head">
              <h2 className="section-title">近期截止岗位</h2>
              <Link to={appPath('/applications')} className="link-btn">
                查看岗位池 →
              </Link>
            </div>
            {upcomingDeadlines.length === 0 ? (
              <p className="page-desc">近期没有即将截止的投递岗位。</p>
            ) : (
              <div className="ddl-list">
                {upcomingDeadlines.map((app) => {
                  const isUrgent = app.deadline <= in3
                  const isSoon = app.deadline <= in7
                  return (
                    <Link
                      key={app.id}
                      to={`${appPath(`/applications/${app.id}`)}?nb`}
                      className="ddl-item"
                      target={window.innerWidth > 767 ? '_blank' : undefined}
                    >
                      <span className="ddl-title">
                        {app.companyName} · {app.jobTitle}
                      </span>
                      <span
                        className={
                          isUrgent ? 'ddl-deadline ddl-urgent' : isSoon ? 'ddl-deadline ddl-soon' : 'ddl-deadline'
                        }
                      >
                        {app.deadline} 截止
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
    </>
  )
}

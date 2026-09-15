import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import InfoItem from '../components/InfoItem'
import StatusBadge from '../components/StatusBadge'
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES } from '../constants/applicationStatus'
import { updateApplicationProgress } from '../utils/progressUpdate'
import {
  APPLICATION_SCREENING_LABELS,
  APPLICATION_SCREENING_STATUSES,
} from '../constants/screeningStatus'
import { sampleApplications } from '../data/sampleData'
import { useAppData } from '../hooks/useAppData'
import { PREVIEW_SNAPSHOT } from '../data/previewSnapshot'
import { useAccountApplications } from '../hooks/useAccountApplications'
import { useAuth } from '../hooks/useAuth'
import { useAppPath } from '../hooks/useAppPath'
import { useMode } from '../hooks/useMode'
import { useCustomTags } from '../hooks/useCustomTags'
import {
  addDays,
  formatDate,
  generateId,
  isValidUrl,
  normalizeApplication,
  normalizeEvent,
  today,
} from '../utils/helpers'
import {
  buildLedgerList,
  EMPTY_LEDGER_FILTERS,
} from '../utils/ledger'
import type { LedgerFilters, LedgerSort, SmartView } from '../utils/ledger'
import type {
  ApplicationEvent,
  ApplicationScreeningStatus,
  ApplicationStatus,
} from '../types'

const NOTE_LIMIT = 100
const JOB_TAG_LIMIT = 10
const CUSTOM_TAG_LIMIT = 20
const APP_EVENT_LIMIT = 20

function renderEventLabel(event: ApplicationEvent) {
  if (event.kind === 'status') {
    return (
      <>
        {event.fromStatus ? APPLICATION_STATUS_LABELS[event.fromStatus] : '创建'}
        {' → '}
        {event.toStatus ? APPLICATION_STATUS_LABELS[event.toStatus] : '—'}
      </>
    )
  }
  if (event.kind === 'priority') {
    return <>{`Priority：${event.note}`}</>
  }
  if (event.kind === 'edit') {
    return <>编辑了岗位信息</>
  }
  return <>{event.note || '编辑了岗位信息'}</>
}

export default function ApplicationDetail() {
  const { id } = useParams()
  const appPath = useAppPath()
  const mode = useMode()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [syncedView] = useAppData<{
    view?: SmartView
    filters?: LedgerFilters
    sortBy?: LedgerSort
  }>('app-view', {})
  const [rawApplications, setApplications] = useAccountApplications(sampleApplications)
  const applications = useMemo(
    () => rawApplications.map(normalizeApplication),
    [rawApplications],
  )
  const [rawEvents, setEvents] = useAppData('application-events', [])
  const events = useMemo(
    () => rawEvents.map(normalizeEvent),
    [rawEvents],
  )
  const [tasks] = useAppData('tasks', [])
  const [poolJobsMap, setPoolJobsMap] = useAppData('pool-jobs', {})
  const [, setPoolEventsMap] = useAppData('pool-events', {})

  const app = applications.find((item) => item.id === id)

  const ledgerList = useMemo(() => {
    const stateKey = mode === 'preview'
      ? 'preview:app-view'
      : `account:${user?.id ?? 'anonymous'}:app-view`
    let persisted: {
      view?: SmartView
      filters?: LedgerFilters
      sortBy?: LedgerSort
    } = {}
    try {
      const raw = localStorage.getItem(stateKey)
      if (raw) persisted = JSON.parse(raw) as typeof persisted
    } catch {
      persisted = {}
    }
    // 工作台优先使用已同步的视图偏好；本地值仅用于旧版本首次迁移前的兼容。
    persisted = { ...persisted, ...syncedView }
    const todayStr = today()
    return buildLedgerList(
      applications.filter((a) => !a.deletedAt),
      persisted.view ?? 'all',
      { ...EMPTY_LEDGER_FILTERS, ...persisted.filters },
      persisted.sortBy ?? 'no',
      {
        today: todayStr,
        in3: addDays(new Date(), 3),
        in7: addDays(new Date(), 7),
        in15: addDays(new Date(), 15),
      },
    )
  }, [applications, mode, syncedView, user?.id])

  // 翻页快照：进入详情页时冻结当前视图的岗位顺序。
  // 在详情页修改筛选决定 / Priority / 求职进度后岗位可能移出当前视图，
  // 翻页仍沿快照进行，返回列表页后列表自然按最新数据刷新。
  const pagerSnapshotRef = useRef<string[] | null>(null)
  if (pagerSnapshotRef.current === null && ledgerList.length > 0) {
    pagerSnapshotRef.current = ledgerList.map((item) => item.id)
  }
  // 直接打开详情链接（不在快照中）时，回退为实时列表
  const pagerIds = pagerSnapshotRef.current?.includes(id ?? '')
    ? pagerSnapshotRef.current
    : ledgerList.map((item) => item.id)

  const currentIndex = pagerIds.indexOf(id ?? '')
  const prevId = currentIndex > 0 ? pagerIds[currentIndex - 1] : null
  const nextId =
    currentIndex >= 0 && currentIndex < pagerIds.length - 1
      ? pagerIds[currentIndex + 1]
      : null
  const prevApp = prevId ? (applications.find((item) => item.id === prevId) ?? null) : null
  const nextApp = nextId ? (applications.find((item) => item.id === nextId) ?? null) : null

  const [notesDraft, setNotesDraft] = useState(app?.notes ?? '')
  const { allTags, addTag, removeTag, getJobTags, setJobTags } = useCustomTags()
  const [newTagText, setNewTagText] = useState('')
  const [tagEditMode, setTagEditMode] = useState(false)
  const [jobTags, setJobTagsLocal] = useState<string[]>([])
  const [copyPools, setCopyPools] = useState<Array<{ id: string; name: string }>>([])
  const [copyTargetPoolId, setCopyTargetPoolId] = useState('')
  const [showCopyPoolPicker, setShowCopyPoolPicker] = useState(false)

  useEffect(() => {
    setNotesDraft(app?.notes ?? '')
  // 翻页时即使两条岗位的备注都为空，也必须按岗位 ID 重置草稿，不能沿用上一条的编辑内容。
  }, [app?.id, app?.notes])

  useEffect(() => {
    if (app?.id) setJobTagsLocal(getJobTags(app.id))
  }, [app?.id, getJobTags])

  const toggleJobTag = (tag: string) => {
    if (!app?.id) return
    const marker = `【${tag}】`
    const now = new Date().toISOString()
    if (jobTags.includes(tag)) {
      setJobTagsLocal((prev) => prev.filter((t) => t !== tag))
      setJobTags(app.id, jobTags.filter((t) => t !== tag))
      setNotesDraft((prev) => {
        const next = prev.replace(marker, '').replace(/\s{2,}/g, ' ').trim()
        setApplications((p) => p.map((item) => item.id === app.id ? { ...item, notes: next, updatedAt: now } : item))
        return next
      })
    } else {
      if (jobTags.length >= JOB_TAG_LIMIT) {
        window.alert(`单个岗位最多添加 ${JOB_TAG_LIMIT} 个标签。`)
        return
      }
      setJobTagsLocal((prev) => [...prev, tag])
      setJobTags(app.id, [...jobTags, tag])
      setNotesDraft((prev) => {
        const next = prev ? `${prev.trim()} ${marker}` : marker
        if (next.length > NOTE_LIMIT) {
          window.alert(`单个岗位备注最多 ${NOTE_LIMIT} 字，当前备注已达到上限，标签已添加但不再写入备注文本。`)
          return prev
        }
        setApplications((p) => p.map((item) => item.id === app.id ? { ...item, notes: next, updatedAt: now } : item))
        return next
      })
    }
  }

  const addNewTag = () => {
    const t = newTagText.trim()
    if (!t) return
    const isExistingTag = allTags.includes(t)
    if (!isExistingTag && allTags.length >= CUSTOM_TAG_LIMIT) {
      window.alert(`自定义快捷标签库最多保留 ${CUSTOM_TAG_LIMIT} 个标签。`)
      return
    }
    setNewTagText('')
    if (app?.id && !jobTags.includes(t)) {
      if (jobTags.length >= JOB_TAG_LIMIT) {
        window.alert(`单个岗位最多添加 ${JOB_TAG_LIMIT} 个标签。`)
        return
      }
      addTag(t)
      const next = [...jobTags, t]
      setJobTagsLocal(next)
      setJobTags(app.id, next)
    } else {
      addTag(t)
    }
  }

  if (!app) {
    return (
      <section>
        <h1 className="page-title">未找到该记录</h1>
        <p className="page-desc">
          <Link to={appPath('/applications')}>返回我的岗位池</Link>
        </p>
      </section>
    )
  }

  if (app.deletedAt) {
    return (
      <section>
        <div className="detail-head">
          <Link to={appPath('/applications')} className="link-btn">← 返回岗位池</Link>
        </div>
        <div className="card detail-notes-card">
          <h2 className="section-title">该岗位已在回收站中</h2>
          <p className="page-desc">此岗位已于 {app.deletedAt.slice(0, 10)} 删除，可在「我的岗位池 → 回收站」中恢复。</p>
          <div className="detail-quick-actions">
            <button type="button" className="btn btn-outline" onClick={() => navigate(appPath('/applications'))}>返回岗位池</button>
          </div>
        </div>
      </section>
    )
  }

  // 旧版访客快照可能没有链接；使用保留示例域名补齐，避免误导为真实招聘信息。
  const previewApplicationUrl = mode === 'preview'
    ? `https://jobs.example.invalid/apply/${encodeURIComponent(app.id)}`
    : ''
  const previewAnnouncementUrl = mode === 'preview'
    ? `https://jobs.example.invalid/notice/${encodeURIComponent(app.id)}`
    : ''
  const applicationUrl = isValidUrl(app.applicationUrl) ? app.applicationUrl : previewApplicationUrl
  const announcementUrl = isValidUrl(app.announcementUrl) ? app.announcementUrl : previewAnnouncementUrl

  const updatePriority = (score: number) => {
    if (score === app.priority) return
    const now = new Date().toISOString()
    const oldText = app.priority === 0 ? '未评分' : String(app.priority)
    const newText = score === 0 ? '未评分' : String(score)
    setApplications((prev) =>
      prev.map((item) =>
        item.id === app.id
          ? { ...item, priority: score, updatedAt: now }
          : item,
      ),
    )
    setEvents((prev) => [
      {
        id: generateId(),
        applicationId: app.id,
        kind: 'priority',
        fromStatus: null,
        toStatus: null,
        note: `${oldText} → ${newText}`,
        happenedAt: now,
      },
      ...prev,
    ])
  }

  const deleteEvent = (eventId: string) => {
    if (!window.confirm('确认删除这条变更记录？')) return
    setEvents((prev) => prev.filter((event) => event.id !== eventId))
  }

  const updateScreening = (status: ApplicationScreeningStatus) => {
    if (status === app.screeningStatus) return
    const now = new Date().toISOString()
    setApplications((prev) =>
      prev.map((item) =>
        item.id === app.id
          ? { ...item, screeningStatus: status, updatedAt: now }
          : item,
      ),
    )
  }

  // 求职进度点选：与任务详情页、岗位池列表共用同一套更新逻辑，三处天然同步。
  const updateProgress = (toStatus: ApplicationStatus) => {
    updateApplicationProgress(app, toStatus, setApplications, setEvents)
  }

  // 「管理任务」入口：未推进的岗位先确认是否标记为「决定推进」再前往。
  const goManageTasks = () => {
    if (app.screeningStatus === 'selected') {
      navigate(appPath(`/tasks/${app.id}`))
      return
    }
    const confirmed = window.confirm(
      '该岗位尚未标记为「决定推进」。是否标记为「决定推进」并前往任务管理？',
    )
    if (!confirmed) return
    updateScreening('selected')
    navigate(appPath(`/tasks/${app.id}`))
  }

  const saveNotes = () => {
    const nextNotes = notesDraft.slice(0, NOTE_LIMIT)
    if (notesDraft.length > NOTE_LIMIT) {
      window.alert(`单个岗位备注最多 ${NOTE_LIMIT} 字，已为你保留前 ${NOTE_LIMIT} 字。`)
      setNotesDraft(nextNotes)
    }
    if (nextNotes === app.notes) return
    const now = new Date().toISOString()
    setApplications((prev) =>
      prev.map((item) =>
        item.id === app.id ? { ...item, notes: nextNotes, updatedAt: now } : item,
      ),
    )
  }

  const handleDelete = () => {
    if (!window.confirm(`删除后，该岗位会进入"我的岗位池回收站"，7 天内可恢复；关联任务、个人备注、岗位标签和进度记录会一并保留。确认删除「${app.companyName} · ${app.jobTitle}」？`)) {
      return
    }
    const deletedAt = new Date().toISOString()
    setApplications((prev) =>
      prev.map((item) =>
        item.id === app.id
          ? { ...item, deletedAt, updatedAt: deletedAt }
          : item,
      ),
    )
    navigate(appPath('/applications'))
  }

  const openCopyPoolPicker = async () => {
    if (mode === 'preview') {
      const poolIds = Object.keys(poolJobsMap)
      const pools = PREVIEW_SNAPSHOT.groups.filter((group) => poolIds.includes(group.id))
      if (pools.length === 0) {
        window.alert('你还没有加入任何群组岗位池。')
        return
      }
      setCopyPools(pools)
      setCopyTargetPoolId(pools[0].id)
      setShowCopyPoolPicker(true)
      return
    }
    const response = await fetch('/api/pools')
    if (!response.ok) return
    const body = await response.json() as { pools: Array<{ id: string; name: string; kind: string }> }
    const pools = body.pools.filter((pool) => pool.kind === 'group')
    if (pools.length === 0) {
      window.alert('你还没有加入任何群组岗位池。')
      return
    }
    setCopyPools(pools)
    setCopyTargetPoolId(pools[0].id)
    setShowCopyPoolPicker(true)
  }

  const confirmCopyToPool = async () => {
    const pool = copyPools.find((item) => item.id === copyTargetPoolId)
    if (!pool) return
    if (mode === 'preview') {
      const newId = generateId()
      const no = (poolJobsMap[pool.id] ?? []).length + 1
      setPoolJobsMap((current) => ({
        ...current,
        [pool.id]: [
          ...(current[pool.id] ?? []),
          { id: newId, no, payload_json: JSON.stringify({ ...app, id: newId, no }), revision: 1 },
        ],
      }))
      setPoolEventsMap((current) => ({
        ...current,
        [pool.id]: [
          ...(current[pool.id] ?? []),
          { job_id: newId, actor_name: '演示用户', action: 'copied', changed_fields_json: '{}', created_at: new Date().toISOString() },
        ],
      }))
      window.alert(`已汇入到「${pool.name}」（仅演示数据），可在群组岗位池查看。`)
      setShowCopyPoolPicker(false)
      return
    }
    const copyResponse = await fetch(`/api/pools/${pool.id}/jobs/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceJobId: app.id }),
    })
    const copyBody = await copyResponse.json() as { error?: string }
    if (!copyResponse.ok) {
      window.alert(copyBody.error ?? '汇入失败，请稍后重试。')
      return
    }
    window.alert(`已汇入到「${pool.name}」。`)
    setShowCopyPoolPicker(false)
  }

  const appEvents = events
    .filter((event) => event.applicationId === app.id)
    .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))
    .slice(0, APP_EVENT_LIMIT)

  const appTasks = tasks.filter((task) => task.applicationId === app.id)
  // 最新创建的一条任务，用于「关联任务」卡片的进展速览
  const latestTask = appTasks.length > 0
    ? [...appTasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : null

  return (
    <section>
      <div className="detail-navbar">
        <Link to={appPath('/applications')} className="back-link">
          ← 返回我的岗位池
        </Link>
      </div>

      <div className="detail-header">
        <div>
          <h1 className="page-title">
            <span className="detail-no">#{app.no ?? '—'}</span>{' '}
            {app.companyName} · {app.jobTitle}
          </h1>
          <p className="detail-imported">
            导入时间：{app.importedAt ? app.importedAt.slice(0, 10) : '—'}
            {app.source ? ` · 来源：${app.source}` : ''}
          </p>
          <StatusBadge status={app.applicationStatus} />
          <p className="page-desc detail-note">这条机会已录入你的岗位池，下一步由你决定。</p>
        </div>
        <div className="detail-actions">
          {applicationUrl && (
            <a
              className="btn"
              href={applicationUrl}
              target="_blank"
              rel="noreferrer"
            >
              打开投递地址
            </a>
          )}
          {announcementUrl && (
            <a
              className="btn btn-outline"
              href={announcementUrl}
              target="_blank"
              rel="noreferrer"
            >
              打开公告链接
            </a>
          )}
          <Link
            to={appPath(`/applications/${app.id}/edit`)}
            className="btn btn-outline"
          >
            编辑岗位
          </Link>
          <button type="button" className="btn btn-outline" onClick={() => void openCopyPoolPicker()}>
             汇入共享池
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            删除岗位
          </button>
        </div>
      </div>

      <div className="detail-workspace">
      <div className="detail-main-column">
      <div className="detail-grid">
        <InfoItem label="岗位方向" value={app.jobDirection} />
        <InfoItem label="岗位性质" value={app.employmentType} />
        <InfoItem
          label="所属行业"
          value={app.industries.length > 0 ? app.industries.join('、') : app.industry}
        />
        <InfoItem label="企业类型" value={app.companyType} />
        <InfoItem
          label="工作地点"
          value={app.locations.length > 0 ? app.locations.join('、') : app.location}
        />
        <InfoItem label="学历要求" value={app.educationRequirements.join('、')} />
        <InfoItem label="届次要求" value={app.graduationYears.join('、')} />
        <InfoItem label="招聘专业" value={app.majors} />
        <InfoItem label="发布时间" value={app.publishedAt} />
        <InfoItem label="截止日期" value={app.deadline} />
        <InfoItem label="实际投递日期" value={app.appliedAt} />
        <InfoItem label="岗位详情" value={app.jobDescription} multiline />
        {app.jobRequirements && (
          <InfoItem label="岗位要求" value={app.jobRequirements} multiline />
        )}
        {app.hireProcess && (
          <InfoItem label="录用流程" value={app.hireProcess} multiline />
        )}
        <InfoItem label="福利待遇" value={app.benefits} multiline />
      </div>
      </div>

      <aside className="detail-side-panel">
        <div className="card status-update detail-notes-card">
          <div className="section-head">
            <h2 className="section-title">个人备注</h2>
            <span className="notes-autosave-hint">点击页面其他位置自动保存</span>
          </div>
          <textarea className="field-input notes-editor" rows={2} value={notesDraft} placeholder="记录面试心得、沟通要点、薪资预期等，随时可改。" onChange={(e) => setNotesDraft(e.target.value.slice(0, NOTE_LIMIT))} onBlur={saveNotes} />
          <p className="file-save-caption note-limit-caption">{notesDraft.length}/{NOTE_LIMIT} 字</p>
          <div className="note-tags-section">
            <span className="note-tags-label">快捷标签</span>
            <div className="note-tags-chips">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`note-tag-chip note-tag-selectable${jobTags.includes(tag) ? ' note-tag-active' : ''}`}
                  onClick={() => toggleJobTag(tag)}
                >
                  {tag}
                  {tagEditMode && (
                    <span className="note-tag-remove" onClick={(e) => { e.stopPropagation(); removeTag(tag) }}>×</span>
                  )}
                </button>
              ))}
              {tagEditMode && (
                <input
                  className="note-tag-inline-input"
                  value={newTagText}
                  placeholder="输入后回车"
                  onChange={(e) => setNewTagText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addNewTag() }
                    if (e.key === 'Escape') { setTagEditMode(false); setNewTagText('') }
                  }}
                  autoFocus
                />
              )}
              <button type="button" className={`note-tag-add-btn${tagEditMode ? ' note-tag-add-active' : ''}`} onClick={() => { if (tagEditMode) { if (newTagText.trim()) addNewTag(); setTagEditMode(false); setNewTagText('') } else { setTagEditMode(true) } }}>{tagEditMode ? '✓' : '+'}</button>
            </div>
          </div>
        </div>

        <div className="card detail-quick-actions">
          <div className="quick-decision-field">
            <span className="quick-decision-label">筛选决定</span>
            <div className="status-options">
              {APPLICATION_SCREENING_STATUSES.map((status) => (
                <button key={status} type="button" className={status === app.screeningStatus ? 'status-btn active' : 'status-btn'} disabled={status === app.screeningStatus} onClick={() => updateScreening(status)}>{APPLICATION_SCREENING_LABELS[status]}</button>
              ))}
            </div>
          </div>
          <div className="quick-decision-field">
            <span className="quick-decision-label">Priority</span>
            <div className="status-options">
              {[1, 2, 3, 4, 5].map((score) => (
                <button key={score} type="button" className={score === app.priority ? 'status-btn active' : 'status-btn'} disabled={score === app.priority} onClick={() => updatePriority(score)}>{score}★</button>
              ))}
              {app.priority !== 0 && <button type="button" className="status-btn" onClick={() => updatePriority(0)}>清除</button>}
            </div>
          </div>
          <div className="detail-pager">
            <Link to={prevApp ? appPath(`/applications/${prevApp.id}`) : '#'} className={prevApp ? 'pager-btn' : 'pager-btn disabled'} aria-disabled={!prevApp}>← 上一个</Link>
            <span className="pager-index">{currentIndex >= 0 ? `${currentIndex + 1} / ${pagerIds.length}` : '—'}</span>
            <Link to={nextApp ? appPath(`/applications/${nextApp.id}`) : '#'} className={nextApp ? 'pager-btn' : 'pager-btn disabled'} aria-disabled={!nextApp}>下一个 →</Link>
          </div>
        </div>
      </aside>

      <div className="detail-support">

      <div className="card timeline-card">
        <div className="section-head">
          <h2 className="section-title">关联任务</h2>
        </div>

        <div className="quick-decision-field">
          <span className="quick-decision-label">求职进度</span>
          <div className="status-options">
            {APPLICATION_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={status === app.applicationStatus ? 'status-btn active' : 'status-btn'}
                disabled={status === app.applicationStatus}
                onClick={() => updateProgress(status)}
              >
                {APPLICATION_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>

        {latestTask && (
          <div className="latest-task-block">
            <span className="latest-task-label">最新任务</span>
            <div className="latest-task-main">
              <span className={latestTask.done ? 'task-mini-title done' : 'task-mini-title'}>
                {latestTask.title}
              </span>
              <span className="task-type-badge">{latestTask.taskType}</span>
              {latestTask.deadline && (
                <span className="task-mini-deadline">{latestTask.deadline}</span>
              )}
              {latestTask.done && <span className="task-done-badge">已完成</span>}
            </div>
            {latestTask.notes && (
              <p className="latest-task-notes">{latestTask.notes}</p>
            )}
          </div>
        )}

        {app.screeningStatus !== 'selected' ? (
          <p className="page-desc">
            标记为「决定推进」后，本岗位会出现在任务页，可在此创建和管理任务。
          </p>
        ) : appTasks.length === 0 ? (
          <p className="page-desc">
            暂无任务。点击「管理任务」进入任务详情，手动为该岗位创建任务。
          </p>
        ) : (
          <div className="task-mini-list">
            {appTasks.map((task) => (
              <div key={task.id} className="task-mini-item">
                <span
                  className={task.done ? 'task-mini-title done' : 'task-mini-title'}
                >
                  {task.title}
                </span>
                <span className="task-type-badge">{task.taskType}</span>
                {task.deadline && (
                  <span className="task-mini-deadline">{task.deadline}</span>
                )}
                {task.done && <span className="task-done-badge">已完成</span>}
              </div>
            ))}
          </div>
        )}

        <button type="button" className="btn manage-tasks-btn" onClick={goManageTasks}>
          管理任务 →
        </button>
      </div>

      <div className="card timeline-card">
        <h2 className="section-title">变更记录</h2>
        {appEvents.length === 0 ? (
          <p className="page-desc">暂无变更记录。每次更新都会在这里留下记录。</p>
        ) : (
          <div className="timeline">
            {appEvents.map((event) => (
              <div key={event.id} className="timeline-item">
                <div className="timeline-head">
                  <span className="timeline-status">
                    {renderEventLabel(event)}
                  </span>
                  <span className="timeline-time">
                    {formatDate(event.happenedAt)}
                  </span>
                    <button
                      type="button"
                      className="timeline-delete"
                      onClick={() => deleteEvent(event.id)}
                    >
                      删除
                    </button>
                </div>
                {event.kind === 'status' && event.note && (
                  <div className="timeline-note">{event.note}</div>
                )}
                {event.kind === 'edit' && event.note && (
                  <div className="timeline-note timeline-note-edit">{event.note}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      </div>
      {showCopyPoolPicker && (
        <div className="modal-overlay" onClick={() => setShowCopyPoolPicker(false)}>
          <div className="modal copy-pool-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="section-title">汇入群组岗位池</h2>
            <p className="page-desc">请选择要汇入的群组岗位池。</p>
            <div className="copy-pool-options">
              {copyPools.map((pool) => (
                <button
                  key={pool.id}
                  type="button"
                  className={pool.id === copyTargetPoolId ? 'copy-pool-option active' : 'copy-pool-option'}
                  onClick={() => setCopyTargetPoolId(pool.id)}
                >
                  {pool.name}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowCopyPoolPicker(false)}>取消</button>
              <button type="button" className="btn" onClick={() => void confirmCopyToPool()}>确认汇入</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMode } from '../hooks/useMode'
import { useAppData } from '../hooks/useAppData'
import { useAppPath } from '../hooks/useAppPath'
import { useAuth } from '../hooks/useAuth'
import { addDays, deadlineKind, normalizeApplication, today } from '../utils/helpers'
import { buildLedgerList, EMPTY_LEDGER_FILTERS } from '../utils/ledger'
import type { LedgerFilters, LedgerSort } from '../utils/ledger'
import type { Application } from '../types'
import { COMMUNITY_POOLS } from '../data/communityPools'
import JobListToolbar from '../components/JobListToolbar'

interface PoolEvent {
  job_id: string
  actor_name: string
  action: 'copied' | 'updated'
  changed_fields_json: string
  created_at: string
}

const FIELD_LABELS: Record<string, string> = {
  companyName: '企业名称', jobTitle: '岗位名称', jobDirection: '岗位方向',
  employmentType: '岗位性质', industry: '所属行业', industries: '所属行业',
  companyType: '企业类型', location: '工作地点', locations: '工作地点',
  educationRequirements: '学历要求', graduationYears: '届次要求', majors: '招聘专业',
  publishedAt: '发布时间', deadline: '截止日期', jobDescription: '岗位详情',
  jobRequirements: '岗位要求', hireProcess: '录用流程', benefits: '福利待遇',
  applicationUrl: '投递地址', announcementUrl: '公告链接',
}

const POOL_SORT_OPTIONS: Array<{ value: LedgerSort; label: string }> = [
  { value: 'no', label: '按编号' },
  { value: 'created', label: '按添加时间' },
  { value: 'deadline', label: '按截止日期' },
  { value: 'company', label: '按公司首字母' },
]

const VIEW_LABELS: Record<'all' | 'uncopied', string> = {
  all: '全部共享岗位',
  uncopied: '未纳入我的岗位池',
}

function sourceText(source?: { name: string; addedAt: string }): string {
  if (!source) return ''
  return `来源：${source.name} 添加${source.addedAt ? ` · ${source.addedAt.slice(0, 10)}` : ''}`
}

interface JobSource {
  id: string
  name: string
  addedAt: string
}

function countActiveFilters(f: LedgerFilters): number {
  let n = 0
  if (f.keyword) n++
  if (f.noQuery) n++
  if (f.companyQuery) n++
  if (f.jobQuery) n++
  if (f.direction) n++
  if (f.locationQuery) n++
  if (f.employmentType) n++
  if (f.deadline) n++
  if (f.industry) n++
  if (f.companyType) n++
  if (f.education) n++
  if (f.majorsQuery) n++
  if (f.publishedFrom || f.publishedTo) n++
  if (f.missingDescription) n++
  if (f.missingBenefits) n++
  if (f.missingDeadline) n++
  if (f.missingLink) n++
  return n
}

export default function SharedPoolDetail({ onView, variant }: { onView?: (poolId: string) => void; variant?: 'community' }) {
  const { poolId } = useParams()
  const mode = useMode()
  const appPath = useAppPath()
  const { user } = useAuth()
  const isCommunity = variant === 'community'
  const communityPool = isCommunity ? COMMUNITY_POOLS.find((p) => p.id === poolId) : undefined
  const sharedStateKey = mode === 'preview'
    ? `preview:shared-pool:${poolId ?? 'unknown'}:view`
    : `account:${user?.id ?? 'anonymous'}:shared-pool:${poolId ?? 'unknown'}:view`
  const returnScrollKey = `${sharedStateKey}:return-scroll`
  const readPersisted = () => {
    try {
      return JSON.parse(localStorage.getItem(sharedStateKey) ?? '{}') as {
        view?: 'all' | 'uncopied'
        filters?: LedgerFilters
        sortBy?: LedgerSort
        viewMode?: 'table' | 'card'
        groupBy?: string
      }
    } catch {
      return {}
    }
  }
  const persisted = readPersisted()
  const [sharedApps, setSharedApps] = useState<Application[]>([])
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deletingJobIds, setDeletingJobIds] = useState(false)
  const [poolOperation, setPoolOperation] = useState<'copy' | 'delete' | null>(null)
  const [poolOperationResult, setPoolOperationResult] = useState<{ title: string; detail: string; preview?: boolean } | null>(null)
  const [events, setEvents] = useState<PoolEvent[]>([])
  const [message, setMessage] = useState('')
  const [view, setView] = useState<'all' | 'uncopied'>(persisted.view ?? 'all')
  const [sortBy, setSortBy] = useState<LedgerSort>(persisted.sortBy ?? 'no')
  const [viewMode, setViewMode] = useState<'table' | 'card'>(persisted.viewMode ?? 'table')
  const [isNarrowScreen, setIsNarrowScreen] = useState(false)
  const [narrowViewOverride, setNarrowViewOverride] = useState<'table' | 'card' | null>(null)
  const [groupBy, setGroupBy] = useState<string>(persisted.groupBy ?? 'company')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<LedgerFilters>({ ...EMPTY_LEDGER_FILTERS, ...persisted.filters })
  const [sourceMap, setSourceMap] = useState<Record<string, JobSource>>({})
  const effectiveViewMode = isNarrowScreen ? (narrowViewOverride ?? 'card') : viewMode
  const updateViewMode = (next: 'table' | 'card') => {
    if (isNarrowScreen) setNarrowViewOverride(next)
    else setViewMode(next)
  }

  useEffect(() => {
    if (!poolOperation) return
    const blockKeyboard = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('keydown', blockKeyboard, true)
    return () => document.removeEventListener('keydown', blockKeyboard, true)
  }, [poolOperation])

  useEffect(() => {
    try {
      localStorage.setItem(sharedStateKey, JSON.stringify({ view, filters, sortBy, viewMode, groupBy }))
    } catch {
      // 忽略浏览器存储不可用的情况
    }
  }, [sharedStateKey, view, filters, sortBy, viewMode, groupBy])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(returnScrollKey)
      if (!raw) return
      sessionStorage.removeItem(returnScrollKey)
      const scrollY = Number(raw)
      if (!Number.isFinite(scrollY)) return
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: 'instant' })))
    } catch {
      // 忽略浏览器存储不可用的情况
    }
  }, [returnScrollKey])

  const preserveListPosition = () => {
    try {
      sessionStorage.setItem(returnScrollKey, String(window.scrollY))
    } catch {
      // 筛选状态仍会通过 localStorage 保留
    }
  }

  const [poolJobsMap, setPoolJobsMap] = useAppData('pool-jobs', {})
  const [poolEventsMap, setPoolEventsMap] = useAppData('pool-events', {})
  const [copyMappings, setCopyMappings] = useAppData('copy-mappings', {})
  const [, setPreviewApplications] = useAppData('applications', [])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => {
      setIsNarrowScreen(query.matches)
      if (!query.matches) setNarrowViewOverride(null)
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (poolId) {
      // Mark pool as visited to clear unread indicator
      const visited = JSON.parse(localStorage.getItem('visited-pools') ?? '{}') as Record<string, number>
      visited[poolId] = Date.now()
      localStorage.setItem('visited-pools', JSON.stringify(visited))
      onView?.(poolId)
    }
  }, [poolId, onView])

  useEffect(() => {
    if (!poolId) return
    if (isCommunity) {
      const jobs = communityPool?.jobs ?? []
      setSharedApps(jobs.map((job, index) => normalizeApplication({ ...job, no: index + 1 })))
      setSourceMap(Object.fromEntries(jobs.map((job) => [job.id, { id: 'community-demo', name: '社区演示', addedAt: '' }] as [string, JobSource])))
      setCopiedIds(new Set())
      setEvents([])
      setMessage('')
      return
    }
    if (mode === 'preview') {
      const poolJobs = poolJobsMap[poolId] ?? []
      setSharedApps(poolJobs.map((job) => {
        const payload = JSON.parse(job.payload_json) as Application
        return normalizeApplication({ ...payload, id: job.id, no: job.no })
      }))
      setSourceMap(Object.fromEntries(poolJobs.map((job) => [job.id, { id: 'preview-user', name: '演示用户', addedAt: '' }] as [string, JobSource])))
      setCopiedIds(new Set(Object.keys(copyMappings[poolId] ?? {})))
      setEvents((poolEventsMap[poolId] ?? []).filter(
        (event): event is PoolEvent => event.action === 'copied' || event.action === 'updated',
      ))
      setMessage('')
      return
    }
    const load = async () => {
      const response = await fetch(`/api/pools/${poolId}/jobs`)
      if (!response.ok) throw new Error('无法读取共享岗位')
      const body = await response.json() as { jobs: Array<{ id: string; no: number; payload_json: string; copied_to_personal: number; added_by_user_id?: string; added_by_name?: string; added_at?: string }> }
      setSharedApps(body.jobs.map((job) => {
        const payload = JSON.parse(job.payload_json) as Application
        return normalizeApplication({ ...payload, id: job.id, no: job.no, importedAt: job.added_at ? job.added_at.slice(0, 10) : '' })
      }))
      setSourceMap(Object.fromEntries(body.jobs.map((job) => [job.id, { id: job.added_by_user_id ?? '', name: job.added_by_name ?? '某用户', addedAt: job.added_at ?? '' }] as [string, JobSource])))
      setCopiedIds(new Set(body.jobs.filter((job) => job.copied_to_personal === 1).map((job) => job.id)))
      const eventsResponse = await fetch(`/api/pools/${poolId}/events`)
      if (eventsResponse.ok) {
        const eventBody = await eventsResponse.json() as { events: PoolEvent[] }
        setEvents(eventBody.events.filter((event) => event.action === 'copied' || event.action === 'updated'))
      }
      await fetch(`/api/pools/${poolId}/view`, { method: 'POST' }).catch(() => undefined)
    }
    void load().catch(() => setMessage('共享岗位池暂时无法读取。'))
  }, [poolId, mode, poolJobsMap, poolEventsMap, copyMappings, isCommunity, communityPool])

  const copyJobsToPersonal = async (jobIds: string[]) => {
    if (!poolId || poolOperation) return
    if (isCommunity) {
      setPoolOperationResult({ title: '纳入我的岗位池（开发中）', detail: '正式接入后，将为当前账户创建所选岗位的个人副本，并移交到“我的岗位池”进行筛选、投递和任务管理；不会修改社区原岗位，也不会自动投递。', preview: true })
      return
    }
    setPoolOperation('copy')
    try {
    if (mode === 'preview') {
      const poolJobs = poolJobsMap[poolId] ?? []
      const mapping = { ...(copyMappings[poolId] ?? {}) }
      const newApps: Application[] = []
      let added = 0
      for (const id of jobIds) {
        if (mapping[id]) continue
        const shared = poolJobs.find((job) => job.id === id)
        if (!shared) continue
        const payload = JSON.parse(shared.payload_json) as Application
        const newId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        newApps.push({ ...payload, id: newId, no: 0, importedAt: new Date().toISOString().slice(0, 10), source: '共享岗位池复制' })
        mapping[id] = newId
        added++
      }
      if (added === 0) {
        setPoolOperationResult({ title: '批量纳入完成', detail: '所选岗位都已纳入我的岗位池，无需重复复制。', preview: true })
        return
      }
      setPreviewApplications((current) => {
        const maxNo = current.reduce((max, app) => Math.max(max, app.no ?? 0), 0)
        return [...current, ...newApps.map((app, index) => ({ ...app, no: maxNo + index + 1 }))]
      })
      setCopyMappings((current) => ({ ...current, [poolId]: mapping }))
      setPoolEventsMap((current) => ({
        ...current,
        [poolId]: [
          ...(current[poolId] ?? []),
          { job_id: '', actor_name: '演示用户', action: 'copied', changed_fields_json: JSON.stringify({ count: added }), created_at: new Date().toISOString() },
        ],
      }))
      setCopiedIds(new Set(Object.keys(mapping)))
      setMessage(`已纳入 ${added} 条岗位至我的岗位池，现在可以进行个人筛选与管理（仅演示数据）。`)
      setSelectedIds([])
      setPoolOperationResult({ title: '批量纳入完成', detail: `已成功纳入我的岗位池 ${added} / ${jobIds.length} 条岗位。`, preview: true })
      return
    }
    const personal = (await fetch('/api/pools').then((r) => r.json()) as { pools: Array<{ id: string; kind: string }> }).pools.find((p) => p.kind === 'personal')
    if (!personal) {
      setPoolOperationResult({ title: '批量纳入未完成', detail: '未找到你的个人岗位池。' })
      return
    }
    let copied = 0
    let lastError = ''
    for (const sourceJobId of jobIds) {
      const response = await fetch(`/api/pools/${personal.id}/jobs/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceJobId }),
      })
      const body = await response.json() as { error?: string }
      if (response.ok) copied++
      else lastError = body.error ?? ''
    }
    setMessage(copied > 0 ? `已纳入 ${copied} 条岗位至我的岗位池，现在可以进行个人筛选与管理。` : (lastError || '纳入失败，请稍后重试。'))
    setSelectedIds([])
    setPoolOperationResult({ title: copied > 0 ? '批量纳入完成' : '批量纳入未完成', detail: copied > 0 ? `已成功纳入我的岗位池 ${copied} / ${jobIds.length} 条岗位。${copied < jobIds.length ? `另有 ${jobIds.length - copied} 条未成功纳入。` : ''}` : (lastError || '没有岗位被成功纳入。') })
    } catch {
      setPoolOperationResult({ title: '批量纳入未完成', detail: '处理过程中出现网络问题，请稍后重试。' })
    } finally {
      setPoolOperation(null)
    }
  }

  const copyToPersonal = async (job: Application) => {
    await copyJobsToPersonal([job.id])
  }

  const deleteSharedJobs = async (jobIds: string[]) => {
    if (!poolId || deletingJobIds || poolOperation || jobIds.length === 0) return
    if (isCommunity) {
      setPoolOperationResult({ title: '编辑与删除（开发中）', detail: '正式接入后，社区岗位会由对应的来源与审核规则维护。当前演示岗位仅支持浏览，不会执行编辑、删除或批量操作，也不会改动任何账户数据。', preview: true })
      return
    }
    const deletableIds = jobIds.filter((id) => mode === 'preview' || sourceMap[id]?.id === user?.id)
    if (deletableIds.length === 0) return setMessage('只能删除由你添加到共享岗位池的岗位。')
    if (!window.confirm(`确认删除 ${deletableIds.length} 条由你添加的共享岗位吗？删除后无法恢复。`)) return
    setDeletingJobIds(true)
    setPoolOperation('delete')
    const deletedIds: string[] = []
    let lastError = ''
    try {
      if (mode === 'preview') {
        const removing = new Set(deletableIds)
        setPoolJobsMap((current) => ({ ...current, [poolId]: (current[poolId] ?? []).filter((job) => !removing.has(job.id)) }))
        deletedIds.push(...deletableIds)
      } else {
        for (const jobId of deletableIds) {
          const response = await fetch(`/api/pools/${poolId}/jobs/${jobId}`, { method: 'DELETE' })
          const body = await response.json() as { error?: string }
          if (response.ok) deletedIds.push(jobId)
          else lastError = body.error ?? lastError
        }
      }
      if (deletedIds.length > 0) {
        const removed = new Set(deletedIds)
        setSharedApps((current) => current.filter((app) => !removed.has(app.id)))
        setSourceMap((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !removed.has(id))))
        setCopiedIds((current) => new Set([...current].filter((id) => !removed.has(id))))
        setSelectedIds((current) => current.filter((id) => !removed.has(id)))
      }
      setMessage(deletedIds.length > 0 ? `已删除 ${deletedIds.length} 条由你添加的共享岗位。${deletedIds.length < deletableIds.length ? `另有 ${deletableIds.length - deletedIds.length} 条删除失败，请稍后重试。` : ''}` : (lastError || '删除失败，请稍后重试。'))
      setPoolOperationResult({ title: deletedIds.length > 0 ? '批量删除完成' : '批量删除未完成', detail: deletedIds.length > 0 ? `已删除 ${deletedIds.length} / ${deletableIds.length} 条由你添加的共享岗位。${deletedIds.length < deletableIds.length ? `另有 ${deletableIds.length - deletedIds.length} 条删除失败。` : ''}` : (lastError || '没有岗位被删除。'), preview: mode === 'preview' })
    } finally {
      setDeletingJobIds(false)
      setPoolOperation(null)
    }
  }

  const todayStr = today()
  const in3 = addDays(new Date(), 3)
  const in7 = addDays(new Date(), 7)
  const in15 = addDays(new Date(), 15)

  const filteredApps = useMemo(() => {
    const base = view === 'uncopied' ? sharedApps.filter((app) => !copiedIds.has(app.id)) : sharedApps
    return buildLedgerList(base, 'all', filters, sortBy, { today: todayStr, in3, in7, in15 })
  }, [sharedApps, copiedIds, view, filters, sortBy, todayStr, in3, in7, in15])

  const groups = useMemo(() => {
    const keyOf = (app: Application): string => {
      if (groupBy === 'entryDate') {
        const date = (app.importedAt || app.createdAt || '').slice(0, 10)
        return date || '未记录日期'
      }
      if (groupBy === 'member') return sourceMap[app.id]?.name || '未记录成员'
      return app.companyName || '未命名公司'
    }
    const map = new Map<string, Application[]>()
    for (const app of filteredApps) {
      const name = keyOf(app)
      if (!map.has(name)) map.set(name, [])
      map.get(name)!.push(app)
    }
    // filtered list 已完成排序；保持其首次出现顺序，使分组标题与组内岗位均遵从当前排序。
    return [...map.entries()].map(([name, items]) => ({ name, items }))
  }, [filteredApps, groupBy, sourceMap])

  const activeCount = countActiveFilters(filters)
  const set = <K extends keyof LedgerFilters>(key: K, value: LedgerFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const renderDeadlineCell = (app: Application) => {
    const kind = deadlineKind(app.deadline)
    if (kind === 'rolling') return <span className="deadline-chip deadline-rolling">招满即止</span>
    if (kind === 'none') return <span className="deadline-chip deadline-none">无明确截止</span>
    const overdue = app.deadline < todayStr
    const soon = app.deadline <= in15
    return (
      <span className={overdue ? 'deadline-chip deadline-overdue-chip' : soon ? 'deadline-chip deadline-soon-chip' : 'deadline-chip deadline-dated'}>
        <span className="deadline-date">{app.deadline}</span>
        {overdue && <span className="deadline-hint">已过期</span>}
        {!overdue && soon && <span className="deadline-hint">15天内到期</span>}
      </span>
    )
  }

  const toggleSelect = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  const toggleSelectAll = () => setSelectedIds((prev) => prev.length === filteredApps.length && filteredApps.every((a) => prev.includes(a.id)) ? [] : filteredApps.map((a) => a.id))
  const toggleGroup = (name: string) => setCollapsedGroups((prev) => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next })
  const expandAll = () => setCollapsedGroups(new Set())
  const collapseAll = () => setCollapsedGroups(new Set(groups.map((g) => g.name)))

  const copiedCount = sharedApps.filter((app) => copiedIds.has(app.id)).length
  const deletableSelectedIds = selectedIds.filter((id) => mode === 'preview' || sourceMap[id]?.id === user?.id)
  const detailBase = appPath(isCommunity ? `/community-pools/${poolId}` : `/pools/${poolId}`)

  return (
    <section>
      <Link to={appPath(isCommunity ? '/community-pools' : '/pools')} className="back-link">← 返回{isCommunity ? '社区岗位池' : '群组岗位池'}</Link>
      <div className="toolbar">
        <div>
          <h1 className="page-title">{isCommunity ? (communityPool?.name ?? '社区岗位池') : '共享机会'}</h1>
          <p className="page-desc">{isCommunity ? '浏览池内岗位线索；合适的机会可纳入“我的岗位池”，再进行筛选、投递与任务管理。' : '这里不提供筛选决定、投递、Priority 或备注。觉得合适时，纳入“我的岗位池”后再进行个人管理。'}</p>
        </div>
        <span className="result-count">共 <strong>{sharedApps.length}</strong> 条{isCommunity ? '池内岗位' : `池内岗位 · 已纳入 ${copiedCount} 条`}</span>
      </div>
      {isCommunity && (
        <div className="feature-preview-banner">
          <b>目标功能</b>：社区岗位池按专业、城市、行业、届次与岗位类型汇集公开岗位线索；发现合适机会后，可纳入我的岗位池继续筛选、投递与任务管理。<br /><b>实现路径</b>：持续接入可信岗位来源，完善专业分区与检索体系、岗位审核与更新机制、池内动态及社区协作规则。
        </div>
      )}
      {message && <p className="form-error">{message}</p>}

      {!isCommunity && (
      <div className="card shared-activity">
        <h2 className="section-title">池内动态</h2>
        {events.length === 0 ? <p className="page-desc">暂无新增或编辑记录。</p> : (
          <div className="timeline">
            {events.map((event, index) => {
              const changes = event.action === 'updated' ? Object.keys(JSON.parse(event.changed_fields_json) as Record<string, unknown>).map((field) => FIELD_LABELS[field] ?? field).join('、') : ''
              const job = sharedApps.find((item) => item.id === event.job_id)
              const status = event.action === 'copied'
                ? (event.job_id ? `${event.actor_name} 新增了岗位` : `${event.actor_name} 新增了 ${(JSON.parse(event.changed_fields_json) as { count?: number }).count ?? 0} 条岗位`)
                : `${event.actor_name} 修改了 #${job?.no ?? '—'} ${job?.companyName ?? ''} 的${changes || '岗位信息'}`
              return <div className="timeline-item" key={`${event.job_id}-${event.created_at}-${index}`}>
                <div className="timeline-head">
                  {event.action !== 'copied' && <span className="ripple-dot" />}
                  <span className="timeline-status">{status}</span>
                  <span className="timeline-time">{new Date(event.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
                </div>
              </div>
            })}
          </div>
        )}
      </div>
      )}

      <div className="view-tabs" role="tablist">
        {(Object.keys(VIEW_LABELS) as Array<'all' | 'uncopied'>).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'view-tab active' : 'view-tab'} onClick={() => setView(v)}>
            {VIEW_LABELS[v]}
            <span className="view-tab-count">{v === 'all' ? sharedApps.length : sharedApps.length - copiedCount}</span>
          </button>
        ))}
      </div>

      <JobListToolbar
        filters={filters}
        setFilters={set}
        sortBy={sortBy}
        setSortBy={setSortBy}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        viewMode={effectiveViewMode}
        setViewMode={updateViewMode}
        activeCount={activeCount}
        resultCount={filteredApps.length}
        onClearFilters={() => setFilters({ ...EMPTY_LEDGER_FILTERS })}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        sortOptions={POOL_SORT_OPTIONS}
        showMemberGroup
      />

      {selectedIds.length > 0 && (
        <div className={deletingJobIds ? 'batch-bar is-busy' : 'batch-bar'}>
          <span className="batch-count">已选 {selectedIds.length} 条</span>
          <button type="button" className="btn btn-sm" disabled={poolOperation !== null} onClick={() => void copyJobsToPersonal(selectedIds)}>批量纳入我的岗位池</button>
          {!isCommunity && deletableSelectedIds.length > 0 && <button type="button" className="btn btn-danger btn-sm" disabled={poolOperation !== null} onClick={() => void deleteSharedJobs(deletableSelectedIds)}>{deletingJobIds ? '删除中…' : `批量删除我添加的岗位（${deletableSelectedIds.length}）`}</button>}
          <button type="button" className="btn btn-outline btn-sm" disabled={poolOperation !== null} onClick={() => setSelectedIds([])}>取消选择</button>
        </div>
      )}

      {filteredApps.length === 0 ? (
        <div className="empty-state">暂无符合条件的共享岗位，尝试切换视图或清除筛选条件。</div>
      ) : (
        <>
          {effectiveViewMode === 'table' && (
            <>
              <div className="table-wrap ledger-table-wrap">
                <table className="ledger-table">
                <thead>
                  <tr>
                    <th className="col-check"><input type="checkbox" checked={filteredApps.length > 0 && filteredApps.every((app) => selectedIds.includes(app.id))} onChange={toggleSelectAll} aria-label="全选当前列表" /></th>
                    <th className="col-no">编号</th>
                    <th>企业名称 / 岗位名称</th>
                    <th>岗位方向</th>
                    <th>工作地点</th>
                    <th>截止状态</th>
                    <th>复制状态</th>
                    <th className="col-actions">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {groupBy === 'none' && filteredApps.map((app) => (
                    <SharedRow key={app.id} app={app} copied={copiedIds.has(app.id)} selected={selectedIds.includes(app.id)} source={sourceMap[app.id]} onToggle={toggleSelect} onCopy={copyToPersonal} onDelete={deleteSharedJobs} canDelete={!isCommunity && (mode === 'preview' || sourceMap[app.id]?.id === user?.id)} deleting={deletingJobIds} pathBase={detailBase} applicationsPath={appPath('/applications')} onOpenDetail={preserveListPosition} />
                  ))}
                  {groupBy !== 'none' && groups.map((group) => {
                    const collapsed = collapsedGroups.has(group.name)
                    return (
                      <Fragment key={group.name}>
                        <tr className="company-group-head" onClick={() => toggleGroup(group.name)}>
                          <td className="cell-check">
                            <input type="checkbox" checked={group.items.length > 0 && group.items.every((app) => selectedIds.includes(app.id))} onClick={(e) => e.stopPropagation()} onChange={() => {
                              const allChecked = group.items.every((app) => selectedIds.includes(app.id))
                              setSelectedIds((prev) => allChecked ? prev.filter((id) => !group.items.some((app) => app.id === id)) : [...prev, ...group.items.map((app) => app.id).filter((id) => !prev.includes(id))])
                            }} aria-label={`选择 ${group.name} 全部岗位`} />
                          </td>
                          <td colSpan={7}>
                            <div className="company-group-bar">
                              <span className="company-group-toggle">{collapsed ? '▸' : '▾'}</span>
                              <span className="company-group-name">{group.name}</span>
                              <span className="company-group-count">{group.items.length} 个岗位</span>
                            </div>
                          </td>
                        </tr>
                        {!collapsed && group.items.map((app) => (
                          <SharedRow key={app.id} app={app} copied={copiedIds.has(app.id)} selected={selectedIds.includes(app.id)} source={sourceMap[app.id]} onToggle={toggleSelect} onCopy={copyToPersonal} onDelete={deleteSharedJobs} canDelete={!isCommunity && (mode === 'preview' || sourceMap[app.id]?.id === user?.id)} deleting={deletingJobIds} pathBase={detailBase} applicationsPath={appPath('/applications')} onOpenDetail={preserveListPosition} />
                        ))}
                      </Fragment>
                    )
                  })}
                </tbody>
                </table>
              </div>
              {isNarrowScreen && (
                <p className="mobile-table-notice">列表仅支持在电脑网页端查看，请切换为卡片视图。</p>
              )}
            </>
          )}

          {effectiveViewMode === 'card' && (
            <>
            <div className="card-list-select-all">
              <button type="button" className="btn btn-outline btn-sm" onClick={toggleSelectAll}>
                {filteredApps.length > 0 && filteredApps.every((app) => selectedIds.includes(app.id)) ? '取消全选' : '全选当前列表'}
              </button>
              <span>当前 {filteredApps.length} 条岗位</span>
            </div>
            <div className="app-card-list">
              {filteredApps.map((app) => (
                <div key={app.id} className={selectedIds.includes(app.id) ? 'app-card app-card-selected' : 'app-card'} onClick={() => undefined}>
                  <div className="app-card-head">
                    <div className="app-card-title">
                      <span className="app-card-check" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(app.id)} onChange={() => toggleSelect(app.id)} aria-label={`选择 ${app.companyName} · ${app.jobTitle}`} /></span>
                      <span className="app-card-no">#{app.no ?? '—'}</span>
                      <Link to={`${detailBase}/jobs/${app.id}?nb`} onClick={preserveListPosition} className="cell-company" target={window.innerWidth > 767 ? '_blank' : undefined}>{app.companyName}</Link>
                      <div className="cell-job">{app.jobTitle}</div>
                      {sourceText(sourceMap[app.id]) && <div className="cell-source">{sourceText(sourceMap[app.id])}</div>}
                    </div>
                    <div className="app-card-badges">
                      {copiedIds.has(app.id)
                        ? <Link to={mode === 'preview' ? appPath(`/applications/${copyMappings[poolId ?? '']?.[app.id] ?? ''}`) : appPath('/applications')} className="btn btn-outline btn-sm">已复制至我的岗位池</Link>
                        : <button type="button" className="btn btn-outline btn-sm" onClick={() => void copyToPersonal(app)}>纳入我的岗位池</button>}
                      {!isCommunity && <button type="button" className="btn btn-danger btn-sm" disabled={poolOperation !== null || !(mode === 'preview' || sourceMap[app.id]?.id === user?.id)} title={mode === 'preview' || sourceMap[app.id]?.id === user?.id ? '删除该岗位' : '仅添加该岗位的成员可以删除'} onClick={() => void deleteSharedJobs([app.id])}>删除</button>}
                    </div>
                  </div>
                  <div className="app-card-meta">
                    <span>{app.jobDirection || '—'}</span>
                    <span>{app.locations.join('、') || '—'}</span>
                    {renderDeadlineCell(app)}
                  </div>
                </div>
            ))}
            </div>
            </>
          )}
        </>
      )}
      {poolOperation && (
        <div className="modal-overlay operation-overlay">
          <div className="modal import-summary-modal" role="status" aria-live="polite">
            <h3 className="import-summary-title">{poolOperation === 'delete' ? '正在删除共享岗位…' : '正在纳入我的岗位池…'}</h3>
            <p className="import-summary-hint">正在逐条处理，请勿关闭页面、返回或进行其他操作；完成后会显示处理结果。</p>
          </div>
        </div>
      )}
      {poolOperationResult && (
        <div className="modal-overlay operation-result-overlay">
          <div className="modal import-summary-modal">
            <h3 className="import-summary-title">{poolOperationResult.title}</h3>
            <p className="page-desc">{poolOperationResult.detail}</p>
            {poolOperationResult.preview && <p className="page-desc">{isCommunity ? '社区岗位池开发中；当前操作不会写入任何账户数据。' : '当前为访客模式，结果仅保存在虚构的演示数据中。'}</p>}
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setPoolOperationResult(null)}>知道了</button></div>
          </div>
        </div>
      )}
    </section>
  )
}

interface SharedRowProps {
  app: Application
  copied: boolean
  selected: boolean
  source?: JobSource
  onToggle: (id: string) => void
  onCopy: (app: Application) => void
  onDelete: (ids: string[]) => Promise<void>
  canDelete: boolean
  deleting: boolean
  pathBase: string
  applicationsPath: string
  onOpenDetail: () => void
}

function SharedRow({ app, copied, selected, source, onToggle, onCopy, onDelete, canDelete, deleting, pathBase, applicationsPath, onOpenDetail }: SharedRowProps) {
  return (
    <tr className={selected ? 'ledger-row ledger-row-selected' : 'ledger-row'}>
      <td className="cell-check" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={() => onToggle(app.id)} aria-label={`选择 ${app.companyName} · ${app.jobTitle}`} />
      </td>
      <td className="cell-no">{app.no ?? '—'}</td>
      <td>
        <div className="cell-company"><Link to={`${pathBase}/jobs/${app.id}?nb`} onClick={onOpenDetail} target={window.innerWidth > 767 ? '_blank' : undefined}>{app.companyName}</Link></div>
        <div className="cell-job">{app.jobTitle}</div>
        {sourceText(source) && <div className="cell-source">{sourceText(source)}</div>}
      </td>
      <td>{app.jobDirection || '—'}</td>
      <td>{app.locations.join('、') || '—'}</td>
      <td>{app.deadline || '—'}</td>
      <td>
        {copied
          ? <Link to={applicationsPath} className="btn btn-outline btn-sm">已复制</Link>
          : <button type="button" className="btn btn-outline btn-sm" onClick={() => void onCopy(app)}>纳入我的岗位池</button>}
      </td>
      <td className="shared-row-actions"><Link to={`${pathBase}/jobs/${app.id}?nb`} onClick={onOpenDetail} className="btn btn-outline btn-sm" target={window.innerWidth > 767 ? '_blank' : undefined}>查看</Link>{canDelete && <button type="button" className="btn btn-danger btn-sm" disabled={deleting} title="删除该岗位" onClick={() => void onDelete([app.id])}>删除</button>}</td>
    </tr>
  )
}

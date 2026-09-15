import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMode } from '../hooks/useMode'
import { useAppData } from '../hooks/useAppData'
import { useAppPath } from '../hooks/useAppPath'
import { useAuth } from '../hooks/useAuth'
import InfoItem from '../components/InfoItem'
import { addDays, isValidUrl, normalizeApplication, today } from '../utils/helpers'
import { buildLedgerList, EMPTY_LEDGER_FILTERS } from '../utils/ledger'
import type { LedgerFilters, LedgerSort } from '../utils/ledger'
import type { Application } from '../types'
import { COMMUNITY_POOLS } from '../data/communityPools'

interface EditableField {
  key: keyof Application
  label: string
  type: 'text' | 'textarea' | 'list'
}

const EDITABLE_FIELDS: EditableField[] = [
  { key: 'companyName', label: '企业名称', type: 'text' },
  { key: 'jobTitle', label: '岗位名称', type: 'text' },
  { key: 'jobDirection', label: '岗位方向', type: 'text' },
  { key: 'employmentType', label: '岗位性质', type: 'text' },
  { key: 'industry', label: '所属行业', type: 'text' },
  { key: 'companyType', label: '企业类型', type: 'text' },
  { key: 'location', label: '工作地点', type: 'text' },
  { key: 'educationRequirements', label: '学历要求', type: 'list' },
  { key: 'graduationYears', label: '届次要求', type: 'list' },
  { key: 'majors', label: '招聘专业', type: 'text' },
  { key: 'publishedAt', label: '发布时间', type: 'text' },
  { key: 'deadline', label: '截止日期', type: 'text' },
  { key: 'jobDescription', label: '岗位详情', type: 'textarea' },
  { key: 'jobRequirements', label: '岗位要求', type: 'textarea' },
  { key: 'hireProcess', label: '录用流程', type: 'textarea' },
  { key: 'benefits', label: '福利待遇', type: 'textarea' },
  { key: 'applicationUrl', label: '投递地址', type: 'text' },
  { key: 'announcementUrl', label: '公告链接', type: 'text' },
]

interface LoadedJob {
  id: string
  no: number
  revision: number
  payload: Application
  sourceName?: string
  addedAt?: string
}

function toList(value: unknown): string {
  if (Array.isArray(value)) return (value as string[]).join('、')
  return typeof value === 'string' ? value : ''
}

export default function SharedJobDetail({ variant }: { variant?: 'community' }) {
  const { poolId, jobId } = useParams()
  const isCommunity = variant === 'community'
  const communityPool = isCommunity ? COMMUNITY_POOLS.find((pool) => pool.id === poolId) : undefined
  const base = isCommunity ? `/community-pools/${poolId ?? ''}` : `/pools/${poolId ?? ''}`
  const mode = useMode()
  const appPath = useAppPath()
  const { user } = useAuth()
  const [loaded, setLoaded] = useState<LoadedJob | null>(null)
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Application | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPreviewNotice, setShowPreviewNotice] = useState(false)
  const [siblings, setSiblings] = useState<string[]>([])
  const [copiedToPersonal, setCopiedToPersonal] = useState(false)
  const [poolJobsMap, setPoolJobsMap] = useAppData('pool-jobs', {})
  const [, setPoolEventsMap] = useAppData('pool-events', {})
  const [copyMappings, setCopyMappings] = useAppData('copy-mappings', {})
  const [, setPreviewApplications] = useAppData('applications', [])

  const sharedStateKey = mode === 'preview'
    ? `preview:shared-pool:${poolId ?? 'unknown'}:view`
    : `account:${user?.id ?? 'anonymous'}:shared-pool:${poolId ?? 'unknown'}:view`

  const filteredSiblingIds = useMemo(() => {
    const readState = (): { view?: 'all' | 'uncopied'; filters?: LedgerFilters; sortBy?: LedgerSort } => {
      try {
        return JSON.parse(localStorage.getItem(sharedStateKey) ?? '{}') as { view?: 'all' | 'uncopied'; filters?: LedgerFilters; sortBy?: LedgerSort }
      } catch {
        return {}
      }
    }
    const state = readState()
    const copiedIds = !isCommunity && mode === 'preview' ? new Set(Object.keys(copyMappings[poolId ?? ''] ?? {})) : new Set<string>()
    const sourceApps = isCommunity
      ? (communityPool?.jobs ?? []).map((item, index) => normalizeApplication({ ...item, no: index + 1 }))
      : mode === 'preview'
        ? (poolJobsMap[poolId ?? ''] ?? []).map((item) => normalizeApplication({ ...(JSON.parse(item.payload_json) as Application), id: item.id, no: item.no }))
        : []
    const visible = state.view === 'uncopied' ? sourceApps.filter((item) => !copiedIds.has(item.id)) : sourceApps
    return buildLedgerList(visible, 'all', { ...EMPTY_LEDGER_FILTERS, ...state.filters }, state.sortBy ?? 'no', {
      today: today(),
      in3: addDays(new Date(), 3),
      in7: addDays(new Date(), 7),
      in15: addDays(new Date(), 15),
    }).map((item) => item.id)
  }, [copyMappings, mode, poolId, poolJobsMap, sharedStateKey, isCommunity, communityPool])

  useEffect(() => {
    if (!poolId || !jobId) return
    if (isCommunity) {
      const index = (communityPool?.jobs ?? []).findIndex((item) => item.id === jobId)
      const found = index >= 0 ? communityPool?.jobs[index] : undefined
      if (!found) {
        setMessage('未找到该社区演示岗位。')
        return
      }
      setLoaded({ id: found.id, no: index + 1, revision: 1, payload: normalizeApplication({ ...found, no: index + 1 }), sourceName: '社区演示', addedAt: '' })
      setCopiedToPersonal(false)
      setSiblings(filteredSiblingIds)
      return
    }
    if (mode === 'preview') {
      const found = (poolJobsMap[poolId] ?? []).find((item) => item.id === jobId)
      if (!found) {
        setMessage('未找到该共享岗位。')
        return
      }
      const payload = normalizeApplication(JSON.parse(found.payload_json) as Application)
      setLoaded({ id: found.id, no: found.no, revision: 1, payload, sourceName: '演示用户', addedAt: '' })
      setCopiedToPersonal(Boolean(copyMappings[poolId]?.[jobId]))
      setSiblings(filteredSiblingIds)
      return
    }
    void fetch(`/api/pools/${poolId}/jobs`).then(async (response) => {
      if (!response.ok) throw new Error('无法读取岗位')
      const body = await response.json() as { jobs: Array<{ id: string; no: number; revision: number; payload_json: string; copied_to_personal: number; added_by_name?: string; added_at?: string }> }
      const found = body.jobs.find((item) => item.id === jobId)
      if (!found) throw new Error('未找到岗位')
      const records = body.jobs.map((item) => ({
        app: normalizeApplication({ ...(JSON.parse(item.payload_json) as Application), id: item.id, no: item.no }),
        copied: item.copied_to_personal === 1,
      }))
      const state = (() => { try { return JSON.parse(localStorage.getItem(sharedStateKey) ?? '{}') as { view?: 'all' | 'uncopied'; filters?: LedgerFilters; sortBy?: LedgerSort } } catch { return {} } })()
      const visible = state.view === 'uncopied' ? records.filter((item) => !item.copied).map((item) => item.app) : records.map((item) => item.app)
      setLoaded({ id: found.id, no: found.no, revision: found.revision, payload: normalizeApplication({ ...(JSON.parse(found.payload_json) as Application), id: found.id, no: found.no }), sourceName: found.added_by_name ?? '某用户', addedAt: found.added_at ?? '' })
      setCopiedToPersonal(found.copied_to_personal === 1)
      setSiblings(buildLedgerList(visible, 'all', { ...EMPTY_LEDGER_FILTERS, ...state.filters }, state.sortBy ?? 'no', { today: today(), in3: addDays(new Date(), 3), in7: addDays(new Date(), 7), in15: addDays(new Date(), 15) }).map((item) => item.id))
    }).catch(() => setMessage('未找到该共享岗位。'))
  }, [jobId, poolId, mode, poolJobsMap, copyMappings, filteredSiblingIds, sharedStateKey, isCommunity, communityPool])

  const copyToPersonal = async () => {
    if (!loaded || !poolId || !jobId || busy || copiedToPersonal) return
    if (isCommunity) {
      setShowPreviewNotice(true)
      return
    }
    setBusy(true)
    try {
      if (mode === 'preview') {
        const mapping = { ...(copyMappings[poolId] ?? {}) }
        if (mapping[jobId]) {
          setCopiedToPersonal(true)
          return
        }
        const newId = `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        setPreviewApplications((current) => {
          const maxNo = current.reduce((max, item) => Math.max(max, item.no ?? 0), 0)
          return [...current, { ...loaded.payload, id: newId, no: maxNo + 1, importedAt: new Date().toISOString().slice(0, 10), source: '群组岗位池复制' }]
        })
        mapping[jobId] = newId
        setCopyMappings((current) => ({ ...current, [poolId]: mapping }))
        setCopiedToPersonal(true)
        setMessage('已纳入我的岗位池，可继续进行个人筛选与管理（仅演示数据）。')
        return
      }
      const poolsResponse = await fetch('/api/pools')
      const poolsBody = await poolsResponse.json() as { pools?: Array<{ id: string; kind: string }> }
      const personal = poolsBody.pools?.find((pool) => pool.kind === 'personal')
      if (!personal) {
        setMessage('未找到你的个人岗位池。')
        return
      }
      const response = await fetch(`/api/pools/${personal.id}/jobs/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceJobId: jobId }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) {
        setMessage(body.error ?? '纳入失败，请稍后重试。')
        return
      }
      setCopiedToPersonal(true)
      setMessage('已纳入我的岗位池，可继续进行个人筛选与管理。')
    } catch {
      setMessage('处理过程中出现网络问题，请稍后重试。')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = () => {
    if (loaded) {
      setDraft({ ...loaded.payload })
      setEditing(true)
    }
  }

  const setField = (key: keyof Application, raw: string) => {
    if (!draft) return
    const value = EDITABLE_FIELDS.find((f) => f.key === key)?.type === 'list'
      ? raw.split('、').map((s) => s.trim()).filter(Boolean)
      : raw
    setDraft({ ...draft, [key]: value } as Application)
  }

  const saveEdit = async () => {
    if (!loaded || !draft || !poolId || !jobId) return
    setBusy(true)
    try {
      if (mode === 'preview') {
        const original = loaded.payload
        const changed: Record<string, boolean> = {}
        for (const field of EDITABLE_FIELDS) {
          const before = field.type === 'list' ? toList(original[field.key]) : String(original[field.key] ?? '')
          const after = field.type === 'list' ? toList(draft[field.key]) : String(draft[field.key] ?? '')
          if (before !== after) changed[field.key] = true
        }
        const newRevision = loaded.revision + 1
        setPoolJobsMap((current) => ({
          ...current,
          [poolId]: (current[poolId] ?? []).map((item) =>
            item.id === jobId
              ? { ...item, payload_json: JSON.stringify({ ...draft, id: item.id, no: item.no }), revision: newRevision }
              : item,
          ),
        }))
        setPoolEventsMap((current) => ({
          ...current,
          [poolId]: [
            ...(current[poolId] ?? []),
            { job_id: jobId, actor_name: '演示用户', action: 'updated', changed_fields_json: JSON.stringify(changed), created_at: new Date().toISOString() },
          ],
        }))
        setLoaded({ ...loaded, payload: draft, revision: newRevision })
        setEditing(false)
        setMessage('已保存修改（仅演示数据）。')
      } else {
        const response = await fetch(`/api/pools/${poolId}/jobs/${jobId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: loaded.revision, job: draft }),
        })
        const body = await response.json() as { job?: Application; revision?: number; error?: string }
        if (!response.ok) {
          setMessage(body.error ?? '保存失败，请刷新后重试。')
          return
        }
        setLoaded({ ...loaded, payload: body.job ?? draft, revision: body.revision ?? loaded.revision + 1 })
        setEditing(false)
        setMessage('已保存修改。')
      }
    } finally {
      setBusy(false)
    }
  }

  const deleteJob = async () => {
    if (!loaded || !poolId || !jobId) return
    if (!window.confirm('确认删除该共享岗位？此操作会记录到共享动态，且不可恢复。')) return
    setBusy(true)
    try {
      if (mode === 'preview') {
        setPoolJobsMap((current) => ({
          ...current,
          [poolId]: (current[poolId] ?? []).filter((item) => item.id !== jobId),
        }))
        window.location.href = appPath(base)
      } else {
        const response = await fetch(`/api/pools/${poolId}/jobs/${jobId}`, { method: 'DELETE' })
        const body = await response.json() as { error?: string }
        if (!response.ok) {
          setMessage(body.error ?? '删除失败，请稍后重试。')
          return
        }
        window.location.href = appPath(base)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return <section><Link to={appPath(base)} className="back-link">← 返回{isCommunity ? '社区岗位池' : '共享岗位列表'}</Link><p className="page-desc">{message || '正在读取岗位信息…'}</p></section>

  if (editing && draft) {
    return (
      <section>
        <Link to={appPath(`${base}/jobs/${jobId}`)} className="back-link">← 取消编辑</Link>
        <h1 className="page-title">编辑共享岗位 #{loaded.no} {draft.companyName} · {draft.jobTitle}</h1>
        <div className="card job-edit-form">
          {EDITABLE_FIELDS.map((field) => (
            <label className="edit-field" key={field.key}>
              <span className="edit-label">{field.label}</span>
              {field.type === 'textarea' ? (
                <textarea className="field-input" rows={4} value={String(draft[field.key] ?? '')} onChange={(e) => setField(field.key, e.target.value)} />
              ) : (
                <input className="field-input" value={field.type === 'list' ? toList(draft[field.key]) : String(draft[field.key] ?? '')} onChange={(e) => setField(field.key, e.target.value)} />
              )}
            </label>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn" disabled={busy} onClick={() => void saveEdit()}>保存</button>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setEditing(false)}>取消</button>
          </div>
        </div>
      </section>
    )
  }

  const job = loaded.payload
  const applicationUrl = isValidUrl(job.applicationUrl) ? job.applicationUrl : ''
  const announcementUrl = isValidUrl(job.announcementUrl) ? job.announcementUrl : ''
  const siblingIndex = siblings.indexOf(jobId ?? '')
  const prevJobId = siblingIndex > 0 ? siblings[siblingIndex - 1] : ''
  const nextJobId = siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : ''
  return (
    <section>
      <Link to={appPath(base)} className="back-link">← 返回{isCommunity ? '社区岗位池' : '共享岗位列表'}</Link>
      <div className="detail-nav">
        {siblings.length > 1 && (
          <>
          {prevJobId
            ? <Link to={appPath(`${base}/jobs/${prevJobId}`)} className="btn btn-outline btn-sm">← 上一条</Link>
            : <span className="btn btn-outline btn-sm btn-disabled">← 上一条</span>}
          <span className="detail-nav-count">{siblingIndex + 1} / {siblings.length}</span>
          {nextJobId
            ? <Link to={appPath(`${base}/jobs/${nextJobId}`)} className="btn btn-outline btn-sm">下一条 →</Link>
            : <span className="btn btn-outline btn-sm btn-disabled">下一条 →</span>}
          </>
        )}
        {copiedToPersonal
          ? <Link to={appPath('/applications')} className="btn btn-outline btn-sm">已纳入我的岗位池</Link>
          : <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void copyToPersonal()}>{busy ? '纳入中…' : '纳入我的岗位池'}</button>}
      </div>
      <h1 className="page-title">#{job.no} {job.companyName} · {job.jobTitle}</h1>
       <p className="page-desc">{isCommunity ? '查看岗位资料；纳入“我的岗位池”后，可继续完成个人筛选、投递与任务管理。' : '共享岗位详情：仅展示岗位资料，不含任何成员的个人筛选或投递信息。'}</p>
       {isCommunity && (
        <div className="feature-preview-banner">
          <b>目标功能</b>：社区岗位池按专业、城市、行业、届次与岗位类型汇集公开岗位线索；发现合适机会后，可纳入我的岗位池继续筛选、投递与任务管理。<br /><b>实现路径</b>：持续接入可信岗位来源，完善专业分区与检索体系、岗位审核与更新机制、池内动态及社区协作规则。
        </div>
       )}
      {loaded.sourceName && (
        <p className="detail-imported">
          添加时间：{loaded.addedAt ? loaded.addedAt.slice(0, 10) : '—'} · 来源：{loaded.sourceName} 添加
        </p>
      )}
      {(applicationUrl || announcementUrl) && (
        <div className="detail-actions shared-link-actions">
          {applicationUrl && (
            <a className="btn" href={applicationUrl} target="_blank" rel="noreferrer">
              打开投递地址
            </a>
          )}
          {announcementUrl && (
            <a className="btn btn-outline" href={announcementUrl} target="_blank" rel="noreferrer">
              打开公告链接
            </a>
          )}
        </div>
      )}
      <div className="detail-grid shared-detail-grid">
        <InfoItem label="岗位方向" value={job.jobDirection} /><InfoItem label="岗位性质" value={job.employmentType} />
        <InfoItem label="所属行业" value={job.industries?.join('、') || job.industry} /><InfoItem label="企业类型" value={job.companyType} />
        <InfoItem label="工作地点" value={job.locations?.join('、') || job.location} /><InfoItem label="学历要求" value={job.educationRequirements?.join('、')} />
        <InfoItem label="届次要求" value={job.graduationYears?.join('、')} /><InfoItem label="招聘专业" value={job.majors} />
        <InfoItem label="发布时间" value={job.publishedAt} /><InfoItem label="截止日期" value={job.deadline} />
        <InfoItem label="岗位详情" value={job.jobDescription} multiline /><InfoItem label="岗位要求" value={job.jobRequirements ?? ''} multiline />
        <InfoItem label="录用流程" value={job.hireProcess ?? ''} multiline /><InfoItem label="福利待遇" value={job.benefits} multiline />
      </div>
      {!isCommunity && <div className="pool-card-actions">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={startEdit}>编辑</button>
        <button type="button" className="btn btn-outline btn-danger" disabled={busy} onClick={() => void deleteJob()}>删除</button>
      </div>}
      {showPreviewNotice && (
        <div className="modal-overlay" onClick={() => setShowPreviewNotice(false)}>
          <div className="modal demo-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="section-title">纳入我的岗位池（开发中）</h2>
            <p className="page-desc">正式接入后，点击此按钮会为当前账户创建该岗位的个人副本，并跳转至“我的岗位池”继续筛选、投递和创建任务。个人备注、筛选状态与投递进度不会写回社区岗位池，也不会自动投递。</p>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setShowPreviewNotice(false)}>知道了</button></div>
          </div>
        </div>
      )}
    </section>
  )
}

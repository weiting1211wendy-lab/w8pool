import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useMode } from '../hooks/useMode'
import { normalizeApplication } from '../utils/helpers'
import type { Application } from '../types'

const DATA_KEYS = [
  'applications',
  'tasks',
  'sticky-notes',
  'profile',
  'application-events',
  'custom-tags',
  'job-note-tags',
] as const

const DATA_LABELS: Record<string, string> = {
  applications: '岗位', tasks: '任务', 'sticky-notes': '便签', profile: '网申材料',
  'application-events': '个人操作记录', 'custom-tags': '快捷标签', 'job-note-tags': '岗位标签',
}

type RestoreStat = { key: string; incoming: number; added: number; duplicate: number }
type RestorePlan = { data: Record<string, unknown>; stats: RestoreStat[]; applications: Application[] }
type BackupMetadata = { version: 2; issuedAt: string; signature: string }
type AccountBackup = { format: 'w8pool-account-backup'; version: 2; metadata: BackupMetadata; data: Record<string, unknown> }
type RecoverySnapshot = { id: string; reason: string; createdAt: string; jobs: number; toReview: number; maybe: number; selected: number; skipped: number; tasks: number; documents: number }
type RollbackPreview = {
  snapshot: RecoverySnapshot
  scope: string
  stateChanges: Array<{ id: string; companyName: string; jobTitle: string; before: { screeningStatus: string; applicationStatus: string; priority: number; appliedAt: string; notes: string }; after: { screeningStatus: string; applicationStatus: string; priority: number; appliedAt: string; notes: string } }>
  documentChanges: Array<{ key: string; beforeCount: number; afterCount: number }>
  preservedNewJobs: number
  unavailableJobs: number
}

const SCREENING_LABELS: Record<string, string> = { to_review: '待筛选', maybe: '待定', selected: '决定推进', skipped: '暂不考虑' }
const PROGRESS_LABELS: Record<string, string> = { pending: '待投递', submitted: '已投递', written_test: '笔试', interview: '面试', offer: 'Offer', rejected: '未通过' }

function countItems(value: unknown): number {
  if (value == null) return 0
  if (Array.isArray(value)) return value.length
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length || 1
  return 1
}

function itemKey(value: unknown): string {
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>
    if (item.companyName && item.jobTitle) return `job:${String(item.companyName).toLowerCase()}|${String(item.jobTitle).toLowerCase()}`
    if (item.id) return `id:${String(item.id)}`
  }
  return JSON.stringify(value)
}

function mergeBackupValue(incoming: unknown, current: unknown) {
  const incomingCount = countItems(incoming)
  if (incoming == null) return { value: current, added: 0, duplicate: 0, incoming: 0 }
  if (Array.isArray(incoming)) {
    const existing = Array.isArray(current) ? current : []
    const known = new Set(existing.map(itemKey))
    const additions = incoming.filter((item) => {
      const key = itemKey(item)
      if (known.has(key)) return false
      known.add(key)
      return true
    })
    return { value: [...existing, ...additions], added: additions.length, duplicate: incoming.length - additions.length, incoming: incoming.length }
  }
  if (current == null || countItems(current) === 0 || isEffectivelyEmpty(current)) return { value: incoming, added: incomingCount, duplicate: 0, incoming: incomingCount }
  return { value: current, added: 0, duplicate: incomingCount, incoming: incomingCount }
}

function isEffectivelyEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0 || value.every(isEffectivelyEmpty)
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isEffectivelyEmpty)
  return false
}

function normalizeLegacyData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => {
    if (typeof value !== 'string') return [key, value]
    try { return [key, JSON.parse(value)] } catch { return [key, value] }
  }))
}

function formatStats(stats: RestoreStat[], field: 'incoming' | 'added') {
  return stats.filter((stat) => stat[field] > 0).map((stat) => `${DATA_LABELS[stat.key] ?? stat.key} ${stat[field]} 条`).join('、') || '无可处理数据'
}

function formatDate(value: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatStamp(ts: number | null): string {
  if (!ts) return '尚未备份'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function contentHash(data: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

export default function AccountCenter() {
  const mode = useMode()
  const { user } = useAuth()
  const [lastBackup, setLastBackup] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [restorePlan, setRestorePlan] = useState<RestorePlan | null>(null)
  const [restoreKind, setRestoreKind] = useState<'bound' | 'legacy'>('bound')
  const [recoverySnapshots, setRecoverySnapshots] = useState<RecoverySnapshot[]>([])
  const [rollingBackId, setRollingBackId] = useState<string | null>(null)
  const [rollbackPreview, setRollbackPreview] = useState<RollbackPreview | null>(null)
  const [previewingSnapshotId, setPreviewingSnapshotId] = useState<string | null>(null)
  const [creatingSnapshot, setCreatingSnapshot] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const storagePrefix = mode === 'preview' ? 'preview:' : (user ? `account:${user.id}:` : '')
  const backupKey = `backup-at:${storagePrefix}`

  useEffect(() => {
    const raw = localStorage.getItem(backupKey)
    setLastBackup(raw ? Number(raw) : null)
  }, [backupKey])

  const refreshRecoverySnapshots = async () => {
    if (mode === 'preview' || !user) { setRecoverySnapshots([]); return }
    await fetch('/api/workspace/recovery/snapshots').then(async (response) => {
      if (!response.ok) return null
      return await response.json() as { snapshots?: RecoverySnapshot[] }
    }).then((body) => setRecoverySnapshots(body?.snapshots ?? [])).catch(() => undefined)
  }

  useEffect(() => {
    void refreshRecoverySnapshots()
  }, [mode, user?.id])

  const buildSnapshot = () => {
    const snapshot: Record<string, unknown> = {}
    for (const key of DATA_KEYS) {
      const raw = localStorage.getItem(storagePrefix + key)
      snapshot[key] = raw ? JSON.parse(raw) : null
    }
    return snapshot
  }

  const downloadJson = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const fetchCloudApplications = async (): Promise<Application[]> => {
    const poolsResponse = await fetch('/api/pools')
    if (!poolsResponse.ok) return []
    const body = (await poolsResponse.json()) as { pools: Array<{ id: string; kind: string }> }
    const personal = (body.pools ?? []).find((p) => p.kind === 'personal')
    if (!personal) return []
    const jobsResponse = await fetch(`/api/pools/${personal.id}/jobs`)
    if (!jobsResponse.ok) return []
    const jobsBody = (await jobsResponse.json()) as {
      jobs: Array<{
        id: string
        no: number
        payload_json: string
        revision: number
        created_at: string
        updated_at: string
        screening_status: Application['screeningStatus'] | null
        application_status: Application['applicationStatus'] | null
        priority: number | null
        personal_notes: string | null
        added_at: string
      }>
    }
    return (jobsBody.jobs ?? []).map((job) => {
      const payload = JSON.parse(job.payload_json) as Partial<Application>
      return normalizeApplication({
        ...payload,
        id: job.id,
        no: job.no,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        screeningStatus: job.screening_status ?? 'to_review',
        applicationStatus: job.application_status ?? 'pending',
        priority: job.priority ?? 0,
        notes: job.personal_notes ?? '',
        importedAt: (job.added_at || job.created_at || '').slice(0, 10),
      } as Application)
    })
  }

  const handleExportAll = async () => {
    const snapshot = buildSnapshot()
    if (mode !== 'preview') {
      try {
        const cloudApps = await fetchCloudApplications()
        if (cloudApps.length > 0) snapshot.applications = cloudApps
      } catch {
        // 忽略云端读取失败，沿用本地快照
      }
    }
    let backup: Record<string, unknown> | AccountBackup = snapshot
    if (mode !== 'preview') {
      try {
        const payloadHash = await contentHash(snapshot)
        const response = await fetch('/api/backups/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payloadHash }),
        })
        const body = (await response.json().catch(() => ({}))) as Partial<BackupMetadata> & { error?: string }
        if (!response.ok || body.version !== 2 || !body.issuedAt || !body.signature) throw new Error(body.error ?? '无法创建账户备份')
        backup = {
          format: 'w8pool-account-backup', version: 2,
          metadata: { version: 2, issuedAt: body.issuedAt, signature: body.signature }, data: snapshot,
        }
      } catch (error) {
        setMessage(`下载未完成：${error instanceof Error ? error.message : '无法创建账户备份'}。`)
        return
      }
    }
    downloadJson(`w8pool-backup-${mode}-${formatDate(new Date().toISOString())}.json`, backup)
    localStorage.setItem(backupKey, String(Date.now()))
    setLastBackup(Date.now())
    setMessage(`已下载当前账户备份：${formatStats(DATA_KEYS.map((key) => ({ key, incoming: countItems(snapshot[key]), added: 0, duplicate: 0 })), 'incoming')}。${mode === 'preview' ? '仅包含访客演示数据。' : '仅包含当前账户的私有数据，不包含群组岗位池中的共享数据；备份已与当前账户绑定，仅能由同一账户恢复。'}`)
  }

  const importApplicationsToCloud = async (apps: Application[]): Promise<number> => {
    if (!apps.length) return 0
    const poolsResponse = await fetch('/api/pools')
    if (!poolsResponse.ok) throw new Error('无法读取岗位池')
    const body = (await poolsResponse.json()) as { pools: Array<{ id: string; kind: string }> }
    const personal = (body.pools ?? []).find((p) => p.kind === 'personal')
    if (!personal) throw new Error('未找到个人岗位池')
    const response = await fetch(`/api/pools/${personal.id}/jobs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applications: apps, skipDuplicates: true }),
    })
    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(errBody.error ?? '导入岗位到云端失败')
    }
    const result = (await response.json()) as { added?: number }
    return result.added ?? apps.length
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
        const parsed = JSON.parse(await file.text()) as unknown
        let data: Record<string, unknown>
        let migrationVerified = false
        if (mode === 'preview') {
          data = parsed && typeof parsed === 'object' && 'data' in parsed
            ? (parsed as { data: Record<string, unknown> }).data : parsed as Record<string, unknown>
        } else {
          const backup = parsed as Partial<AccountBackup>
          if (backup?.format !== 'w8pool-account-backup' || backup.version !== 2 || !backup.data) {
            throw new Error('此备份为旧版或未绑定文件，无法恢复。请使用当前账户重新下载备份。')
          }
          const payloadHash = await contentHash(backup.data)
          const verifyResponse = await fetch(restoreKind === 'legacy' ? '/api/backups/verify-legacy-migration' : '/api/backups/verify', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(restoreKind === 'legacy' ? { payloadHash } : { payloadHash, metadata: backup.metadata }),
          })
          const verifyBody = (await verifyResponse.json().catch(() => ({}))) as { error?: string }
          if (!verifyResponse.ok) throw new Error(verifyBody.error ?? (restoreKind === 'legacy' ? '旧备份迁移校验失败' : '账户备份校验失败'))
          migrationVerified = restoreKind === 'legacy'
          data = migrationVerified ? normalizeLegacyData(backup.data) : backup.data
        }
        if (!data || typeof data !== 'object') throw new Error('格式不正确')
        const current = buildSnapshot()
        if (mode !== 'preview') {
          try { current.applications = await fetchCloudApplications() } catch { /* use local snapshot */ }
        }
        const next: Record<string, unknown> = {}
        const stats: RestoreStat[] = []
        for (const key of DATA_KEYS) {
          if (Object.prototype.hasOwnProperty.call(data, key) && data[key] != null) {
            const merged = mergeBackupValue(data[key], current[key])
            next[key] = merged.value
            stats.push({ key, incoming: merged.incoming, added: merged.added, duplicate: merged.duplicate })
          }
        }
        const apps = (stats.find((stat) => stat.key === 'applications')?.added ?? 0) > 0 && Array.isArray(data.applications)
          ? (data.applications as Application[]).filter((app) => !new Set((current.applications as Application[] ?? []).map(itemKey)).has(itemKey(app))) : []
        setRestorePlan({ data: next, stats, applications: apps })
        setMessage(`${mode === 'preview' ? '' : migrationVerified ? '已通过旧备份迁移校验；' : '已通过账户绑定校验；'}已完成备份分析，尚未写入数据。默认只恢复新增内容并跳过重复项。`)
        event.target.value = ''
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '文件解析失败，请确认是有效的备份文件（JSON）。')
      event.target.value = ''
    }
  }

  const confirmRestore = async () => {
    if (!restorePlan) return
    try {
      for (const [key, value] of Object.entries(restorePlan.data)) localStorage.setItem(storagePrefix + key, JSON.stringify(value))
      let cloudAdded = 0
      if (mode !== 'preview') cloudAdded = await importApplicationsToCloud(restorePlan.applications)
      setMessage(`已恢复新增内容：${formatStats(restorePlan.stats, 'added')}${cloudAdded ? `；其中岗位 ${cloudAdded} 条已写入云端` : ''}。重复内容已跳过，即将刷新页面…`)
      setRestorePlan(null)
      window.setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      setMessage(`恢复未完成：${error instanceof Error ? error.message : '未知错误'}。未自动覆盖已有数据。`)
    }
  }

  const handleLogout = async () => {
    if (mode === 'preview') {
      setMessage('演示环境无需退出登录。')
      return
    }
    if (!window.confirm('退出登录后，您的账户数据会保留；您设备上的本地数据不会因退出而删除，下次登录可继续使用。确认退出？')) return
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    window.location.href = '/'
  }

  const rollbackToSnapshot = async (snapshot: RecoverySnapshot) => {
    setRollingBackId(snapshot.id)
    try {
      const response = await fetch('/api/workspace/recovery/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshotId: snapshot.id }),
      })
      const body = await response.json().catch(() => ({})) as { restoredStates?: number; preservedNewJobs?: number; error?: string }
      if (!response.ok) throw new Error(body.error ?? '回滚未完成')
      setMessage(`已回滚 ${body.restoredStates ?? 0} 条岗位的私有状态；快照后新增岗位已保留 ${body.preservedNewJobs ?? 0} 条。正在刷新页面…`)
      setRollbackPreview(null)
      window.setTimeout(() => window.location.reload(), 900)
    } catch (error) {
      setMessage(`回滚未完成：${error instanceof Error ? error.message : '未知错误'}。当前数据未被覆盖。`)
    } finally {
      setRollingBackId(null)
    }
  }

  const openRollbackPreview = async (snapshot: RecoverySnapshot) => {
    setPreviewingSnapshotId(snapshot.id)
    try {
      const response = await fetch('/api/workspace/recovery/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ snapshotId: snapshot.id }),
      })
      const body = await response.json().catch(() => ({})) as Omit<RollbackPreview, 'snapshot'> & { error?: string }
      if (!response.ok) throw new Error(body.error ?? '无法生成回滚预览')
      setRollbackPreview({ ...body, snapshot })
    } catch (error) {
      setMessage(`无法生成回滚预览：${error instanceof Error ? error.message : '未知错误'}。`)
    } finally {
      setPreviewingSnapshotId(null)
    }
  }

  const createRecoverySnapshotNow = async () => {
    if (mode === 'preview' || !user) return
    setCreatingSnapshot(true)
    try {
      const response = await fetch('/api/workspace/recovery/snapshots', { method: 'POST' })
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? '快照生成失败')
      setMessage('已手动生成当前账户私有数据快照。当前仅保留 48 小时内、最多 6 个可回滚版本。')
      await refreshRecoverySnapshots()
    } catch (error) {
      setMessage(`快照生成失败：${error instanceof Error ? error.message : '未知错误'}。`)
    } finally {
      setCreatingSnapshot(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (mode === 'preview') {
      setMessage('演示环境无需注销账户。')
      return
    }
    try {
      const poolsResponse = await fetch('/api/pools')
      if (poolsResponse.ok) {
        const body = await poolsResponse.json() as { pools: Array<{ kind: string; role: string }> }
        const owned = (body.pools ?? []).filter((pool) => pool.kind === 'group' && pool.role === 'owner')
        if (owned.length > 0) {
          setMessage(`你是 ${owned.length} 个群组岗位池的创建者，请先在「群组岗位池」转让或删除后再注销账户。`)
          return
        }
      }
    } catch {
      // 忽略，继续注销
    }
    if (!window.confirm('注销账户将永久删除本账户的全部数据（本机与云端），且不可恢复。确认注销？')) return
    const response = await fetch('/api/auth/account', { method: 'DELETE' }).catch(() => null)
    if (response && !response.ok) {
      const body = (await response.json().catch(() => ({})) as { error?: string })
      setMessage(body.error ?? '注销失败，请稍后重试。')
      return
    }
    for (const key of DATA_KEYS) localStorage.removeItem(storagePrefix + key)
    localStorage.removeItem(backupKey)
    window.location.href = '/'
  }

  return (
    <section>
      <h1 className="page-title">个人中心</h1>
      <p className="page-desc">管理当前模式下的资料、备份与恢复；所有数据操作均保持独立，不会读取或覆盖他人数据。</p>

      <div className="card">
        <h2 className="section-title">账户信息</h2>
        {user && mode !== 'preview' ? (
          <div className="overview-grid">
            <div className="overview-item"><span className="overview-label">用户名</span><span className="overview-num">{user.username}</span></div>
            <div className="overview-item"><span className="overview-label">绑定邮箱</span><span className="overview-num">{user.email}</span></div>
            <div className="overview-item"><span className="overview-label">注册时间</span><span className="overview-num">{formatDate(user.createdAt)}</span></div>
          </div>
        ) : (
          <p className="page-desc">未登录（演示环境无账户信息）。</p>
        )}
      </div>

      {mode !== 'preview' && (
        <div className="card">
          <h2 className="section-title">云端历史与回滚</h2>
          <p className="page-desc">系统在账户有操作时定期保留云端快照；当前仅展示 48 小时内、最多 6 个可回滚版本，并在回滚前自动再保存当前版本。回滚会恢复快照内的私有状态与资料；不会删除之后新增的岗位。</p>
          <div className="data-mgmt-actions">
            <button type="button" className="btn" disabled={creatingSnapshot} onClick={() => void createRecoverySnapshotNow()}>
              {creatingSnapshot ? '正在生成快照…' : '立即生成快照'}
            </button>
            <span className="file-save-caption">建议在大批量筛选、批量导入或集中修改前后手动留一个恢复点。</span>
          </div>
          {recoverySnapshots.length === 0 ? (
            <p className="file-save-caption">暂未生成可用快照。完成一次正常同步后，系统会自动创建第一份云端快照。</p>
          ) : (
            <div className="data-mgmt-block">
              {recoverySnapshots.map((snapshot) => (
                <div className="recovery-snapshot-row" key={snapshot.id}>
                  <span className="overview-label">{formatStamp(new Date(snapshot.createdAt).getTime())} · 岗位 {snapshot.jobs} 条（待筛选 {snapshot.toReview}｜待定 {snapshot.maybe}｜决定推进 {snapshot.selected}｜暂不考虑 {snapshot.skipped}）· 任务 {snapshot.tasks} 条 · 私有资料 {snapshot.documents} 类</span>
                  <button type="button" className="btn btn-outline" disabled={rollingBackId !== null || previewingSnapshotId !== null} onClick={() => void openRollbackPreview(snapshot)}>{previewingSnapshotId === snapshot.id ? '正在生成预览…' : '查看并确认回滚'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rollbackPreview && (
        <div className="modal-overlay" onClick={() => setRollbackPreview(null)}>
          <div className="modal rollback-preview-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rollback-preview-title">
            <h3 id="rollback-preview-title" className="import-summary-title">确认回滚前的私有数据预览</h3>
            <p className="page-desc">快照时间：{formatStamp(new Date(rollbackPreview.snapshot.createdAt).getTime())}。{rollbackPreview.scope}</p>
            <p className="page-desc">以下逐条显示会变化的岗位状态；“当前”是回滚前，“回滚后”是所选快照。共享岗位池数据不在本次操作范围内。</p>
            <div className="rollback-preview-scroll">
              <h4 className="usage-guide-sub">岗位私有状态（{rollbackPreview.stateChanges.length} 条将变化）</h4>
              {rollbackPreview.stateChanges.length === 0 ? <p className="file-save-caption">该快照与当前岗位私有状态一致。</p> : rollbackPreview.stateChanges.map((change) => (
                <div className="rollback-change-row" key={change.id}>
                  <b>{change.companyName} · {change.jobTitle}</b>
                  <span>筛选：{SCREENING_LABELS[change.before.screeningStatus] ?? change.before.screeningStatus} → {SCREENING_LABELS[change.after.screeningStatus] ?? change.after.screeningStatus}</span>
                  <span>进度：{PROGRESS_LABELS[change.before.applicationStatus] ?? change.before.applicationStatus} → {PROGRESS_LABELS[change.after.applicationStatus] ?? change.after.applicationStatus}；星级：{change.before.priority} → {change.after.priority}</span>
                  <span>备注：{change.before.notes || '（空）'} → {change.after.notes || '（空）'}</span>
                </div>
              ))}
              <h4 className="usage-guide-sub">其他私有资料（{rollbackPreview.documentChanges.length} 类将变化）</h4>
              {rollbackPreview.documentChanges.length === 0 ? <p className="file-save-caption">任务、便签、材料、动态和标签与该快照一致。</p> : rollbackPreview.documentChanges.map((change) => <p className="page-desc" key={change.key}>{DATA_LABELS[change.key] ?? change.key}：当前 {change.beforeCount} → 回滚后 {change.afterCount}</p>)}
              <p className="page-desc">快照后新增岗位将保留：{rollbackPreview.preservedNewJobs} 条；快照内但目前已不存在的岗位不重新创建：{rollbackPreview.unavailableJobs} 条。</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setRollbackPreview(null)}>取消</button>
              <button type="button" className="btn" disabled={rollingBackId !== null} onClick={() => void rollbackToSnapshot(rollbackPreview.snapshot)}>{rollingBackId ? '正在回滚…' : '确认仅回滚上述私有数据'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title">数据管理</h2>
        <p className="page-desc">账户可直接使用，无需选择本地保存位置。需要留存时，可下载账户备份；需要找回资料时，可从备份文件恢复。</p>

        <div className="data-mgmt-block">
          <h3 className="data-mgmt-title">💾 账户备份与恢复</h3>
          <div className="pool-action-grid data-export-row">
            <div className="btn-with-desc">
              <button type="button" className="btn btn-outline" onClick={handleExportAll}>下载账户备份</button>
              <span className="btn-hint">下载当前账户的岗位、任务与网申材料</span>
            </div>
            <div className="btn-with-desc">
              <button type="button" className="btn btn-outline" onClick={() => { setRestoreKind('bound'); fileInputRef.current?.click() }}>从备份恢复</button>
              <span className="btn-hint">选择此前由当前账户下载的 JSON 备份文件</span>
              <button type="button" className="btn btn-outline" onClick={() => { setRestoreKind('legacy'); fileInputRef.current?.click() }}>迁移旧版备份</button>
              <span className="btn-hint">仅适用于开发者已确认的旧版备份文件</span>
            </div>
          </div>
          {mode !== 'preview' && <p className="file-save-caption">为保障账户隔离，下载的备份仅包含当前账户的私有数据，不包含群组岗位池中的共享数据，且只能由同一账户恢复。</p>}
          {lastBackup && <p className="file-save-caption">最近一次下载备份：{formatStamp(lastBackup)}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          {restorePlan && (
            <div className="import-invalid">
              <p className="import-invalid-title">恢复预览（尚未写入）</p>
              {mode !== 'preview' && <p className="page-desc">✓ 已通过当前账户备份校验</p>}
              <p className="page-desc">将恢复新增：{formatStats(restorePlan.stats, 'added')}。</p>
              <p className="page-desc">将跳过重复：{formatStats(restorePlan.stats.map((stat) => ({ ...stat, incoming: stat.duplicate })), 'incoming')}。</p>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => void confirmRestore()}>确认恢复新增内容</button>
                <button type="button" className="btn btn-outline" onClick={() => setRestorePlan(null)}>取消</button>
              </div>
            </div>
          )}
        </div>

        {message && <p className="form-error">{message}</p>}
      </div>

      <div className="card">
        <h2 className="section-title">退出登录</h2>
        <p className="page-desc" style={{fontSize: '13px', color: 'var(--color-text-muted)'}}>
          {mode === 'preview'
            ? '访客模式无需登录，因此无需退出登录。'
            : '退出前请确认已备份数据。退出后保留本机与云端数据，可重新登录继续使用。'}
        </p>
        <button
          type="button"
          className="btn btn-outline"
          disabled={mode === 'preview'}
          onClick={() => void handleLogout()}
        >
          退出登录
        </button>
      </div>

      <div className="card danger-zone">
        <h2 className="section-title">注销账户</h2>
        <p className="page-desc danger-note">
          {mode === 'preview'
            ? '访客模式无账户，无法注销。'
            : '注销会永久删除全部数据（本机与云端），不可恢复。若你是共享池创建者，需先转让或删除。'}
        </p>
        <button
          type="button"
          className="btn btn-danger"
          disabled={mode === 'preview'}
          onClick={() => void handleDeleteAccount()}
        >
          注销账户
        </button>
      </div>
    </section>
  )
}

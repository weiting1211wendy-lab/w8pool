import { useEffect, useState } from 'react'
import { APPLICATION_SCREENING_LABELS } from '../constants/screeningStatus'
import { APPLICATION_STATUS_LABELS } from '../constants/applicationStatus'
import { normalizeApplication } from '../utils/helpers'
import { useMode } from '../hooks/useMode'
import type { Application } from '../types'

interface TrashJob {
  id: string
  no: number
  payload_json: string
  revision: number
  deleted_at: string
  screening_status: string
  application_status: string
  priority: number
  applied_at: string
  personal_notes: string
  taskCount: number
}

interface Props {
  open: boolean
  onClose: () => void
  onRestore: (jobId: string) => void
  applications: Application[]
  tasks: Array<{ applicationId?: string; done: boolean }>
}

function daysUntilExpiry(deletedAt: string): number {
  const deleted = new Date(deletedAt)
  const expiry = new Date(deleted.getTime() + 7 * 24 * 60 * 60 * 1000)
  const now = new Date()
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}

export default function TrashModal({ open, onClose, onRestore, applications, tasks }: Props) {
  const mode = useMode()
  const [trashJobs, setTrashJobs] = useState<TrashJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError('')
    if (mode === 'preview') {
      const deleted = applications
        .filter((app) => app.deletedAt)
        .map((app) => {
          const linkedTasks = tasks.filter((t) => t.applicationId === app.id)
          return {
            id: app.id,
            no: app.no ?? 0,
            payload_json: JSON.stringify(app),
            revision: 1,
            deleted_at: app.deletedAt ?? '',
            screening_status: app.screeningStatus,
            application_status: app.applicationStatus,
            priority: app.priority,
            applied_at: app.appliedAt,
            personal_notes: app.notes,
            taskCount: linkedTasks.length,
          }
        })
      setTrashJobs(deleted)
      return
    }
    setLoading(true)
    void fetch('/api/pools/me/jobs/trash')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? '回收站加载失败')
        }
        const data = await r.json() as { jobs: TrashJob[] }
        setTrashJobs(data.jobs)
      })
      .catch((err) => {
        setTrashJobs([])
        setError(err instanceof Error ? err.message : '回收站加载失败')
      })
      .finally(() => setLoading(false))
  }, [open, mode, applications, tasks])

  const handleRestore = async (jobId: string) => {
    setRestoring(jobId)
    try {
      if (mode === 'preview') {
        onRestore(jobId)
        setTrashJobs((prev) => prev.filter((j) => j.id !== jobId))
      } else {
        const response = await fetch(`/api/pools/me/jobs/${jobId}/restore`, { method: 'POST' })
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? '恢复失败')
        }
        onRestore(jobId)
        setTrashJobs((prev) => prev.filter((j) => j.id !== jobId))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复失败')
    } finally {
      setRestoring(null)
      setConfirmRestore(null)
    }
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal trash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="section-head">
          <h2 className="section-title">我的岗位池回收站</h2>
          <button type="button" className="link-btn" onClick={onClose}>关闭</button>
        </div>
        <p className="page-desc">这里仅显示当前账户 7 天内删除的个人岗位，最多 200 条。恢复后，岗位会回到我的岗位池；如有关联任务，也会一并恢复。共享岗位池数据不会受到影响。</p>
        {error && <p className="page-desc form-error">{error}</p>}
        {loading ? (
          <p className="page-desc">加载中…</p>
        ) : trashJobs.length === 0 ? (
          <p className="page-desc">暂无 7 天内删除的岗位。</p>
        ) : (
          <div className="trash-list">
            {trashJobs.map((job) => {
              let parsed: Application
              try { parsed = normalizeApplication(JSON.parse(job.payload_json) as Application) } catch { return null }
              const remaining = daysUntilExpiry(job.deleted_at)
              const screeningLabel = APPLICATION_SCREENING_LABELS[job.screening_status as keyof typeof APPLICATION_SCREENING_LABELS] ?? job.screening_status
              const statusLabel = APPLICATION_STATUS_LABELS[job.application_status as keyof typeof APPLICATION_STATUS_LABELS] ?? job.application_status
              return (
                <div key={job.id} className="trash-item">
                  <div className="trash-item-body">
                    <div className="trash-item-main">
                      <span className="trash-item-no">#{job.no || '—'}</span>
                      <span className="trash-item-company">{parsed.companyName}</span>
                      <span className="trash-item-sep">·</span>
                      <span className="trash-item-title">{parsed.jobTitle}</span>
                      <span className="trash-item-sep">·</span>
                      <span className="trash-item-deleted">删除于 {job.deleted_at.slice(0, 10)}</span>
                      <span className="trash-item-sep">·</span>
                      <span className="trash-item-expiry">剩余 {remaining} 天</span>
                    </div>
                    <div className="trash-item-meta">
                      <span className="trash-item-status">{screeningLabel}</span>
                      <span className="trash-item-status">{statusLabel}</span>
                      {job.priority > 0 && <span className="trash-item-priority">{'★'.repeat(job.priority)}</span>}
                      {job.taskCount > 0 && <span className="trash-item-tasks">{job.taskCount} 个关联任务</span>}
                      {job.personal_notes && <span className="trash-item-notes" title={job.personal_notes}>有备注</span>}
                    </div>
                  </div>
                  <div className="trash-item-actions">
                    {confirmRestore === job.id ? (
                      <>
                        <span className="trash-confirm-text">确认恢复？</span>
                        <button type="button" className="btn btn-sm btn-gradient" disabled={restoring === job.id} onClick={() => void handleRestore(job.id)}>
                          {restoring === job.id ? '恢复中…' : '确认'}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setConfirmRestore(null)}>取消</button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => setConfirmRestore(job.id)}>
                        恢复
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

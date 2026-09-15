import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { useMode } from './useMode'
import { useAuth } from './useAuth'
import { normalizeApplication } from '../utils/helpers'
import type { Application } from '../types'

type CloudApplication = Application & { __cloudRevision?: number; __stateRevision?: number }

const workspaceApplicationsCache = new Map<string, Application[]>()
const stateQueues = new Map<string, Promise<void>>()
const stateRevisions = new Map<string, number>()

function emitSync(state: 'syncing' | 'synced' | 'failed' | 'conflict') {
  window.dispatchEvent(new CustomEvent('w8pool-sync-status', { detail: { state, at: Date.now() } }))
}

interface ApiJob {
  id: string
  no: number
  payload_json: string
  revision: number
  created_at: string
  updated_at: string
  screening_status: Application['screeningStatus'] | null
  application_status: Application['applicationStatus'] | null
  priority: number | null
  applied_at: string | null
  personal_notes: string | null
  state_revision: number | null
  added_at: string
  added_by_name?: string
}

function toApplication(job: ApiJob): CloudApplication {
  const payload = JSON.parse(job.payload_json) as Partial<Application>
  return {
    ...normalizeApplication({
      ...payload,
      id: job.id,
      no: job.no,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      screeningStatus: job.screening_status ?? 'to_review',
      applicationStatus: job.application_status ?? 'pending',
      priority: job.priority ?? 0,
      appliedAt: job.applied_at ?? '',
      notes: job.personal_notes ?? '',
      importedAt: (job.added_at || job.created_at || '').slice(0, 10),
    } as Application),
    __cloudRevision: job.revision,
    __stateRevision: job.state_revision ?? 1,
  }
}

function privateState(app: Application) {
  return {
    screeningStatus: app.screeningStatus,
    applicationStatus: app.applicationStatus,
    priority: app.priority,
    appliedAt: app.appliedAt,
    personalNotes: app.notes,
  }
}

function jobPayload(app: CloudApplication) {
  const {
    __cloudRevision: _revision,
    __stateRevision: _stateRevision,
    screeningStatus: _screeningStatus,
    applicationStatus: _applicationStatus,
    priority: _priority,
    appliedAt: _appliedAt,
    notes: _notes,
    id: _id,
    no: _no,
    importedAt: _importedAt,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...payload
  } = app
  return payload
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * 工作台读取登录账户的个人岗位池；访客模式仍使用原有 preview localStorage。
 * 现有页面可以继续沿用 useState 风格的 setter，筛选、投递、优先级、备注会同步到账户。
 */
export function useAccountApplications(
  fallback: Application[],
): [Application[], Dispatch<SetStateAction<Application[]>>, boolean, () => Promise<void>] {
  const mode = useMode()
  const { user } = useAuth()
  const userId = user?.id ?? null
  const localKey = mode === 'preview' ? 'preview:applications' : userId ? `account:${userId}:applications` : 'applications'
  const [localApplications, setLocalApplications] = useLocalStorage<Application[]>(localKey, mode === 'preview' ? fallback : [])
  const [applications, setApplications] = useState<Application[]>(
    mode === 'workspace' && userId && workspaceApplicationsCache.has(userId)
      ? workspaceApplicationsCache.get(userId)!
      : [],
  )
  const [loading, setLoading] = useState(mode === 'workspace')
  const poolRef = useRef<string | null>(null)
  // 本地变更代际：用户每次本地修改 +1。reload 返回时若代际已变，
  // 说明拉取期间用户做了修改，丢弃这次结果，避免覆盖用户操作。
  const mutationEpoch = useRef(0)
  // poolId 尚未就绪时的修改先排队，reload 完成后补发同步。
  const pendingSync = useRef<{ before: Application[]; after: Application[] } | null>(null)

  const syncRef = useRef<((before: Application[], after: Application[]) => Promise<void>) | undefined>(undefined)

  const reload = useCallback(async () => {
    if (mode !== 'workspace' || !userId) return
    setLoading(true)
    const epochAtStart = mutationEpoch.current
    try {
      const poolsResponse = await fetch('/api/pools')
      if (!poolsResponse.ok) throw new Error('无法读取岗位池')
      const pools = await poolsResponse.json() as {
        pools: Array<{ id: string; kind: string }>
      }
      const personal = pools.pools.find((pool) => pool.kind === 'personal')
      if (!personal) throw new Error('未找到个人岗位池')
      const jobsResponse = await fetch(`/api/pools/${personal.id}/jobs`)
      if (!jobsResponse.ok) throw new Error('无法读取岗位')
      const body = await jobsResponse.json() as { jobs: ApiJob[] }
      poolRef.current = personal.id
      // poolId 已就绪，补发排队中的同步
      if (pendingSync.current) {
        const pending = pendingSync.current
        pendingSync.current = null
        void syncRef.current?.(pending.before, pending.after)
      }
      // 拉取期间发生过本地修改：结果已过期，丢弃，不覆盖用户操作
      if (mutationEpoch.current !== epochAtStart) return
      const nextApplications = body.jobs.map(toApplication)
      nextApplications.forEach((app) => stateRevisions.set(`${userId}:${app.id}`, (app as CloudApplication).__stateRevision ?? 1))
      workspaceApplicationsCache.set(userId, nextApplications)
      setApplications(nextApplications)
    } catch {
      if (mutationEpoch.current === epochAtStart) setApplications([])
    } finally {
      setLoading(false)
    }
  }, [mode, userId])

  useEffect(() => {
    if (mode !== 'workspace') {
      setApplications(localApplications)
      setLoading(false)
      return
    }
    if (!userId) {
      setApplications([])
      setLoading(false)
      return
    }
    void reload()
  }, [mode, userId, reload])

  // 云端岗位列表在本机保留只读离线缓存；刷新和重新登录仍以账户云端版本为准。
  useEffect(() => {
    if (mode === 'workspace' && userId && !loading) setLocalApplications(applications)
  }, [applications, loading, mode, setLocalApplications, userId])

  const sync = useCallback(async (before: Application[], after: Application[]) => {
    const activePoolId = poolRef.current
    if (mode !== 'workspace' || !userId) return
    if (!activePoolId) {
      // poolId 未就绪：保留最早的 before 与最新的 after，等待 reload 后补发
      pendingSync.current = pendingSync.current
        ? { before: pendingSync.current.before, after }
        : { before, after }
      return
    }
    const previous = new Map(before.map((app) => [app.id, app as CloudApplication]))
    const next = new Map(after.map((app) => [app.id, app as CloudApplication]))

    for (const [id, oldApp] of previous) {
      const newApp = next.get(id)
      if (!newApp) {
        await fetch(`/api/pools/${activePoolId}/jobs/${id}`, { method: 'DELETE' })
        continue
      }
      // Soft delete: app was not deleted before but now has deletedAt
      if (!oldApp.deletedAt && newApp.deletedAt) {
        await fetch(`/api/pools/${activePoolId}/jobs/${id}`, { method: 'DELETE' })
        continue
      }
      // Restore: app was deleted before but now has no deletedAt
      if (oldApp.deletedAt && !newApp.deletedAt) {
        await fetch(`/api/pools/${activePoolId}/jobs/${id}/restore`, { method: 'POST' })
        continue
      }
      if (!sameValue(privateState(oldApp), privateState(newApp))) {
        const queueKey = `${userId}:${id}`
        const queued = (stateQueues.get(queueKey) ?? Promise.resolve()).catch(() => undefined).then(async () => {
          const expectedRevision = stateRevisions.get(queueKey) ?? oldApp.__stateRevision ?? 1
          emitSync('syncing')
          const response = await fetch(`/api/jobs/${id}/state`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...privateState(newApp), revision: expectedRevision }),
          })
          if (response.status === 409) { emitSync('conflict'); throw new Error('岗位状态已在其他设备更新，未覆盖云端数据') }
          if (!response.ok) { emitSync('failed'); throw new Error('岗位状态同步失败') }
          const body = await response.json() as { revision: number }
          stateRevisions.set(queueKey, body.revision)
          emitSync('synced')
          setApplications((current) => current.map((app) => app.id === id
            ? { ...app, __stateRevision: body.revision }
            : app))
        })
        stateQueues.set(queueKey, queued)
        await queued
      }
      if (!sameValue(jobPayload(oldApp), jobPayload(newApp))) {
        const response = await fetch(`/api/pools/${activePoolId}/jobs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: oldApp.__cloudRevision ?? 1, job: jobPayload(newApp) }),
        })
        if (response.ok) {
          const body = await response.json() as { revision: number }
          setApplications((current) => current.map((app) =>
            app.id === id ? { ...app, __cloudRevision: body.revision } : app,
          ))
        }
      }
    }

    for (const [id, app] of next) {
      if (previous.has(id)) continue
      const response = await fetch(`/api/pools/${activePoolId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobPayload(app)),
      })
      if (!response.ok) continue
      const body = await response.json() as { job: Application; revision: number }
      const created: CloudApplication = { ...body.job, __cloudRevision: body.revision }
      setApplications((current) => current.map((item) => item.id === id ? created : item))
    }
  }, [mode, userId])

  syncRef.current = sync

  const setSyncedApplications: Dispatch<SetStateAction<Application[]>> = useCallback((action) => {
    if (mode !== 'workspace') {
      setLocalApplications(action)
      return
    }
    mutationEpoch.current += 1
    setApplications((previous) => {
      const next = typeof action === 'function'
        ? action(previous)
        : action
      if (userId) workspaceApplicationsCache.set(userId, next)
      void sync(previous, next)
      return next
    })
  }, [mode, userId, setLocalApplications, sync])

  return [applications, setSyncedApplications, loading, reload]
}

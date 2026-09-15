import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { useMode } from './useMode'
import { useAuth } from './useAuth'
import { PREVIEW_SNAPSHOT } from '../data/previewSnapshot'
import type { PreviewSnapshot } from '../data/previewSnapshot'
type CloudDocument<T> = { data: T; revision: number; updatedAt: string }
const queues = new Map<string, Promise<void>>()
const CLOUD_SYNC_KEYS = new Set([
  'tasks', 'sticky-notes', 'profile', 'application-events', 'motto',
  'custom-tags', 'job-note-tags', 'app-view', 'workspace-preferences',
])

function emitSync(state: 'syncing' | 'synced' | 'failed' | 'conflict') {
  window.dispatchEvent(new CustomEvent('w8pool-sync-status', { detail: { state, at: Date.now() } }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function itemKey(value: unknown): string | null {
  return isRecord(value) && typeof value.id === 'string' ? value.id : null
}
function mergeLegacy<T>(cloud: T, legacy: T): T {
  if (Array.isArray(cloud) && Array.isArray(legacy)) {
    const known = new Set(cloud.map(itemKey).filter((key): key is string => Boolean(key)))
    const additions = legacy.filter((item) => {
      const key = itemKey(item)
      return key ? !known.has(key) : !cloud.some((current) => JSON.stringify(current) === JSON.stringify(item))
    })
    return [...cloud, ...additions] as T
  }
  if (isRecord(cloud) && isRecord(legacy)) {
    const next: Record<string, unknown> = { ...cloud }
    for (const [key, legacyValue] of Object.entries(legacy)) {
      const cloudValue = next[key]
      if (cloudValue === undefined || cloudValue === null || cloudValue === '') next[key] = legacyValue
      else if ((isRecord(cloudValue) && isRecord(legacyValue)) || (Array.isArray(cloudValue) && Array.isArray(legacyValue))) next[key] = mergeLegacy(cloudValue, legacyValue)
    }
    return next as T
  }
  return cloud === undefined || cloud === null || cloud === '' ? legacy : cloud
}
function same(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right) }

/** 访客数据固定在 preview 空间；工作台私有文档以账户为边界同步到云端，本机仅作离线缓存。 */
export function useAppData<K extends keyof PreviewSnapshot>(key: K, userFallback: PreviewSnapshot[K]): [PreviewSnapshot[K], Dispatch<SetStateAction<PreviewSnapshot[K]>>]
export function useAppData<T>(key: string, userFallback: T): [T, Dispatch<SetStateAction<T>>]
export function useAppData<T>(key: string, userFallback: T): [T, Dispatch<SetStateAction<T>>] {
  const mode = useMode()
  const { user } = useAuth()
  const storageKey = mode === 'preview'
    ? `preview:${key}`
    : user
      ? `account:${user.id}:${key}`
      : key
  const previewValue = (PREVIEW_SNAPSHOT as unknown as Record<string, unknown>)[key] as T | undefined
  const initialValue = mode === 'preview' && previewValue !== undefined ? previewValue : userFallback
  const [cachedValue, setCachedValue] = useLocalStorage<T>(storageKey, initialValue)
  const [value, setValue] = useState<T>(cachedValue)
  const revisionRef = useRef(0)
  const readyRef = useRef(mode !== 'workspace')
  const queuedBeforeReady = useRef<T | null>(null)
  const latestRef = useRef(cachedValue)

  useEffect(() => { latestRef.current = value }, [value])

  const enqueue = useCallback((next: T, reason: string) => {
    if (mode !== 'workspace' || !user || !CLOUD_SYNC_KEYS.has(key)) return
    const queueKey = `${user.id}:${key}`
    const task = (queues.get(queueKey) ?? Promise.resolve()).catch(() => undefined).then(async () => {
      emitSync('syncing')
      const response = await fetch(`/api/workspace/documents/${encodeURIComponent(key)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: next, revision: revisionRef.current, reason }),
      })
      if (response.status === 409) { emitSync('conflict'); throw new Error('conflict') }
      if (!response.ok) { emitSync('failed'); throw new Error('sync failed') }
      const body = await response.json() as { revision: number }
      revisionRef.current = body.revision
      emitSync('synced')
    })
    queues.set(queueKey, task)
  }, [key, mode, user])

  useEffect(() => {
    if (mode !== 'workspace' || !user || !CLOUD_SYNC_KEYS.has(key)) {
      readyRef.current = true
      setValue(cachedValue)
      return
    }
    let cancelled = false
    readyRef.current = false
    const legacy = cachedValue
    void (async () => {
      try {
        const response = await fetch(`/api/workspace/documents/${encodeURIComponent(key)}`)
        if (!response.ok) throw new Error('load failed')
        const body = await response.json() as { document: CloudDocument<T> | null }
        if (cancelled) return
        let next = body.document?.data ?? legacy
        revisionRef.current = body.document?.revision ?? 0
        if (body.document) next = mergeLegacy(body.document.data, legacy)
        setValue(next); setCachedValue(next); latestRef.current = next; readyRef.current = true
        if (!body.document || !same(next, body.document.data) || queuedBeforeReady.current !== null) {
          const pending = queuedBeforeReady.current ?? next
          queuedBeforeReady.current = null
          enqueue(pending, body.document ? 'legacy-merge' : 'initial-migration')
        }
      } catch {
        readyRef.current = true
        queuedBeforeReady.current = latestRef.current
        emitSync('failed')
      }
    })()
    return () => { cancelled = true }
  // cachedValue 是本次账户/键切换时的旧数据快照；不要因每次本地缓存写入重新拉取而覆盖正在编辑的内容。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enqueue, key, mode, setCachedValue, storageKey, user?.id])

  const setSyncedValue: Dispatch<SetStateAction<T>> = useCallback((action) => {
    const next = typeof action === 'function' ? (action as (previous: T) => T)(latestRef.current) : action
    latestRef.current = next; setValue(next); setCachedValue(next)
    if (mode !== 'workspace' || !CLOUD_SYNC_KEYS.has(key)) return
    if (!readyRef.current) { queuedBeforeReady.current = next; return }
    enqueue(next, 'update')
  }, [enqueue, key, mode, setCachedValue])
  return [value, setSyncedValue]
}

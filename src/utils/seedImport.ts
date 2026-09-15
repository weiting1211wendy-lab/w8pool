import {
  PREVIEW_KEYS,
  PREVIEW_SNAPSHOT,
} from '../data/previewSnapshot'
import type { PreviewSnapshot } from '../data/previewSnapshot'
import type { StickyNote } from '../types'

const VERSION_KEY = 'w8pool-preview-seed-v7'

function seedPreviewKey<K extends keyof PreviewSnapshot>(
  key: K,
  value: PreviewSnapshot[K],
): void {
  const storageKey = `preview:${key}`
  if (localStorage.getItem(storageKey) !== null) return
  localStorage.setItem(storageKey, JSON.stringify(value))
}

const REMOVED_PREVIEW_NOTE_ID = 'preview-note-4'
const PREVIEW_MOTTO_RESET_KEY = 'w8pool-preview-motto-reset-v1'

export function clearLegacyPreviewMotto(): void {
  try {
    if (localStorage.getItem(PREVIEW_MOTTO_RESET_KEY)) return
    // 访客模式不展示个人心情寄语；迁移已存在的浏览器预览缓存。
    localStorage.setItem('preview:motto', JSON.stringify(''))
    localStorage.setItem(PREVIEW_MOTTO_RESET_KEY, 'done')
  } catch {
    // 忽略存储不可用，下次启动重试
  }
}

export function cleanPreviewStickyNotes(): void {
  try {
    const key = 'preview:sticky-notes'
    const raw = localStorage.getItem(key)
    if (raw === null) return
    const notes = JSON.parse(raw) as StickyNote[]
    const filtered = notes.filter((n) => n.id !== REMOVED_PREVIEW_NOTE_ID)
    if (filtered.length !== notes.length) {
      localStorage.setItem(key, JSON.stringify(filtered))
    }
  } catch {
    // 忽略解析失败，下次启动重试
  }
}

export function seedImportedData(): void {
  try {
    const alreadySeeded = localStorage.getItem(VERSION_KEY)
    if (alreadySeeded) return
    // 版本变更或首次运行：清除旧的预览缓存，使最新 PREVIEW_SNAPSHOT 生效
    for (const key of PREVIEW_KEYS) {
      localStorage.removeItem(`preview:${key}`)
    }
    seedPreviewKey('applications', PREVIEW_SNAPSHOT.applications)
    seedPreviewKey(
      'application-events',
      PREVIEW_SNAPSHOT['application-events'],
    )
    seedPreviewKey('tasks', PREVIEW_SNAPSHOT.tasks)
    seedPreviewKey('sticky-notes', PREVIEW_SNAPSHOT['sticky-notes'])
    seedPreviewKey('profile', PREVIEW_SNAPSHOT.profile)
    seedPreviewKey('motto', PREVIEW_SNAPSHOT.motto)
    localStorage.setItem(VERSION_KEY, 'done')
  } catch {
    // 忽略种子写入失败，下次启动会重试
  }
}

export function exportPreviewSnapshot(): string {
  const out: Record<string, unknown> = {}
  for (const key of PREVIEW_KEYS) {
    const raw = localStorage.getItem(`preview:${key}`)
    if (raw !== null) {
      try {
        out[key] = JSON.parse(raw)
      } catch {
        out[key] = raw
      }
    }
  }
  return JSON.stringify(
    { tool: 'w8pool', kind: 'preview-snapshot', data: out },
    null,
    2,
  )
}

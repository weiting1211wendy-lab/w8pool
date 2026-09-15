import type { Application } from '../types'

interface FileHandleLike {
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
  getFile(): Promise<File>
  queryPermission(options?: { mode: string }): Promise<PermissionState>
  requestPermission(options?: { mode: string }): Promise<PermissionState>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: Array<{ description: string; accept: Record<string, string[]> }>
    }) => Promise<FileHandleLike>
  }
}

const DB_NAME = 'w8pool-workspace-persist'
const DB_VERSION = 1
const STORE_NAME = 'handles'
const HANDLE_KEY = 'main'

export const EDIT_AT_KEY = 'persist:edited-at'

const DATA_KEYS = [
  'applications',
  'tasks',
  'application-events',
  'sticky-notes',
  'profile',
  'motto',
  'groups',
  'pool-jobs',
  'pool-events',
  'copy-mappings',
] as const

export type FileSaveState = 'unsupported' | 'none' | 'ready' | 'need-auth'

let fileHandle: FileHandleLike | null = null
let saveTimer: number | undefined

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function readHandle(): Promise<FileHandleLike | null> {
  try {
    const db = await idbOpen()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY)
      req.onsuccess = () => resolve((req.result as FileHandleLike | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function writeHandle(handle: FileHandleLike): Promise<void> {
  try {
    const db = await idbOpen()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // 句柄记忆失败不影响主流程
  }
}

function collectAllData(prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of DATA_KEYS) {
    const raw = localStorage.getItem(prefix + key)
    if (raw !== null) out[prefix + key] = raw
  }
  return out
}

export async function saveNow(prefix = ''): Promise<boolean> {
  if (!fileHandle) return false
  try {
    const payload = JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      data: collectAllData(prefix),
    })
    const writable = await fileHandle.createWritable()
    await writable.write(payload)
    await writable.close()
    return true
  } catch {
    // 写入失败（如文件被移除）时静默，下次授权重试
    return false
  }
}

export function scheduleSave(): void {
  if (!fileHandle) return
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void saveNow()
  }, 500)
}

export async function getFileSaveState(): Promise<FileSaveState> {
  if (typeof window.showSaveFilePicker !== 'function') {
    return 'unsupported'
  }
  const handle = await readHandle()
  if (!handle) {
    fileHandle = null
    return 'none'
  }
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') {
      fileHandle = handle
      return 'ready'
    }
    fileHandle = handle
    return 'need-auth'
  } catch {
    fileHandle = handle
    return 'need-auth'
  }
}

export async function loadFromFileIfGranted(prefix = ''): Promise<boolean> {
  if (typeof window.showSaveFilePicker !== 'function') return false
  const handle = await readHandle()
  if (!handle) return false
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm !== 'granted') return false
    fileHandle = handle
    const file = await handle.getFile()
    const text = await file.text()
    const parsed = JSON.parse(text) as {
      savedAt?: string
      data?: Record<string, string>
    }
    if (!parsed.data || typeof parsed.data !== 'object') return false
    const editedAt = Number(localStorage.getItem(EDIT_AT_KEY) ?? 0)
    const fileSavedAt = parsed.savedAt ? Date.parse(parsed.savedAt) : 0
    if (editedAt > fileSavedAt) {
      // localStorage 比文件新（例如最后一次编辑未落盘就关闭了）：
      // 保留 localStorage，并立即把最新数据写回文件
      await saveNow(prefix)
      return false
    }
    let changed = false
    for (const key of DATA_KEYS) {
      const value = parsed.data[prefix + key]
      if (typeof value === 'string') {
        localStorage.setItem(prefix + key, value)
        changed = true
      }
    }
    if (changed && fileSavedAt > 0) {
      localStorage.setItem(EDIT_AT_KEY, String(fileSavedAt))
    }
    return changed
  } catch {
    return false
  }
}

export async function requestSaveFile(prefix = ''): Promise<void> {
  const picker = window.showSaveFilePicker
  if (typeof picker !== 'function') return
  const handle = await picker({
    suggestedName: 'w8pool-workspace-data.json',
    types: [
      {
        description: 'JSON 数据文件',
        accept: { 'application/json': ['.json'] },
      },
    ],
  })
  fileHandle = handle
  await writeHandle(handle)
  await saveNow(prefix)
}

export async function requestReadFile(prefix = ''): Promise<void> {
  if (!fileHandle) {
    fileHandle = await readHandle()
  }
  if (!fileHandle) return
  try {
    const perm = await fileHandle.requestPermission({ mode: 'readwrite' })
    if (perm === 'granted') {
      await loadFromFileIfGranted(prefix)
    }
  } catch {
    // 用户取消授权
  }
}

export async function reloadFromFile(prefix = ''): Promise<boolean> {
  if (typeof window.showSaveFilePicker !== 'function') return false
  if (!fileHandle) fileHandle = await readHandle()
  if (!fileHandle) return false
  try {
    const perm = await fileHandle.queryPermission({ mode: 'readwrite' })
    if (perm !== 'granted') {
      const granted = await fileHandle.requestPermission({ mode: 'readwrite' })
      if (granted !== 'granted') return false
    }
    const file = await fileHandle.getFile()
    const text = await file.text()
    const parsed = JSON.parse(text) as {
      data?: Record<string, string>
    }
    if (!parsed.data || typeof parsed.data !== 'object') return false
    let changed = false
    for (const key of DATA_KEYS) {
      const value = parsed.data[prefix + key]
      if (typeof value === 'string') {
        localStorage.setItem(prefix + key, value)
        changed = true
      }
    }
    if (changed) {
      localStorage.setItem(EDIT_AT_KEY, String(Date.now()))
    }
    return changed
  } catch {
    return false
  }
}

function readStored<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function normalizeTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean)
  }
  const s = String(value ?? '').trim()
  return s ? [s] : []
}

function extractLink(value: unknown): string {
  const s = String(value ?? '').trim()
  if (!s) return ''
  const m = s.match(/\]\((https?:\/\/[^)]+)\)/)
  return m ? m[1] : s
}

function normalizeGraduationYears(value: unknown): string[] {
  return normalizeTextArray(value).map((y) =>
    /^\d{4}$/.test(y) ? `${y}届` : y,
  )
}

function mapJobItem(rawItem: unknown): Partial<Application> | null {
  if (!rawItem || typeof rawItem !== 'object') return null
  const raw = rawItem as Record<string, unknown>
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) {
      if (raw[key] !== undefined && raw[key] !== null) return raw[key]
    }
    return undefined
  }
  const companyName = String(pick('companyName', '企业名称', 'flddT9OT13') ?? '').trim()
  const jobTitle = String(pick('jobTitle', '岗位名称', 'fldX74eqiU') ?? '').trim()
  if (!companyName || !jobTitle) return null
  const industries = normalizeTextArray(pick('industries', '所属行业', 'fldA3shEQR'))
  const locations = normalizeTextArray(pick('locations', '工作地点', 'fldTLEOLki'))
  const educationRequirements = normalizeTextArray(
    pick('educationRequirements', '学历要求', 'fldGE0vVDo'),
  )
  const graduationYears = normalizeGraduationYears(
    pick('graduationYears', '届次要求', 'fldQFZwnfz'),
  )
  const industryRaw = pick('industry', 'fldA3shEQR')
  const industry =
    typeof industryRaw === 'string' && industryRaw.trim()
      ? String(industryRaw).trim()
      : industries[0] ?? ''
  const locationRaw = pick('location', 'fldTLEOLki')
  const location =
    typeof locationRaw === 'string' && locationRaw.trim()
      ? String(locationRaw).trim()
      : locations[0] ?? ''
  const applicationUrl = extractLink(pick('applicationUrl', '投递地址', 'fldVFYsoGM'))
  const announcementUrl = extractLink(pick('announcementUrl', '公告链接', 'fldk6jg20Y'))
  const idRaw = pick('id', '记录ID', 'rec_id')
  const id = typeof idRaw === 'string' ? idRaw.trim() : ''
  return {
    id,
    companyName,
    jobTitle,
    jobDirection: String(pick('jobDirection', '岗位方向', 'fld2o4lElM') ?? ''),
    employmentType: String(pick('employmentType', '岗位性质', 'fld2pgGYbW') ?? ''),
    industry,
    industries,
    companyType: String(pick('companyType', '企业类型', 'fldRGNcjxf') ?? ''),
    location,
    locations,
    educationRequirements,
    graduationYears,
    majors: String(pick('majors', '招聘专业', 'fldokgmh0a') ?? ''),
    publishedAt: String(pick('publishedAt', '发布时间', 'fldHkpE0oA') ?? ''),
    deadline: String(pick('deadline', '截止日期', 'fldHIdgs2t') ?? ''),
    jobDescription: String(pick('jobDescription', '岗位详情', 'fld1equ5uq') ?? ''),
    jobRequirements: String(pick('jobRequirements', '岗位要求') ?? ''),
    hireProcess: String(pick('hireProcess', '录用流程') ?? ''),
    benefits: String(pick('benefits', '福利待遇', 'fldzapqsYh') ?? ''),
    applicationUrl,
    announcementUrl,
  }
}

function appSignature(app: Partial<Application>): string {
  const company = String(app.companyName ?? '').trim().toLowerCase()
  const title = String(app.jobTitle ?? '').trim().toLowerCase()
  return `${company}||${title}`
}

export interface JobImportItem {
  mapped: Partial<Application>
  isDuplicate: boolean
}

export interface JobImportInvalid {
  index: number
  reason: string
}

export interface JobImportAnalysis {
  ok: boolean
  reason?: 'format' | 'parse'
  total: number
  valid: number
  duplicates: number
  items: JobImportItem[]
  invalid: JobImportInvalid[]
}

function jobItemReason(rawItem: unknown): string {
  if (!rawItem || typeof rawItem !== 'object') return '记录不是对象'
  const raw = rawItem as Record<string, unknown>
  const present = (...keys: string[]): boolean =>
    keys.some((key) => {
      const value = raw[key]
      if (value === undefined || value === null) return false
      if (typeof value === 'string') return value.trim().length > 0
      return true
    })
  const hasCompany = present('companyName', '企业名称', 'flddT9OT13')
  const hasTitle = present('jobTitle', '岗位名称', 'fldX74eqiU')
  if (!hasCompany && !hasTitle) return '缺少企业名称和岗位名称'
  if (!hasCompany) return '缺少企业名称(companyName)'
  if (!hasTitle) return '缺少岗位名称(jobTitle)'
  return '缺少企业名称或岗位名称'
}

export async function analyzeJobImport(file: File, existing: Application[]): Promise<JobImportAnalysis> {
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as unknown
    let incoming: unknown[] = []
    if (Array.isArray(parsed)) {
      incoming = parsed
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as { kind?: string }).kind === 'applications' &&
      Array.isArray((parsed as { data?: unknown[] }).data)
    ) {
      incoming = (parsed as { data: unknown[] }).data
    } else {
      return { ok: false, total: 0, valid: 0, duplicates: 0, items: [], reason: 'format', invalid: [] }
    }
    const seenKeys = new Set(existing.map((app) => appSignature(app)))
    const invalid: JobImportInvalid[] = []
    const mapped = incoming.map((rawItem, idx) => {
      const item = mapJobItem(rawItem)
      if (!item) {
        invalid.push({ index: idx + 1, reason: jobItemReason(rawItem) })
        return { mapped: {}, isDuplicate: false }
      }
      const signature = appSignature(item)
      const dup = seenKeys.has(signature)
      seenKeys.add(signature)
      return { mapped: item, isDuplicate: dup }
    })
    const validItems = mapped.filter((m) => Boolean(m.mapped.companyName))
    return {
      ok: true,
      total: incoming.length,
      valid: validItems.length,
      duplicates: validItems.filter((m) => m.isDuplicate).length,
      items: validItems,
      invalid,
    }
  } catch {
    return { ok: false, total: 0, valid: 0, duplicates: 0, items: [], reason: 'parse', invalid: [] }
  }
}

export interface JobApplyResult {
  added: number
  skipped: number
}

export function applyJobImport(
  items: JobImportItem[],
  skipDuplicates: boolean,
  storageKey = 'applications',
): JobApplyResult {
  const existing = readStored<Application>(storageKey)
  const byId = new Map(existing.map((app) => [app.id, app]))
  const usedKeys = new Set(existing.map((app) => appSignature(app)))
  let added = 0
  let skipped = 0
  let manualSeq = 0
  for (const { mapped, isDuplicate } of items) {
    const item = mapped as Partial<Application>
    if (!item.companyName || !item.jobTitle) continue
    if (isDuplicate && skipDuplicates) {
      skipped++
      continue
    }
    let id = item.id ?? ''
    if (!id || byId.has(id)) {
      id = `manual-${Date.now()}-${manualSeq++}`
    }
    const nowIso = new Date().toISOString()
    const createdAt =
      typeof item.createdAt === 'string' && item.createdAt
        ? item.createdAt
        : nowIso
    byId.set(id, {
      id,
      companyName: item.companyName!,
      jobTitle: item.jobTitle!,
      jobDirection: item.jobDirection ?? '',
      employmentType: item.employmentType ?? '',
      industry: item.industry ?? '',
      industries: item.industries ?? [],
      companyType: item.companyType ?? '',
      location: item.location ?? '',
      locations: item.locations ?? [],
      educationRequirements: item.educationRequirements ?? [],
      graduationYears: item.graduationYears ?? [],
      majors: item.majors ?? '',
      publishedAt: item.publishedAt ?? '',
      deadline: item.deadline ?? '',
      jobDescription: item.jobDescription ?? '',
      jobRequirements: item.jobRequirements ?? '',
      hireProcess: item.hireProcess ?? '',
      source: item.source ?? 'AI 清洗导入',
      benefits: item.benefits ?? '',
      applicationUrl: item.applicationUrl ?? '',
      announcementUrl: item.announcementUrl ?? '',
      applicationStatus: 'pending',
      screeningStatus: 'to_review',
      priority: 0,
      appliedAt: '',
      notes: '',
      importedAt: nowIso,
      createdAt,
      updatedAt: createdAt,
    })
    usedKeys.add(appSignature(item as Partial<Application>))
    added++
  }
  if (added > 0) {
    localStorage.setItem(storageKey, JSON.stringify([...byId.values()]))
    localStorage.setItem(EDIT_AT_KEY, String(Date.now()))
    scheduleSave()
  }
  return { added, skipped }
}

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { analyzeJobImport, applyJobImport, type JobImportAnalysis } from '../utils/filePersistence'
import { useMode } from '../hooks/useMode'
import {
  APPLICATION_SCREENING_LABELS,
  APPLICATION_SCREENING_STATUSES,
} from '../constants/screeningStatus'
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
} from '../constants/applicationStatus'
import { updateApplicationProgress } from '../utils/progressUpdate'
import { sampleApplications } from '../data/sampleData'
import { PREVIEW_SNAPSHOT } from '../data/previewSnapshot'
import { useAppData } from '../hooks/useAppData'
import { useAuth } from '../hooks/useAuth'
import { useAccountApplications } from '../hooks/useAccountApplications'
import { useAppPath } from '../hooks/useAppPath'
import {
  addDays,
  applicationCompleteness,
  deadlineKind,
  generateId,
  normalizeApplication,
  today,
} from '../utils/helpers'
import {
  buildLedgerList,
  EMPTY_LEDGER_FILTERS,
} from '../utils/ledger'
import type { LedgerFilters, LedgerSort, SmartView } from '../utils/ledger'
import type {
  Application,
  ApplicationScreeningStatus,
  ApplicationStatus,
} from '../types'
import JobListToolbar from '../components/JobListToolbar'
import TrashModal from '../components/TrashModal'

const MAX_IMPORT_CANDIDATES = 3000
const MAX_IMPORT_ADDED_JOBS = 500

const _TEMPLATE_CONTENT = `# 校招岗位采集与清洗模板（输出可导入的岗位 JSON 文件）

把我给你的招聘网页/链接里的校招岗位，整理成一个 JSON 文件，供本工具直接导入。

## 你要做什么
- 读取我提供的招聘页面内容或链接，逐个岗位抓取信息。
- 把每个岗位整理成一条记录，清洗掉广告、导航等无关噪声。
- **输出一个 JSON 文件本身**（不要输出说明文字，也不要用 markdown 代码块包裹）。
- **只输出真实抓取到的内容，绝对不要编造、猜测，也不要留空占位。** 某个字段没有信息就直接省略该字段（或留空字符串/空数组），**不要写 null**。

## 输出格式（两种都行）
方式 A：直接是一个数组
\`\`\`json
[
  { "companyName": "示例企业", "jobTitle": "法务专员", ... },
  { ... }
]
\`\`\`
方式 B：带包裹对象（推荐，可带导出时间等元信息）
\`\`\`json
{
  "kind": "applications",
  "version": 1,
  "exportedAt": "2026-08-18T00:00:00.000Z",
  "data": [ { "companyName": "示例企业", "jobTitle": "法务专员", ... } ]
}
\`\`\`

## 字段说明
下面是所有可用字段。**只有 companyName（企业名称）和 jobTitle（岗位名称）是必填的**，其余都可选——有就填、没有就省略；内容格式不限，原样保留招聘页面的原始表述即可，**系统导入时不会做任何取值校验**（导入后你会看到哪些记录因缺少必填字段而无法导入）。

- companyName / 企业名称 *（必填）*：如「示例企业」
- jobTitle / 岗位名称 *（必填）*：如「法务专员」
- jobDirection / 岗位方向：如「合同/知产/法审」「未明确」
- employmentType / 岗位性质：如「正式」「实习」「未明确」
- industry / 所属行业（主）：如「制造业」
- industries / 所属行业（数组）：如 ["制造业","汽车"]
- companyType / 企业类型：如「合资」「国企」「未明确」
- location / 工作地点（主）：如「广东-东莞」
- locations / 工作地点（数组）：如 ["广东-东莞","北京"]
- educationRequirements / 学历要求（数组）：如 ["本科","硕士"]
- graduationYears / 届次（数组）：如 ["2027届"]
- majors / 招聘专业：如「法学相关专业」
- publishedAt / 发布时间：如「2026-08-12 08:00」（格式不限）
- deadline / 截止日期：如「2026-09-30」或「招满即止」
- jobDescription / 岗位详情：岗位职责与任职要求原文，保留换行
- jobRequirements / 岗位要求：学历、专业、技能等
- hireProcess / 录用流程：如「网申 → 笔试 → 面试 → Offer」
- benefits / 福利待遇：如「五险一金、带薪年假」
- applicationUrl / 投递地址：尽量给完整链接
- announcementUrl / 公告链接：尽量给完整链接

字段名可用上面任一中英文写法，系统都能识别；你也可以自由增删字段。

## 一条完整记录示例
\`\`\`json
{
  "companyName": "示例企业",
  "jobTitle": "法务专员",
  "jobDirection": "法务合规",
  "employmentType": "正式",
  "industry": "专业服务",
  "companyType": "民企",
  "location": "示例城市",
  "locations": ["示例城市"],
  "educationRequirements": ["本科"],
  "graduationYears": ["2027届"],
  "majors": "法学相关专业",
  "publishedAt": "2026-08-12 08:00",
  "deadline": "招满即止",
  "jobDescription": "岗位职责…\\n任职要求…",
  "benefits": "五险一金、带薪年假",
  "applicationUrl": "https://example.com/job"
}
\`\`\`

## 注意事项
- 保存为 .json（如 new-jobs.json），在「我的岗位池」点「＋ 录入岗位 → 批量导入」选择该文件即可。
- 不要输出 null，也不要输出任何多余的解释文字或代码块标记，直接给 JSON 文件本身。
- 系统不会限制字段的取值格式，任意可读内容都能导入。
`

void _TEMPLATE_CONTENT

const EXAMPLE_IMPORT_FILE = JSON.stringify([
  {
    companyName: '示例企业',
    jobTitle: '法务专员',
    jobDirection: '法务合规',
    employmentType: '正式',
    industry: '专业服务',
    companyType: '民企',
    location: '示例城市',
    locations: ['示例城市'],
    educationRequirements: ['本科'],
    graduationYears: ['2027届'],
    majors: '法学相关专业',
    deadline: '招满即止',
    jobDescription: '岗位职责示例',
    applicationUrl: 'https://example.com/job',
  },
], null, 2)

const AI_CLEANING_PROMPT = `请将当前对话中的校招岗位信息，按照以下示例的字段和结构整理为可导入的 JSON 文件。\n\n注意：\n1. 字段名称必须与示例完全一致，不要自行修改、翻译或新建字段名称，以保证文件可以顺利导入。\n2. 输出时只能使用示例中的英文驼峰字段名，例如 companyName、jobTitle、applicationUrl；不要使用中文字段名，也不要使用 company_name、job_title 这类英文下划线字段名，否则可能无法匹配而导入为空。\n3. 每个岗位保留为一条记录；企业名称（companyName）和岗位名称（jobTitle）必须保留。\n4. 如果现有岗位信息中找不到某个字段，请省略该字段，或填入空字符串 / 空数组；不要猜测、补全或编造。\n5. 只输出有效 JSON 内容，不要添加说明文字或 Markdown 代码块。\n\n示例 JSON：\n${EXAMPLE_IMPORT_FILE}`

function downloadExampleImportFile() {
  const blob = new Blob([EXAMPLE_IMPORT_FILE], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '岗位批量导入示例.json'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const VIEW_LABELS: Record<SmartView, string> = {
  all: '全部岗位',
  to_review: '待筛选',
  maybe: '待定',
  selected: '决定推进',
  skipped: '暂不考虑',
  overdue: '已过期',
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
  if (f.status) n++
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

export default function Applications() {
  const appPath = useAppPath()
  const mode = useMode()
  const [rawApplications, setApplications] = useAccountApplications(sampleApplications)
  const applications = useMemo(
    () => rawApplications.map(normalizeApplication),
    [rawApplications],
  )
  const [, setEvents] = useAppData('application-events', [])
  const [tasks] = useAppData('tasks', [])
  const [poolJobsMap, setPoolJobsMap] = useAppData('pool-jobs', {})
  const [, setPoolEventsMap] = useAppData('pool-events', {})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [collaborationPools, setCollaborationPools] = useState<Array<{ id: string; name: string }>>([])
  const [copyTargetPoolId, setCopyTargetPoolId] = useState('')
  const [copyingToPool, setCopyingToPool] = useState(false)
  const [copyResult, setCopyResult] = useState<{ copied: number; total: number; failed: number; poolName: string; preview: boolean } | null>(null)
  const [importTargetPoolIds, setImportTargetPoolIds] = useState<string[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  )
  const { user } = useAuth()
  const [syncedView, setSyncedView] = useAppData<{
    view?: SmartView
    filters?: LedgerFilters
    sortBy?: LedgerSort
    viewMode?: 'table' | 'card'
    groupBy?: string
  }>('app-view', {})
  const stateKey = mode === 'preview' ? 'preview:app-view' : `account:${user?.id ?? 'anonymous'}:app-view`
  const returnScrollKey = `${stateKey}:return-scroll`
  const applicationsKey = mode === 'preview' ? 'preview:applications' : `account:${user?.id ?? 'anonymous'}:applications`

  const readPersisted = <T,>(defaultValue: T): T => {
    try {
      const raw = localStorage.getItem(stateKey)
      if (!raw) return defaultValue
      return JSON.parse(raw) as T
    } catch {
      return defaultValue
    }
  }

  const persisted = readPersisted<{
    view?: SmartView
    filters?: LedgerFilters
    sortBy?: LedgerSort
    viewMode?: 'table' | 'card'
    groupBy?: string
  }>({})

  const [searchParams] = useSearchParams()
  const viewParam = searchParams.get('view') as SmartView | null
  const initialView: SmartView = viewParam ?? persisted.view ?? 'all'
  const [view, setView] = useState<SmartView>(initialView)
  const [filters, setFilters] = useState<LedgerFilters>({
    ...EMPTY_LEDGER_FILTERS,
    ...persisted.filters,
  })
  const [sortBy, setSortBy] = useState<LedgerSort>(persisted.sortBy ?? 'no')
  const [viewMode, setViewMode] = useState<'table' | 'card'>(
    persisted.viewMode ?? 'table',
  )
  const [isNarrowScreen, setIsNarrowScreen] = useState(false)
  const [narrowViewOverride, setNarrowViewOverride] = useState<'table' | 'card' | null>(null)
  // 进入「决定推进」标签页时自动按求职进度分组；切出时恢复进入前的分组方式。
  const prevGroupByRef = useRef<string>(persisted.groupBy ?? 'company')
  const [groupBy, setGroupBy] = useState<string>(
    initialView === 'selected' ? 'status' : (persisted.groupBy ?? 'company'),
  )
  // 工具栏面板（受控）：进入「决定推进」时自动展开分组面板。
  const [toolbarPanel, setToolbarPanel] = useState<'filter' | 'group' | 'sort' | 'view' | null>(
    initialView === 'selected' ? 'group' : null,
  )
  const [importOpen, setImportOpen] = useState(false)
  const [batchImportOpen, setBatchImportOpen] = useState(false)
  const [importAnalysis, setImportAnalysis] = useState<JobImportAnalysis | null>(null)
  const [importFileName, setImportFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; invalid: number; sharedCopied: number; sharedFailed: number; preview: boolean; error?: string } | null>(null)
  const [dedupeReport, setDedupeReport] = useState<
    Array<Array<{ app: Application; index: number }>> | null
  >(null)
  const [trashOpen, setTrashOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!Object.keys(syncedView).length) return
    if (syncedView.view) setView(syncedView.view)
    if (syncedView.filters) setFilters((current) => {
      const next = { ...current, ...syncedView.filters }
      return JSON.stringify(next) === JSON.stringify(current) ? current : next
    })
    if (syncedView.sortBy) setSortBy(syncedView.sortBy)
    if (syncedView.viewMode) setViewMode(syncedView.viewMode)
    if (syncedView.groupBy) setGroupBy(syncedView.groupBy)
  }, [syncedView])
  const importInputRef = useRef<HTMLInputElement>(null)
  const effectiveViewMode = isNarrowScreen ? (narrowViewOverride ?? 'card') : viewMode
  const operationLocked = importing || copyingToPool
  const updateViewMode = (next: 'table' | 'card') => {
    if (isNarrowScreen) setNarrowViewOverride(next)
    else setViewMode(next)
  }

  useEffect(() => {
    if (!operationLocked) return
    const blockKeyboard = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('keydown', blockKeyboard, true)
    return () => document.removeEventListener('keydown', blockKeyboard, true)
  }, [operationLocked])

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
    try {
      localStorage.setItem(
        stateKey,
        JSON.stringify({ view, filters, sortBy, viewMode, groupBy }),
      )
      setSyncedView({ view, filters, sortBy, viewMode, groupBy })
    } catch {
      // 忽略持久化失败
    }
  }, [stateKey, view, filters, sortBy, viewMode, groupBy, setSyncedView])

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

  const openApplicationDetail = (applicationId: string) => {
    try {
      sessionStorage.setItem(returnScrollKey, String(window.scrollY))
    } catch {
      // 筛选状态仍会通过 localStorage 保留
    }
    if (window.innerWidth > 767) {
      window.open(`${appPath(`/applications/${applicationId}`)}?nb`, '_blank')
    } else {
      navigate(appPath(`/applications/${applicationId}`))
    }
  }

  useEffect(() => {
    if (mode === 'workspace') {
      void fetch('/api/pools')
        .then(async (response) => {
          if (!response.ok) return []
          const body = await response.json() as { pools: Array<{ id: string; name: string; kind: string }> }
          return body.pools.filter((pool) => pool.kind === 'group')
        })
        .then((pools) => setCollaborationPools(pools))
        .catch(() => setCollaborationPools([]))
    } else {
      setCollaborationPools(PREVIEW_SNAPSHOT.groups.map((group) => ({ id: group.id, name: group.name })))
    }
  }, [mode])

  const handleJsonImport = async (file: File) => {
    const analysis = await analyzeJobImport(file, applications)
    if (!analysis.ok) {
      window.alert(
        '导入失败：请选择 AI 清洗后导出的岗位 JSON 文件（数组或 { kind: "applications", data: [...] } 格式）。',
      )
      return
    }
    if (analysis.total > MAX_IMPORT_CANDIDATES) {
      window.alert(`单次最多校验 ${MAX_IMPORT_CANDIDATES} 条候选岗位；如文件更大，请先拆成多个 JSON 文件分批导入。`)
      return
    }
    setImportFileName(file.name)
    setImportAnalysis(analysis)
  }

  // 进入「决定推进」标签页：自动按求职进度分组、展开分组面板、全部分组展开；
  // 切出时恢复进入前的分组方式并收起面板。
  const handleViewChange = (next: SmartView) => {
    if (next === view) return
    if (next === 'selected') {
      prevGroupByRef.current = groupBy === 'status' ? prevGroupByRef.current : groupBy
      setGroupBy('status')
      setCollapsedGroups(new Set())
      setToolbarPanel('group')
    } else if (view === 'selected') {
      if (groupBy === 'status') setGroupBy(prevGroupByRef.current)
      setToolbarPanel(null)
    }
    setView(next)
  }

  // 在列表中直接修改求职进度；未「决定推进」的岗位先确认是否同时标记为推进。
  const handleProgressChange = (app: Application, status: ApplicationStatus) => {
    if (status === app.applicationStatus) return
    if (app.screeningStatus !== 'selected') {
      const confirmed = window.confirm(
        '该岗位尚未标记为「决定推进」。是否先标记为「决定推进」，并将求职进度更新为所选状态？',
      )
      if (!confirmed) return
      updateApplicationProgress(app, status, setApplications, setEvents, { markSelected: true })
      return
    }
    updateApplicationProgress(app, status, setApplications, setEvents)
  }

  const selectedImportPoolNames = collaborationPools
    .filter((pool) => importTargetPoolIds.includes(pool.id))
    .map((pool) => pool.name)
  const importNewCount = importAnalysis ? Math.max(0, importAnalysis.valid - importAnalysis.duplicates) : 0
  const importAllCount = importAnalysis?.valid ?? 0

  const runImport = async (skipDuplicates: boolean) => {
    const analysis = importAnalysis
    if (!analysis || analysis.valid === 0) return
    const requestedAdds = skipDuplicates ? Math.max(0, analysis.valid - analysis.duplicates) : analysis.valid
    if (requestedAdds > MAX_IMPORT_ADDED_JOBS) {
      window.alert(`单次最多新增 ${MAX_IMPORT_ADDED_JOBS} 条岗位。当前将新增 ${requestedAdds} 条，请拆分文件或先选择“导入新岗位”拦截重复岗位。`)
      return
    }
    setImportAnalysis(null)
    setImporting(true)
    try {
    if (mode === 'workspace') {
      const poolsResponse = await fetch('/api/pools')
      const pools = await poolsResponse.json() as { pools: Array<{ id: string; kind: string }> }
      const personal = pools.pools.find((pool) => pool.kind === 'personal')
      if (!personal) {
        setImportResult({ added: 0, skipped: 0, invalid: analysis.invalid.length, sharedCopied: 0, sharedFailed: 0, preview: false, error: '未找到你的个人岗位池，暂时无法导入。' })
        return
      }
      const importResponse = await fetch(`/api/pools/${personal.id}/jobs/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applications: analysis.items.map((item) => item.mapped),
          skipDuplicates,
        }),
      })
      const importBody = await importResponse.json() as { error?: string; added?: number; skipped?: number; importedJobIds?: string[] }
      if (!importResponse.ok) {
        setImportResult({ added: 0, skipped: 0, invalid: analysis.invalid.length, sharedCopied: 0, sharedFailed: 0, preview: false, error: importBody.error ?? '导入失败，请稍后重试。' })
        return
      }
      let copied = 0
      let failed = 0
      for (const poolId of importTargetPoolIds) {
        for (const sourceJobId of importBody.importedJobIds ?? []) {
          const copyResponse = await fetch(`/api/pools/${poolId}/jobs/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceJobId }),
          })
          if (copyResponse.ok) copied++
          else failed++
        }
      }
      setImportResult({
        added: importBody.added ?? 0,
        skipped: importBody.skipped ?? (skipDuplicates ? analysis.duplicates : 0),
        invalid: analysis.invalid.length,
        sharedCopied: copied,
        sharedFailed: failed,
        preview: false,
      })
      return
    }
    const result = applyJobImport(analysis.items, skipDuplicates, applicationsKey)
    let sharedCopied = 0
    if (mode === 'preview' && importTargetPoolIds.length > 0) {
      const mappedApps = analysis.items
        .filter((item) => !(skipDuplicates && item.isDuplicate))
        .map((item) => item.mapped)
      let copied = 0
      for (const poolId of importTargetPoolIds) {
        addAppsToPool(poolId, mappedApps)
        copied += mappedApps.length
      }
      sharedCopied = copied
    }
    setImportResult({ added: result.added, skipped: result.skipped, invalid: analysis.invalid.length, sharedCopied, sharedFailed: 0, preview: true })
    } catch {
      setImportResult({ added: 0, skipped: 0, invalid: analysis.invalid.length, sharedCopied: 0, sharedFailed: 0, preview: mode === 'preview', error: '处理过程中出现网络问题，请稍后重试。' })
    } finally {
      setImporting(false)
    }
  }

  const openDedupe = () => {
    const groups = new Map<string, Array<{ app: Application; index: number }>>()
    applications.forEach((app, index) => {
      const key = `${app.companyName}||${app.jobTitle}`
      const list = groups.get(key)
      if (list) list.push({ app, index })
      else groups.set(key, [{ app, index }])
    })
    const dupGroups = [...groups.values()].filter((g) => g.length > 1)
    if (dupGroups.length === 0) {
      window.alert('未检测到重复岗位（企业名称与岗位名称均相同）。')
      return
    }
    setDedupeReport(dupGroups)
    setImportOpen(false)
  }

  const copyImportInstruction = async () => {
    try {
      await navigator.clipboard.writeText(AI_CLEANING_PROMPT)
      window.alert('整理指令已复制，可直接发送给 AI。')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = AI_CLEANING_PROMPT
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      window.alert('整理指令已复制，可直接发送给 AI。')
    }
  }

  const confirmDedupe = () => {
    if (!dedupeReport) return
    const removeIds = new Set<string>()
    for (const group of dedupeReport) {
      const best = [...group].sort((a, b) => {
        const am = a.app.id.startsWith('manual-') ? 1 : 0
        const bm = b.app.id.startsWith('manual-') ? 1 : 0
        if (am !== bm) return am - bm
        return (a.app.importedAt ?? '').localeCompare(b.app.importedAt ?? '')
      })[0]
      for (const item of group) {
        if (item.app.id !== best.app.id) removeIds.add(item.app.id)
      }
    }
    const kept = applications.filter((app) => !removeIds.has(app.id))
    setApplications(kept)
    setDedupeReport(null)
    window.alert(`已去除 ${removeIds.size} 条重复岗位，保留 ${kept.length} 条。`)
  }

  const todayStr = today()
  const in3 = addDays(new Date(), 3)
  const in7 = addDays(new Date(), 7)
  const in15 = addDays(new Date(), 15)

  const activeApplications = useMemo(
    () => applications.filter((app) => !app.deletedAt),
    [applications],
  )

  const sorted = useMemo(
    () =>
      buildLedgerList(activeApplications, view, filters, sortBy, {
        today: todayStr,
        in3,
        in7,
        in15,
      }),
    [activeApplications, view, filters, sortBy, todayStr, in3, in7, in15],
  )

  const groups = useMemo(() => {
    // 按求职进度分组：固定顺序 待投递→已投递→笔试→面试→Offer→未通过，空组不显示
    if (groupBy === 'status') {
      const byStatus = new Map<ApplicationStatus, Application[]>()
      for (const app of sorted) {
        const list = byStatus.get(app.applicationStatus) ?? []
        list.push(app)
        byStatus.set(app.applicationStatus, list)
      }
      return APPLICATION_STATUSES
        .filter((status) => byStatus.has(status))
        .map((status) => ({
          name: APPLICATION_STATUS_LABELS[status],
          items: byStatus.get(status)!,
        }))
    }
    const keyOf = (app: Application): string => {
      if (groupBy === 'entryDate') {
        const date = (app.importedAt || app.createdAt || '').slice(0, 10)
        return date || '未记录日期'
      }
      return app.companyName || '未命名公司'
    }
    const map = new Map<string, Application[]>()
    for (const app of sorted) {
      const name = keyOf(app)
      if (!map.has(name)) map.set(name, [])
      map.get(name)!.push(app)
    }
    // filtered list 已完成排序；保持其首次出现顺序，使分组标题与组内岗位均遵从当前排序。
    return [...map.entries()].map(([name, items]) => ({ name, items }))
  }, [sorted, groupBy])

  const groupCounts = (items: Application[]) => {
    const counts: Record<ApplicationScreeningStatus, number> = {
      to_review: 0,
      maybe: 0,
      selected: 0,
      skipped: 0,
    }
    for (const app of items) counts[app.screeningStatus]++
    return counts
  }

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const expandAll = () => setCollapsedGroups(new Set())
  const collapseAll = () =>
    setCollapsedGroups(new Set(groups.map((g) => g.name)))

  const viewCounts = useMemo(() => {
    const isOverdue = (app: Application) =>
      deadlineKind(app.deadline) === 'dated' && app.deadline < todayStr
    return {
      all: activeApplications.length,
      to_review: activeApplications.filter(
        (app) => app.screeningStatus === 'to_review' && !isOverdue(app),
      ).length,
      maybe: activeApplications.filter(
        (app) => app.screeningStatus === 'maybe' && !isOverdue(app),
      ).length,
      selected: activeApplications.filter(
        (app) => app.screeningStatus === 'selected' && !isOverdue(app),
      ).length,
      skipped: activeApplications.filter(
        (app) => app.screeningStatus === 'skipped' && !isOverdue(app),
      ).length,
      overdue: activeApplications.filter(isOverdue).length,
    }
  }, [activeApplications, todayStr])

  const activeCount = countActiveFilters(filters)
  const clearFilters = () => {
    setFilters(EMPTY_LEDGER_FILTERS)
    setSortBy('created')
  }

  const handleScreeningChange = (
    app: Application,
    status: ApplicationScreeningStatus,
  ) => {
    if (status === app.screeningStatus) return
    setApplications((prev) =>
      prev.map((item) =>
        item.id === app.id
          ? {
              ...item,
              screeningStatus: status,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    )
  }

  const handlePriorityChange = (app: Application, priority: number) => {
    if (priority === app.priority) return
    const now = new Date().toISOString()
    const oldText = app.priority === 0 ? '未评分' : String(app.priority)
    const newText = priority === 0 ? '未评分' : String(priority)
    setApplications((prev) => prev.map((item) =>
      item.id === app.id ? { ...item, priority, updatedAt: now } : item,
    ))
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const toggleSelectAll = () => {
    const allIds = sorted.map((app) => app.id)
    setSelectedIds((prev) =>
      prev.length === allIds.length && allIds.every((id) => prev.includes(id))
        ? []
        : allIds,
    )
  }

  const addAppsToPool = (poolId: string, apps: Array<Partial<Application>>) => {
    const pool = poolJobsMap[poolId] ?? []
    let no = pool.length
    const items = apps.map((app) => {
      no++
      return { id: generateId(), no, app }
    })
    setPoolJobsMap((current) => ({
      ...current,
      [poolId]: [
        ...(current[poolId] ?? []),
        ...items.map((item) => ({
          id: item.id,
          no: item.no,
          payload_json: JSON.stringify({ ...item.app, id: item.id, no: item.no }),
          revision: 1,
        })),
      ],
    }))
    setPoolEventsMap((current) => ({
      ...current,
      [poolId]: [
        ...(current[poolId] ?? []),
        ...items.map((item) => ({
          job_id: item.id,
          actor_name: '演示用户',
          action: 'copied' as const,
          changed_fields_json: '{}',
          created_at: new Date().toISOString(),
        })),
      ],
    }))
  }

  const batchSetScreening = (status: ApplicationScreeningStatus) => {
    if (selectedIds.length === 0) return
    const now = new Date().toISOString()
    const idSet = new Set(selectedIds)
    setApplications((prev) =>
      prev.map((item) =>
        idSet.has(item.id)
          ? { ...item, screeningStatus: status, updatedAt: now }
          : item,
      ),
    )
    setSelectedIds([])
  }

  const batchDelete = () => {
    if (selectedIds.length === 0) return
    if (
      !window.confirm(`删除后，该岗位会进入"我的岗位池回收站"，7 天内可恢复；关联任务、个人备注、岗位标签和进度记录会一并保留。确认删除选中的 ${selectedIds.length} 条岗位？`)
    ) {
      return
    }
    const idSet = new Set(selectedIds)
    const deletedAt = new Date().toISOString()
    setApplications((prev) =>
      prev.map((item) =>
        idSet.has(item.id)
          ? { ...item, deletedAt, updatedAt: deletedAt }
          : item,
      ),
    )
    setSelectedIds([])
  }

  const batchCopyToCollaborationPool = async () => {
    if (!copyTargetPoolId || selectedIds.length === 0 || copyingToPool) return
    const ids = [...selectedIds]
    const poolName = collaborationPools.find((pool) => pool.id === copyTargetPoolId)?.name ?? '群组岗位池'
    setCopyingToPool(true)
    try {
      if (mode === 'preview') {
        const apps = rawApplications.filter((app) => ids.includes(app.id))
        addAppsToPool(copyTargetPoolId, apps)
        setCopyResult({ copied: apps.length, total: ids.length, failed: ids.length - apps.length, poolName, preview: true })
        return
      }
      let copied = 0
      let failed = 0
      for (const sourceJobId of ids) {
        try {
          const response = await fetch(`/api/pools/${copyTargetPoolId}/jobs/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceJobId }),
          })
          if (response.ok) copied++
          else failed++
        } catch {
          failed++
        }
      }
      setCopyResult({ copied, total: ids.length, failed, poolName, preview: false })
    } finally {
      setCopyingToPool(false)
      setSelectedIds([])
      setCopyTargetPoolId('')
    }
  }

  const set = <K extends keyof LedgerFilters>(
    key: K,
    value: LedgerFilters[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const renderDeadlineCell = (app: Application) => {
    const kind = deadlineKind(app.deadline)
    if (kind === 'rolling') {
      return <span className="deadline-chip deadline-rolling">招满即止</span>
    }
    if (kind === 'none') {
      return <span className="deadline-chip deadline-none">无明确截止</span>
    }
    const overdue = app.deadline < todayStr
    const soon = app.deadline <= in15
    return (
      <span
        className={
          overdue
            ? 'deadline-chip deadline-overdue-chip'
            : soon
              ? 'deadline-chip deadline-soon-chip'
              : 'deadline-chip deadline-dated'
        }
      >
        <span className="deadline-date">{app.deadline}</span>
        {overdue && <span className="deadline-hint">已过期</span>}
        {!overdue && soon && <span className="deadline-hint">15天内到期</span>}
      </span>
    )
  }

  const renderCompletenessTags = (app: Application) => {
    const c = applicationCompleteness(app)
    const tags: string[] = []
    if (!c.hasDescription) tags.push('缺详情')
    if (!c.hasBenefits) tags.push('缺福利')
    if (!c.hasDeadline) tags.push('缺截止')
    if (!c.hasLinks) tags.push('缺链接')
    if (tags.length === 0) return null
    return (
      <span className="completeness-tags">
        {tags.map((tag) => (
          <span key={tag} className="completeness-tag">
            {tag}
          </span>
        ))}
      </span>
    )
  }

  const renderPriorityControl = (app: Application) => (
    <select
      className="field-input priority-select"
      value={app.priority}
      aria-label={`${app.companyName} · ${app.jobTitle} 的 Priority`}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => handlePriorityChange(app, Number(event.target.value))}
    >
      <option value={0}>未评分</option>
      {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{'★'.repeat(score)}</option>)}
    </select>
  )

  // 求职进度下拉框：决定推进的岗位直接修改；未推进的岗位会先确认是否同时标记推进。
  const renderProgressControl = (app: Application) => (
    <select
      className="field-input progress-select"
      value={app.applicationStatus}
      aria-label={`${app.companyName} · ${app.jobTitle} 的求职进度`}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) =>
        handleProgressChange(app, event.target.value as ApplicationStatus)
      }
    >
      {APPLICATION_STATUSES.map((s) => (
        <option key={s} value={s}>
          {APPLICATION_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  )

  return (
    <section className={selectedIds.length > 0 ? 'has-batch-bar' : undefined}>
      <div className="toolbar">
        <div>
          <h1 className="page-title">我的岗位池</h1>
          <p className="page-desc">把值得关注的机会录入你的私有岗位池，再决定下一步。</p>
        </div>
        <div className="toolbar-actions">
          <div className="add-menu">
            <button
              type="button"
              className={importOpen ? 'btn btn-gradient' : 'btn btn-outline'}
              onClick={() => setImportOpen((s) => !s)}
              aria-expanded={importOpen}
            >
              ＋ 录入岗位
            </button>
            {importOpen && (
              <>
              <div className="add-popover-backdrop" onClick={() => setImportOpen(false)} />
              <div className="add-popover" onClick={(event) => event.stopPropagation()}>
                <div className="add-category">
                  <span className="add-category-title">手动新增</span>
                  <Link
                    to={appPath('/applications/new')}
                    className="add-popover-item"
                    onClick={() => setImportOpen(false)}
                  >
                    <span className="add-item-title">手动录入</span>
                    <span className="add-item-desc">填写信息，新增一条岗位</span>
                  </Link>
                </div>
                <button
                  type="button"
                  className="add-popover-item"
                  onClick={() => {
                    setImportOpen(false)
                    setBatchImportOpen(true)
                  }}
                >
                  <span className="add-item-title">批量导入</span>
                  <span className="add-item-desc">下载模板、复制整理指令并导入 JSON 文件</span>
                </button>
                <button
                  type="button"
                  className="add-popover-item"
                  onClick={openDedupe}
                >
                  <span className="add-item-title">清理重复</span>
                  <span className="add-item-desc">检测企业名称与岗位名称相同的记录，再决定是否清理</span>
                </button>
              </div>
              </>
            )}
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="data-transfer-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleJsonImport(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setTrashOpen(true)}
          >
            回收站
          </button>
        </div>
      </div>

      <div className="view-tabs" role="tablist">
        {(Object.keys(VIEW_LABELS) as SmartView[]).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={view === v ? 'view-tab active' : 'view-tab'}
            onClick={() => handleViewChange(v)}
          >
            {VIEW_LABELS[v]}
            <span className="view-tab-count">{viewCounts[v]}</span>
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
        resultCount={sorted.length}
        showStatusFilter
        showStatusGroup
        openPanel={toolbarPanel}
        onOpenPanelChange={setToolbarPanel}
        onClearFilters={clearFilters}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />

      {selectedIds.length > 0 && (
        <div className={copyingToPool ? 'batch-bar is-busy' : 'batch-bar'}>
          <span className="batch-count">已选 {selectedIds.length} 条</span>
          <span className="batch-label">批量设为：</span>
          {APPLICATION_SCREENING_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-sm"
              disabled={copyingToPool}
              onClick={() => batchSetScreening(s)}
            >
              {APPLICATION_SCREENING_LABELS[s]}
            </button>
          ))}
          {collaborationPools.length > 0 && (
            <>
              <select
                className="field-input batch-copy-select"
                value={copyTargetPoolId}
                disabled={copyingToPool}
                onChange={(event) => setCopyTargetPoolId(event.target.value)}
              >
                <option value="">汇入群组岗位池…</option>
                {collaborationPools.map((pool) => (
                  <option key={pool.id} value={pool.id}>{pool.name}</option>
                ))}
              </select>
              <button type="button" className="btn btn-sm" disabled={!copyTargetPoolId || copyingToPool} onClick={() => void batchCopyToCollaborationPool()}>
                {copyingToPool ? '复制中…' : '批量复制'}
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm batch-delete"
            disabled={copyingToPool}
            onClick={batchDelete}
          >
            批量删除
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={copyingToPool}
            onClick={() => setSelectedIds([])}
          >
            取消选择
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          当前没有符合条件的岗位，试试调整筛选或清除筛选条件。
        </div>
      ) : (
        <>
          {effectiveViewMode === 'table' && (
            <>
              <div className="table-wrap ledger-table-wrap">
                <table className="ledger-table ledger-table-my">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={
                        sorted.length > 0 &&
                        sorted.every((app) => selectedIds.includes(app.id))
                      }
                      onChange={toggleSelectAll}
                      aria-label="全选当前列表"
                    />
                  </th>
                  <th className="col-no">编号</th>
                  <th className="col-name">企业名称 / 岗位名称</th>
                  <th className="col-direction">岗位方向</th>
                  <th className="col-location">工作地点</th>
                  <th className="col-deadline">截止状态</th>
                  <th className="col-actions">筛选状态</th>
                  <th className="col-priority">Priority</th>
                  <th className="col-progress">投递进度</th>
                </tr>
              </thead>
              <tbody>
                {groupBy === 'none' &&
                  sorted.map((app) => (
                    <tr
                      key={app.id}
                      className={
                        selectedIds.includes(app.id)
                          ? 'ledger-row ledger-row-selected'
                          : 'ledger-row'
                      }
                      onClick={() => openApplicationDetail(app.id)}
                    >
                      <td
                        className="cell-check"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          aria-label={`选择 ${app.companyName} · ${app.jobTitle}`}
                        />
                      </td>
                      <td className="cell-no">{app.no ?? '—'}</td>
                      <td>
                        <div className="cell-company">{app.companyName}</div>
                        <div className="cell-job">{app.jobTitle}</div>
                        {renderCompletenessTags(app)}
                      </td>
                      <td className="col-direction">{app.jobDirection || '—'}</td>
                      <td className="col-location">{app.locations.join('、') || '—'}</td>
                      <td>{renderDeadlineCell(app)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          className="field-input screening-select"
                          value={app.screeningStatus}
                          onChange={(e) =>
                            handleScreeningChange(
                              app,
                              e.target.value as ApplicationScreeningStatus,
                            )
                          }
                        >
                          {APPLICATION_SCREENING_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {APPLICATION_SCREENING_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>{renderPriorityControl(app)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {renderProgressControl(app)}
                      </td>
                    </tr>
                  ))}
                {groupBy !== 'none' &&
                  groups.map((group) => {
                  const counts = groupCounts(group.items)
                  const collapsed = collapsedGroups.has(group.name)
                  return (
                    <Fragment key={group.name}>
                      <tr
                        className="company-group-head"
                        onClick={() => toggleGroup(group.name)}
                      >
                        <td className="cell-check">
                          <input
                            type="checkbox"
                            checked={
                              group.items.length > 0 &&
                              group.items.every((app) =>
                                selectedIds.includes(app.id),
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => {
                              const allChecked = group.items.every((app) =>
                                selectedIds.includes(app.id),
                              )
                              setSelectedIds((prev) =>
                                allChecked
                                  ? prev.filter(
                                      (id) =>
                                        !group.items.some(
                                          (app) => app.id === id,
                                        ),
                                    )
                                  : [
                                      ...prev,
                                      ...group.items
                                        .map((app) => app.id)
                                        .filter((id) => !prev.includes(id)),
                                    ],
                              )
                            }}
                            aria-label={`选择 ${group.name} 全部岗位`}
                          />
                        </td>
                        <td colSpan={8}>
                          <div className="company-group-bar">
                            <span className="company-group-toggle">
                              {collapsed ? '▸' : '▾'}
                            </span>
                            <span className="company-group-name">
                              {group.name}
                            </span>
                            <span className="company-group-count">
                              {group.items.length} 个岗位
                            </span>
                            <span className="company-group-stats">
                              {counts.to_review > 0 && (
                                <span className="cg-stat cg-to-review">
                                  待筛选 {counts.to_review}
                                </span>
                              )}
                              {counts.maybe > 0 && (
                                <span className="cg-stat cg-maybe">
                                  待定 {counts.maybe}
                                </span>
                              )}
                              {counts.selected > 0 && (
                                <span className="cg-stat cg-selected">
                                  决定推进 {counts.selected}
                                </span>
                              )}
                              {counts.skipped > 0 && (
                                <span className="cg-stat cg-skipped">
                                  暂不考虑 {counts.skipped}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {!collapsed &&
                        group.items.map((app) => (
                          <tr
                            key={app.id}
                            className={
                              selectedIds.includes(app.id)
                                ? 'ledger-row ledger-row-selected'
                                : 'ledger-row'
                            }
                            onClick={() => openApplicationDetail(app.id)}
                          >
                            <td
                              className="cell-check"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(app.id)}
                                onChange={() => toggleSelect(app.id)}
                                aria-label={`选择 ${app.companyName} · ${app.jobTitle}`}
                              />
                            </td>
                            <td className="cell-no">{app.no ?? '—'}</td>
                            <td>
                              <div className="cell-company">{app.companyName}</div>
                              <div className="cell-job">{app.jobTitle}</div>
                              {renderCompletenessTags(app)}
                            </td>
                            <td className="col-direction">{app.jobDirection || '—'}</td>
                            <td className="col-location">{app.locations.join('、') || '—'}</td>
                            <td>{renderDeadlineCell(app)}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <select
                                className="field-input screening-select"
                                value={app.screeningStatus}
                                onChange={(e) =>
                                  handleScreeningChange(
                                    app,
                                    e.target.value as ApplicationScreeningStatus,
                                  )
                                }
                              >
                                {APPLICATION_SCREENING_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {APPLICATION_SCREENING_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>{renderPriorityControl(app)}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              {renderProgressControl(app)}
                            </td>
                          </tr>
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
                {sorted.length > 0 && sorted.every((app) => selectedIds.includes(app.id)) ? '取消全选' : '全选当前列表'}
              </button>
              <span>当前 {sorted.length} 条岗位</span>
            </div>
            <div className="app-card-list">
              {sorted.map((app) => (
              <div
                key={app.id}
                className={
                  selectedIds.includes(app.id)
                    ? 'app-card app-card-selected'
                    : 'app-card'
                }
                onClick={() => openApplicationDetail(app.id)}
              >
                <div className="app-card-head">
                  <div className="app-card-title">
                    <span
                      className="app-card-check"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(app.id)}
                        onChange={() => toggleSelect(app.id)}
                        aria-label={`选择 ${app.companyName} · ${app.jobTitle}`}
                      />
                    </span>
                    <span className="app-card-no">#{app.no ?? '—'}</span>
                    <div className="cell-company">{app.companyName}</div>
                    <div className="cell-job">{app.jobTitle}</div>
                  </div>
                  <div className="app-card-badges">
                    <select
                      className="field-input screening-select"
                      value={app.screeningStatus}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        handleScreeningChange(
                          app,
                          e.target.value as ApplicationScreeningStatus,
                        )
                      }
                    >
                      {APPLICATION_SCREENING_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {APPLICATION_SCREENING_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    {renderPriorityControl(app)}
                    {renderProgressControl(app)}
                  </div>
                </div>
                <div className="app-card-meta">
                  <span>{app.jobDirection || '—'}</span>
                  <span>{app.locations.join('、') || '—'}</span>
                </div>
                <div className="app-card-deadline">
                  {renderDeadlineCell(app)}
                </div>
                {renderCompletenessTags(app)}
              </div>
            ))}
            </div>
            </>
          )}
        </>
      )}
      {importing && (
        <div className="modal-overlay operation-overlay">
          <div className="modal import-summary-modal" role="status" aria-live="polite">
            <h3 className="import-summary-title">正在批量导入…</h3>
            <p className="import-summary-hint">正在写入岗位数据；如勾选了群组岗位池，也会在导入后同步处理。请勿关闭页面或重复操作。</p>
          </div>
        </div>
      )}
      {importResult && (
        <div className="modal-overlay operation-result-overlay">
          <div className="modal import-summary-modal">
            <h3 className="import-summary-title">{importResult.error ? '批量导入未完成' : '批量导入完成'}</h3>
            {importResult.error ? <p className="form-error">{importResult.error}</p> : <>
              <div className="import-summary-stats">
                <span className="ok">新增到我的岗位池 <b>{importResult.added}</b> 条</span>
                {importResult.skipped > 0 && <span className="warn">已拦截重复岗位 <b>{importResult.skipped}</b> 条</span>}
                {importResult.invalid > 0 && <span className="bad">缺少必填项，未导入 <b>{importResult.invalid}</b> 条</span>}
              </div>
              {importResult.skipped > 0 && <p className="page-desc">重复判断依据：企业名称 + 岗位名称均相同。被拦截的重复岗位不会覆盖已有岗位的筛选、投递进度、星级、备注或标签。</p>}
              {importResult.sharedCopied > 0 && <p className="page-desc">已同步汇入所选群组岗位池 {importResult.sharedCopied} 条。</p>}
              {importResult.sharedFailed > 0 && <p className="form-error">另有 {importResult.sharedFailed} 条未能同步到群组岗位池，请稍后重试；已导入到我的岗位池的内容不会受影响。</p>}
              {importResult.added === 0 && importResult.skipped > 0 && <p className="page-desc">本次没有新增岗位，因为文件内容已在你的岗位池中存在。</p>}
            </>}
            {importResult.preview && <p className="page-desc">当前为访客模式，导入结果仅保存在虚构的演示数据中。</p>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => window.location.reload()}>{importResult.error ? '知道了' : '知道了，刷新列表'}</button>
            </div>
          </div>
        </div>
      )}
      {copyingToPool && (
        <div className="modal-overlay operation-overlay">
          <div className="modal import-summary-modal" role="status" aria-live="polite">
            <h3 className="import-summary-title">正在复制到群组岗位池…</h3>
            <p className="import-summary-hint">正在逐条处理所选岗位。请勿关闭页面、返回或进行其他操作，完成后会显示复制结果。</p>
          </div>
        </div>
      )}
      {copyResult && (
        <div className="modal-overlay operation-result-overlay" onClick={() => setCopyResult(null)}>
          <div className="modal copy-result-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="import-summary-title">批量复制完成</h3>
            <p className="page-desc">已成功汇入「{copyResult.poolName}」{copyResult.copied} / {copyResult.total} 条岗位。</p>
            {copyResult.failed > 0 && <p className="form-error">另有 {copyResult.failed} 条未成功复制，请稍后重试。</p>}
            {copyResult.preview && <p className="page-desc">当前为访客模式，结果仅保存在虚构的演示数据中。</p>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setCopyResult(null)}>知道了</button>
            </div>
          </div>
        </div>
      )}
      {importAnalysis && (
        <div className="modal-overlay" onClick={() => setImportAnalysis(null)}>
          <div className="modal import-summary-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="import-summary-title">
              导入前校验{importFileName ? ` · ${importFileName}` : ''}
            </h3>
            <div className="import-summary-stats">
              <span>文件共 <b>{importAnalysis.total}</b> 条</span>
              <span className="ok import-new-highlight">新岗位 <b>{importAnalysis.valid - importAnalysis.duplicates}</b> 条</span>
              <span className="warn">与已有重复 <b>{importAnalysis.duplicates}</b> 条</span>
              <span className="bad">缺少必填项 <b>{importAnalysis.invalid.length}</b> 条</span>
            </div>
            <p className="import-summary-hint">单次实际新增最多 {MAX_IMPORT_ADDED_JOBS} 条。重复岗位如选择“导入新岗位”会被拦截，不占用新增额度。</p>
            {importAnalysis.invalid.length > 0 && (
              <div className="import-invalid">
                <p className="import-invalid-title">以下记录缺少必填字段（企业名称/岗位名称），将不会被导入：</p>
                <ul className="import-invalid-list">
                  {importAnalysis.invalid.slice(0, 30).map((inv) => (
                    <li key={inv.index}>第 {inv.index} 条：{inv.reason}</li>
                  ))}
                </ul>
                {importAnalysis.invalid.length > 30 && (
                  <p className="import-invalid-more">…其余 {importAnalysis.invalid.length - 30} 条同理</p>
                )}
              </div>
            )}
            {selectedImportPoolNames.length > 0 && (
              <div className="import-destination-preview">
                <p className="import-destination-title">已勾选同步汇入群组岗位池</p>
                <p className="page-desc">{selectedImportPoolNames.join('、')}</p>
                <p className="page-desc">
                  选择“导入新岗位”时，将同步本次新增的 {importNewCount} 条岗位；选择“全部导入”时，将同步全部 {importAllCount} 条有效岗位，其中重复岗位会以副本形式进入我的岗位池和群组岗位池。
                </p>
                <p className="page-desc">如果实际新增超过 {MAX_IMPORT_ADDED_JOBS} 条，需要拆分文件后分批导入；本次勾选的群组只会收到成功新增的岗位。</p>
              </div>
            )}
            {importAnalysis.valid === 0 ? (
              <div className="modal-actions">
                <button type="button" className="btn btn-primary" onClick={() => setImportAnalysis(null)}>
                  我知道了
                </button>
              </div>
            ) : importAnalysis.valid - importAnalysis.duplicates === 0 ? (
              <>
                <p className="import-summary-hint">文件中的岗位均已存在。推荐取消导入；如果确实想保留多份相同岗位，也可以选择全部导入并生成副本，但单次最多新增 {MAX_IMPORT_ADDED_JOBS} 条。</p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setImportAnalysis(null)}>
                    取消
                  </button>
                  <button type="button" className="btn" onClick={() => runImport(false)}>
                    全部导入 {importAnalysis.valid} 条
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="import-summary-hint">请选择导入方式。缺少必填项（企业名称或岗位名称）的记录不会导入；推荐只导入新岗位，重复岗位会被拦截在外，不会影响你已有的私有数据。</p>
                <div className="modal-actions import-actions-stacked">
                  <button type="button" className="btn btn-outline" onClick={() => setImportAnalysis(null)}>
                    取消
                  </button>
                  {importAnalysis.duplicates > 0 && (
                    <button type="button" className="btn btn-with-desc" onClick={() => runImport(false)}>
                      <span className="btn-with-desc-title">全部导入 {importAnalysis.valid} 条</span>
                      <span className="btn-hint btn-hint-danger">与已有岗位重复的 {importAnalysis.duplicates} 条会生成副本</span>
                    </button>
                  )}
                  <button type="button" className="btn btn-primary btn-with-desc" onClick={() => runImport(true)}>
                    {importAnalysis.duplicates > 0 ? (
                      <>
                        <span className="btn-with-desc-title">导入 {importNewCount} 条新岗位（推荐）</span>
                        <span className="btn-hint">自动跳过 {importAnalysis.duplicates} 条重复岗位</span>
                      </>
                    ) : (
                      <span className="btn-with-desc-title">确认导入 {importAnalysis.valid} 条</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {batchImportOpen && (
        <div className="modal-overlay" onClick={() => setBatchImportOpen(false)}>
          <div className="modal batch-import-modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="import-summary-title">批量导入</h3>
            <p className="import-summary-hint">一次录入多条岗位：先让 AI 按现成指令整理，再选择它输出的文件即可。</p>
            <ol className="batch-import-steps">
              <li>先收集岗位信息，或让 AI 自行查找岗位；也可以把招聘链接、岗位描述或截图发给 AI。</li>
              <li>点击<b>「一键复制整理指令」</b>，把复制好的内容直接发送给 AI。指令已经说明了整理要求，不需要自行改写。</li>
              <li>让 AI 按指令生成 JSON 文件并保存到本机；如果 AI 不确定文件格式，可一并发送<b>「示例 JSON 文件」</b>。</li>
              <li>点击<b>「JSON 批量录入」</b>，选择该文件。系统会先检查内容，并告诉你可以导入多少条、哪些重复或有问题。</li>
              <li>确认导入方式即可；如希望岗位同时进入群组岗位池，再勾选对应群组。只想个人管理时无需勾选。单次实际新增最多 {MAX_IMPORT_ADDED_JOBS} 条；重复岗位被拦截时不占用新增额度。</li>
            </ol>
            <div className="batch-import-actions">
              <button type="button" className="btn btn-outline" onClick={() => void copyImportInstruction()}>一键复制整理指令</button>
              <button type="button" className="btn btn-outline" onClick={downloadExampleImportFile}>下载示例 JSON 文件</button>
              <button type="button" className="btn" onClick={() => {
                setBatchImportOpen(false)
                importInputRef.current?.click()
              }}>JSON 批量录入</button>
            </div>
            {collaborationPools.length > 0 && (
              <div className="batch-import-pools">
                <span className="add-section-title">批量导入时同步汇入群组岗位池</span>
                {collaborationPools.map((pool) => (
                  <label key={pool.id} className="add-check">
                    <input
                      type="checkbox"
                      checked={importTargetPoolIds.includes(pool.id)}
                      onChange={() => setImportTargetPoolIds((ids) => ids.includes(pool.id) ? ids.filter((id) => id !== pool.id) : [...ids, pool.id])}
                    />
                    {pool.name}
                  </label>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setBatchImportOpen(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
      {dedupeReport && (
        <div className="modal-overlay" onClick={() => setDedupeReport(null)}>
          <div className="modal import-summary-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="import-summary-title">清理重复</h3>
            <p className="import-summary-hint">
              检测到 {dedupeReport.reduce((sum, g) => sum + g.length - 1, 0)} 条重复记录（来自{' '}
              {dedupeReport.length} 组相同「企业 + 岗位」），每组将保留 1 条：
            </p>
            <div className="import-invalid">
              <ul className="import-invalid-list dedupe-list">
                {dedupeReport.map((group, gi) => {
                  const canonical = group[0].app
                  const dups = group.slice(1)
                  return (
                    <li key={gi} className="dedupe-group">
                      <b>{canonical.companyName} - {canonical.jobTitle}</b>
                      <span className="dedupe-meta">（共 {group.length} 条，将移除 {dups.length} 条）</span>
                      <ul>
                        {dups.map((d) => (
                          <li key={d.app.id}>
                            第 {d.index + 1} 条{d.app.no ? `（编号 ${d.app.no}）` : ''}
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setDedupeReport(null)}>
                取消
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmDedupe}>
                清理重复
              </button>
            </div>
          </div>
        </div>
      )}
      <TrashModal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        onRestore={(jobId) => {
          setApplications((prev) =>
            prev.map((app) =>
              app.id === jobId
                ? { ...app, deletedAt: undefined, deletedBy: undefined, updatedAt: new Date().toISOString() }
                : app,
            ),
          )
        }}
        applications={applications}
        tasks={tasks}
      />
    </section>
  )
}

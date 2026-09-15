import type {
  Application,
  ApplicationEvent,
  CustomField,
  EducationEntry,
  ExperienceEntry,
  LibraryEntry,
  Profile,
  ProfileJobType,
  ProfileModule,
  ProfileVariant,
  ProjectEntry,
  SkillCategory,
  Task,
  TextItem,
} from '../types'

export function normalizeApplication(app: Application): Application {
  const industries = normalizeStringArray(app.industries)
  const locations = normalizeStringArray(app.locations)
  const educationRequirements = normalizeStringArray(app.educationRequirements)
  const graduationYears = normalizeStringArray(app.graduationYears)
  return {
    ...app,
    industries,
    locations,
    educationRequirements,
    graduationYears,
    industry: app.industry ?? industries[0] ?? '',
    location: app.location ?? locations[0] ?? '',
    jobRequirements: app.jobRequirements ?? '',
    hireProcess: app.hireProcess ?? '',
    source: app.source ?? '',
    screeningStatus: app.screeningStatus ?? 'to_review',
    priority: app.priority ?? 0,
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string' && item.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(item) as unknown
          if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean)
        } catch { /* not JSON */ }
      }
      const s = String(item).trim()
      return s ? [s] : []
    })
  }
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean)
  } catch {
    // 普通文本按单个值保留。
  }
  return [value.trim()]
}

export type DeadlineKind = 'dated' | 'rolling' | 'none'

const IS_STANDARD_DATE = /^\d{4}-\d{2}-\d{2}$/

export function deadlineKind(deadline: string): DeadlineKind {
  const value = (deadline ?? '').trim()
  if (IS_STANDARD_DATE.test(value)) return 'dated'
  if (value.includes('招满即止')) return 'rolling'
  return 'none'
}

export interface Completeness {
  hasDescription: boolean
  hasBenefits: boolean
  hasDeadline: boolean
  hasLinks: boolean
}

export function applicationCompleteness(app: Application): Completeness {
  return {
    hasDescription: Boolean((app.jobDescription ?? '').trim()),
    hasBenefits: Boolean((app.benefits ?? '').trim()),
    hasDeadline: deadlineKind(app.deadline) !== 'none',
    hasLinks: Boolean(app.applicationUrl || app.announcementUrl),
  }
}

export function normalizeTask(task: Task): Task {
  return {
    ...task,
    notes: task.notes ?? '',
    updatedAt: task.updatedAt ?? task.createdAt,
    completedAt: task.completedAt ?? '',
  }
}

export function normalizeEvent(event: ApplicationEvent): ApplicationEvent {
  return {
    ...event,
    kind: event.kind ?? 'status',
    toStatus: event.toStatus ?? null,
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object'
    ? (value as Record<string, T>)
    : {}
}

export function emptyVariant(): ProfileVariant {
  return {
    certificates: [],
    experience: [],
    projects: [],
    skills: [],
    activities: [],
    modules: [],
    customFields: {
      experience: [],
      projects: [],
      skills: [],
      activities: [],
      modules: [],
      certificates: [],
    },
  }
}

function normalizeVariant(value: unknown): ProfileVariant {
  const v = asRecord<unknown>(value)
  const cfRaw = asRecord<CustomField[]>(v.customFields)
  return {
    certificates: asArray<TextItem>(v.certificates),
    experience: asArray<ExperienceEntry>(v.experience),
    projects: asArray<ProjectEntry>(v.projects),
    skills: asArray<SkillCategory>(v.skills),
    activities: asArray<TextItem>(v.activities),
    modules: asArray<ProfileModule>(v.modules),
    customFields: {
      experience: asArray<CustomField>(cfRaw.experience),
      projects: asArray<CustomField>(cfRaw.projects),
      skills: asArray<CustomField>(cfRaw.skills),
      activities: asArray<CustomField>(cfRaw.activities),
      modules: asArray<CustomField>(cfRaw.modules),
      certificates: asArray<CustomField>(cfRaw.certificates),
    },
  }
}

export function normalizeProfile(input: unknown): Profile {
  const p = asRecord<unknown>(input)
  const legacyCertificates = asArray<EducationEntry>(p.education).flatMap(
    (entry) => asArray<TextItem>(entry.certificates),
  )
  const shared = {
    name: typeof p.name === 'string' ? p.name : '',
    age: typeof p.age === 'string' ? p.age : '',
    phone: typeof p.phone === 'string' ? p.phone : '',
    email: typeof p.email === 'string' ? p.email : '',
    location: typeof p.location === 'string' ? p.location : '',
    politicalStatus: typeof p.politicalStatus === 'string' ? p.politicalStatus : '',
    ethnicity: typeof p.ethnicity === 'string' ? p.ethnicity : '',
    jobIntent: typeof p.jobIntent === 'string' ? p.jobIntent : '',
    avatar: typeof p.avatar === 'string' ? p.avatar : '',
    sensitiveVisibility: {
      phone: asRecord<unknown>(p.sensitiveVisibility).phone !== false,
      email: asRecord<unknown>(p.sensitiveVisibility).email !== false,
      location: asRecord<unknown>(p.sensitiveVisibility).location !== false,
      politicalStatus: asRecord<unknown>(p.sensitiveVisibility).politicalStatus !== false,
      ethnicity: asRecord<unknown>(p.sensitiveVisibility).ethnicity !== false,
    },
    education: asArray<EducationEntry>(p.education),
    customFields: {
      base: asArray<CustomField>(asRecord<unknown>(p.customFields).base),
      education: asArray<CustomField>(asRecord<unknown>(p.customFields).education),
    },
    honors: asArray<TextItem>(p.honors),
    library: asArray<LibraryEntry>(p.library),
  }

  const jobTypes: ProfileJobType[] =
    asArray<ProfileJobType>(p.jobTypes).length > 0
      ? asArray<ProfileJobType>(p.jobTypes)
      : [{ id: 'default', name: '默认' }]
  const defaultId = jobTypes[0].id

  const hasOldShape =
    asArray<TextItem>(p.certificates).length > 0 ||
    asArray<ExperienceEntry>(p.experience).length > 0 ||
    asArray<ProjectEntry>(p.projects).length > 0 ||
    asArray<SkillCategory>(p.skills).length > 0 ||
    asArray<TextItem>(p.activities).length > 0 ||
    asArray<ProfileModule>(p.modules).length > 0

  let variants: Record<string, ProfileVariant>
  if (hasOldShape) {
    const cfRaw = asRecord<CustomField[]>(p.customFields)
    variants = {
      [defaultId]: {
        certificates: asArray<TextItem>(p.certificates).length
          ? asArray<TextItem>(p.certificates)
          : legacyCertificates,
        experience: asArray<ExperienceEntry>(p.experience),
        projects: asArray<ProjectEntry>(p.projects),
        skills: asArray<SkillCategory>(p.skills),
        activities: asArray<TextItem>(p.activities),
        modules: asArray<ProfileModule>(p.modules),
        customFields: {
          experience: asArray<CustomField>(cfRaw.experience),
          projects: asArray<CustomField>(cfRaw.projects),
          skills: asArray<CustomField>(cfRaw.skills),
          activities: asArray<CustomField>(cfRaw.activities),
          modules: asArray<CustomField>(cfRaw.modules),
          certificates: asArray<CustomField>(cfRaw.certificates),
        },
      },
    }
  } else {
    const rawVariants = asRecord<unknown>(p.variants)
    variants = {}
    for (const [id, v] of Object.entries(rawVariants)) {
      variants[id] = normalizeVariant(v)
    }
    if (Object.keys(variants).length === 0) variants = { [defaultId]: emptyVariant() }
  }

  return { ...shared, jobTypes, variants }
}

export function extractTaskDeadline(deadline: string): string {
  const trimmed = deadline.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : ''
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatDate(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

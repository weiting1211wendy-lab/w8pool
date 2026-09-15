import type { Application, ApplicationStatus } from '../types'
import { applicationCompleteness, deadlineKind } from './helpers'

const IS_STANDARD_DATE = /^\d{4}-\d{2}-\d{2}$/

export type SmartView = 'all' | 'to_review' | 'maybe' | 'selected' | 'skipped' | 'overdue'

export type LedgerSort =
  | 'no'
  | 'created'
  | 'deadline'
  | 'priority'
  | 'company'

export interface LedgerFilters {
  keyword: string
  noQuery: string
  companyQuery: string
  jobQuery: string
  direction: string
  locationQuery: string
  employmentType: string
  status: ApplicationStatus | ''
  deadline: string
  industry: string
  companyType: string
  education: string
  majorsQuery: string
  publishedFrom: string
  publishedTo: string
  missingDescription: boolean
  missingBenefits: boolean
  missingDeadline: boolean
  missingLink: boolean
}

export const EMPTY_LEDGER_FILTERS: LedgerFilters = {
  keyword: '',
  noQuery: '',
  companyQuery: '',
  jobQuery: '',
  direction: '',
  locationQuery: '',
  employmentType: '',
  status: '',
  deadline: '',
  industry: '',
  companyType: '',
  education: '',
  majorsQuery: '',
  publishedFrom: '',
  publishedTo: '',
  missingDescription: false,
  missingBenefits: false,
  missingDeadline: false,
  missingLink: false,
}

export interface LedgerDates {
  today: string
  in3: string
  in7: string
  in15: string
}

function publishedDate(publishedAt: string): string {
  return (publishedAt ?? '').slice(0, 10)
}

function deadlineSortKey(app: Application): string {
  return IS_STANDARD_DATE.test(app.deadline) ? app.deadline : '9999-12-31'
}

function filterApplications(
  base: Application[],
  f: LedgerFilters,
  dates: LedgerDates,
): Application[] {
  const { today: todayStr, in3, in7, in15 } = dates
  return base.filter((app) => {
    const noMatch =
      f.noQuery === '' || String(app.no ?? '').includes((f.noQuery ?? '').trim())
    if (!noMatch) return false
    const keyword =
      f.keyword === '' ||
      app.companyName.toLowerCase().includes(f.keyword.toLowerCase()) ||
      app.jobTitle.toLowerCase().includes(f.keyword.toLowerCase())
    if (!keyword) return false
    const companyMatch =
      f.companyQuery === '' ||
      app.companyName.toLowerCase().includes(f.companyQuery.toLowerCase())
    if (!companyMatch) return false
    const jobMatch =
      f.jobQuery === '' ||
      app.jobTitle.toLowerCase().includes(f.jobQuery.toLowerCase())
    if (!jobMatch) return false
    const directions =
      f.direction === '' ||
      app.jobDirection === f.direction ||
      app.jobDirection.includes(f.direction)
    if (!directions) return false
    const locations =
      f.locationQuery === '' ||
      app.locations.some((loc) => loc.includes(f.locationQuery)) ||
      app.location.includes(f.locationQuery)
    if (!locations) return false
    const employment =
      f.employmentType === '' || app.employmentType === f.employmentType
    if (!employment) return false
    const status = f.status === '' || app.applicationStatus === f.status
    if (!status) return false

    let deadlineOk = true
    if (f.deadline) {
      const kind = deadlineKind(app.deadline)
      switch (f.deadline) {
        case 'overdue':
          deadlineOk = kind === 'dated' && app.deadline < todayStr
          break
        case 'today':
          deadlineOk = kind === 'dated' && app.deadline === todayStr
          break
        case '3days':
          deadlineOk =
            kind === 'dated' && app.deadline > todayStr && app.deadline <= in3
          break
        case '7days':
          deadlineOk =
            kind === 'dated' && app.deadline > todayStr && app.deadline <= in7
          break
        case '15days':
          deadlineOk =
            kind === 'dated' && app.deadline > todayStr && app.deadline <= in15
          break
        case 'rolling':
          deadlineOk = kind === 'rolling'
          break
        case 'none':
          deadlineOk = kind === 'none'
          break
      }
    }
    if (!deadlineOk) return false

    const industry =
      f.industry === '' ||
      app.industries.includes(f.industry) ||
      app.industry === f.industry
    if (!industry) return false
    const companyType =
      f.companyType === '' || app.companyType === f.companyType
    if (!companyType) return false
    const education =
      f.education === '' || app.educationRequirements.includes(f.education)
    if (!education) return false
    const majors =
      f.majorsQuery === '' || app.majors.includes(f.majorsQuery)
    if (!majors) return false

    let publishedOk = true
    if (app.publishedAt) {
      const p = publishedDate(app.publishedAt)
      if (f.publishedFrom && p < f.publishedFrom) publishedOk = false
      if (f.publishedTo && p > f.publishedTo) publishedOk = false
    } else if (f.publishedFrom || f.publishedTo) {
      publishedOk = false
    }
    if (!publishedOk) return false

    const completeness = applicationCompleteness(app)
    if (f.missingDescription && completeness.hasDescription) return false
    if (f.missingBenefits && completeness.hasBenefits) return false
    if (f.missingDeadline && completeness.hasDeadline) return false
    if (f.missingLink && completeness.hasLinks) return false

    return true
  })
}

export function buildLedgerList(
  applications: Application[],
  view: SmartView,
  filters: LedgerFilters,
  sortBy: LedgerSort,
  dates: LedgerDates,
): Application[] {
  const { today: todayStr } = dates
  const isOverdue = (app: Application) =>
    deadlineKind(app.deadline) === 'dated' && app.deadline < todayStr
  const base = (() => {
    switch (view) {
      case 'to_review':
        return applications.filter(
          (app) => app.screeningStatus === 'to_review' && !isOverdue(app),
        )
      case 'maybe':
        return applications.filter(
          (app) => app.screeningStatus === 'maybe' && !isOverdue(app),
        )
      case 'selected':
        return applications.filter(
          (app) => app.screeningStatus === 'selected' && !isOverdue(app),
        )
      case 'skipped':
        return applications.filter(
          (app) => app.screeningStatus === 'skipped' && !isOverdue(app),
        )
      case 'overdue':
        return applications.filter(isOverdue)
      default:
        return applications
    }
  })()

  const filtered = filterApplications(base, filters, dates)
  const arr = [...filtered]
  arr.sort((a, b) => {
    if (sortBy === 'no') {
      return (a.no ?? Infinity) - (b.no ?? Infinity)
    }
    if (sortBy === 'deadline') {
      return deadlineSortKey(a).localeCompare(deadlineSortKey(b))
    }
    if (sortBy === 'priority') {
      if (a.priority !== b.priority) return b.priority - a.priority
      return deadlineSortKey(a).localeCompare(deadlineSortKey(b))
    }
    if (sortBy === 'company') {
      return (a.companyName || '').localeCompare(b.companyName || '', 'zh-Hans-CN')
    }
    return b.createdAt.localeCompare(a.createdAt)
  })
  return arr
}

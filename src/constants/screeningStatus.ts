import type { ApplicationScreeningStatus } from '../types'

export const APPLICATION_SCREENING_STATUSES: ApplicationScreeningStatus[] = [
  'to_review',
  'maybe',
  'selected',
  'skipped',
]

export const APPLICATION_SCREENING_LABELS: Record<
  ApplicationScreeningStatus,
  string
> = {
  to_review: '待筛选',
  maybe: '待定',
  selected: '决定推进',
  skipped: '暂不考虑',
}
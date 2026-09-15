import type { ApplicationStatus } from '../types'

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'pending',
  'submitted',
  'written_test',
  'interview',
  'offer',
  'rejected',
]

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: '待投递',
  submitted: '已投递',
  written_test: '笔试',
  interview: '面试',
  offer: 'Offer',
  rejected: '未通过',
}
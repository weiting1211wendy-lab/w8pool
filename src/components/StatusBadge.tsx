import { APPLICATION_STATUS_LABELS } from '../constants/applicationStatus'
import type { ApplicationStatus } from '../types'

interface StatusBadgeProps {
  status: ApplicationStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${status}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  )
}
import { APPLICATION_SCREENING_LABELS } from '../constants/screeningStatus'
import type { ApplicationScreeningStatus } from '../types'

interface ScreeningBadgeProps {
  status: ApplicationScreeningStatus
}

export default function ScreeningBadge({ status }: ScreeningBadgeProps) {
  return (
    <span className={`screening-badge screening-${status}`}>
      {APPLICATION_SCREENING_LABELS[status]}
    </span>
  )
}
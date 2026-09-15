import type { Dispatch, SetStateAction } from 'react'
import type { Application, ApplicationEvent, ApplicationStatus } from '../types'
import { generateId, today } from './helpers'

/**
 * 统一的求职进度更新逻辑。
 * 「我的岗位池」列表、岗位详情页「关联任务」、任务详情页三处共用，
 * 保证任何一处修改，其余位置进入时都是最新值：
 * - 更新 applicationStatus；选「已投递」时自动将实际投递日期填为当天
 * - 写入一条 status 变更记录
 * - markSelected 为 true 时同时将筛选决定标记为「决定推进」
 */
export function updateApplicationProgress(
  app: Application,
  toStatus: ApplicationStatus,
  setApplications: Dispatch<SetStateAction<Application[]>>,
  setEvents: Dispatch<SetStateAction<ApplicationEvent[]>>,
  options?: { markSelected?: boolean },
) {
  const statusChanged = toStatus !== app.applicationStatus
  const markSelected = Boolean(options?.markSelected) && app.screeningStatus !== 'selected'
  if (!statusChanged && !markSelected) return
  const now = new Date().toISOString()
  setApplications((prev) =>
    prev.map((item) =>
      item.id === app.id
        ? {
            ...item,
            applicationStatus: toStatus,
            appliedAt: toStatus === 'submitted' ? today() : item.appliedAt,
            screeningStatus: markSelected ? 'selected' : item.screeningStatus,
            updatedAt: now,
          }
        : item,
    ),
  )
  if (statusChanged) {
    setEvents((prev) => [
      {
        id: generateId(),
        applicationId: app.id,
        kind: 'status',
        fromStatus: app.applicationStatus,
        toStatus,
        note: '',
        happenedAt: now,
      },
      ...prev,
    ])
  }
}

export type AppMode = 'preview' | 'workspace'

export const MODE_LABELS: Record<AppMode, string> = {
  preview: '访客模式',
  workspace: '我的工作台',
}

export const PREVIEW_PREFIX = '/preview'
export const WORKSPACE_PREFIX = '/workspace'
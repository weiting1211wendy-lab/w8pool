import { useMode } from './useMode'
import {
  PREVIEW_PREFIX,
  WORKSPACE_PREFIX,
} from '../constants/appMode'

export function useAppPath() {
  const mode = useMode()
  const prefix = mode === 'preview' ? PREVIEW_PREFIX : WORKSPACE_PREFIX
  return (path: string) => `${prefix}${path}`
}
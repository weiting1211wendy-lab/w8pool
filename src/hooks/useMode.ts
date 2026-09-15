import { useContext } from 'react'
import { ModeContext } from '../contexts/mode'
import type { AppMode } from '../constants/appMode'

export function useMode(): AppMode {
  return useContext(ModeContext)
}
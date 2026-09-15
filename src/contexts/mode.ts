import { createContext } from 'react'
import type { AppMode } from '../constants/appMode'

export const ModeContext = createContext<AppMode>('workspace')

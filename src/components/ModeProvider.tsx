import type { ReactNode } from 'react'
import { ModeContext } from '../contexts/mode'
import type { AppMode } from '../constants/appMode'

export function ModeProvider({
  mode,
  children,
}: {
  mode: AppMode
  children: ReactNode
}) {
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>
}

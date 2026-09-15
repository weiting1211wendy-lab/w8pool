import { useEffect, useState } from 'react'
import { getFileSaveState } from '../utils/filePersistence'
import type { FileSaveState } from '../utils/filePersistence'
import { useMode } from './useMode'
import { useAuth } from './useAuth'

export function useFileSave() {
  const mode = useMode()
  const { user } = useAuth()
  const [saveState, setSaveState] = useState<FileSaveState>('none')
  const [lastBackup, setLastBackup] = useState(0)
  const storagePrefix = mode === 'preview' ? 'preview:' : (user ? `account:${user.id}:` : '')
  const backupKey = `backup-at:${mode}`

  useEffect(() => {
    void getFileSaveState().then(setSaveState)
    const raw = localStorage.getItem(backupKey)
    setLastBackup(raw ? Number(raw) : 0)
  }, [backupKey])

  return { saveState, lastBackup, storagePrefix }
}

import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { EDIT_AT_KEY, scheduleSave } from '../utils/filePersistence'

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const read = (): T => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? initialValue : (JSON.parse(stored) as T)
    } catch {
      return initialValue
    }
  }
  const [value, setValue] = useState<T>(read)
  const prevKey = useRef(key)
  const isFirstWrite = useRef(true)

  if (prevKey.current !== key) {
    prevKey.current = key
    setValue(read())
  }

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      if (!isFirstWrite.current) {
        localStorage.setItem(EDIT_AT_KEY, String(Date.now()))
      }
      isFirstWrite.current = false
      scheduleSave()
    } catch {
      // 忽略写入失败（如隐私模式下的存储配额限制）
    }
  }, [key, value])

  return [value, setValue]
}
import { useContext } from 'react'
import { AuthContext } from '../contexts/auth'
import type { AuthContextValue } from '../contexts/auth'

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}

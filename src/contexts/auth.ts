import { createContext } from 'react'

export interface AuthUser {
  id: string
  email: string
  username: string
  displayName: string
  createdAt: string
}

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refresh: async () => undefined,
})

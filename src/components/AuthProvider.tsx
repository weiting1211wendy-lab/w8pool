import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from '../contexts/auth'
import type { AuthUser } from '../contexts/auth'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (!response.ok) throw new Error('未登录')
      const result = (await response.json()) as { user: AuthUser | null }
      setUser(result.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <AuthContext.Provider value={{ user, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

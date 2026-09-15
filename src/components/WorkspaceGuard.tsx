import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function WorkspaceGuard({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth()

  if (loading) return <div className="auth-loading">正在读取账户信息…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

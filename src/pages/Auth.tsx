import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface AuthProps {
  kind: 'login' | 'register'
}

// 与后端 worker/index.ts 的注册校验规则保持一致
const USERNAME_RE = /^[\p{L}\p{N}_-]{3,32}$/u
const EMAIL_RE = /^\S+@\S+\.\S+$/
const PASSWORD_MIN_LENGTH = 12

type FieldState = 'idle' | 'valid' | 'invalid'

function fieldState(value: string, test: (v: string) => boolean): FieldState {
  if (!value) return 'idle'
  return test(value) ? 'valid' : 'invalid'
}

export default function Auth({ kind }: AuthProps) {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isRegister = kind === 'register'

  const usernameState = fieldState(username, (v) => USERNAME_RE.test(v))
  const emailState = fieldState(email, (v) => EMAIL_RE.test(v))
  const passwordState = fieldState(password, (v) => v.length >= PASSWORD_MIN_LENGTH)

  const validateBeforeSubmit = (): string | null => {
    if (!isRegister) return null
    if (!EMAIL_RE.test(email)) return '请输入有效邮箱（用于账号验证和找回）'
    if (!USERNAME_RE.test(username)) return '用户名格式不正确：3–32 个字符，可含中文、字母、数字、下划线 _ 和短横 -'
    if (password.length < PASSWORD_MIN_LENGTH) return `密码至少需要 ${PASSWORD_MIN_LENGTH} 个字符`
    return null
  }

  const submit = async () => {
    setMessage('')
    const clientError = validateBeforeSubmit()
    if (clientError) {
      setMessage(clientError)
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(`/api/auth/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRegister ? { email, username, password, inviteCode } : { username, password },
        ),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        setMessage(result.error ?? '操作失败，请稍后重试')
        return
      }
      await refresh()
      const from = (location.state as { from?: string } | null)?.from ?? '/workspace'
      navigate(from, { replace: true })
    } catch {
      setMessage('暂时无法连接账户服务，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const renderFeedback = (state: FieldState, validText: string, invalidText: string, hint: string) => {
    if (state === 'valid') return <span className="auth-field-feedback ok">✓ {validText}</span>
    if (state === 'invalid') return <span className="auth-field-feedback bad">{invalidText}</span>
    return <span className="auth-field-hint">{hint}</span>
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="btn btn-outline auth-home-link">← 返回主页</Link>
        <div className="auth-brand-center">
          <span className="auth-brand-text">W8Pool · 我的求职岗位池</span>
        </div>
        <h1>{isRegister ? '创建你的工作台账户' : '登录工作台'}</h1>
        <p className="auth-subtitle">
          {isRegister
            ? '创建账户后，建立只属于你的岗位池与求职记录。'
            : '汇集机会，沉淀选择，管理个人岗位池与求职进展。'}
        </p>
        <label className="auth-field">
          <span>用户名</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
          {isRegister && renderFeedback(
            usernameState,
            '用户名可用',
            '格式不正确：3–32 个字符，可含中文、字母、数字、下划线 _ 和短横 -',
            '3–32 个字符，可含中文、字母、数字、下划线 _ 和短横 -',
          )}
        </label>
        {isRegister && (
          <label className="auth-field">
            <span>邮箱（用于账号验证和找回）</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            {renderFeedback(
              emailState,
              '邮箱格式正确',
              '邮箱格式不正确，示例：name@example.com',
              '需为有效邮箱格式，例如 name@example.com',
            )}
          </label>
        )}
        {isRegister && (
          <label className="auth-field">
            <span>邀请码（选填）</span>
            <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoComplete="off" />
            <span className="auth-field-hint">非必填：内测开放注册期间可不填写；如已有开发者提供的邀请码，也可填写。</span>
          </label>
        )}
        <label className="auth-field">
          <span>密码{isRegister && `（至少 ${PASSWORD_MIN_LENGTH} 个字符）`}</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {isRegister && renderFeedback(
            passwordState,
            `密码长度达标（${password.length} 个字符）`,
            `密码至少 ${PASSWORD_MIN_LENGTH} 个字符，当前 ${password.length} 个`,
            `至少 ${PASSWORD_MIN_LENGTH} 个字符，建议混合字母、数字和符号`,
          )}
        </label>
        {message && <p className="auth-error">{message}</p>}
        <button type="button" className="btn auth-submit" disabled={submitting} onClick={() => void submit()}>
          {submitting ? '处理中…' : isRegister ? '注册并进入工作台' : '登录工作台'}
        </button>
        <p className="auth-switch">
          {isRegister ? '已有账户？' : '还没有账户？'}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? '去登录' : '去注册'}</Link>
        </p>
        <Link to="/preview" className="auth-preview">
          <span className="auth-preview-title">我要体验：访客模式</span>
          <span className="auth-preview-desc">无需登录，可完整体验所有功能，已填充虚构的演示数据。</span>
        </Link>
      </section>
    </main>
  )
}

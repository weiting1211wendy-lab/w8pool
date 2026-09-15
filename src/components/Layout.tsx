import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { MODE_LABELS } from '../constants/appMode'
import { useMode } from '../hooks/useMode'
import { useAuth } from '../hooks/useAuth'
import { useAppPath } from '../hooks/useAppPath'
import logo from '../assets/w8pool-logo.png'
import UsageGuideContent from './UsageGuideContent'
import VersionLogContent from './VersionLogContent'
import EntrySplash from './EntrySplash'

type IconName =
  | 'home'
  | 'pool'
  | 'collab'
  | 'tasks'
  | 'resume'
  | 'user'
  | 'book'
  | 'log'
  | 'robot'
  | 'community'
  | 'prefill'

interface WorkspaceSummary {
  jobs: number
  toReview: number
  maybe: number
  selected: number
  skipped: number
  tasks: number
  notes: number
  events: number
  tags: number
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      )
    case 'pool':
      return (
        <svg {...common}>
          <path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" />
        </svg>
      )
    case 'collab':
      return (
        <svg {...common}>
          <path d="M8 3.5s-3.7 4-3.7 6.9a3.7 3.7 0 0 0 7.4 0C11.7 7.5 8 3.5 8 3.5z" />
          <path d="M16.3 6s-3.4 3.7-3.4 6.3a3.4 3.4 0 0 0 6.8 0C19.7 9.7 16.3 6 16.3 6z" />
          <path d="M4.5 18.5c2.2 1 4.4 1.5 6.7 1.5 2.9 0 5.6-.7 8.3-2" />
        </svg>
      )
    case 'tasks':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="7" height="6" rx="1.4" />
          <rect x="3" y="14" width="7" height="6" rx="1.4" />
          <path d="M14 7h7M14 17h7" />
        </svg>
      )
    case 'resume':
      return (
        <svg {...common}>
          <path d="M6 2h8l4 4v16H6z" />
          <path d="M14 2v4h4" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 4h7v16H4z" />
          <path d="M13 4h7v16h-7" />
        </svg>
      )
    case 'log':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'robot':
      return (
        <svg {...common}>
          <rect x="5" y="8" width="14" height="10" rx="2.6" />
          <circle cx="9.5" cy="12" r="1.3" />
          <circle cx="14.5" cy="12" r="1.3" />
          <path d="M12 8V5M10 5h4" />
        </svg>
      )
    case 'community':
      return (
        <svg {...common}>
          <path d="M12 2.5s-3 3.2-3 5.6a3 3 0 0 0 6 0C15 5.7 12 2.5 12 2.5z" />
          <path d="M6.1 8.2s-3 3.2-3 5.6a3 3 0 0 0 6 0c0-2.4-3-5.6-3-5.6z" />
          <path d="M17.9 8.2s-3 3.2-3 5.6a3 3 0 0 0 6 0c0-2.4-3-5.6-3-5.6z" />
          <path d="M3.2 20c2.7-1.1 5.6-1.6 8.8-1.6 3.2 0 6.1.5 8.8 1.6" />
        </svg>
      )
    case 'prefill':
      return (
        <svg {...common}>
          <path d="M5 3.5h9l4 4V20.5H5z" />
          <path d="M14 3.5v4h4" />
          <path d="M8.5 12h5M8.5 15.5h3" />
          <path d="m14 17.5 5.2-5.2 1.5 1.5-5.2 5.2-2.4.9z" />
        </svg>
      )
  }
}

interface NavItem {
  to?: string
  label: string
  icon: IconName
  end?: boolean
  action?: 'guide' | 'log'
  tag?: string
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: '工作台',
    items: [
      { to: '/', label: '首页', icon: 'home', end: true },
      { to: '/applications', label: '我的岗位池', icon: 'pool' },
      { to: '/tasks', label: '我的任务', icon: 'tasks' },
      { to: '/robot', label: '智巡岗位 Robot', icon: 'robot', tag: '开发中' },
    ],
  },
  {
    title: '共享岗位池',
    items: [
      { to: '/pools', label: '群组岗位池', icon: 'collab' },
      { to: '/community-pools', label: '社区岗位池', icon: 'community', tag: '开发中' },
    ],
  },
  {
    title: '我的网申材料',
    items: [
      { to: '/resume', label: '网申材料管理', icon: 'resume', end: true },
      { to: '/resume/prefill', label: '网申预填小助手', icon: 'prefill', tag: '开发中' },
    ],
  },
  {
    title: '账户',
    items: [
      { to: '/profile', label: '个人中心', icon: 'user' },
      { action: 'guide', label: '使用说明', icon: 'book' },
      { action: 'log', label: '版本日志', icon: 'log' },
    ],
  },
]

const BOTTOM_NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/applications', label: '岗位池', icon: 'pool' },
  { to: '/tasks', label: '任务', icon: 'tasks' },
  { to: '/', label: '首页', icon: 'home', end: true },
]

function renderNavItem(item: NavItem, onTrigger: (a: 'guide' | 'log') => void, appPath: (p: string) => string) {
  const inner = (
    <>
      <span className="nav-icon">
        <Icon name={item.icon} />
      </span>
      <span className="nav-label">{item.label}</span>
      {item.tag && <span className="nav-tag">{item.tag}</span>}
    </>
  )
  if (item.action) {
    return (
      <button
        type="button"
        key={item.label}
        className={`nav-item nav-btn${item.tag ? ' nav-item-planned' : ''}`}
        onClick={() => onTrigger(item.action!)}
      >
        {inner}
      </button>
    )
  }
  return (
    <NavLink
      key={item.to}
      to={item.to ? appPath(item.to) : '/'}
      end={item.end}
      className={({ isActive }) => `nav-item${item.tag ? ' nav-item-planned' : ''}${isActive ? ' active' : ''}`}
    >
      {inner}
    </NavLink>
  )
}

export default function Layout() {
  const mode = useMode()
  const appPath = useAppPath()
  const { user } = useAuth()
  const [showGuide, setShowGuide] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [acctOpen, setAcctOpen] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [poolOpen, setPoolOpen] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [showGuideHint, setShowGuideHint] = useState(false)
  const [syncState, setSyncState] = useState<'syncing' | 'synced' | 'failed' | 'conflict'>('synced')
  const [syncedAt, setSyncedAt] = useState<number | null>(null)
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary | null>(null)

  useEffect(() => {
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ state: 'syncing' | 'synced' | 'failed' | 'conflict'; at: number }>).detail
      if (!detail) return
      setSyncState(detail.state)
      if (detail.state === 'synced') setSyncedAt(detail.at)
    }
    window.addEventListener('w8pool-sync-status', onSync)
    return () => window.removeEventListener('w8pool-sync-status', onSync)
  }, [])

  useEffect(() => {
    if (mode !== 'workspace' || !user) { setWorkspaceSummary(null); return }
    let cancelled = false
    void fetch('/api/workspace/summary').then(async (response) => {
      if (!response.ok) return null
      return await response.json() as WorkspaceSummary
    }).then((summary) => {
      if (!cancelled && summary) setWorkspaceSummary(summary)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [mode, syncedAt, user?.id])

  const summaryTooltip = workspaceSummary
    ? `云端账户数据\n岗位 ${workspaceSummary.jobs} 条\n待筛选 ${workspaceSummary.toReview}｜待定 ${workspaceSummary.maybe}｜决定推进 ${workspaceSummary.selected}｜暂不考虑 ${workspaceSummary.skipped}\n任务 ${workspaceSummary.tasks} 条｜便签 ${workspaceSummary.notes} 条｜个人操作记录 ${workspaceSummary.events} 条｜标签 ${workspaceSummary.tags} 个`
    : '正在读取云端账户数据统计…'

  const otherModePath = mode === 'preview' ? '/workspace' : '/preview'
  const otherModeLabel = mode === 'preview' ? '我的工作台' : '访客模式'

  const resetPreview = () => {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('preview:')) toRemove.push(key)
    }
    toRemove.forEach((key) => localStorage.removeItem(key))
    window.location.reload()
  }

  const initial = mode === 'preview' ? '访' : (user ? (user.displayName || user.username || '?').slice(0, 1).toUpperCase() : '访')
  const accountName = mode === 'preview' ? '访客' : (user ? user.displayName || user.username : '访客')
  const accountSub = user ? MODE_LABELS[mode] : '访客模式'

  const openGuide = () => {
    setShowGuide(true)
    setAcctOpen(false)
    setResumeOpen(false)
  }
  const openLog = () => {
    setShowLog(true)
    setAcctOpen(false)
    setResumeOpen(false)
  }
  const showEntryGuideHint = () => {
    setShowGuideHint(true)
    window.setTimeout(() => setShowGuideHint(false), 5000)
  }

  const accountMenu: ReactNode[] = user
    ? [
        <Link
          key="me"
          to={appPath('/profile')}
          className="account-menu-item"
          onClick={() => setAcctOpen(false)}
        >
          <span className="nav-icon">
            <Icon name="user" size={18} />
          </span>
          个人中心
        </Link>,
        <button key="guide" type="button" className="account-menu-item" onClick={openGuide}>
          <span className="nav-icon">
            <Icon name="book" size={18} />
          </span>
          使用说明
        </button>,
        <button key="log" type="button" className="account-menu-item" onClick={openLog}>
          <span className="nav-icon">
            <Icon name="log" size={18} />
          </span>
          版本日志
        </button>,
        <div key="sep" className="account-menu-sep" />,
        <Link
          key="mode"
          to={otherModePath}
          className="account-menu-item"
          onClick={() => setAcctOpen(false)}
        >
          <span className="nav-icon">
            <Icon name="collab" size={18} />
          </span>
          切换至{otherModeLabel}
        </Link>,
      ]
    : [
        <Link
          key="login"
          to="/workspace"
          className="account-menu-item"
          onClick={() => setAcctOpen(false)}
        >
          <span className="nav-icon">
            <Icon name="user" size={18} />
          </span>
          登录工作台
        </Link>,
        <Link
          key="register"
          to="/register"
          className="account-menu-item"
          onClick={() => setAcctOpen(false)}
        >
          <span className="nav-icon">
            <Icon name="resume" size={18} />
          </span>
          注册账户
        </Link>,
        <button key="guide" type="button" className="account-menu-item" onClick={openGuide}>
          <span className="nav-icon">
            <Icon name="book" size={18} />
          </span>
          使用说明
        </button>,
        <button key="log" type="button" className="account-menu-item" onClick={openLog}>
          <span className="nav-icon">
            <Icon name="log" size={18} />
          </span>
          版本日志
        </button>,
      ]

  if (mode === 'preview') {
    accountMenu.push(
      <div key="preview-sep" className="account-menu-sep" />,
      <button key="reset" type="button" className="account-menu-item" onClick={() => { setResetConfirmOpen(true); setAcctOpen(false) }}>
        <span className="nav-icon"><Icon name="pool" size={18} /></span>
        重置演示数据
      </button>,
    )
  }

  return (
    <div className="app">
      <EntrySplash mode={mode} userId={user?.id} onComplete={showEntryGuideHint} />
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <Link to="/" className="sidebar-brand">
          <img src={logo} alt="W8Pool" className="sidebar-logo" />
          <span className="sidebar-brand-text">
            <span className="sidebar-brand-name">W8Pool</span>
            <span className="sidebar-brand-sub">我的求职岗位池</span>
          </span>
        </Link>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.title}>
              <span className="nav-group-title">{group.title}</span>
              {group.items.map((item) => renderNavItem(item, (a) => (a === 'guide' ? openGuide() : openLog()), appPath))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {mode !== 'preview' && user && (
            <Link to={appPath('/profile')} className="sidebar-save-status" title={summaryTooltip}>
              <span className="sidebar-save-status-label">账户状态</span>
              <span className="sidebar-save-status-value save-ok">✓ 已登录工作台</span>
              <span className={`sidebar-save-status-value${syncState === 'failed' || syncState === 'conflict' ? ' save-warning' : ''}`}>
                {syncState === 'syncing' ? '正在同步到云端…' : syncState === 'failed' ? '同步未完成，联网后将重试' : syncState === 'conflict' ? '检测到其他设备更新，请刷新确认' : '✓ 已同步至云端'}
              </span>
              <span className="sidebar-save-status-value">{syncedAt ? `最近同步：${new Date(syncedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '管理备份与恢复'}</span>
            </Link>
          )}
          {mode === 'preview' && (
            <div className="sidebar-footer-actions">
              <button type="button" className="preview-reset" onClick={() => setResetConfirmOpen(true)}>
                <span className="preview-reset-label">重置演示数据</span>
              </button>
            </div>
          )}
          <button
            type="button"
            className="collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          >
            <span>{collapsed ? '»' : '«'}</span>
            <span className="collapse-label">{collapsed ? '展开' : '收起'}</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <Link to="/" className="brand-mini">
              <img src={logo} alt="W8Pool" className="brand-mini-logo" />
              <span className="brand-mini-name">W8Pool</span>
            </Link>
            <div className="env-hint">
              <span className="env-badge">
                {mode === 'preview'
                  ? '访客模式'
                  : user
                    ? `${accountName}的工作台`
                    : '我的工作台'}
              </span>
              <span className="env-desc">
                {mode === 'preview'
                  ? <>访客模式所有数据（岗位信息、个人信息等）均为<b className="preview-data-emphasis">用于演示的虚构数据，非真实用户信息</b>，您可以体验所有功能。</>
                  : '汇集机会，沉淀选择，管理个人岗位池与求职进展。'}
              </span>
            </div>
          </div>
          {mode === 'preview' && (
            <p className="preview-mobile-notice">
              访客模式已录入<b className="preview-data-emphasis">用于演示的虚构数据，非真实用户信息</b>。
            </p>
          )}

          <div className="account">
            <button
              type="button"
              className="account-trigger"
              onClick={() => setAcctOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={acctOpen}
            >
              <span className="account-avatar">{initial}</span>
              <span className="account-meta">
                <span className="account-name">{accountName}</span>
                <span className="account-sub">{accountSub}</span>
              </span>
              <span className="account-caret">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            {acctOpen && (
              <>
                <div className="account-backdrop" onClick={() => setAcctOpen(false)} />
                <div className="account-menu" role="menu">
                  {accountMenu}
                </div>
              </>
            )}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={appPath(item.to)}
            end={item.end}
            className={({ isActive }) => `bottom-nav-item${item.to === '/' ? ' bn-fab' : ''}${isActive ? ' active' : ''}`}
            onClick={() => { setResumeOpen(false); setPoolOpen(false) }}
          >
            <span className="bn-icon">
              <Icon name={item.icon} size={22} />
            </span>
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          className={`bottom-nav-item${poolOpen ? ' active' : ''}`}
          onClick={() => { setPoolOpen((o) => !o); setResumeOpen(false) }}
        >
          <span className="bn-icon">
            <Icon name="collab" size={22} />
          </span>
          共享池
        </button>
        <button
          type="button"
          className={`bottom-nav-item${resumeOpen ? ' active' : ''}`}
          onClick={() => { setResumeOpen((o) => !o); setPoolOpen(false) }}
        >
          <span className="bn-icon">
            <Icon name="resume" size={22} />
          </span>
          网申
        </button>
      </nav>

      {poolOpen && (
        <>
          <div className="account-backdrop" onClick={() => setPoolOpen(false)} />
          <div className="bn-menu pool-submenu" role="menu">
            <Link to={appPath('/pools')} className="bn-menu-item" onClick={() => setPoolOpen(false)}>
              <span className="nav-icon"><Icon name="collab" size={18} /></span>群组岗位池
            </Link>
            <Link to={appPath('/community-pools')} className="bn-menu-item" onClick={() => setPoolOpen(false)}>
              <span className="nav-icon"><Icon name="community" size={18} /></span>社区岗位池
            </Link>
          </div>
        </>
      )}

      {resumeOpen && (
        <>
          <div className="account-backdrop" onClick={() => setResumeOpen(false)} />
          <div className="bn-menu resume-submenu" role="menu">
            <Link to={appPath('/resume')} className="bn-menu-item" onClick={() => setResumeOpen(false)}>
              <span className="nav-icon"><Icon name="resume" size={18} /></span>
              网申材料管理
            </Link>
            <Link to={appPath('/resume/prefill')} className="bn-menu-item" onClick={() => setResumeOpen(false)}>
              <span className="nav-icon"><Icon name="prefill" size={18} /></span>
              网申预填小助手
            </Link>
          </div>
        </>
      )}

      {showGuide && (
        <div className="modal-overlay" onClick={() => setShowGuide(false)}>
          <div className="modal usage-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ug-close" onClick={() => setShowGuide(false)}>✕</button>
            <UsageGuideContent />
          </div>
        </div>
      )}
      {showLog && (
        <div className="modal-overlay" onClick={() => setShowLog(false)}>
          <div className="modal usage-modal" onClick={(e) => e.stopPropagation()}>
            <VersionLogContent onClose={() => setShowLog(false)} />
          </div>
        </div>
      )}
      {resetConfirmOpen && (
        <div className="modal-overlay" onClick={() => setResetConfirmOpen(false)}>
          <div className="modal import-summary-modal" onClick={(event) => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="reset-preview-title">
            <h3 id="reset-preview-title" className="import-summary-title">重置演示数据？</h3>
            <p className="page-desc">将恢复为内置演示数据，当前访客模式中的改动会被清空，且不可恢复。</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setResetConfirmOpen(false)}>取消</button>
              <button type="button" className="btn btn-danger" onClick={resetPreview}>确认重置</button>
            </div>
          </div>
        </div>
      )}
      {showGuideHint && (
        <button type="button" className="entry-guide-hint" onClick={() => { setShowGuideHint(false); openGuide() }}>
          <span className="entry-guide-hint-icon"><Icon name="book" size={18} /></span>
          <span><b>首次使用？</b> 查看使用说明，快速了解功能</span>
          <span className="entry-guide-hint-arrow">→</span>
        </button>
      )}
    </div>
  )
}

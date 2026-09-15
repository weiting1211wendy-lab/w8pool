import { useState } from 'react'
import type { ReactNode } from 'react'
import CopyButton from './CopyButton'

interface SectionCardProps {
  title: string
  onAdd?: () => void
  addLabel?: string
  copyText?: () => string
  readOnly?: boolean
  defaultCollapsed?: boolean
  actions?: ReactNode
  children: ReactNode
}

export default function SectionCard({
  title,
  onAdd,
  addLabel,
  copyText,
  readOnly,
  defaultCollapsed = false,
  actions,
  children,
}: SectionCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  return (
    <div className="card profile-section">
      <div className="section-head">
        <button
          type="button"
          className="section-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? '展开' : '折叠'}
        >
          <span className={collapsed ? 'chevron collapsed' : 'chevron'}>▾</span>
        </button>
        <h2 className="section-title">{title}</h2>
        <div className="section-actions">
          {copyText && <CopyButton getText={copyText} label="复制本模块" />}
          {!readOnly && onAdd && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onAdd}>
              {addLabel || '+ 新增'}
            </button>
          )}
          {actions}
        </div>
      </div>
      {!collapsed && children}
    </div>
  )
}

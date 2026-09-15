import { useEffect, useState } from 'react'
import type { ApplicationStatus } from '../types'
import type { LedgerFilters, LedgerSort } from '../utils/ledger'
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
} from '../constants/applicationStatus'
import {
  COMPANY_TYPES,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  INDUSTRIES,
  JOB_DIRECTIONS,
} from '../constants/jobOptions'

type Panel = 'filter' | 'group' | 'sort' | 'view' | null
type SearchField = 'all' | 'company' | 'job' | 'city' | 'no'

const SEARCH_FIELD_KEY: Record<SearchField, keyof LedgerFilters> = {
  all: 'keyword',
  company: 'companyQuery',
  job: 'jobQuery',
  city: 'locationQuery',
  no: 'noQuery',
}

const PLACEHOLDERS: Record<SearchField, string> = {
  all: '搜索企业名称 / 岗位名称',
  company: '搜索企业名称',
  job: '搜索岗位名称',
  city: '工作地点，如：上海、北京',
  no: '按编号检索，如：001',
}

const DEADLINE_FILTERS = [
  { value: '', label: '全部截止状态' },
  { value: 'overdue', label: '已过期' },
  { value: 'today', label: '今天截止' },
  { value: '3days', label: '3天内截止' },
  { value: '7days', label: '7天内截止' },
  { value: '15days', label: '15天内截止' },
  { value: 'rolling', label: '招满即止' },
  { value: 'none', label: '无明确截止' },
]

const DEFAULT_SORT_OPTIONS: Array<{ value: LedgerSort; label: string }> = [
  { value: 'no', label: '按编号' },
  { value: 'created', label: '按导入时间' },
  { value: 'deadline', label: '按截止日期' },
  { value: 'priority', label: '按 Priority' },
  { value: 'company', label: '按公司首字母' },
]

interface JobListToolbarProps {
  filters: LedgerFilters
  setFilters: <K extends keyof LedgerFilters>(key: K, value: LedgerFilters[K]) => void
  sortBy: LedgerSort
  setSortBy: (v: LedgerSort) => void
  groupBy: string
  setGroupBy: (v: string) => void
  viewMode: 'table' | 'card'
  setViewMode: (v: 'table' | 'card') => void
  activeCount: number
  resultCount: number
  showStatusFilter?: boolean
  showMemberGroup?: boolean
  showStatusGroup?: boolean
  openPanel?: Panel
  onOpenPanelChange?: (panel: Panel) => void
  onClearFilters: () => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  sortOptions?: Array<{ value: LedgerSort; label: string }>
}

export default function JobListToolbar({
  filters,
  setFilters,
  sortBy,
  setSortBy,
  groupBy,
  setGroupBy,
  viewMode,
  setViewMode,
  activeCount,
  resultCount,
  showStatusFilter = false,
  showMemberGroup = false,
  showStatusGroup = false,
  openPanel: controlledPanel,
  onOpenPanelChange,
  onClearFilters,
  onExpandAll,
  onCollapseAll,
  sortOptions = DEFAULT_SORT_OPTIONS,
}: JobListToolbarProps) {
  const [searchField, setSearchField] = useState<SearchField>('all')
  const [internalPanel, setInternalPanel] = useState<Panel>(null)

  // 支持受控面板（父组件需要自动展开某个面板时传入 openPanel/onOpenPanelChange）
  const openPanel = controlledPanel !== undefined ? controlledPanel : internalPanel
  const setOpenPanel = (panel: Panel) => {
    if (onOpenPanelChange) onOpenPanelChange(panel)
    else setInternalPanel(panel)
  }

  const searchKey = SEARCH_FIELD_KEY[searchField]
  const searchValue = (filters[searchKey] as string) ?? ''
  const [searchDraft, setSearchDraft] = useState(searchValue)
  const toggle = (panel: Exclude<Panel, null>) =>
    setOpenPanel(openPanel === panel ? null : panel)

  useEffect(() => {
    setSearchDraft(searchValue)
  }, [searchKey, searchValue])

  useEffect(() => {
    if (searchDraft === searchValue) return
    const timer = window.setTimeout(() => {
      setFilters(searchKey, searchDraft)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft, searchKey, searchValue, setFilters])

  const applySearchNow = () => {
    if (searchDraft !== searchValue) setFilters(searchKey, searchDraft)
  }

  return (
    <div className="joblist-toolbar">
      <div className="searchbar">
        <select
          className="search-field-select"
          value={searchField}
          onChange={(e) => setSearchField(e.target.value as SearchField)}
          aria-label="搜索字段"
        >
          <option value="all">全部</option>
          <option value="company">企业</option>
          <option value="job">岗位</option>
          <option value="city">城市</option>
          <option value="no">编号</option>
        </select>
        <input
          className="search-input"
          type="text"
          value={searchDraft}
          placeholder={PLACEHOLDERS[searchField]}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applySearchNow()
          }}
        />
        <button type="button" className="search-btn" title="搜索" onClick={applySearchNow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      <div className="toolbar-buttons">
        <div className="view-toggle-inline">
          <button
            type="button"
            className={viewMode === 'table' ? 'vm-btn active' : 'vm-btn'}
            onClick={() => setViewMode('table')}
          >
            列表
          </button>
          <button
            type="button"
            className={viewMode === 'card' ? 'vm-btn active' : 'vm-btn'}
            onClick={() => setViewMode('card')}
          >
            卡片
          </button>
        </div>
        <button
          type="button"
          className={openPanel === 'filter' ? 'tb-btn active' : 'tb-btn'}
          onClick={() => toggle('filter')}
        >
          筛选
          <svg className="tb-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          {activeCount > 0 && <span className="tb-badge">{activeCount}</span>}
        </button>
        <button
          type="button"
          className={openPanel === 'group' ? 'tb-btn active' : 'tb-btn'}
          onClick={() => toggle('group')}
        >
          分组
          <svg className="tb-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        <button
          type="button"
          className={openPanel === 'sort' ? 'tb-btn active' : 'tb-btn'}
          onClick={() => toggle('sort')}
        >
          排序
          <svg className="tb-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      </div>

      {openPanel === 'filter' && (
        <div className="more-filters-panel">
          <div className="more-filters-grid">
            {showStatusFilter && (
              <label className="filter-field">
                <span className="filter-label">投递进度</span>
                <select
                  className="field-input"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters('status', e.target.value as ApplicationStatus | '')
                  }
                >
                  <option value="">全部投递进度</option>
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {APPLICATION_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="filter-field">
              <span className="filter-label">截止状态</span>
              <select
                className="field-input"
                value={filters.deadline}
                onChange={(e) => setFilters('deadline', e.target.value)}
              >
                {DEADLINE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="filter-label">岗位方向</span>
              <select
                className="field-input"
                value={filters.direction}
                onChange={(e) => setFilters('direction', e.target.value)}
              >
                <option value="">全部岗位方向</option>
                {JOB_DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="filter-label">正式/实习</span>
              <select
                className="field-input"
                value={filters.employmentType}
                onChange={(e) => setFilters('employmentType', e.target.value)}
              >
                <option value="">全部岗位性质</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="filter-label">所属行业</span>
              <select
                className="field-input"
                value={filters.industry}
                onChange={(e) => setFilters('industry', e.target.value)}
              >
                <option value="">全部行业</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="filter-label">企业类型</span>
              <select
                className="field-input"
                value={filters.companyType}
                onChange={(e) => setFilters('companyType', e.target.value)}
              >
                <option value="">全部类型</option>
                {COMPANY_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="filter-label">学历要求</span>
              <select
                className="field-input"
                value={filters.education}
                onChange={(e) => setFilters('education', e.target.value)}
              >
                <option value="">全部学历</option>
                {EDUCATION_LEVELS.map((el) => (
                  <option key={el} value={el}>
                    {el}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span className="filter-label">招聘专业</span>
              <input
                className="field-input"
                value={filters.majorsQuery}
                placeholder="包含匹配，如：法学、知识产权"
                onChange={(e) => setFilters('majorsQuery', e.target.value)}
              />
            </label>
            <span className="filter-field">
              <span className="filter-label">发布时间从</span>
              <input
                type="date"
                className="field-input"
                value={filters.publishedFrom}
                onChange={(e) => setFilters('publishedFrom', e.target.value)}
              />
            </span>
            <span className="filter-field">
              <span className="filter-label">到</span>
              <input
                type="date"
                className="field-input"
                value={filters.publishedTo}
                onChange={(e) => setFilters('publishedTo', e.target.value)}
              />
            </span>
          </div>
          <div className="completeness-filters">
            <span className="filter-label">信息完整度（筛选缺项）</span>
            <div className="completeness-checks">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.missingDescription}
                  onChange={(e) => setFilters('missingDescription', e.target.checked)}
                />
                缺岗位详情
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.missingBenefits}
                  onChange={(e) => setFilters('missingBenefits', e.target.checked)}
                />
                缺福利待遇
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.missingDeadline}
                  onChange={(e) => setFilters('missingDeadline', e.target.checked)}
                />
                缺明确截止日期
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.missingLink}
                  onChange={(e) => setFilters('missingLink', e.target.checked)}
                />
                缺少任一链接
              </label>
            </div>
          </div>
          {activeCount > 0 && (
            <div className="panel-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={onClearFilters}>
                一键清除筛选
              </button>
            </div>
          )}
        </div>
      )}

      {openPanel === 'group' && (
        <div className="more-filters-panel">
          <div className="more-filters-grid">
            <label className="filter-field">
              <span className="filter-label">分组方式</span>
              <select
                className="field-input"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="none">不分组</option>
                <option value="company">按公司分组</option>
                <option value="entryDate">按添加时间分组</option>
                {showStatusGroup && <option value="status">按求职进度分组</option>}
                {showMemberGroup && <option value="member">按成员分组</option>}
              </select>
            </label>
          </div>
          {viewMode === 'table' &&
            groupBy !== 'none' &&
            onExpandAll &&
            onCollapseAll && (
              <div className="panel-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={onExpandAll}>
                  全部展开
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={onCollapseAll}>
                  全部折叠
                </button>
              </div>
            )}
        </div>
      )}

      {openPanel === 'sort' && (
        <div className="more-filters-panel">
          <div className="more-filters-grid">
            <label className="filter-field">
              <span className="filter-label">排序方式</span>
              <select
                className="field-input"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as LedgerSort)}
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      <div className="result-line">
        <span className="result-count">
          共 <strong>{resultCount}</strong> 条
          {activeCount > 0 && (
            <span className="result-filters"> · 已选条件 {activeCount} 项</span>
          )}
        </span>
      </div>
    </div>
  )
}

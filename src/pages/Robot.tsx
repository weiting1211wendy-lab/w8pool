import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useMode } from '../hooks/useMode'
import { ROBOT_JOBS, type RobotJob } from '../data/robotJobs'
import { COMPANY_TYPES } from '../constants/jobOptions'

const CITIES = ['上海', '深圳', '北京', '广州', '杭州', '成都', '武汉', '南京', '西安', '苏州', '全国']
const GRADES = ['2027届', '2026届']
const NATURES = ['正式', '实习']
const FREQS = ['每日', '工作日（周一至周五）', '每周一、三、五', '自定义（待接入）']
const PREVIEW_PREVIOUS_JOB_COUNT = 18
type PreviewNotice = { title: string; detail: string }

function MultiSelect({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])

  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  return (
    <div className="ms-wrap" ref={wrapRef}>
      <span className="field-label">{label}</span>
      <button type="button" className="field-input ms-trigger" onClick={() => setOpen((o) => !o)}>
        <span className={value.length ? 'ms-value' : 'ms-placeholder'}>{value.length ? value.join('、') : '请选择（可多选）'}</span>
        <span className="ms-caret">▾</span>
      </button>
      {open && pos && createPortal(
        <>
          <div className="ms-backdrop" onClick={() => setOpen(false)} />
          <div className="ms-panel" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000 }}>
            {options.map((o) => (
              <label key={o} className="ms-option">
                <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
                {o}
              </label>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

function ChipInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('')
  const add = () => {
    const t = text.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setText('')
  }
  return (
    <div className="ms-wrap">
      <span className="field-label">{label}</span>
      <div className="chip-input">
        {value.map((v) => (
          <span className="chip" key={v}>
            {v}
            <button type="button" className="chip-x" onClick={() => onChange(value.filter((x) => x !== v))}>×</button>
          </span>
        ))}
        <input
          className="chip-field"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          onBlur={add}
        />
      </div>
    </div>
  )
}

export default function Robot() {
  const mode = useMode()
  const [keywords, setKeywords] = useState<string[]>(['法务合规', '知识产权', '合规'])
  const [cities, setCities] = useState<string[]>(['上海', '深圳'])
  const [grades, setGrades] = useState<string[]>(['2027届'])
  const [companyTypes, setCompanyTypes] = useState<string[]>([])
  const [natures, setNatures] = useState<string[]>([])
  const [blockWords, setBlockWords] = useState<string[]>(mode === 'preview' ? ['销售', '客服', '行政'] : [])
  const [freq, setFreq] = useState('每周一、三、五')
  const [time, setTime] = useState('09:00')
  const running = mode === 'preview'
  const lastRun = mode === 'preview' ? '今日 09:00' : ''
  const previousRun = mode === 'preview' ? '昨日 09:00' : ''
  const [detail, setDetail] = useState<RobotJob | null>(null)
  const [previewNotice, setPreviewNotice] = useState<PreviewNotice | null>(null)

  const exampleJobs = mode === 'preview' ? ROBOT_JOBS : []
  const previousJobCount = Math.min(exampleJobs.length, PREVIEW_PREVIOUS_JOB_COUNT)
  const newJobCount = Math.max(exampleJobs.length - previousJobCount, 0)
  const newPreviewJobIds = new Set(exampleJobs.slice(PREVIEW_PREVIOUS_JOB_COUNT).map((job) => job.id))
  const orderedJobs = mode === 'preview'
    ? [...exampleJobs.slice(PREVIEW_PREVIOUS_JOB_COUNT), ...exampleJobs.slice(0, PREVIEW_PREVIOUS_JOB_COUNT)]
    : exampleJobs

  const openPreviewNotice = (title: string, detail: string) => setPreviewNotice({ title, detail })

  return (
    <section>
      <div className="toolbar">
        <div>
          <h1 className="page-title">智巡岗位 Robot <span className="demo-tag">开发中</span></h1>
          <p className="page-desc">正式开放后，AI 将按你设置的关键词与检索规则抓取、整理岗位线索，汇入待审核池，供你决定是否纳入我的岗位池。</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" className={running ? 'btn btn-outline' : 'btn btn-gradient'} onClick={() => openPreviewNotice(
            running ? '停止巡检（开发中）' : '开启巡检（开发中）',
            running
              ? '正式接入后，将暂停当前订阅的定时抓取；已进入待审核岗位的结果会被保留，方便你继续处理。'
              : '正式接入后，将保存当前检索规则与运行时间，并按设置定时抓取符合条件的岗位线索。',
          )}>
            {running ? '停止巡检' : '开启巡检'}
          </button>
          <button type="button" className="btn" onClick={() => openPreviewNotice('立即巡检一次（开发中）', '正式接入后，Robot 会立即按当前关键词与检索规则抓取岗位、完成去重，并将符合条件的结果汇入待审核岗位；不会自动投递或改动你的个人岗位池。')}>立即巡检一次</button>
        </div>
      </div>

      <div className="feature-preview-banner">
        <b>目标功能</b>：Robot 按你的关键词、城市、届次、岗位类型与屏蔽词等检索规则，抓取并整理岗位线索，汇入待审核池；由你确认后再纳入我的岗位池，始终不自动投递。<br /><b>实现路径</b>：持续接入多源岗位信息、可追溯的来源链接、定时巡检与去重、岗位变动提醒，以及巡检设置的实际连接。
      </div>

      <div className="robot-status">
        <div className="robot-status-item">
          <span className="robot-status-label">巡检状态</span>
          <span className={`robot-status-value ${running ? 'on' : 'off'}`}>{running ? '已开启' : '待开启'}</span>
        </div>
        <div className="robot-status-item">
          <span className="robot-status-label">最近运行</span>
          <span className="robot-status-value">{lastRun || '—'}</span>
        </div>
        <div className="robot-status-item">
          <span className="robot-status-label">待审核池</span>
          <span className="robot-status-value">{exampleJobs.length} 条</span>
        </div>
        <div className="robot-status-item">
          <span className="robot-status-label">下次运行</span>
          <span className="robot-status-value">{running ? `${freq} ${time}` : '—'}</span>
        </div>
      </div>

      {mode === 'preview' && (
        <div className="card shared-activity robot-activity">
          <h2 className="section-title">巡检动态</h2>
          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-head">
                <span className="ripple-dot" />
                <span className="timeline-status">本次巡检抓取 {newJobCount} 条新岗位</span>
                <span className="timeline-time">{lastRun}</span>
              </div>
              <p className="timeline-note">已汇入待审核岗位，等待你决定是否纳入我的岗位池。</p>
            </div>
            <div className="timeline-item">
              <div className="timeline-head">
                <span className="timeline-status">上次巡检收录 {previousJobCount} 条岗位</span>
                <span className="timeline-time">{previousRun}</span>
              </div>
              <p className="timeline-note">已保留在待审核岗位中，便于继续查看与处理。</p>
            </div>
          </div>
        </div>
      )}

      <div className="robot-config-grid">
        <div className="card demo-card">
          <h2 className="section-title">我的巡检订阅</h2>
          <div className="robot-subscription-top">
            <MultiSelect label="岗位性质（可多选）" options={NATURES} value={natures} onChange={setNatures} />
            <MultiSelect label="城市（可多选）" options={CITIES} value={cities} onChange={setCities} />
            <MultiSelect label="届次（可多选）" options={GRADES} value={grades} onChange={setGrades} />
            <MultiSelect label="企业性质（可多选）" options={COMPANY_TYPES} value={companyTypes} onChange={setCompanyTypes} />
          </div>
          <div className="robot-subscription-bottom">
            <ChipInput label="检索关键词（可多个）" placeholder="输入关键词后回车，如 法务合规" value={keywords} onChange={setKeywords} />
            <ChipInput label="屏蔽词（可多个）" placeholder="输入屏蔽词后回车，如 销售" value={blockWords} onChange={setBlockWords} />
          </div>
        </div>

        <div className="card demo-card">
          <h2 className="section-title">巡检设置</h2>
          <div className="cond-grid">
            <label className="cond-item">
              <span className="field-label">频率</span>
              <select className="field-select" value={freq} onChange={(e) => setFreq(e.target.value)}>
                {FREQS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label className="cond-item">
              <span className="field-label">时间</span>
              <input className="field-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label className="cond-item">
              <span className="field-label">信息来源</span>
              <input className="field-input" value="待接入" readOnly aria-label="信息来源待接入" />
            </label>
          </div>
        </div>
      </div>

      <div className="card demo-card">
        <div className="demo-card-head">
          <h2 className="section-title">待审核岗位</h2>
          <span className="demo-count">共 {orderedJobs.length} 条岗位</span>
        </div>
        <div className="demo-job-list">
          {exampleJobs.length === 0 && (
            <div className="empty-state">{mode === 'preview' ? '暂无示例岗位。' : '当前为工作台，数据为空；进入访客模式可查看示例待审核岗位。'}</div>
          )}
          {orderedJobs.map((job) => {
            const isNew = mode === 'preview' && newPreviewJobIds.has(job.id)
            const capturedAt = mode === 'preview' ? (isNew ? `本次抓取 ${lastRun}` : `上次抓取 ${previousRun}`) : job.updated
            return (
            <div className="demo-job-card" key={job.id}>
              <div className="demo-job-main">
                <div className="demo-job-title">
                  <span>{job.company} · {job.title}</span>
                  {isNew && <span className="robot-new-badge">新</span>}
                </div>
                <div className="demo-job-reason">{job.direction} · {job.city} · {job.nature}</div>
                <div className="demo-job-source">来源：{job.source} · {capturedAt}</div>
              </div>
              <div className="demo-job-actions">
                <button type="button" className="btn btn-sm" onClick={() => setDetail(job)}>查看详情</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => openPreviewNotice('纳入我的岗位池（开发中）', `正式接入后，将把「${job.company} · ${job.title}」复制到你的个人岗位池，供你继续筛选、投递与创建任务；不会自动投递。`)}>纳入我的岗位池</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => openPreviewNotice('淘汰岗位（开发中）', `正式接入后，将把「${job.company} · ${job.title}」移出待审核岗位，并记录为已淘汰；后续巡检会对同一岗位去重，不再重复推送。`)}>淘汰</button>
              </div>
            </div>
            )
          })}
        </div>
      </div>

      <p className="demo-foot-note">以上为虚构的演示结果。正式版本将为每条岗位保留来源、整理时间与原始链接；岗位进入个人岗位池前需由你确认。</p>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal demo-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="section-title">岗位详情</h2>
            <div className="job-detail">
              <div className="job-detail-row"><span className="job-detail-label">企业名称</span><span className="job-detail-value">{detail.company}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">岗位名称</span><span className="job-detail-value">{detail.title}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">方向</span><span className="job-detail-value">{detail.direction}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">工作地点</span><span className="job-detail-value">{detail.city}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">岗位性质</span><span className="job-detail-value">{detail.nature}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">行业</span><span className="job-detail-value">{detail.industry}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">来源</span><span className="job-detail-value">{detail.source}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">更新</span><span className="job-detail-value">{detail.updated}</span></div>
              <div className="job-detail-row job-detail-block"><span className="job-detail-label">岗位描述</span><span className="job-detail-value">{detail.description}</span></div>
              <div className="job-detail-row job-detail-block"><span className="job-detail-label">福利待遇</span><span className="job-detail-value">{detail.benefits}</span></div>
              <div className="job-detail-row job-detail-block"><span className="job-detail-label">网申链接</span><span className="job-detail-value">{detail.applicationUrl}</span></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => {
                setDetail(null)
                openPreviewNotice('纳入我的岗位池（开发中）', `正式接入后，将把「${detail.company} · ${detail.title}」复制到你的个人岗位池，供你继续筛选、投递与创建任务；不会自动投递。`)
              }}>纳入我的岗位池</button>
              <button type="button" className="btn btn-outline" onClick={() => setDetail(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
      {previewNotice && (
        <div className="modal-overlay" onClick={() => setPreviewNotice(null)}>
          <div className="modal demo-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="section-title">{previewNotice.title}</h2>
            <p className="page-desc">{previewNotice.detail}</p>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setPreviewNotice(null)}>知道了</button></div>
          </div>
        </div>
      )}
    </section>
  )
}

import { useMemo, useState } from 'react'
import { useAppData } from '../hooks/useAppData'
import { useAccountApplications } from '../hooks/useAccountApplications'
import { emptyProfile, sampleApplications } from '../data/sampleData'
import { normalizeProfile, emptyVariant } from '../utils/helpers'
import type { Application, ProfileVariant } from '../types'

type RightState = {
  name: string
  phone: string
  email: string
  school: string
  major: string
  degree: string
  intern: string
  project: string
  self: string
}

type VariantModule = 'experience' | 'projects' | 'self'

function buildRight(profile: ReturnType<typeof normalizeProfile>, variant: ProfileVariant): RightState {
  const edu = profile.education[0]
  const exp = variant.experience[0]
  const proj = variant.projects[0]
  const skillText = variant.skills.map((s) => `${s.name}：${s.skills.map((x) => x.text).join('、')}`).join('；')
  const actText = variant.activities.map((a) => a.text).join('；')
  return {
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
    school: edu?.school ?? '',
    major: edu?.major ?? '',
    degree: edu?.degree ?? '',
    intern: exp ? `${exp.company} · ${exp.position}\n${exp.bullets.map((b) => b.text).join('\n')}` : '',
    project: proj ? proj.description : '',
    self: [skillText, actText].filter(Boolean).join('\n'),
  }
}

export default function ResumePrefill() {
  const [rawProfile] = useAppData('profile', emptyProfile)
  const [applications] = useAccountApplications(sampleApplications)
  const profile = useMemo(() => normalizeProfile(rawProfile), [rawProfile])

  const [targetNo, setTargetNo] = useState('')
  const [link, setLink] = useState('')
  const defaultTypeId = profile.jobTypes[0]?.id ?? 'default'
  const [selectedTypeId, setSelectedTypeId] = useState(defaultTypeId)
  const [moduleVersionIds, setModuleVersionIds] = useState<Record<VariantModule, string>>({
    experience: defaultTypeId,
    projects: defaultTypeId,
    self: defaultTypeId,
  })
  const [right, setRight] = useState<RightState>(() =>
    buildRight(profile, profile.variants[profile.jobTypes[0]?.id ?? 'default'] ?? emptyVariant()),
  )
  const [edited, setEdited] = useState<Set<string>>(new Set())
  const [showJobDetail, setShowJobDetail] = useState(false)
  const [showWrite, setShowWrite] = useState(false)
  const [showSaveDraft, setShowSaveDraft] = useState(false)
  const [showTip, setShowTip] = useState(false)
  const [message, setMessage] = useState('')

  const toast = (text: string) => {
    setMessage(text)
    window.setTimeout(() => setMessage(''), 4000)
  }

  const matched: Application | undefined = targetNo.trim()
    ? applications.find((a) => String(a.no) === targetNo.trim())
    : undefined

  const experienceVariant = profile.variants[moduleVersionIds.experience] ?? emptyVariant()
  const projectVariant = profile.variants[moduleVersionIds.projects] ?? emptyVariant()
  const selfVariant = profile.variants[moduleVersionIds.self] ?? emptyVariant()

  const changeVersion = (id: string) => {
    if (edited.size > 0 && !window.confirm('切换材料版本将替换当前右侧预览内容')) return
    setSelectedTypeId(id)
    setModuleVersionIds({ experience: id, projects: id, self: id })
    setRight(buildRight(profile, profile.variants[id] ?? emptyVariant()))
    setEdited(new Set())
  }

  const changeModuleVersion = (module: VariantModule, id: string) => {
    if (edited.has(module) && !window.confirm('切换该模块的材料版本将替换当前预览内容')) return
    const nextVariant = profile.variants[id] ?? emptyVariant()
    const refreshed = buildRight(profile, nextVariant)
    setModuleVersionIds((current) => ({ ...current, [module]: id }))
    setRight((current) => {
      if (module === 'experience') return { ...current, intern: refreshed.intern }
      if (module === 'projects') return { ...current, project: refreshed.project }
      return { ...current, self: refreshed.self }
    })
    setEdited((current) => {
      const next = new Set(current)
      next.delete(module === 'experience' ? 'intern' : module === 'projects' ? 'project' : 'self')
      return next
    })
  }

  const setField = (module: string, patch: Partial<RightState>) => {
    setRight((r) => ({ ...r, ...patch }))
    setEdited((e) => new Set(e).add(module))
  }

  const parseFields = () => {
    if (!matched) {
      toast('未在我的岗位池中找到该编号对应的岗位，请确认编号。')
      return
    }
    setLink(matched.applicationUrl || '')
    const matchId =
      profile.jobTypes.find((t) => matched.jobDirection && t.name.includes(matched.jobDirection))?.id ??
      profile.jobTypes[0]?.id ??
      'default'
    setSelectedTypeId(matchId)
    setModuleVersionIds({ experience: matchId, projects: matchId, self: matchId })
    setRight(buildRight(profile, profile.variants[matchId] ?? emptyVariant()))
    setEdited(new Set())
    toast('已匹配岗位：自动填入网申链接并选择对应材料版本。')
  }

  if (profile.jobTypes.length === 0) {
    return (
      <section>
        <div className="toolbar">
          <div>
          <h1 className="page-title">
            网申预填小助手
            <span className="demo-tag">开发中</span>
            <button type="button" className="pool-tip-btn" onClick={() => setShowTip((s) => !s)} title="使用教程">使用教程</button>
          </h1>
            <p className="page-desc">按模块选择材料版本，预览本次网申将使用的字段内容。</p>
          </div>
        </div>
        <p className="prefill-desktop-tip"><b>建议在电脑端使用</b>：电脑端可并排查看材料版本与预填字段，更便于核对和编辑。</p>
      <div className="feature-preview-banner">
        <b>目标功能</b>：小助手将目标岗位与材料版本组合为可编辑、可核对的网申草稿；确认字段后协助写入支持的网申页面，最终提交始终由你完成。<br /><b>实现路径</b>：持续完善浏览器插件连接、页面字段识别与映射、逐项确认写入、草稿保存复用，以及支持网站范围管理。
      </div>
        <div className="empty-state">请先在“网申材料管理”中填写材料，再回到此处生成预填草稿。</div>
      </section>
    )
  }

  return (
    <section>
      <div className="toolbar">
        <div>
          <h1 className="page-title">
            网申预填小助手
            <span className="demo-tag">开发中</span>
            <button type="button" className="pool-tip-btn" onClick={() => setShowTip((s) => !s)} title="使用教程">使用教程</button>
          </h1>
          <p className="page-desc">读取“网申材料管理”中的材料与“我的岗位池”中的目标岗位，按版本预览并填写本次网申字段。</p>
        </div>
      </div>

      {showTip && (
        <div className="card pool-tip-card">
          <h3 className="pool-tip-title">网申预填小助手 · 使用教程</h3>
          <ul className="pool-tip-list">
            <li><b>第 1 步 · 备好材料</b>：在「网申材料管理」中维护个人信息，并按岗位类型准备多份材料版本；本页左侧「我的材料」会同步显示。</li>
            <li><b>第 2 步 · 填入目标岗位</b>：在「我的岗位池」复制目标岗位编号，粘贴到本页输入框，点【开始解析】自动填入网申链接并匹配材料版本。</li>
            <li><b>第 3 步 · 选择模块版本</b>：可按实习经历、项目经历、自我评价 / 技能分别选择材料版本，组合成当前网申草稿。</li>
            <li><b>第 4 步 · 预览并微调</b>：在右侧字段预览中按需调整；修改仅作用于本次预填草稿，不会覆盖原始材料。</li>
            <li><b>第 5 步 · 开始写入</b>：逐项确认右侧字段后，使用小助手协助写入支持的网申页面；最终提交仍由你完成。</li>
          </ul>
        </div>
      )}

      <p className="prefill-desktop-tip"><b>建议在电脑端使用</b>：电脑端可并排查看材料版本与预填字段，更便于核对和编辑。</p>

      <div className="feature-preview-banner">
        <b>目标功能</b>：小助手将目标岗位与材料版本组合为可编辑、可核对的网申草稿；确认字段后协助写入支持的网申页面，最终提交始终由你完成。<br /><b>实现路径</b>：持续完善浏览器插件连接、页面字段识别与映射、逐项确认写入、草稿保存复用，以及支持网站范围管理。
      </div>

      <div className="card demo-card">
        <h2 className="section-title">目标岗位与网申链接</h2>
        <div className="prefill-input-row">
          <label className="cond-item prefill-field">
            <span className="field-label">目标岗位（我的岗位池编号）</span>
            <input className="field-input" list="pool-job-numbers" value={targetNo} placeholder="输入岗位编号，如 1" onChange={(e) => setTargetNo(e.target.value)} />
            <datalist id="pool-job-numbers">
              {applications.slice(0, 300).map((a) => (
                <option key={a.id} value={String(a.no)}>{`${a.no} · ${a.companyName} ${a.jobTitle}`}</option>
              ))}
            </datalist>
            {matched && <span className="prefill-match">→ {matched.companyName} · {matched.jobTitle}</span>}
          </label>
          {matched && (
            <button type="button" className="btn" onClick={() => setShowJobDetail(true)}>
              查看岗位详情
            </button>
          )}
          <button type="button" className="btn btn-gradient" onClick={parseFields}>
            开始解析
          </button>
          <label className="cond-item prefill-field">
            <span className="field-label">网申链接</span>
            <input className="field-input" value={link} placeholder="可从岗位信息自动解析，也可手动填写" onChange={(e) => setLink(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="prefill-layout">
        <div className="prefill-left">
          <div className="card demo-card">
            <h2 className="section-title">我的材料</h2>
            <div className="module-select-row">
              <span className="module-select-label">材料版本</span>
              <select className="field-select" value={selectedTypeId} onChange={(e) => changeVersion(e.target.value)}>
                {profile.jobTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div className="module-block">
              <div className="preview-module-title">基础信息</div>
              <div className="module-content">
                <div className="module-content-row"><span className="module-content-label">姓名</span><span className="module-content-value">{profile.name || '—'}</span></div>
                <div className="module-content-row"><span className="module-content-label">手机</span><span className="module-content-value">{profile.phone || '—'}</span></div>
                <div className="module-content-row"><span className="module-content-label">邮箱</span><span className="module-content-value">{profile.email || '—'}</span></div>
              </div>
            </div>

            <div className="module-block">
              <div className="preview-module-title">教育经历</div>
              <div className="module-content">
                {profile.education.length === 0 ? (
                  <div className="module-content-row"><span className="module-content-value">—</span></div>
                ) : profile.education.map((e) => (
                  <div className="module-content-row" key={e.id}>
                    <span className="module-content-label">{e.school}</span>
                    <span className="module-content-value">{e.degree} · {e.major}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="module-block">
              <div className="module-block-head"><div className="preview-module-title">实习经历</div><select className="field-select module-version-select" value={moduleVersionIds.experience} onChange={(e) => changeModuleVersion('experience', e.target.value)}>{profile.jobTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="module-content">
                {experienceVariant.experience.length === 0 ? (
                  <div className="module-content-row"><span className="module-content-value">—</span></div>
                ) : experienceVariant.experience.map((x) => (
                  <div className="module-content-row" key={x.id}>
                    <span className="module-content-label">{x.company} · {x.position}</span>
                    <span className="module-content-value">{x.bullets.map((b) => b.text).join('；')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="module-block">
              <div className="module-block-head"><div className="preview-module-title">项目经历</div><select className="field-select module-version-select" value={moduleVersionIds.projects} onChange={(e) => changeModuleVersion('projects', e.target.value)}>{profile.jobTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="module-content">
                {projectVariant.projects.length === 0 ? (
                  <div className="module-content-row"><span className="module-content-value">—</span></div>
                ) : projectVariant.projects.map((p) => (
                  <div className="module-content-row" key={p.id}>
                    <span className="module-content-label">{p.title}</span>
                    <span className="module-content-value">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="module-block">
              <div className="module-block-head"><div className="preview-module-title">自我评价 / 技能</div><select className="field-select module-version-select" value={moduleVersionIds.self} onChange={(e) => changeModuleVersion('self', e.target.value)}>{profile.jobTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="module-content">
                {selfVariant.skills.map((s) => (
                  <div className="module-content-row" key={s.id}>
                    <span className="module-content-label">{s.name}</span>
                    <span className="module-content-value">{s.skills.map((x) => x.text).join('、')}</span>
                  </div>
                ))}
                {selfVariant.activities.map((a) => (
                  <div className="module-content-row" key={a.id}>
                    <span className="module-content-label">活动</span>
                    <span className="module-content-value">{a.text}</span>
                  </div>
                ))}
                {selfVariant.skills.length === 0 && selfVariant.activities.length === 0 && (
                  <div className="module-content-row"><span className="module-content-value">—</span></div>
                )}
              </div>
            </div>

            <p className="prefill-note">左侧读取自“网申材料管理”，在其中修改后会在此自动同步。</p>
          </div>
        </div>

        <div className="prefill-right">
          <div className="card demo-card">
            <h2 className="section-title">网申字段预览</h2>

            <div className="preview-module">
              <div className="preview-module-head"><span className="preview-module-title">基础信息</span>{edited.has('base') && <span className="preview-modified">已修改</span>}</div>
              <div className="preview-field"><label className="field-label">姓名</label><input className="field-input" value={right.name} onChange={(e) => setField('base', { name: e.target.value })} /></div>
              <div className="preview-field"><label className="field-label">手机号码</label><input className="field-input" value={right.phone} onChange={(e) => setField('base', { phone: e.target.value })} /></div>
              <div className="preview-field"><label className="field-label">邮箱</label><input className="field-input" value={right.email} onChange={(e) => setField('base', { email: e.target.value })} /></div>
            </div>

            <div className="preview-module">
              <div className="preview-module-head"><span className="preview-module-title">教育经历</span>{edited.has('edu') && <span className="preview-modified">已修改</span>}</div>
              <div className="preview-field"><label className="field-label">学校名称</label><input className="field-input" value={right.school} onChange={(e) => setField('edu', { school: e.target.value })} /></div>
              <div className="preview-field"><label className="field-label">专业</label><input className="field-input" value={right.major} onChange={(e) => setField('edu', { major: e.target.value })} /></div>
              <div className="preview-field"><label className="field-label">学历</label><input className="field-input" value={right.degree} onChange={(e) => setField('edu', { degree: e.target.value })} /></div>
            </div>

            <div className="preview-module">
              <div className="preview-module-head"><span className="preview-module-title">实习经历</span>{edited.has('intern') && <span className="preview-modified">已修改</span>}</div>
              <div className="preview-field"><label className="field-label">最近一段实习经历</label><textarea className="field-textarea" value={right.intern} onChange={(e) => setField('intern', { intern: e.target.value })} /></div>
            </div>

            <div className="preview-module">
              <div className="preview-module-head"><span className="preview-module-title">项目经历</span>{edited.has('project') && <span className="preview-modified">已修改</span>}</div>
              <div className="preview-field"><label className="field-label">项目经历</label><textarea className="field-textarea" value={right.project} onChange={(e) => setField('project', { project: e.target.value })} /></div>
            </div>

            <div className="preview-module">
              <div className="preview-module-head"><span className="preview-module-title">自我评价</span>{edited.has('self') && <span className="preview-modified">已修改</span>}</div>
              <div className="preview-field"><label className="field-label">自我评价</label><textarea className="field-textarea" value={right.self} onChange={(e) => setField('self', { self: e.target.value })} /></div>
            </div>

            <p className="prefill-note">右侧修改仅作用于本次预填草稿，不会覆盖左侧原始材料。</p>
          </div>
        </div>
      </div>

      <div className="prefill-actions">
        <button type="button" className="btn" onClick={() => setShowSaveDraft(true)}>保存草稿</button>
        <button type="button" className="btn btn-gradient" onClick={() => setShowWrite(true)}>查看写入说明</button>
      </div>

      {message && <div className="demo-toast">{message}</div>}

      {showJobDetail && matched && (
        <div className="modal-overlay" onClick={() => setShowJobDetail(false)}>
          <div className="modal demo-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="section-title">岗位详情</h2>
            <div className="job-detail">
              <div className="job-detail-row"><span className="job-detail-label">企业名称</span><span className="job-detail-value">{matched.companyName}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">岗位名称</span><span className="job-detail-value">{matched.jobTitle}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">方向</span><span className="job-detail-value">{matched.jobDirection}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">工作地点</span><span className="job-detail-value">{matched.location}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">用工类型</span><span className="job-detail-value">{matched.employmentType}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">行业</span><span className="job-detail-value">{matched.industry}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">公司类型</span><span className="job-detail-value">{matched.companyType}</span></div>
              <div className="job-detail-row"><span className="job-detail-label">截止时间</span><span className="job-detail-value">{matched.deadline || '—'}</span></div>
              <div className="job-detail-row job-detail-block"><span className="job-detail-label">岗位描述</span><span className="job-detail-value">{matched.jobDescription || '—'}</span></div>
              <div className="job-detail-row job-detail-block"><span className="job-detail-label">福利待遇</span><span className="job-detail-value">{matched.benefits || '—'}</span></div>
              <div className="job-detail-row job-detail-block"><span className="job-detail-label">网申链接</span><span className="job-detail-value">{matched.applicationUrl || '—'}</span></div>
            </div>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setShowJobDetail(false)}>关闭</button></div>
          </div>
        </div>
      )}

      {showWrite && (
        <div className="modal-overlay" onClick={() => setShowWrite(false)}>
          <div className="modal demo-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="section-title">开始写入</h2>
            <p className="page-desc">正式接入后，点击「开始写入」会将右侧已确认的字段逐项填入支持的网申页面；写入前仍可返回修改。</p>
            <ul className="demo-write-list">
              <li>请先逐项确认右侧材料内容；</li>
              <li>本助手不会自动提交网申；</li>
              <li>不会保存第三方网站账号或密码。</li>
            </ul>
            <p className="page-desc">开发中：外部网申页面连接将仅在你确认字段后启用。</p>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setShowWrite(false)}>知道了</button></div>
          </div>
        </div>
      )}

      {showSaveDraft && (
        <div className="modal-overlay" onClick={() => setShowSaveDraft(false)}>
          <div className="modal demo-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="section-title">保存草稿（开发中）</h2>
            <p className="page-desc">正式接入后，会保存当前目标岗位、已选材料版本与右侧临时修改内容，便于下次继续核对；不会覆盖「网申材料管理」中的原始材料。</p>
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setShowSaveDraft(false)}>知道了</button></div>
          </div>
        </div>
      )}
    </section>
  )
}

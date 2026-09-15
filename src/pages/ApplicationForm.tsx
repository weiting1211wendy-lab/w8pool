import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Field from '../components/Field'
import TagInput from '../components/TagInput'
import { sampleApplications } from '../data/sampleData'
import { PREVIEW_SNAPSHOT } from '../data/previewSnapshot'
import { useAppData } from '../hooks/useAppData'
import { useAccountApplications } from '../hooks/useAccountApplications'
import { useAppPath } from '../hooks/useAppPath'
import { useMode } from '../hooks/useMode'
import { generateId, isValidUrl, normalizeApplication } from '../utils/helpers'
import {
  COMPANY_TYPES,
  EDUCATION_LEVELS,
  EMPLOYMENT_TYPES,
  INDUSTRIES,
  JOB_DIRECTIONS,
} from '../constants/jobOptions'
import type { Application } from '../types'

function buildEditDiff(before: Application, after: Application): string {
  const lines: string[] = []
  const compare = (label: string, beforeVal: unknown, afterVal: unknown) => {
    const norm = (v: unknown) =>
      Array.isArray(v) ? v.join('、') : String(v ?? '').trim()
    const b = norm(beforeVal)
    const a = norm(afterVal)
    if (b !== a) {
      lines.push(`${label}：${b || '（空）'} → ${a || '（空）'}`)
    }
  }
  compare('企业名称', before.companyName, after.companyName)
  compare('岗位名称', before.jobTitle, after.jobTitle)
  compare('岗位方向', before.jobDirection, after.jobDirection)
  compare('岗位性质', before.employmentType, after.employmentType)
  compare('所属行业', before.industries, after.industries)
  compare('企业类型', before.companyType, after.companyType)
  compare('工作地点', before.locations, after.locations)
  compare('学历要求', before.educationRequirements, after.educationRequirements)
  compare('届次要求', before.graduationYears, after.graduationYears)
  compare('招聘专业', before.majors, after.majors)
  compare('发布时间', before.publishedAt, after.publishedAt)
  compare('截止日期', before.deadline, after.deadline)
  compare('岗位详情', before.jobDescription, after.jobDescription)
  compare('岗位要求', before.jobRequirements, after.jobRequirements)
  compare('录用流程', before.hireProcess, after.hireProcess)
  compare('福利待遇', before.benefits, after.benefits)
  compare('投递地址', before.applicationUrl, after.applicationUrl)
  compare('公告链接', before.announcementUrl, after.announcementUrl)
  compare('个人备注', before.notes, after.notes)
  return lines.join('\n')
}

function createEmptyApplication(): Application {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    companyName: '',
    jobTitle: '',
    jobDirection: '',
    employmentType: '',
    industry: '',
    industries: [],
    companyType: '',
    location: '',
    locations: [],
    educationRequirements: [],
    graduationYears: [],
    majors: '',
    publishedAt: '',
    deadline: '',
    jobDescription: '',
    jobRequirements: '',
    hireProcess: '',
    benefits: '',
    applicationUrl: '',
    announcementUrl: '',
    applicationStatus: 'pending',
    screeningStatus: 'to_review',
    priority: 0,
    appliedAt: '',
    notes: '',
    importedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

export default function ApplicationForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const appPath = useAppPath()
  const mode = useMode()
  const [applications, setApplications, , reloadApplications] = useAccountApplications(sampleApplications)
  const [, setEvents] = useAppData('application-events', [])
  const [poolJobsMap, setPoolJobsMap] = useAppData('pool-jobs', {})
  const [, setPoolEventsMap] = useAppData('pool-events', {})
  const target = id
    ? applications.find((item) => item.id === id)
    : undefined
  const [form, setForm] = useState<Application>(() =>
    target ? { ...normalizeApplication(target) } : createEmptyApplication(),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [collaborationPools, setCollaborationPools] = useState<Array<{ id: string; name: string }>>([])
  const [copyPoolIds, setCopyPoolIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (isEdit) return
    if (mode === 'workspace') {
      void fetch('/api/pools').then(async (response) => {
        if (!response.ok) return { pools: [] as Array<{ id: string; name: string; kind: string }> }
        return await response.json() as { pools: Array<{ id: string; name: string; kind: string }> }
      }).then((body) => setCollaborationPools(body.pools.filter((pool) => pool.kind === 'group')))
    } else {
      setCollaborationPools(PREVIEW_SNAPSHOT.groups.map((group) => ({ id: group.id, name: group.name })))
    }
  }, [isEdit, mode])

  if (isEdit && !target) {
    return (
      <section>
        <h1 className="page-title">未找到该岗位</h1>
        <p className="page-desc">
          <Link to={appPath('/applications')}>返回我的岗位池</Link>
        </p>
      </section>
    )
  }

  const update = (
    field: keyof Application,
    value: string | string[] | number,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value } as Application))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!form.companyName.trim()) nextErrors.companyName = '请填写企业名称'
    if (!form.jobTitle.trim()) nextErrors.jobTitle = '请填写岗位名称'
    if (form.applicationUrl.trim() && !isValidUrl(form.applicationUrl.trim())) {
      nextErrors.applicationUrl = '请输入以 http(s):// 开头的有效链接'
    }
    if (form.announcementUrl.trim() && !isValidUrl(form.announcementUrl.trim())) {
      nextErrors.announcementUrl = '请输入以 http(s):// 开头的有效链接'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (saving) return
    setSaving(true)
    setSubmitMessage('')

    const now = new Date().toISOString()
    const record: Application = {
      ...form,
      applicationUrl: form.applicationUrl.trim(),
      announcementUrl: form.announcementUrl.trim(),
      updatedAt: now,
    }

    try {
    if (isEdit) {
      setApplications((prev) =>
        prev.map((item) => (item.id === record.id ? record : item)),
      )
const original = normalizeApplication(target!)
const diff = buildEditDiff(original, record)
      setEvents((prev) => [
        {
          id: generateId(),
          applicationId: record.id,
          kind: 'edit',
          fromStatus: null,
          toStatus: null,
          note: diff || '编辑了岗位信息（无内容变化）',
          happenedAt: now,
        },
        ...prev,
      ])
      navigate(appPath(`/applications/${record.id}`))
    } else {
      if (mode === 'workspace') {
        const poolsResponse = await fetch('/api/pools')
        if (!poolsResponse.ok) {
          const body = await poolsResponse.json().catch(() => null) as { error?: string } | null
          throw new Error(body?.error ?? '暂时无法读取个人岗位池，请检查网络后重试。')
        }
        const pools = await poolsResponse.json() as { pools: Array<{ id: string; kind: string }> }
        const personal = pools.pools.find((pool) => pool.kind === 'personal')
        if (!personal) throw new Error('未找到当前账户的个人岗位池，请重新登录后再试。')
        const createdResponse = await fetch(`/api/pools/${personal.id}/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) })
        const created = await createdResponse.json().catch(() => null) as { job?: Application; error?: string } | null
        if (!createdResponse.ok || !created?.job) throw new Error(created?.error ?? '保存岗位失败，请稍后重试。')
        for (const poolId of copyPoolIds) {
          const copyResponse = await fetch(`/api/pools/${poolId}/jobs/copy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceJobId: created.job.id }) })
          if (!copyResponse.ok) throw new Error('岗位已保存，但复制到共享岗位池未完成，请稍后在列表中重试。')
        }
        await reloadApplications()
        navigate(appPath(`/applications/${created.job.id}`))
        return
      }
      const nextNo =
        applications.reduce(
          (max, item) => (typeof item.no === 'number' ? Math.max(max, item.no) : max),
          0,
        ) + 1
      setApplications([{ ...record, no: nextNo }, ...applications])
      if (mode === 'preview' && copyPoolIds.length > 0) {
        for (const poolId of copyPoolIds) {
          const newSharedId = generateId()
          const no = (poolJobsMap[poolId] ?? []).length + 1
          setPoolJobsMap((current) => ({ ...current, [poolId]: [...(current[poolId] ?? []), { id: newSharedId, no, payload_json: JSON.stringify({ ...record, id: newSharedId, no }), revision: 1 }] }))
          setPoolEventsMap((current) => ({ ...current, [poolId]: [...(current[poolId] ?? []), { job_id: newSharedId, actor_name: '演示用户', action: 'copied' as const, changed_fields_json: '{}', created_at: new Date().toISOString() }] }))
        }
      }
      navigate(appPath(`/applications/${record.id}`))
    }
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : '保存岗位失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h1 className="page-title">{isEdit ? '编辑岗位' : '新增岗位'}</h1>
      <p className="page-desc">
        {isEdit
          ? '修改岗位信息，保存后自动记录变更。'
          : '记录一条招聘岗位信息，字段与岗位信息一一对应。'}
      </p>

      <form className="card form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className="form-grid">
          <Field label="企业名称" error={errors.companyName}>
            <input
              className="field-input"
              value={form.companyName}
              placeholder="如：示例企业"
              onChange={(e) => update('companyName', e.target.value)}
            />
          </Field>
          <Field label="岗位名称" error={errors.jobTitle}>
            <input
              className="field-input"
              value={form.jobTitle}
              placeholder="如：法务专员"
              onChange={(e) => update('jobTitle', e.target.value)}
            />
          </Field>
          <Field label="岗位方向">
            <select
              className="field-input"
              value={form.jobDirection}
              onChange={(e) => update('jobDirection', e.target.value)}
            >
              <option value="">请选择岗位方向</option>
              {JOB_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="岗位性质">
            <select
              className="field-input"
              value={form.employmentType}
              onChange={(e) => update('employmentType', e.target.value)}
            >
              <option value="">请选择岗位性质</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="所属行业" full>
            <select
              className="field-input"
              value={form.industry}
              onChange={(e) => {
                update('industry', e.target.value)
                update('industries', e.target.value ? [e.target.value] : [])
              }}
            >
              <option value="">请选择所属行业</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </Field>
          <Field label="企业类型">
            <select
              className="field-input"
              value={form.companyType}
              onChange={(e) => update('companyType', e.target.value)}
            >
              <option value="">请选择企业类型</option>
              {COMPANY_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="工作地点" full>
            <TagInput
              values={form.locations}
              onChange={(values) => {
                update('locations', values)
                update('location', values[0] ?? '')
              }}
              placeholder="输入后按回车添加，如：上海、北京"
            />
          </Field>
          <Field label="招聘专业">
            <input
              className="field-input"
              value={form.majors}
              placeholder="如：法学相关专业"
              onChange={(e) => update('majors', e.target.value)}
            />
          </Field>
          <Field label="学历要求" full>
            <select
              className="field-input"
              value={form.educationRequirements[0] ?? ''}
              onChange={(e) =>
                update('educationRequirements', e.target.value ? [e.target.value] : [])
              }
            >
              <option value="">请选择学历要求</option>
              {EDUCATION_LEVELS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Field>
          <Field label="届次要求" full>
            <TagInput
              values={form.graduationYears}
              onChange={(values) => update('graduationYears', values)}
              placeholder="输入后按回车添加，如：2026届"
            />
          </Field>
          <Field label="发布时间">
            <input
              type="date"
              className="field-input"
              value={form.publishedAt}
              onChange={(e) => update('publishedAt', e.target.value)}
            />
          </Field>
          <Field label="截止日期">
            <input
              className="field-input"
              value={form.deadline}
              placeholder="如：2026-09-30 或 招满即止"
              onChange={(e) => update('deadline', e.target.value)}
            />
          </Field>
          <Field label="岗位详情" full>
            <textarea
              className="field-textarea"
              rows={8}
              value={form.jobDescription}
              placeholder="岗位职责、任职要求等，支持换行"
              onChange={(e) => update('jobDescription', e.target.value)}
            />
          </Field>
          <Field label="岗位要求" full>
            <textarea
              className="field-textarea"
              rows={4}
              value={form.jobRequirements}
              placeholder="学历、专业、技能、证书等任职要求，支持换行"
              onChange={(e) => update('jobRequirements', e.target.value)}
            />
          </Field>
          <Field label="录用流程" full>
            <textarea
              className="field-textarea"
              rows={4}
              value={form.hireProcess}
              placeholder="网申 → 笔试 → 面试 → Offer 等录用流程，支持换行"
              onChange={(e) => update('hireProcess', e.target.value)}
            />
          </Field>
          <Field label="福利待遇" full>
            <textarea
              className="field-textarea"
              rows={3}
              value={form.benefits}
              placeholder="福利、留用/转正通道等"
              onChange={(e) => update('benefits', e.target.value)}
            />
          </Field>
          <Field label="投递地址" full error={errors.applicationUrl}>
            <input
              className="field-input"
              value={form.applicationUrl}
              placeholder="https://..."
              onChange={(e) => update('applicationUrl', e.target.value)}
            />
          </Field>
          <Field label="公告链接" full error={errors.announcementUrl}>
            <input
              className="field-input"
              value={form.announcementUrl}
              placeholder="https://..."
              onChange={(e) => update('announcementUrl', e.target.value)}
            />
          </Field>
          <Field label="个人备注" full>
            <textarea
              className="field-textarea"
              rows={3}
              value={form.notes}
              placeholder="记录注意事项等"
              onChange={(e) => update('notes', e.target.value)}
            />
          </Field>
          {!isEdit && collaborationPools.length > 0 && <div className="field field-full"><span className="field-label">同时复制到共享岗位池（可选）</span><span className="page-desc">默认只保存到我的岗位池；也可稍后在我的岗位池中多选复制。</span>{collaborationPools.map((pool) => <label key={pool.id}><input type="checkbox" checked={copyPoolIds.includes(pool.id)} onChange={() => setCopyPoolIds((ids) => ids.includes(pool.id) ? ids.filter((id) => id !== pool.id) : [...ids, pool.id])} /> {pool.name}</label>)}</div>}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? '正在保存…' : isEdit ? '保存修改' : '保存岗位'}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate(isEdit ? appPath(`/applications/${form.id}`) : appPath('/applications'))}
          >
            取消
          </button>
        </div>
        {submitMessage && <p className="form-error" role="alert">{submitMessage}</p>}
      </form>
    </section>
  )
}

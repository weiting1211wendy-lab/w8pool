import { useEffect, useMemo, useState } from 'react'
import ActivitiesSection from '../components/profile/ActivitiesSection'
import BaseInfo from '../components/profile/BaseInfo'
import CertificatesSection from '../components/profile/CertificatesSection'
import CopyButton from '../components/profile/CopyButton'
import EducationSection from '../components/profile/EducationSection'
import ExperienceSection from '../components/profile/ExperienceSection'
import LibrarySection from '../components/profile/LibrarySection'
import ModulesSection from '../components/profile/ModulesSection'
import ProjectsSection from '../components/profile/ProjectsSection'
import SkillsSection from '../components/profile/SkillsSection'
import { profileVariantText } from '../components/profile/serialize'
import { emptyProfile } from '../data/sampleData'
import { useAppData } from '../hooks/useAppData'
import { emptyVariant, generateId, normalizeProfile } from '../utils/helpers'
import type {
  CustomField,
  Profile as ProfileType,
  ProfileVariant,
  VariantCustomFieldSection,
} from '../types'

const JOB_TYPE_THEMES = [
  { accent: '#6c6aa6', bg: '#f0f0fb' },
  { accent: '#5a9b92', bg: '#eafaf7' },
  { accent: '#c07d92', bg: '#fdf0f3' },
  { accent: '#c79356', bg: '#fdf6ea' },
  { accent: '#8a72c4', bg: '#f4effb' },
  { accent: '#5fa06f', bg: '#eefaf1' },
  { accent: '#5a93bd', bg: '#eaf4fb' },
  { accent: '#c47ba0', bg: '#fdeef5' },
]

export default function Profile() {
  const [rawProfile, setProfile] = useAppData('profile', emptyProfile)
  const profile = useMemo(() => normalizeProfile(rawProfile), [rawProfile])
  const [activeTypeId, setActiveTypeId] = useState<string>(profile.jobTypes[0]?.id ?? 'default')
  const [manageOpen, setManageOpen] = useState(false)

  useEffect(() => {
    if (!profile.jobTypes.some((t) => t.id === activeTypeId)) {
      setActiveTypeId(profile.jobTypes[0]?.id ?? 'default')
    }
  }, [profile.jobTypes, activeTypeId])

  const activeType = profile.jobTypes.find((t) => t.id === activeTypeId) ?? profile.jobTypes[0]
  const activeIndex = Math.max(
    0,
    profile.jobTypes.findIndex((t) => t.id === activeTypeId),
  )
  const theme = JOB_TYPE_THEMES[activeIndex % JOB_TYPE_THEMES.length]
  const sectionStyle = { '--vt-accent': theme.accent, '--vt-bg': theme.bg } as React.CSSProperties
  const variant: ProfileVariant = activeType
    ? profile.variants[activeType.id] ?? emptyVariant()
    : emptyVariant()

  const update = <K extends keyof ProfileType>(key: K, value: ProfileType[K]) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  const updateVariant = <K extends keyof ProfileVariant>(key: K, value: ProfileVariant[K]) => {
    setProfile((prev) => {
      const norm = normalizeProfile(prev)
      const id = activeType?.id ?? norm.jobTypes[0].id
      const current = norm.variants[id] ?? emptyVariant()
      return {
        ...norm,
        variants: { ...norm.variants, [id]: { ...current, [key]: value } },
      }
    })
  }

  const updateVariantCustomFields = (section: VariantCustomFieldSection, value: CustomField[]) => {
    setProfile((prev) => {
      const norm = normalizeProfile(prev)
      const id = activeType?.id ?? norm.jobTypes[0].id
      const current = norm.variants[id] ?? emptyVariant()
      return {
        ...norm,
        variants: {
          ...norm.variants,
          [id]: { ...current, customFields: { ...current.customFields, [section]: value } },
        },
      }
    })
  }

  const addJobType = () => {
    const id = `jt-${generateId()}`
    setProfile((prev) => {
      const norm = normalizeProfile(prev)
      const name = `岗位类型${norm.jobTypes.length + 1}`
      return {
        ...norm,
        jobTypes: [...norm.jobTypes, { id, name }],
        variants: { ...norm.variants, [id]: emptyVariant() },
      }
    })
    setActiveTypeId(id)
    setManageOpen(false)
  }

  const renameJobType = (id: string, name: string) => {
    setProfile((prev) => {
      const norm = normalizeProfile(prev)
      return {
        ...norm,
        jobTypes: norm.jobTypes.map((t) => (t.id === id ? { ...t, name } : t)),
      }
    })
  }

  const deleteJobType = (id: string) => {
    setProfile((prev) => {
      const norm = normalizeProfile(prev)
      if (norm.jobTypes.length <= 1) return norm
      const jobTypes = norm.jobTypes.filter((t) => t.id !== id)
      const variants = { ...norm.variants }
      delete variants[id]
      return { ...norm, jobTypes, variants }
    })
    if (activeTypeId === id) {
      setActiveTypeId(profile.jobTypes.find((t) => t.id !== id)?.id ?? 'default')
    }
  }

  return (
    <section style={sectionStyle}>
      <div className="profile-topbar">
        <div className="profile-topbar-left">
          <h1 className="page-title">网申材料管理</h1>
          <p className="page-desc">按岗位类型维护材料版本，可一键复制，也可同步供网申预填小助手调用。</p>
        </div>
        <div className="profile-topbar-actions">
          <CopyButton getText={() => profileVariantText(variant)} label="复制当前版本" />
        </div>
      </div>

      <BaseInfo
        profile={profile}
        onChange={update}
        customFields={profile.customFields.base}
        onCustomFieldsChange={(v) =>
          update('customFields', { ...profile.customFields, base: v })
        }
      />
      <EducationSection
        items={profile.education}
        onChange={(v) => update('education', v)}
        customFields={profile.customFields.education}
        onCustomFieldsChange={(v) =>
          update('customFields', { ...profile.customFields, education: v })
        }

      />

      <div className="profile-jobtypes">
        <div className="jt-tabs">
          <span className="jt-type-label">档案对应岗位类型</span>
          {profile.jobTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === activeTypeId ? 'jt-tab active' : 'jt-tab'}
              onClick={() => setActiveTypeId(t.id)}
            >
              {t.name}
            </button>
          ))}
          <button type="button" className="jt-tab jt-add" onClick={addJobType} title="新增岗位类型">
            ＋
          </button>
          <button
            type="button"
            className="jt-manage"
            onClick={() => setManageOpen((s) => !s)}
          >
            管理
          </button>
        </div>
        {manageOpen && (
          <div className="modal-overlay" onClick={() => setManageOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="section-title">管理岗位类型</h2>
              <p className="page-desc">岗位类型可按求职方向（如国企 / 律所 / 外企）分别维护一套简历资料，切换即可一键管理与复制对应版本。</p>
              <div className="jt-manage-panel">
                {profile.jobTypes.map((t) => (
                  <div key={t.id} className="jt-manage-row">
                    <input
                      className="field-input"
                      value={t.name}
                      onChange={(e) => renameJobType(t.id, e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={profile.jobTypes.length <= 1}
                      onClick={() => deleteJobType(t.id)}
                    >
                      删除
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm" onClick={addJobType}>
                  ＋ 添加岗位类型
                </button>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setManageOpen(false)}>关闭</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="variant-content">
      <CertificatesSection
        items={variant.certificates}
        onChange={(v) => updateVariant('certificates', v)}
        customFields={variant.customFields.certificates}
        onCustomFieldsChange={(v) => updateVariantCustomFields('certificates', v)}

      />
      <ExperienceSection
        items={variant.experience}
        onChange={(v) => updateVariant('experience', v)}
        customFields={variant.customFields.experience}
        onCustomFieldsChange={(v) => updateVariantCustomFields('experience', v)}

      />
      <ProjectsSection
        items={variant.projects}
        onChange={(v) => updateVariant('projects', v)}
        customFields={variant.customFields.projects}
        onCustomFieldsChange={(v) => updateVariantCustomFields('projects', v)}

      />
      <SkillsSection
        items={variant.skills}
        onChange={(v) => updateVariant('skills', v)}
        customFields={variant.customFields.skills}
        onCustomFieldsChange={(v) => updateVariantCustomFields('skills', v)}

      />
      <ActivitiesSection
        activities={variant.activities}
        honors={profile.honors}
        onChangeActivities={(v) => updateVariant('activities', v)}
        onChangeHonors={(v) => update('honors', v)}
        customFields={variant.customFields.activities}
        onCustomFieldsChange={(v) => updateVariantCustomFields('activities', v)}

      />
      <ModulesSection
        items={variant.modules}
        onChange={(v) => updateVariant('modules', v)}
        customFields={variant.customFields.modules}
        onCustomFieldsChange={(v) => updateVariantCustomFields('modules', v)}

      />
        <LibrarySection items={profile.library} onChange={(v) => update('library', v)} />
      </div>
    </section>
  )
}

import { useState, type ChangeEvent } from 'react'
import CopyButton from './CopyButton'
import SectionCard from './SectionCard'
import CustomFieldsBlock from './CustomFieldsBlock'
import EditableText from './EditableText'
import { customFieldsText, joinSection } from './serialize'
import type { CustomField, Profile, SensitiveVisibility } from '../../types'

interface BaseInfoProps {
  profile: Profile
  onChange: <K extends keyof Profile>(key: K, value: Profile[K]) => void
  customFields: CustomField[]
  onCustomFieldsChange: (items: CustomField[]) => void
}

const SENSITIVE_FIELDS: {
  key: keyof SensitiveVisibility
  label: string
}[] = [
  { key: 'phone', label: '手机号' },
  { key: 'email', label: '邮箱' },
  { key: 'location', label: '所在地/住址' },
  { key: 'politicalStatus', label: '政治面貌' },
  { key: 'ethnicity', label: '民族' },
]

export default function BaseInfo({
  profile,
  onChange,
  customFields,
  onCustomFieldsChange,
}: BaseInfoProps) {
  const [editing, setEditing] = useState(false)
  const readOnly = !editing
  const toggleVisibility = (
    key: keyof SensitiveVisibility,
    show: boolean,
  ) => {
    onChange('sensitiveVisibility', {
      ...profile.sensitiveVisibility,
      [key]: show,
    })
  }

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      window.alert('图片过大，请选择 2MB 以内的图片')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onChange('avatar', String(reader.result ?? ''))
    reader.readAsDataURL(file)
  }

  const baseInfoText = () => {
    const lines: string[] = []
    const add = (label: string, value: string) => {
      const v = value.trim()
      if (v) lines.push(`${label}：${v}`)
    }
    add('姓名', profile.name)
    add('年龄', profile.age)
    add('求职意向', profile.jobIntent)
    SENSITIVE_FIELDS.forEach(({ key, label }) => {
      if (profile.sensitiveVisibility[key]) add(label, profile[key])
    })
    return joinSection(lines.join('\n'), customFieldsText(customFields))
  }

  const renderField = (
    label: string,
    value: string,
    onValue: (value: string) => void,
    opts?: { multiline?: boolean; sensitiveKey?: keyof SensitiveVisibility },
  ) => {
    const visible = opts?.sensitiveKey
      ? profile.sensitiveVisibility[opts.sensitiveKey]
      : true
    if (readOnly && opts?.sensitiveKey && !visible) return null
    return (
      <div className="profile-field">
        <div className="profile-field-head">
          <span className="profile-field-label">{label}</span>
          <CopyButton getText={() => value} className="copy-btn-inline" />
        </div>
        <EditableText
          value={value}
          onChange={onValue}
          multiline={opts?.multiline}
          readOnly={readOnly || (!!opts?.sensitiveKey && !visible)}
        />
        {!readOnly && opts?.sensitiveKey && (
          <label className="vis-toggle">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) =>
                toggleVisibility(opts.sensitiveKey!, e.target.checked)
              }
            />
            展示
          </label>
        )}
      </div>
    )
  }

  return (
    <SectionCard
      title="基础信息"
      copyText={baseInfoText}
      readOnly={readOnly}
      defaultCollapsed={false}
      actions={
        <button
          type="button"
          className="btn btn-outline btn-sm section-edit-btn"
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? '保存' : '编辑'}
        </button>
      }
    >
      <div className="avatar-block">
        {profile.avatar ? (
          <div className="avatar-wrap">
            <img src={profile.avatar} alt="头像" className="avatar-img" />
            {!readOnly && (
              <div className="avatar-actions">
                <label className="btn btn-outline btn-sm">
                  替换
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleAvatarChange}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-danger"
                  onClick={() => onChange('avatar', '')}
                >
                  删除
                </button>
              </div>
            )}
          </div>
        ) : (
          !readOnly && (
            <label className="btn btn-outline">
              上传头像
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarChange}
              />
            </label>
          )
        )}
      </div>
      <div className="profile-field-grid">
        {renderField('姓名', profile.name, (v) => onChange('name', v))}
        {renderField('年龄', profile.age, (v) => onChange('age', v))}
        {renderField(
          '求职意向',
          profile.jobIntent,
          (v) => onChange('jobIntent', v),
        )}
        {SENSITIVE_FIELDS.map(({ key, label }) =>
          renderField(
            label,
            profile[key],
            (v) => onChange(key, v),
            { sensitiveKey: key },
          ),
        )}
      </div>
      <CustomFieldsBlock
        items={customFields}
        onChange={onCustomFieldsChange}
        readOnly={readOnly}
      />
    </SectionCard>
  )
}

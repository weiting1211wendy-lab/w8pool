import { useState } from 'react'
import CustomFieldsBlock from './CustomFieldsBlock'
import SectionCard from './SectionCard'
import SimpleListEditor from './SimpleListEditor'
import { bulletLines, customFieldsText, joinSection } from './serialize'
import type { CustomField, TextItem } from '../../types'

interface ActivitiesSectionProps {
  activities: TextItem[]
  honors: TextItem[]
  onChangeActivities: (items: TextItem[]) => void
  onChangeHonors: (items: TextItem[]) => void
  customFields: CustomField[]
  onCustomFieldsChange: (items: CustomField[]) => void
}

export default function ActivitiesSection({
  activities,
  honors,
  onChangeActivities,
  onChangeHonors,
  customFields,
  onCustomFieldsChange,
}: ActivitiesSectionProps) {
  const [editing, setEditing] = useState(false)
  const readOnly = !editing
  const copyText = () => {
    const parts: string[] = []
    if (activities.length > 0)
      parts.push(`学生工作：\n${bulletLines(activities)}`)
    if (honors.length > 0)
      parts.push(`荣誉奖项：\n${bulletLines(honors)}`)
    return joinSection(parts.join('\n\n'), customFieldsText(customFields))
  }

  return (
    <SectionCard
      title="学生工作与荣誉"
      copyText={copyText}
      readOnly={readOnly}
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
      <div className="profile-sublist">
        <span className="profile-sublist-label">学生工作</span>
        <SimpleListEditor
          items={activities}
          onChange={onChangeActivities}
          addPlaceholder="添加学生工作，如班级/社团/学生会职务"
          readOnly={readOnly}
        />
      </div>
      <div className="profile-sublist profile-sublist-gap">
        <span className="profile-sublist-label">荣誉奖项</span>
        <SimpleListEditor
          items={honors}
          onChange={onChangeHonors}
          addPlaceholder="添加荣誉或奖项"
          readOnly={readOnly}
        />
      </div>
      <CustomFieldsBlock
        items={customFields}
        onChange={onCustomFieldsChange}
        readOnly={readOnly}
      />
    </SectionCard>
  )
}

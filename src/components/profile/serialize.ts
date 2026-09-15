import type {
  CustomField,
  EducationEntry,
  ExperienceEntry,
  ProfileModule,
  ProfileVariant,
  ProjectEntry,
  SkillCategory,
  TextItem,
} from '../../types'

export function textItemsText(items: TextItem[]): string {
  return items
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('、')
}

export function bulletLines(items: TextItem[]): string {
  return items
    .map((item) => item.text.trim())
    .filter(Boolean)
    .map((t) => `- ${t}`)
    .join('\n')
}

export function customFieldsText(items: CustomField[]): string {
  return items
    .map((f) => [f.label.trim(), f.value.trim()].filter(Boolean).join('：'))
    .filter(Boolean)
    .join('\n')
}

export function joinSection(...parts: string[]): string {
  return parts.filter(Boolean).join('\n\n')
}

export function educationEntryText(e: EducationEntry): string {
  const title = [e.school, e.degree, e.major].filter(Boolean).join(' · ')
  const time = [e.start, e.end].filter(Boolean).join(' — ')
  const lines: string[] = []
  if (title) lines.push(title)
  if (e.schoolTag.trim()) lines.push(`学校标签：${e.schoolTag.trim()}`)
  if (e.researchDirection.trim())
    lines.push(`研究方向：${e.researchDirection.trim()}`)
  if (time) lines.push(`时间：${time}`)
  if (e.performance.trim()) lines.push(`成绩/排名：${e.performance.trim()}`)
  if (e.notes.trim()) lines.push(`备注：${e.notes.trim()}`)
  return lines.join('\n')
}

export function experienceEntryText(e: ExperienceEntry): string {
  const title = [e.company, e.position].filter(Boolean).join(' · ')
  const time = [e.start, e.end].filter(Boolean).join(' — ')
  const lines: string[] = []
  if (title) lines.push(title)
  if (e.companyType.trim()) lines.push(`单位类型：${e.companyType.trim()}`)
  if (e.department.trim()) lines.push(`部门：${e.department.trim()}`)
  if (time) lines.push(`时间：${time}`)
  const bullets = bulletLines(e.bullets)
  if (bullets) lines.push(`工作内容要点：\n${bullets}`)
  return lines.join('\n')
}

export function projectEntryText(e: ProjectEntry): string {
  const title = [e.title, e.type].filter(Boolean).join(' · ')
  const time = [e.start, e.end].filter(Boolean).join(' — ')
  const lines: string[] = []
  if (title) lines.push(title)
  if (e.achievement.trim()) lines.push(`奖项/成果：${e.achievement.trim()}`)
  if (time) lines.push(`时间：${time}`)
  if (e.description.trim()) lines.push(`详细描述：\n${e.description.trim()}`)
  return lines.join('\n')
}

export function skillCategoryText(c: SkillCategory): string {
  const skills = textItemsText(c.skills)
  return [c.name.trim(), skills].filter(Boolean).join('：')
}

export function profileModuleText(m: ProfileModule): string {
  return [m.title.trim(), m.content.trim()].filter(Boolean).join('\n')
}

export function profileVariantText(v: ProfileVariant): string {
  const parts: string[] = []
  if (v.certificates.length > 0) {
    parts.push(
      [`证书：`, bulletLines(v.certificates), customFieldsText(v.customFields.certificates)]
        .filter(Boolean)
        .join('\n'),
    )
  }
  if (v.experience.length > 0) {
    parts.push(
      [`实习经历：`, v.experience.map(experienceEntryText).join('\n\n'), customFieldsText(v.customFields.experience)]
        .filter(Boolean)
        .join('\n'),
    )
  }
  if (v.projects.length > 0) {
    parts.push(
      [`项目经历：`, v.projects.map(projectEntryText).join('\n\n'), customFieldsText(v.customFields.projects)]
        .filter(Boolean)
        .join('\n'),
    )
  }
  if (v.skills.length > 0) {
    parts.push(
      [`技能：`, v.skills.map(skillCategoryText).join('、'), customFieldsText(v.customFields.skills)]
        .filter(Boolean)
        .join('\n'),
    )
  }
  if (v.activities.length > 0) {
    parts.push(
      [`学生工作：`, bulletLines(v.activities), customFieldsText(v.customFields.activities)]
        .filter(Boolean)
        .join('\n'),
    )
  }
  if (v.modules.length > 0) {
    parts.push(
      [`自定义模块：`, v.modules.map(profileModuleText).join('\n\n'), customFieldsText(v.customFields.modules)]
        .filter(Boolean)
        .join('\n'),
    )
  }
  return parts.join('\n\n')
}

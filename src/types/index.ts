export type ApplicationStatus =
  | 'pending'
  | 'submitted'
  | 'written_test'
  | 'interview'
  | 'offer'
  | 'rejected'

export type ApplicationScreeningStatus = 'to_review' | 'maybe' | 'selected' | 'skipped'

export type ApplicationEventKind = 'status' | 'priority' | 'edit'

export interface Application {
  id: string
  no?: number
  importedAt?: string
  source?: string
  companyName: string
  jobTitle: string
  jobDirection: string
  employmentType: string
  industry: string
  industries: string[]
  companyType: string
  location: string
  locations: string[]
  educationRequirements: string[]
  graduationYears: string[]
  majors: string
  publishedAt: string
  deadline: string
  jobDescription: string
  jobRequirements?: string
  hireProcess?: string
  benefits: string
  applicationUrl: string
  announcementUrl: string
  applicationStatus: ApplicationStatus
  screeningStatus: ApplicationScreeningStatus
  priority: number
  appliedAt: string
  notes: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  deletedBy?: string
}

export interface ApplicationEvent {
  id: string
  applicationId: string
  kind: ApplicationEventKind
  fromStatus: ApplicationStatus | null
  toStatus: ApplicationStatus | null
  note: string
  happenedAt: string
}

export interface Task {
  id: string
  title: string
  taskType: string
  applicationId?: string
  deadline: string
  done: boolean
  notes: string
  createdAt: string
  updatedAt: string
  completedAt: string
}

export interface StickyNote {
  id: string
  title: string
  done: boolean
  createdAt: string
  updatedAt: string
  completedAt: string
}

export interface ProfileModule {
  id: string
  title: string
  content: string
}

export interface TextItem {
  id: string
  text: string
}

export interface CustomField {
  id: string
  label: string
  value: string
}

export type VariantCustomFieldSection =
  | 'experience'
  | 'projects'
  | 'skills'
  | 'activities'
  | 'modules'
  | 'certificates'

export type VariantCustomFields = Record<VariantCustomFieldSection, CustomField[]>

export interface ProfileVariant {
  certificates: TextItem[]
  experience: ExperienceEntry[]
  projects: ProjectEntry[]
  skills: SkillCategory[]
  activities: TextItem[]
  modules: ProfileModule[]
  customFields: VariantCustomFields
}

export interface ProfileJobType {
  id: string
  name: string
}

export interface EducationEntry {
  id: string
  school: string
  schoolTag: string
  degree: string
  major: string
  researchDirection: string
  start: string
  end: string
  performance: string
  notes: string
  certificates?: TextItem[]
}

export interface ExperienceEntry {
  id: string
  company: string
  companyType: string
  department: string
  position: string
  start: string
  end: string
  bullets: TextItem[]
}

export interface ProjectEntry {
  id: string
  title: string
  type: string
  achievement: string
  start: string
  end: string
  description: string
}

export interface SkillCategory {
  id: string
  name: string
  skills: TextItem[]
}

export interface LibraryEntry {
  id: string
  label: string
  value: string
}

export interface SensitiveVisibility {
  phone: boolean
  email: boolean
  location: boolean
  politicalStatus: boolean
  ethnicity: boolean
}

export interface Profile {
  name: string
  age: string
  phone: string
  email: string
  location: string
  politicalStatus: string
  ethnicity: string
  jobIntent: string
  avatar: string
  sensitiveVisibility: SensitiveVisibility
  education: EducationEntry[]
  customFields: { base: CustomField[]; education: CustomField[] }
  honors: TextItem[]
  library: LibraryEntry[]
  jobTypes: ProfileJobType[]
  variants: Record<string, ProfileVariant>
}
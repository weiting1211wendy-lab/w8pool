import type {
  Application,
  ApplicationEvent,
  ApplicationScreeningStatus,
  ApplicationStatus,
  Profile,
  StickyNote,
  Task,
} from '../types'
import { sampleProfile } from './sampleData'

export interface PreviewGroupMember {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
}

export interface PreviewGroup {
  id: string
  name: string
  kind: 'group'
  ownerId: string
  ownerName: string
  inviteCode: string
  role: 'owner' | 'editor' | 'viewer'
  next_job_no: number
  unreadCount: number
  members: PreviewGroupMember[]
}

export interface PreviewSharedJob {
  id: string
  no: number
  payload_json: string
}

export interface PreviewPoolEvent {
  job_id: string
  actor_name: string
  action: 'added' | 'copied' | 'created' | 'deleted' | 'updated'
  changed_fields_json: string
  created_at: string
}

export type PreviewPoolJobs = Record<string, PreviewSharedJob[]>
export type PreviewPoolEvents = Record<string, PreviewPoolEvent[]>
export type PreviewCopyMappings = Record<string, Record<string, string>>

export interface PreviewSnapshot {
  motto: string
  applications: Application[]
  'application-events': ApplicationEvent[]
  tasks: Task[]
  'sticky-notes': StickyNote[]
  profile: Profile
  groups: PreviewGroup[]
  'pool-jobs': PreviewPoolJobs
  'pool-events': PreviewPoolEvents
  'copy-mappings': PreviewCopyMappings
}

const pad = (n: number) => String(n).padStart(2, '0')

function dateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isoOffset(days: number, hour = 9): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

// ---- 虚构公司与岗位数据（不含知名品牌）----
const COMPANIES = [
  '晨曦律所', '恒正咨询', '博远资本', '云图科技', '明德教育', '方圆法务',
  '启航人力', '智联医疗', '盛和数据', '光年文创', '同信银行', '泰和保险',
  '远见传媒', '翰林出版', '嘉禾食品', '蔚蓝环保', '星河文旅', '鼎新制造',
  '安和地产', '迅捷物流', '睿思设计', '知行智库', '云栖网络', '砺新半导体',
  '澄明化工', '中和医药', '寰宇能源', '优创零售', '枫桥律所', '弘毅投资',
  '明澈检测', '格物智能', '万象咨询', '卓远建筑', '晴川生物', '瀚海航运',
  '锦书文化', '璞石家居', '正源审计', '微光公益', '沐光智能', '知行法务',
]

const DIRECTIONS = [
  '核心法务', '合规风控', '知识产权', '投融资', '争议解决', '劳动法',
  '财税', '审计', '产品经理', '数据分析', '市场营销', '人力资源',
  '软件开发', '算法工程', '运营管理', '内容策划', '财务管理', '供应链',
]

const CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京',
  '西安', '苏州', '重庆', '天津', '长沙', '青岛',
]

const INDUSTRIES = [
  '咨询与专业服务', '金融', '科技/互联网', '教育培训', '医疗健康',
  '快消/零售', '文化传媒', '房地产/建筑', '制造', '能源/环保', '法律', '审计/税务',
]

const COMPANY_TYPES = ['民企', '国企', '外企', '合资', '事业单位']

const TITLE_SUFFIXES = ['专员', '助理', '顾问', '经理', '实习生']

const JOB_DESC = [
  '负责业务相关的合规审查与风险把控，参与合同起草、审核与谈判；对接内外部资源，推动项目落地。',
  '协助团队完成日常法务支持，整理与归档法律文件，参与案件研究与文书撰写。',
  '参与岗位相关的数据分析与业务支持，输出可落地的优化建议。',
  '负责用户/客户沟通与需求梳理，协同产品与研发推进功能迭代。',
  '支持团队的运营与项目管理工作，确保流程规范与节点交付。',
  '参与行业研究与专题分析，整理材料并协助汇报与决策。',
]

const BENEFITS = [
  '五险一金，补充商业保险，节日福利。',
  '弹性工作，定期团建，完善的培训体系。',
  '带薪年假，餐补与交通补贴。',
  '具有竞争力的薪资与绩效奖金。',
]

// ---- 重点岗位（被任务/动态/共享池引用，固定 id）----
interface FeaturedSeed {
  id: string
  companyName: string
  jobTitle: string
  jobDirection: string
  employmentType: string
  industry: string
  companyType: string
  location: string
  screeningStatus: ApplicationScreeningStatus
  applicationStatus: ApplicationStatus
  priority: number
  appliedAt: string
  notes: string
  deadline: string
  jobDescription: string
}

const FEATURED_SEEDS: FeaturedSeed[] = [
  {
    id: 'demo-legal-001', companyName: '晨曦律所', jobTitle: '金融证券授薪律师',
    jobDirection: '核心法务', employmentType: '正式', industry: '法律', companyType: '民企', location: '上海',
    screeningStatus: 'to_review', applicationStatus: 'submitted', priority: 3, appliedAt: dateOffset(-1),
    notes: '', deadline: '招满即止',
    jobDescription: '负责金融证券领域合规审查与风险把控，参与合同起草、审核与谈判，协助处理日常法务支持与案件研究。',
  },
  {
    id: 'demo-consulting-002', companyName: '恒正咨询', jobTitle: '合规顾问',
    jobDirection: '合规风控', employmentType: '正式', industry: '咨询与专业服务', companyType: '民企', location: '北京',
    screeningStatus: 'selected', applicationStatus: 'interview', priority: 5, appliedAt: dateOffset(-7),
    notes: '群面已通过，等待终面时间确认', deadline: dateOffset(12),
    jobDescription: '为企业的合规体系搭建与日常运营提供咨询支持，参与合规审查、风险排查与制度优化。',
  },
  {
    id: 'demo-finance-003', companyName: '博远资本', jobTitle: '投融资法务',
    jobDirection: '投融资', employmentType: '正式', industry: '金融', companyType: '民企', location: '上海',
    screeningStatus: 'selected', applicationStatus: 'written_test', priority: 4, appliedAt: dateOffset(-5),
    notes: '已收到笔试通知，重点复习合规内控', deadline: dateOffset(9),
    jobDescription: '支持投融资项目的法律尽职调查、交易文件起草与谈判，参与投后管理与风险处置。',
  },
  {
    id: 'demo-tech-004', companyName: '云图科技', jobTitle: '法务专员',
    jobDirection: '核心法务', employmentType: '正式', industry: '科技/互联网', companyType: '民企', location: '深圳',
    screeningStatus: 'selected', applicationStatus: 'submitted', priority: 3, appliedAt: dateOffset(-3),
    notes: '简历已投递，等待反馈', deadline: dateOffset(20),
    jobDescription: '负责公司日常合同审核、知识产权与产品合规，协助处理诉讼与监管沟通事项。',
  },
  {
    id: 'demo-education-005', companyName: '明德教育', jobTitle: '法务经理',
    jobDirection: '劳动法', employmentType: '正式', industry: '教育培训', companyType: '民企', location: '杭州',
    screeningStatus: 'selected', applicationStatus: 'offer', priority: 5, appliedAt: dateOffset(-20),
    notes: '已收到正式 Offer，正在对比薪资福利', deadline: dateOffset(15),
    jobDescription: '统筹公司劳动用工合规、合同与纠纷处理，搭建法务流程并支持业务团队。',
  },
  {
    id: 'demo-tech-006', companyName: '沐光智能', jobTitle: '法务BP',
    jobDirection: '合规风控', employmentType: '正式', industry: '科技/互联网', companyType: '民企', location: '深圳',
    screeningStatus: 'selected', applicationStatus: 'pending', priority: 4, appliedAt: '',
    notes: '目标岗位，先完善简历再投递', deadline: dateOffset(25),
    jobDescription: '作为业务伙伴嵌入产品与运营团队，提供合规评估、合同支持与风险预警。',
  },
  {
    id: 'demo-legal-007', companyName: '方圆法务', jobTitle: '争议解决律师',
    jobDirection: '争议解决', employmentType: '正式', industry: '法律', companyType: '民企', location: '广州',
    screeningStatus: 'selected', applicationStatus: 'rejected', priority: 0, appliedAt: dateOffset(-18),
    notes: '在线笔试未通过，复盘复习方向', deadline: dateOffset(30),
    jobDescription: '代理民商事诉讼与仲裁案件，负责证据梳理、文书撰写与庭审支持。',
  },
  {
    id: 'demo-hr-008', companyName: '启航人力', jobTitle: 'HR专员',
    jobDirection: '人力资源', employmentType: '正式', industry: '教育培训', companyType: '民企', location: '成都',
    screeningStatus: 'skipped', applicationStatus: 'pending', priority: 0, appliedAt: '',
    notes: '暂不考虑：方向不符', deadline: dateOffset(8),
    jobDescription: '负责招聘、员工关系与基础人事运营，支持团队人才供给。',
  },
  {
    id: 'demo-medical-009', companyName: '智联医疗', jobTitle: '医疗法务',
    jobDirection: '知识产权', employmentType: '正式', industry: '医疗健康', companyType: '国企', location: '武汉',
    screeningStatus: 'to_review', applicationStatus: 'pending', priority: 1, appliedAt: '',
    notes: '', deadline: dateOffset(18),
    jobDescription: '支持医疗器械与药品业务的合规审查、专利布局与监管沟通。',
  },
  {
    id: 'demo-data-010', companyName: '盛和数据', jobTitle: '数据合规',
    jobDirection: '合规风控', employmentType: '实习', industry: '科技/互联网', companyType: '民企', location: '南京',
    screeningStatus: 'to_review', applicationStatus: 'pending', priority: 2, appliedAt: '',
    notes: '', deadline: dateOffset(22),
    jobDescription: '参与数据隐私与合规评估，协助梳理数据处理流程并输出合规建议。',
  },
]

const SCREENING_CYCLE: ApplicationScreeningStatus[] = ['to_review', 'selected', 'skipped']
const SELECTED_STATUSES: ApplicationStatus[] = ['submitted', 'written_test', 'interview', 'offer', 'rejected']

function makeFeaturedApp(seed: FeaturedSeed, no: number): Application {
  const ts = isoOffset(-30)
  return {
    id: seed.id,
    no,
    importedAt: ts,
    source: 'AI 清洗导入',
    companyName: seed.companyName,
    jobTitle: seed.jobTitle,
    jobDirection: seed.jobDirection,
    employmentType: seed.employmentType,
    industry: seed.industry,
    industries: [seed.industry],
    companyType: seed.companyType,
    location: seed.location,
    locations: [seed.location],
    educationRequirements: ['硕士', '博士'],
    graduationYears: ['2026届', '2027届'],
    majors: '法学相关专业',
    publishedAt: dateOffset(-25),
    deadline: seed.deadline,
    jobDescription: seed.jobDescription,
    jobRequirements: '',
    hireProcess: '',
    benefits: BENEFITS[no % BENEFITS.length],
    applicationUrl: `https://jobs.example.invalid/apply/${seed.id}`,
    announcementUrl: `https://jobs.example.invalid/notice/${seed.id}`,
    applicationStatus: seed.applicationStatus,
    screeningStatus: seed.screeningStatus,
    priority: seed.priority,
    appliedAt: seed.appliedAt,
    notes: seed.notes,
    createdAt: ts,
    updatedAt: ts,
  }
}

function makeBulkApp(i: number, no: number): Application {
  const company = COMPANIES[i % COMPANIES.length]
  const direction = DIRECTIONS[i % DIRECTIONS.length]
  const city = CITIES[i % CITIES.length]
  const industry = INDUSTRIES[i % INDUSTRIES.length]
  const companyType = COMPANY_TYPES[i % COMPANY_TYPES.length]
  const employment = i % 3 === 0 ? '实习' : '正式'
  const screening = SCREENING_CYCLE[i % 3]
  const titleSuffix = TITLE_SUFFIXES[i % TITLE_SUFFIXES.length]
  const jobTitle = `${direction}${titleSuffix}`

  let deadline: string
  const r = i % 4
  if (r === 0) deadline = dateOffset(-(5 + (i % 25)))
  else if (r === 1) deadline = '招满即止'
  else if (r === 2) deadline = ''
  else deadline = dateOffset(5 + (i % 40))

  let applicationStatus: ApplicationStatus = 'pending'
  let priority = 0
  let appliedAt = ''
  if (screening === 'selected') {
    applicationStatus = SELECTED_STATUSES[i % SELECTED_STATUSES.length]
    priority = 3 + (i % 3)
    if (applicationStatus !== 'pending') appliedAt = dateOffset(-(1 + (i % 20)))
  } else if (screening === 'to_review') {
    priority = 1 + (i % 3)
  }

  const edu = i % 2 === 0 ? ['本科'] : ['硕士', '博士']
  const pub = dateOffset(-(10 + (i % 40)))
  const ts = isoOffset(-(15 + i))
  const isLegal = direction.includes('法务') || direction === '合规风控' || direction === '知识产权' || direction === '争议解决' || direction === '劳动法'

  return {
    id: `pv-bulk-${i}`,
    no,
    importedAt: ts,
    source: 'AI 清洗导入',
    companyName: company,
    jobTitle,
    jobDirection: direction,
    employmentType: employment,
    industry,
    industries: [industry],
    companyType,
    location: city,
    locations: [city],
    educationRequirements: edu,
    graduationYears: ['2026届', '2027届'],
    majors: isLegal ? '法学相关专业' : '相关专业',
    publishedAt: pub,
    deadline,
    jobDescription: JOB_DESC[i % JOB_DESC.length],
    jobRequirements: '',
    hireProcess: '',
    benefits: BENEFITS[i % BENEFITS.length],
    applicationUrl: `https://jobs.example.invalid/apply/pv-bulk-${i}`,
    announcementUrl: `https://jobs.example.invalid/notice/pv-bulk-${i}`,
    applicationStatus,
    screeningStatus: screening,
    priority,
    appliedAt,
    notes: screening === 'skipped' ? '方向暂不匹配，先标记为暂不考虑。' : (screening === 'selected' ? '重点跟进岗位。' : ''),
    createdAt: ts,
    updatedAt: ts,
  }
}

const BULK_COUNT = 190

const previewApplications: Application[] = [
  ...FEATURED_SEEDS.map((seed, idx) => makeFeaturedApp(seed, idx + 1)),
  ...Array.from({ length: BULK_COUNT }, (_, i) => makeBulkApp(i, i + FEATURED_SEEDS.length + 1)),
]

const previewTaskBase = {
  taskType: '笔试',
  done: false,
  notes: '',
  createdAt: isoOffset(-2),
  updatedAt: isoOffset(-2),
  completedAt: '',
}

const previewTasks: Task[] = [
  {
    ...previewTaskBase,
    id: 'preview-task-1',
    title: '完成网申投递',
    taskType: '投递/网申',
    applicationId: 'demo-legal-001',
    deadline: dateOffset(-1),
    done: true,
    completedAt: isoOffset(-1),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-2',
    title: '整理笔试高频考点',
    taskType: '材料准备',
    applicationId: 'demo-legal-001',
    deadline: dateOffset(1),
    notes: '公司法与合同审查为重点',
  },
  {
    ...previewTaskBase,
    id: 'preview-task-3',
    title: '跟进邮件：确认笔试时间',
    taskType: '跟进邮件',
    applicationId: 'demo-legal-001',
    deadline: dateOffset(2),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-4',
    title: '完成网申投递',
    taskType: '投递/网申',
    applicationId: 'demo-consulting-002',
    deadline: dateOffset(-7),
    done: true,
    completedAt: isoOffset(-7),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-5',
    title: '整理资本市场案例分析',
    taskType: '材料准备',
    applicationId: 'demo-consulting-002',
    deadline: dateOffset(-3),
    done: true,
    completedAt: isoOffset(-3),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-6',
    title: '准备群面模拟练习',
    taskType: '面试准备',
    applicationId: 'demo-consulting-002',
    deadline: dateOffset(1),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-7',
    title: '跟进邮件：确认终面时间',
    taskType: '跟进邮件',
    applicationId: 'demo-consulting-002',
    deadline: dateOffset(2),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-8',
    title: '完成网申投递',
    taskType: '投递/网申',
    applicationId: 'demo-finance-003',
    deadline: dateOffset(-5),
    done: true,
    completedAt: isoOffset(-5),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-9',
    title: '复习合规内控笔试考点',
    taskType: '笔试',
    applicationId: 'demo-finance-003',
    deadline: dateOffset(1),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-10',
    title: '打印学历证明等材料',
    taskType: '材料准备',
    applicationId: 'demo-finance-003',
    deadline: dateOffset(-4),
    done: true,
    completedAt: isoOffset(-4),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-11',
    title: '提交笔试报名材料',
    taskType: '其他',
    applicationId: 'demo-finance-003',
    deadline: dateOffset(-2),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-12',
    title: '完成网申投递',
    taskType: '投递/网申',
    applicationId: 'demo-tech-004',
    deadline: dateOffset(-3),
    done: true,
    completedAt: isoOffset(-3),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-13',
    title: '跟进邮件：询问笔试安排',
    taskType: '跟进邮件',
    applicationId: 'demo-tech-004',
    deadline: dateOffset(4),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-14',
    title: '完成网申投递',
    taskType: '投递/网申',
    applicationId: 'demo-education-005',
    deadline: dateOffset(-20),
    done: true,
    completedAt: isoOffset(-20),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-15',
    title: '合同商务案例分析面试',
    taskType: '面试准备',
    applicationId: 'demo-education-005',
    deadline: dateOffset(-8),
    done: true,
    completedAt: isoOffset(-8),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-16',
    title: '确认 Offer 细节并回复 HR',
    taskType: '跟进邮件',
    applicationId: 'demo-education-005',
    deadline: dateOffset(3),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-17',
    title: '对比其他 Offer 薪资福利',
    taskType: '其他',
    applicationId: 'demo-education-005',
    deadline: dateOffset(5),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-18',
    title: '完善简历并投递',
    taskType: '投递/网申',
    applicationId: 'demo-tech-006',
    deadline: dateOffset(2),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-19',
    title: '研究沐光智能产品与法务 BP 职责',
    taskType: '材料准备',
    applicationId: 'demo-tech-006',
    deadline: dateOffset(5),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-20',
    title: '完成网申投递',
    taskType: '投递/网申',
    applicationId: 'demo-legal-007',
    deadline: dateOffset(-18),
    done: true,
    completedAt: isoOffset(-18),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-21',
    title: '参加在线笔试',
    taskType: '笔试',
    applicationId: 'demo-legal-007',
    deadline: dateOffset(-10),
    done: true,
    completedAt: isoOffset(-10),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-22',
    title: '复盘笔试失利原因',
    taskType: '其他',
    applicationId: 'demo-legal-007',
    deadline: dateOffset(1),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-today-1',
    title: '确认网申材料版本',
    taskType: '材料准备',
    applicationId: 'demo-legal-001',
    deadline: dateOffset(0),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-today-2',
    title: '提交岗位申请',
    taskType: '投递/网申',
    applicationId: 'demo-consulting-002',
    deadline: dateOffset(0),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-today-3',
    title: '补充开放性问题答案',
    taskType: '材料准备',
    applicationId: 'demo-finance-003',
    deadline: dateOffset(0),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-today-4',
    title: '跟进笔试通知',
    taskType: '跟进邮件',
    applicationId: 'demo-tech-004',
    deadline: dateOffset(0),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-today-5',
    title: '完成面试复盘',
    taskType: '面试准备',
    applicationId: 'demo-education-005',
    deadline: dateOffset(0),
    done: true,
    completedAt: isoOffset(0, 11),
  },
  {
    ...previewTaskBase,
    id: 'preview-task-today-6',
    title: '整理岗位判断备注',
    taskType: '其他',
    applicationId: 'demo-tech-006',
    deadline: dateOffset(0),
  },
]

const previewStickyNotes: StickyNote[] = [
  {
    id: 'preview-note-1',
    title: '下周面试前复习合同法',
    done: false,
    createdAt: isoOffset(-2),
    updatedAt: isoOffset(-2),
    completedAt: '',
  },
  {
    id: 'preview-note-2',
    title: '整理成绩单盖章',
    done: true,
    createdAt: isoOffset(-3),
    updatedAt: isoOffset(-1),
    completedAt: isoOffset(-1),
  },
  {
    id: 'preview-note-3',
    title: '更新简历项目经历',
    done: false,
    createdAt: isoOffset(-1),
    updatedAt: isoOffset(-1),
    completedAt: '',
  },
]

const previewEvents: ApplicationEvent[] = [
  {
    id: 'preview-event-1',
    applicationId: 'demo-legal-001',
    kind: 'status',
    fromStatus: 'pending',
    toStatus: 'submitted',
    note: '任务「完成网申投递」完成',
    happenedAt: isoOffset(-1),
  },
  {
    id: 'preview-event-2',
    applicationId: 'demo-consulting-002',
    kind: 'status',
    fromStatus: 'pending',
    toStatus: 'submitted',
    note: '任务「完成网申投递」完成',
    happenedAt: isoOffset(-7),
  },
  {
    id: 'preview-event-3',
    applicationId: 'demo-consulting-002',
    kind: 'priority',
    fromStatus: null,
    toStatus: null,
    note: '3 → 5',
    happenedAt: isoOffset(-7),
  },
  {
    id: 'preview-event-4',
    applicationId: 'demo-consulting-002',
    kind: 'status',
    fromStatus: 'submitted',
    toStatus: 'interview',
    note: '群面通过，进入终面',
    happenedAt: isoOffset(-2),
  },
  {
    id: 'preview-event-5',
    applicationId: 'demo-finance-003',
    kind: 'status',
    fromStatus: 'pending',
    toStatus: 'submitted',
    note: '任务「完成网申投递」完成',
    happenedAt: isoOffset(-5),
  },
  {
    id: 'preview-event-6',
    applicationId: 'demo-finance-003',
    kind: 'status',
    fromStatus: 'submitted',
    toStatus: 'written_test',
    note: '收到笔试通知',
    happenedAt: isoOffset(-1),
  },
  {
    id: 'preview-event-7',
    applicationId: 'demo-tech-004',
    kind: 'status',
    fromStatus: 'pending',
    toStatus: 'submitted',
    note: '任务「完成网申投递」完成',
    happenedAt: isoOffset(-3),
  },
  {
    id: 'preview-event-8',
    applicationId: 'demo-education-005',
    kind: 'status',
    fromStatus: 'pending',
    toStatus: 'submitted',
    note: '任务「完成网申投递」完成',
    happenedAt: isoOffset(-20),
  },
  {
    id: 'preview-event-9',
    applicationId: 'demo-education-005',
    kind: 'status',
    fromStatus: 'submitted',
    toStatus: 'written_test',
    note: '收到笔试通知',
    happenedAt: isoOffset(-12),
  },
  {
    id: 'preview-event-10',
    applicationId: 'demo-education-005',
    kind: 'status',
    fromStatus: 'written_test',
    toStatus: 'interview',
    note: '笔试通过，进入面试',
    happenedAt: isoOffset(-8),
  },
  {
    id: 'preview-event-11',
    applicationId: 'demo-education-005',
    kind: 'status',
    fromStatus: 'interview',
    toStatus: 'offer',
    note: '收到正式 Offer',
    happenedAt: isoOffset(-2),
  },
  {
    id: 'preview-event-12',
    applicationId: 'demo-tech-006',
    kind: 'priority',
    fromStatus: null,
    toStatus: null,
    note: '0 → 4',
    happenedAt: isoOffset(-3),
  },
  {
    id: 'preview-event-13',
    applicationId: 'demo-legal-007',
    kind: 'status',
    fromStatus: 'pending',
    toStatus: 'submitted',
    note: '任务「完成网申投递」完成',
    happenedAt: isoOffset(-18),
  },
  {
    id: 'preview-event-14',
    applicationId: 'demo-legal-007',
    kind: 'status',
    fromStatus: 'submitted',
    toStatus: 'written_test',
    note: '收到笔试通知',
    happenedAt: isoOffset(-10),
  },
  {
    id: 'preview-event-15',
    applicationId: 'demo-legal-007',
    kind: 'status',
    fromStatus: 'written_test',
    toStatus: 'rejected',
    note: '笔试未通过，已复盘复习方向',
    happenedAt: isoOffset(-4),
  },
  {
    id: 'preview-event-16',
    applicationId: 'demo-hr-008',
    kind: 'edit',
    fromStatus: null,
    toStatus: null,
    note: '标记为暂不考虑',
    happenedAt: isoOffset(-6),
  },
]

// ---- 演示档案（访客模式下的网申材料管理，全部为虚拟【示例】信息）----
const previewProfile: Profile = { ...sampleProfile, name: '张三' }

function toSharedJob(appId: string, no: number): PreviewSharedJob {
  const app = previewApplications.find((item) => item.id === appId)
  if (!app) throw new Error(`预览演示岗位缺失：${appId}`)
  return { id: app.id, no, payload_json: JSON.stringify(app) }
}

const previewGroups: PreviewGroup[] = [
  {
    id: 'preview-group-legal-2027',
    name: '2027 法学秋招协作组',
    kind: 'group',
    ownerId: 'preview-user-owner',
    ownerName: '演示用户',
    inviteCode: 'DEMO-LEGAL-2027',
    role: 'owner',
    next_job_no: 13,
    unreadCount: 5,
    members: [
      { id: 'preview-user-owner', name: '演示用户', role: 'owner' },
      { id: 'preview-user-a', name: '同学A', role: 'editor' },
      { id: 'preview-user-b', name: '同学B', role: 'viewer' },
      { id: 'preview-user-d', name: '同学D', role: 'editor' },
      { id: 'preview-user-e', name: '同学E', role: 'viewer' },
      { id: 'preview-user-f', name: '同学F', role: 'editor' },
      { id: 'preview-user-g', name: '同学G', role: 'viewer' },
    ],
  },
  {
    id: 'preview-group-arb',
    name: '外所仲裁方向小分队',
    kind: 'group',
    ownerId: 'preview-user-c',
    ownerName: '同学C',
    inviteCode: 'DEMO-ARB-2026',
    role: 'editor',
    unreadCount: 0,
    next_job_no: 8,
    members: [
      { id: 'preview-user-c', name: '同学C', role: 'owner' },
      { id: 'preview-user-owner', name: '演示用户', role: 'editor' },
      { id: 'preview-user-h', name: '同学H', role: 'editor' },
      { id: 'preview-user-i', name: '同学I', role: 'viewer' },
      { id: 'preview-user-j', name: '同学J', role: 'viewer' },
    ],
  },
]

const previewPoolJobs: PreviewPoolJobs = {
  'preview-group-legal-2027': [
    toSharedJob('demo-legal-001', 1),
    toSharedJob('demo-consulting-002', 2),
    toSharedJob('demo-finance-003', 3),
    toSharedJob('demo-tech-004', 4),
    toSharedJob('demo-education-005', 5),
    toSharedJob('demo-legal-007', 6),
    toSharedJob('pv-bulk-10', 7),
    toSharedJob('pv-bulk-25', 8),
    toSharedJob('pv-bulk-40', 9),
    toSharedJob('pv-bulk-55', 10),
    toSharedJob('pv-bulk-70', 11),
    toSharedJob('pv-bulk-85', 12),
  ],
  'preview-group-arb': [
    toSharedJob('demo-tech-006', 1),
    toSharedJob('demo-medical-009', 2),
    toSharedJob('demo-data-010', 3),
    toSharedJob('pv-bulk-5', 4),
    toSharedJob('pv-bulk-15', 5),
    toSharedJob('pv-bulk-30', 6),
    toSharedJob('pv-bulk-45', 7),
  ],
}

const previewPoolEvents: PreviewPoolEvents = {
  'preview-group-legal-2027': [
    { job_id: 'demo-finance-003', actor_name: '同学A', action: 'updated', changed_fields_json: JSON.stringify({ deadline: true }), created_at: isoOffset(-1) },
    { job_id: 'demo-tech-004', actor_name: '演示用户', action: 'copied', changed_fields_json: '{}', created_at: isoOffset(-2) },
    { job_id: 'demo-consulting-002', actor_name: '演示用户', action: 'copied', changed_fields_json: '{}', created_at: isoOffset(-3) },
    { job_id: 'pv-bulk-10', actor_name: '同学D', action: 'added', changed_fields_json: '{}', created_at: isoOffset(-5) },
    { job_id: 'pv-bulk-25', actor_name: '同学E', action: 'added', changed_fields_json: '{}', created_at: isoOffset(-6) },
    { job_id: 'demo-legal-001', actor_name: '演示用户', action: 'updated', changed_fields_json: JSON.stringify({ salary: true }), created_at: isoOffset(-7) },
    { job_id: 'pv-bulk-40', actor_name: '同学F', action: 'added', changed_fields_json: '{}', created_at: isoOffset(-8) },
    { job_id: 'demo-consulting-002', actor_name: '同学A', action: 'copied', changed_fields_json: '{}', created_at: isoOffset(-9) },
    { job_id: 'pv-bulk-55', actor_name: '同学G', action: 'added', changed_fields_json: '{}', created_at: isoOffset(-10) },
    { job_id: 'demo-tech-004', actor_name: '同学B', action: 'updated', changed_fields_json: JSON.stringify({ deadline: true }), created_at: isoOffset(-11) },
    { job_id: 'pv-bulk-70', actor_name: '同学D', action: 'added', changed_fields_json: '{}', created_at: isoOffset(-12) },
    { job_id: 'pv-bulk-85', actor_name: '演示用户', action: 'added', changed_fields_json: '{}', created_at: isoOffset(-13) },
  ],
  'preview-group-arb': [
    { job_id: 'demo-tech-006', actor_name: '同学C', action: 'updated', changed_fields_json: JSON.stringify({ jobDescription: true }), created_at: isoOffset(-4) },
    { job_id: 'pv-bulk-5', actor_name: '同学H', action: 'added', changed_fields_json: '{}', created_at: isoOffset(-5) },
    { job_id: 'pv-bulk-15', actor_name: '同学I', action: 'added', changed_fields_json: '{}', created_at: isoOffset(-6) },
    { job_id: 'demo-data-010', actor_name: '同学J', action: 'updated', changed_fields_json: JSON.stringify({ jobDescription: true }), created_at: isoOffset(-7) },
    { job_id: 'pv-bulk-30', actor_name: '同学C', action: 'added', changed_fields_json: '{}', created_at: isoOffset(-8) },
    { job_id: 'pv-bulk-45', actor_name: '同学H', action: 'updated', changed_fields_json: JSON.stringify({ deadline: true }), created_at: isoOffset(-9) },
  ],
}

const previewCopyMappings: PreviewCopyMappings = {
  'preview-group-legal-2027': {
    'demo-consulting-002': 'preview-copied-1',
    'demo-tech-004': 'preview-copied-2',
  },
  'preview-group-arb': {},
}

export const PREVIEW_SNAPSHOT: PreviewSnapshot = {
  motto: '',
  applications: previewApplications,
  'application-events': previewEvents,
  tasks: previewTasks,
  'sticky-notes': previewStickyNotes,
  profile: previewProfile,
  groups: previewGroups,
  'pool-jobs': previewPoolJobs,
  'pool-events': previewPoolEvents,
  'copy-mappings': previewCopyMappings,
}

export const PREVIEW_KEYS = Object.keys(PREVIEW_SNAPSHOT) as Array<
  keyof PreviewSnapshot
>

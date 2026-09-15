import type { Application } from '../types'

export interface CommunityPool {
  id: string
  name: string
  desc: string
  memberCount: number
  jobs: Application[]
}

type PoolJobEntry = { id: string; no: number; payload_json: string }

function app(p: Partial<Application> & Pick<Application, 'id' | 'companyName' | 'jobTitle'>): Application {
  return {
    jobDirection: '',
    industries: [],
    locations: [],
    employmentType: '',
    industry: '',
    companyType: '',
    location: '',
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
    source: '社区岗位池',
    screeningStatus: 'to_review',
    applicationStatus: 'pending',
    priority: 0,
    no: 0,
    importedAt: '',
    appliedAt: '',
    notes: '',
    createdAt: '',
    updatedAt: '',
    ...p,
  }
}

export const COMMUNITY_POOLS: CommunityPool[] = [
  {
    id: 'comm-1',
    name: '红圈所校招互助池',
    desc: '面向意向红圈 / 精品律所的校招同学，共享内推、笔面经验与岗位线索。',
    memberCount: 142,
    jobs: [
      app({ id: 'comm-1-j1', companyName: '示例红圈所', jobTitle: '律师助理（校招）', jobDirection: '争议解决', locations: ['北京'], employmentType: '校招', industry: '法律', companyType: '律所', deadline: '2026-09-30', jobDescription: '协助民商事诉讼与仲裁，参与证据梳理、文书撰写与庭审支持。', benefits: '带教导师，系统培训。', applicationUrl: 'https://jobs.example.invalid/apply/comm-1-j1' }),
      app({ id: 'comm-1-j2', companyName: '示例精品所', jobTitle: '资本市场律师助理', jobDirection: '法务合规', locations: ['上海'], employmentType: '校招', industry: '法律', companyType: '律所', deadline: '2026-10-15', jobDescription: '参与投融资、并购与资本市场项目的文件起草与尽调。', benefits: '有竞争力的起薪，项目制培养。', applicationUrl: 'https://jobs.example.invalid/apply/comm-1-j2' }),
      app({ id: 'comm-1-j3', companyName: '示例律所', jobTitle: '公司法律师助理', jobDirection: '法务合规', locations: ['深圳'], employmentType: '校招', industry: '法律', companyType: '律所', deadline: '2026-09-20', jobDescription: '协助日常公司法律事务与合同管理。', benefits: '五险一金，案源支持。', applicationUrl: 'https://jobs.example.invalid/apply/comm-1-j3' }),
      app({ id: 'comm-1-j4', companyName: '示例涉外所', jobTitle: '涉外法务实习生', jobDirection: '涉外法务', locations: ['上海'], employmentType: '实习', industry: '法律', companyType: '律所', deadline: '招满即止', jobDescription: '支持跨境交易文件与合规沟通。', benefits: '实习津贴，语言津贴。', applicationUrl: 'https://jobs.example.invalid/apply/comm-1-j4' }),
      app({ id: 'comm-1-j5', companyName: '示例知产所', jobTitle: '知识产权律师助理', jobDirection: '知识产权', locations: ['北京'], employmentType: '校招', industry: '法律', companyType: '律所', deadline: '2026-10-31', jobDescription: '参与专利、商标与著作权相关诉讼与非诉业务。', benefits: '导师带教，专业培训。', applicationUrl: 'https://jobs.example.invalid/apply/comm-1-j5' }),
    ],
  },
  {
    id: 'comm-2',
    name: '法务合规求职圈',
    desc: '企业法务 / 合规方向，覆盖互联网、金融与制造业的校招与实习机会。',
    memberCount: 96,
    jobs: [
      app({ id: 'comm-2-j1', companyName: '示例科技', jobTitle: '法务专员', jobDirection: '法务合规', locations: ['深圳'], employmentType: '校招', industry: '科技/互联网', companyType: '企业', deadline: '2026-09-25', jobDescription: '负责合同审核、合规排查与风险整理。', benefits: '五险一金，补充商业保险。', applicationUrl: 'https://jobs.example.invalid/apply/comm-2-j1' }),
      app({ id: 'comm-2-j2', companyName: '示例集团', jobTitle: '合规管培生', jobDirection: '合规风控', locations: ['上海'], employmentType: '校招', industry: '综合企业', companyType: '企业', deadline: '2026-10-10', jobDescription: '轮岗参与合同、诉讼、合规等模块。', benefits: '具有竞争力的薪资与绩效奖金。', applicationUrl: 'https://jobs.example.invalid/apply/comm-2-j2' }),
      app({ id: 'comm-2-j3', companyName: '示例制造', jobTitle: '法务BP', jobDirection: '法务合规', locations: ['苏州'], employmentType: '校招', industry: '制造', companyType: '企业', deadline: '2026-09-30', jobDescription: '作为业务伙伴嵌入产品线，提供合规评估。', benefits: '弹性工作，定期团建。', applicationUrl: 'https://jobs.example.invalid/apply/comm-2-j3' }),
      app({ id: 'comm-2-j4', companyName: '示例互联网', jobTitle: '合规实习生', jobDirection: '数据合规', locations: ['杭州'], employmentType: '实习', industry: '科技/互联网', companyType: '企业', deadline: '招满即止', jobDescription: '协助隐私合规与数据出境评估。', benefits: '实习津贴，导师带教。', applicationUrl: 'https://jobs.example.invalid/apply/comm-2-j4' }),
    ],
  },
  {
    id: 'comm-3',
    name: '知识产权专项池',
    desc: '专利、商标、著作权与知识产权诉讼方向，适合有理工科背景的同学。',
    memberCount: 64,
    jobs: [
      app({ id: 'comm-3-j1', companyName: '示例知产所', jobTitle: '专利代理师（实习）', jobDirection: '知识产权', locations: ['北京'], employmentType: '实习', industry: '法律', companyType: '律所', deadline: '招满即止', jobDescription: '参与专利申请文件撰写与审查意见答复。', benefits: '实习津贴，导师带教。', applicationUrl: 'https://jobs.example.invalid/apply/comm-3-j1' }),
      app({ id: 'comm-3-j2', companyName: '示例知产所', jobTitle: '商标专员', jobDirection: '知识产权', locations: ['广州'], employmentType: '校招', industry: '法律', companyType: '律所', deadline: '2026-10-20', jobDescription: '负责商标注册、异议与维权流程。', benefits: '五险一金，节日福利。', applicationUrl: 'https://jobs.example.invalid/apply/comm-3-j2' }),
      app({ id: 'comm-3-j3', companyName: '示例律所', jobTitle: '知识产权诉讼助理', jobDirection: '知识产权', locations: ['北京'], employmentType: '校招', industry: '法律', companyType: '律所', deadline: '2026-09-28', jobDescription: '协助专利与商标侵权诉讼。', benefits: '五险一金，案源支持。', applicationUrl: 'https://jobs.example.invalid/apply/comm-3-j3' }),
      app({ id: 'comm-3-j4', companyName: '示例科技', jobTitle: 'IP 法务', jobDirection: '知识产权', locations: ['深圳'], employmentType: '校招', industry: '科技/互联网', companyType: '企业', deadline: '2026-10-15', jobDescription: '负责知识产权布局、登记与维权。', benefits: '弹性工作，定期团建。', applicationUrl: 'https://jobs.example.invalid/apply/comm-3-j4' }),
    ],
  },
  {
    id: 'comm-4',
    name: '涉外法务交流池',
    desc: '跨境交易、涉外争议与英文合同方向，关注语言能力与海外合规。',
    memberCount: 53,
    jobs: [
      app({ id: 'comm-4-j1', companyName: '示例涉外所', jobTitle: '涉外法务', jobDirection: '涉外法务', locations: ['上海'], employmentType: '校招', industry: '法律', companyType: '律所', deadline: '2026-10-08', jobDescription: '处理跨境合同、合规与争议，需良好英文能力。', benefits: '五险一金，语言津贴。', applicationUrl: 'https://jobs.example.invalid/apply/comm-4-j1' }),
      app({ id: 'comm-4-j2', companyName: '示例外企', jobTitle: '涉外合同法务', jobDirection: '涉外法务', locations: ['上海'], employmentType: '校招', industry: '制造', companyType: '企业', deadline: '2026-09-30', jobDescription: '处理跨境采购与分销合同，支持海外合规。', benefits: '五险一金，语言津贴。', applicationUrl: 'https://jobs.example.invalid/apply/comm-4-j2' }),
      app({ id: 'comm-4-j3', companyName: '示例事务所', jobTitle: '涉外法务助理', jobDirection: '涉外法务', locations: ['南京'], employmentType: '校招', industry: '法律', companyType: '律所', deadline: '2026-10-12', jobDescription: '支持跨境交易文件与合规沟通。', benefits: '五险一金，语言津贴。', applicationUrl: 'https://jobs.example.invalid/apply/comm-4-j3' }),
      app({ id: 'comm-4-j4', companyName: '示例律所', jobTitle: '国际仲裁助理', jobDirection: '争议解决', locations: ['北京'], employmentType: '实习', industry: '法律', companyType: '律所', deadline: '招满即止', jobDescription: '协助国际商事仲裁案件。', benefits: '实习津贴，导师带教。', applicationUrl: 'https://jobs.example.invalid/apply/comm-4-j4' }),
    ],
  },
  {
    id: 'comm-5',
    name: '公考与体制内法务',
    desc: '法院、检察院、行政机关的法规岗与见习机会，适合意向体制内的同学。',
    memberCount: 38,
    jobs: [
      app({ id: 'comm-5-j1', companyName: '示例法院', jobTitle: '法官助理（见习）', jobDirection: '争议解决', locations: ['成都'], employmentType: '实习', industry: '公共部门', companyType: '机关', deadline: '招满即止', jobDescription: '协助裁判文书起草与案件整理。', benefits: '实习津贴。', applicationUrl: 'https://jobs.example.invalid/apply/comm-5-j1' }),
      app({ id: 'comm-5-j2', companyName: '示例机关', jobTitle: '法规处见习', jobDirection: '合规风控', locations: ['南京'], employmentType: '实习', industry: '公共部门', companyType: '机关', deadline: '招满即止', jobDescription: '参与规范性文件起草与合规见习。', benefits: '实习津贴。', applicationUrl: 'https://jobs.example.invalid/apply/comm-5-j2' }),
      app({ id: 'comm-5-j3', companyName: '示例机关', jobTitle: '行政法见习', jobDirection: '合规风控', locations: ['武汉'], employmentType: '实习', industry: '公共部门', companyType: '机关', deadline: '招满即止', jobDescription: '参与行政执法与合规见习。', benefits: '实习津贴。', applicationUrl: 'https://jobs.example.invalid/apply/comm-5-j3' }),
      app({ id: 'comm-5-j4', companyName: '示例高校', jobTitle: '法务与合同管理', jobDirection: '法务合规', locations: ['西安'], employmentType: '校招', industry: '教育', companyType: '事业单位', deadline: '2026-10-31', jobDescription: '负责校办企业合同管理与制度合规。', benefits: '事业编制，寒暑假。', applicationUrl: 'https://jobs.example.invalid/apply/comm-5-j4' }),
    ],
  },
  {
    id: 'comm-6',
    name: '金融法律协作组',
    desc: '投行、银行、保险的合规与法律岗，关注金融监管与反洗钱。',
    memberCount: 71,
    jobs: [
      app({ id: 'comm-6-j1', companyName: '示例券商', jobTitle: '投行合规', jobDirection: '金融法律', locations: ['上海'], employmentType: '校招', industry: '金融', companyType: '企业', deadline: '2026-09-26', jobDescription: '支持投行项目合规审查与信息披露。', benefits: '具有竞争力的薪资与绩效奖金。', applicationUrl: 'https://jobs.example.invalid/apply/comm-6-j1' }),
      app({ id: 'comm-6-j2', companyName: '示例银行', jobTitle: '金融合规岗', jobDirection: '金融法律', locations: ['北京'], employmentType: '校招', industry: '金融', companyType: '企业', deadline: '2026-10-05', jobDescription: '支持投融资合规审查、反洗钱与监管报送。', benefits: '五险一金，年终奖。', applicationUrl: 'https://jobs.example.invalid/apply/comm-6-j2' }),
      app({ id: 'comm-6-j3', companyName: '示例银行', jobTitle: '反洗钱合规', jobDirection: '金融法律', locations: ['广州'], employmentType: '校招', industry: '金融', companyType: '企业', deadline: '2026-10-18', jobDescription: '负责反洗钱监测、可疑交易报送与培训。', benefits: '五险一金，年终奖。', applicationUrl: 'https://jobs.example.invalid/apply/comm-6-j3' }),
      app({ id: 'comm-6-j4', companyName: '示例保险', jobTitle: '合规审查岗', jobDirection: '合规风控', locations: ['上海'], employmentType: '校招', industry: '金融', companyType: '企业', deadline: '2026-09-30', jobDescription: '负责产品合规审查、销售行为管理与监管报送。', benefits: '五险一金，补充医疗。', applicationUrl: 'https://jobs.example.invalid/apply/comm-6-j4' }),
      app({ id: 'comm-6-j5', companyName: '示例银行', jobTitle: '金融合规实习', jobDirection: '金融法律', locations: ['成都'], employmentType: '实习', industry: '金融', companyType: '企业', deadline: '招满即止', jobDescription: '协助合规审查与监管材料整理。', benefits: '实习津贴。', applicationUrl: 'https://jobs.example.invalid/apply/comm-6-j5' }),
    ],
  },
]

export function seedCommunityPools(
  setPoolJobsMap: (updater: (cur: Record<string, PoolJobEntry[]>) => Record<string, PoolJobEntry[]>) => void,
  setPoolEventsMap: (updater: (cur: Record<string, unknown[]>) => Record<string, unknown[]>) => void,
) {
  const seed: Record<string, PoolJobEntry[]> = {}
  for (const pool of COMMUNITY_POOLS) {
    seed[pool.id] = pool.jobs.map((j, i) => ({ id: j.id, no: i + 1, payload_json: JSON.stringify(j) }))
  }
  setPoolJobsMap((cur) => {
    const next = { ...cur }
    for (const [id, jobs] of Object.entries(seed)) if (!next[id]) next[id] = jobs
    return next
  })
  setPoolEventsMap((cur) => {
    const next = { ...cur }
    for (const pool of COMMUNITY_POOLS) if (!next[pool.id]) next[pool.id] = []
    return next
  })
}

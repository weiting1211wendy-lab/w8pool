import type { Profile, ProfileVariant } from '../types'
import { importedApplications } from './importedApplications'

export { importedApplications as sampleApplications }

function emptyCustomFields(): ProfileVariant['customFields'] {
  return { experience: [], projects: [], skills: [], activities: [], modules: [], certificates: [] }
}

function emptyProfileVariant(): ProfileVariant {
  return {
    certificates: [],
    experience: [],
    projects: [],
    skills: [],
    activities: [],
    modules: [],
    customFields: emptyCustomFields(),
  }
}

function makeVariant(direction: string): ProfileVariant {
  const litigation = direction.includes('诉讼')
  return {
    certificates: [
      { id: 'c1', text: '【示例】法律职业资格 A 证' },
      { id: 'c2', text: `【示例】${direction}专项培训证书` },
    ],
    experience: [
      {
        id: 'exp-1',
        company: '【示例】示例集团法务部',
        companyType: '【示例】企业',
        department: '【示例】法务部',
        position: `【示例】${direction}实习生`,
        start: '2025-03',
        end: '2025-09',
        bullets: [
          { id: 'b1', text: `【示例】参与${direction}相关的合同初审、合规排查与材料整理` },
          { id: 'b2', text: '【示例】协助起草并归档标准模板，提升团队处理效率' },
        ],
      },
      {
        id: 'exp-2',
        company: '【示例】示例律师事务所',
        companyType: '【示例】律所',
        department: litigation ? '【示例】争议解决组' : '【示例】综合法律组',
        position: litigation ? '【示例】诉讼助理（实习）' : '【示例】法务助理（兼职）',
        start: '2024-09',
        end: '2025-02',
        bullets: [
          { id: 'b3', text: litigation ? '【示例】整理证据材料、撰写诉讼文书并完成案件检索' : `【示例】梳理${direction}流程，输出风险清单与整改建议` },
          { id: 'b4', text: '【示例】参与客户沟通与案件/项目复盘' },
        ],
      },
    ],
    projects: [
      {
        id: 'prj-1',
        title: `【示例】${direction}自动化辅助工具`,
        type: '【示例】课题项目',
        achievement: '【示例】搭建流程并完成原型验证',
        start: '2025',
        end: '2025',
        description: `【示例】围绕${direction}，参与流程自动化项目，沉淀可复用模板。`,
      },
      {
        id: 'prj-2',
        title: '【示例】校园法律科普实践',
        type: '【示例】实践项目',
        achievement: '【示例】完成需求梳理与方案设计',
        start: '2024',
        end: '2024',
        description: `【示例】结合${direction}场景，设计面向学生的法律辅助工具。`,
      },
    ],
    skills: [
      {
        id: 'sk-1',
        name: '【示例】法律实务',
        skills: [
          { id: 's1', text: `【示例】${direction}审查与文书能力` },
          { id: 's2', text: '【示例】合同起草与谈判支持' },
        ],
      },
      {
        id: 'sk-2',
        name: '【示例】工具与协作',
        skills: [
          { id: 's3', text: '【示例】法律检索（北大法宝 / 威科）' },
          { id: 's4', text: '【示例】AI 辅助工具与 Office' },
        ],
      },
    ],
    activities: [
      { id: 'a1', text: `【示例】${direction}方向社团负责人` },
      { id: 'a2', text: '【示例】校法律援助中心志愿者' },
    ],
    modules: [
      { id: 'm1', title: '【示例】自我评价', content: `【示例】具备${direction}相关能力，熟悉法律检索与 AI 辅助工具，注重落地与协作。` },
      { id: 'm2', title: '【示例】其他补充', content: '【示例】可出差，适应多线程节奏，愿意在实务中持续学习。' },
    ],
    customFields: emptyCustomFields(),
  }
}

export const sampleProfile: Profile = {
  name: '【示例】林如实',
  age: '24岁',
  phone: '138****0000',
  email: 'example@email.com',
  location: '【示例】示例市',
  politicalStatus: '【示例】共青团员',
  ethnicity: '【示例】汉族',
  jobIntent: '【示例】法律相关方向',
  avatar: '',
  sensitiveVisibility: {
    phone: true,
    email: true,
    location: true,
    politicalStatus: true,
    ethnicity: true,
  },
  education: [
    {
      id: 'edu-1',
      school: '【示例】示例大学',
      schoolTag: '【示例】双一流建设高校',
      degree: '硕士',
      major: '【示例】法学',
      researchDirection: '【示例】法律与人工智能',
      start: '2024',
      end: '2027',
      performance: '【示例】GPA 3.8/4.0，校级奖学金',
      notes: '【示例】担任法学院实践社团骨干',
      certificates: [{ id: 'c1', text: '【示例】法律职业资格A证' }],
    },
  ],
  customFields: { base: [], education: [] },
  honors: [{ id: 'h1', text: '【示例】校级一等奖学金' }],
  library: [{ id: 'l1', label: '【示例】个人陈述', value: '【示例】热爱法律，注重实务与工具结合。' }],
  jobTypes: [
    { id: 'jt-ai', name: '法律AI方向' },
    { id: 'jt-legal', name: '法务方向' },
    { id: 'jt-ip', name: '知识产权方向' },
    { id: 'jt-litigation', name: '律所（诉讼方向）' },
  ],
  variants: {
    'jt-ai': makeVariant('法律AI方向'),
    'jt-legal': makeVariant('法务方向'),
    'jt-ip': makeVariant('知识产权方向'),
    'jt-litigation': makeVariant('律所（诉讼方向）'),
  },
}

/** 工作台新账户的初始档案。访客模式使用上方的完整虚构示例档案。 */
export const emptyProfile: Profile = {
  name: '',
  age: '',
  phone: '',
  email: '',
  location: '',
  politicalStatus: '',
  ethnicity: '',
  jobIntent: '',
  avatar: '',
  sensitiveVisibility: {
    phone: true,
    email: true,
    location: true,
    politicalStatus: true,
    ethnicity: true,
  },
  education: [],
  customFields: { base: [], education: [] },
  honors: [],
  library: [],
  jobTypes: [{ id: 'default', name: '默认' }],
  variants: { default: emptyProfileVariant() },
}

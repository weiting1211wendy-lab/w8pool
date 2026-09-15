export interface RobotJob {
  id: string
  company: string
  title: string
  direction: string
  city: string
  nature: string
  industry: string
  description: string
  benefits: string
  applicationUrl: string
  source: string
  updated: string
}

export const ROBOT_JOBS: RobotJob[] = [
  { id: 'r1', company: '示例企业', title: '法务专员', direction: '法务合规', city: '上海', nature: '正式', industry: '科技/互联网', description: '负责日常合同审核、合规排查与风险整理，参与诉讼与监管沟通。', benefits: '五险一金，补充商业保险，节日福利。', applicationUrl: 'https://jobs.example.invalid/apply/r1', source: '示例招聘来源', updated: '今日更新' },
  { id: 'r2', company: '示例科技', title: '合规助理', direction: '法务合规', city: '深圳', nature: '实习', industry: '科技/互联网', description: '协助合规体系搭建与日常运营支持，整理风险清单。', benefits: '实习津贴，弹性工作。', applicationUrl: 'https://jobs.example.invalid/apply/r2', source: '示例公开招聘', updated: '今日更新' },
  { id: 'r3', company: '示例集团', title: '法务管培生', direction: '法务合规', city: '上海', nature: '正式', industry: '综合企业', description: '轮岗参与合同、诉讼、合规等法务模块，培养综合实务能力。', benefits: '具有竞争力的薪资与绩效奖金。', applicationUrl: 'https://jobs.example.invalid/apply/r3', source: '示例招聘来源', updated: '昨日更新' },
  { id: 'r4', company: '示例知产所', title: '专利代理师（实习）', direction: '知识产权', city: '北京', nature: '实习', industry: '法律', description: '参与专利申请文件撰写与审查意见答复，支持知识产权布局。', benefits: '实习津贴，导师带教。', applicationUrl: 'https://jobs.example.invalid/apply/r4', source: '示例公开招聘', updated: '今日更新' },
  { id: 'r5', company: '示例银行', title: '金融合规岗', direction: '金融法律', city: '北京', nature: '正式', industry: '金融', description: '支持投融资合规审查、反洗钱与监管报送。', benefits: '五险一金，年终奖。', applicationUrl: 'https://jobs.example.invalid/apply/r5', source: '企业官网', updated: '本周' },
  { id: 'r6', company: '示例事务所', title: '劳动争议处理岗', direction: '劳动法', city: '广州', nature: '正式', industry: '法律', description: '处理劳动合同、工伤与仲裁相关事务。', benefits: '五险一金，案源支持。', applicationUrl: 'https://jobs.example.invalid/apply/r6', source: '示例公开招聘', updated: '今日更新' },
  { id: 'r7', company: '示例涉外所', title: '涉外法务', direction: '涉外法务', city: '上海', nature: '正式', industry: '法律', description: '处理跨境合同、合规与争议，需良好英文能力。', benefits: '五险一金，语言津贴。', applicationUrl: 'https://jobs.example.invalid/apply/r7', source: '示例公开招聘', updated: '昨日更新' },
  { id: 'r8', company: '示例科技', title: '数据合规专员', direction: '数据合规', city: '杭州', nature: '正式', industry: '科技/互联网', description: '负责隐私合规评估、数据出境与算法合规。', benefits: '弹性工作，定期团建。', applicationUrl: 'https://jobs.example.invalid/apply/r8', source: '企业官网', updated: '今日更新' },
  { id: 'r9', company: '示例律所', title: '诉讼律师助理', direction: '争议解决', city: '深圳', nature: '正式', industry: '法律', description: '协助民商事诉讼与仲裁，负责证据梳理与文书撰写。', benefits: '五险一金，案源支持。', applicationUrl: 'https://jobs.example.invalid/apply/r9', source: '导师推荐', updated: '本周' },
  { id: 'r10', company: '示例集团', title: '合规风控岗', direction: '合规风控', city: '全国', nature: '正式', industry: '综合企业', description: '搭建合规体系，开展风险排查与制度优化。', benefits: '带薪年假，餐补与交通补贴。', applicationUrl: 'https://jobs.example.invalid/apply/r10', source: '示例公开招聘', updated: '昨日更新' },
  { id: 'r11', company: '示例银行', title: '金融合规实习', direction: '金融法律', city: '成都', nature: '实习', industry: '金融', description: '协助合规审查与监管材料整理。', benefits: '实习津贴。', applicationUrl: 'https://jobs.example.invalid/apply/r11', source: '企业官网', updated: '今日更新' },
  { id: 'r12', company: '示例事务所', title: '涉外法务助理', direction: '涉外法务', city: '南京', nature: '正式', industry: '法律', description: '支持跨境交易文件与合规沟通。', benefits: '五险一金，语言津贴。', applicationUrl: 'https://jobs.example.invalid/apply/r12', source: '示例公开招聘', updated: '本周' },
  { id: 'r13', company: '示例知产所', title: '商标专员', direction: '知识产权', city: '广州', nature: '正式', industry: '法律', description: '负责商标注册、异议与维权流程。', benefits: '五险一金，节日福利。', applicationUrl: 'https://jobs.example.invalid/apply/r13', source: '示例公开招聘', updated: '今日更新' },
  { id: 'r14', company: '示例机关', title: '行政法见习', direction: '合规风控', city: '武汉', nature: '实习', industry: '公共部门', description: '参与行政执法与合规见习。', benefits: '实习津贴。', applicationUrl: 'https://jobs.example.invalid/apply/r14', source: '导师推荐', updated: '昨日更新' },
  { id: 'r15', company: '示例科技', title: '法务BP', direction: '法务合规', city: '深圳', nature: '正式', industry: '科技/互联网', description: '作为业务伙伴嵌入产品团队，提供合规评估与风险预警。', benefits: '具有竞争力的薪资与绩效奖金。', applicationUrl: 'https://jobs.example.invalid/apply/r15', source: '校友内推', updated: '今日更新' },
  { id: 'r16', company: '示例保险', title: '合规审查岗', direction: '合规风控', city: '上海', nature: '正式', industry: '金融', description: '负责产品合规审查、销售行为管理与监管报送。', benefits: '五险一金，补充医疗。', applicationUrl: 'https://jobs.example.invalid/apply/r16', source: '示例公开招聘', updated: '今日更新' },
  { id: 'r17', company: '示例互联网', title: '平台治理法务', direction: '数据合规', city: '北京', nature: '正式', industry: '科技/互联网', description: '处理内容合规、平台责任与用户权益相关事务。', benefits: '弹性工作，股票期权。', applicationUrl: 'https://jobs.example.invalid/apply/r17', source: '企业官网', updated: '本周' },
  { id: 'r18', company: '示例律所', title: '公司法律师助理', direction: '法务合规', city: '苏州', nature: '正式', industry: '法律', description: '协助投融资、并购与日常公司法律事务。', benefits: '五险一金，案源支持。', applicationUrl: 'https://jobs.example.invalid/apply/r18', source: '示例公开招聘', updated: '今日更新' },
  { id: 'r19', company: '示例高校', title: '法务与合同管理', direction: '法务合规', city: '西安', nature: '正式', industry: '教育', description: '负责校办企业合同管理与制度合规。', benefits: '事业编制，寒暑假。', applicationUrl: 'https://jobs.example.invalid/apply/r19', source: '导师推荐', updated: '昨日更新' },
  { id: 'r20', company: '示例医药', title: '医药合规专员', direction: '合规风控', city: '杭州', nature: '正式', industry: '医药', description: '支持反商业贿赂、推广合规与监管沟通。', benefits: '五险一金，定期体检。', applicationUrl: 'https://jobs.example.invalid/apply/r20', source: '示例公开招聘', updated: '今日更新' },
  { id: 'r21', company: '示例法院', title: '法官助理（见习）', direction: '争议解决', city: '成都', nature: '实习', industry: '公共部门', description: '协助裁判文书起草与案件整理。', benefits: '实习津贴。', applicationUrl: 'https://jobs.example.invalid/apply/r21', source: '导师推荐', updated: '本周' },
  { id: 'r22', company: '示例知产', title: '版权专员', direction: '知识产权', city: '深圳', nature: '正式', industry: '法律', description: '负责著作权登记、监测与维权。', benefits: '五险一金，节日福利。', applicationUrl: 'https://jobs.example.invalid/apply/r22', source: '示例公开招聘', updated: '今日更新' },
  { id: 'r23', company: '示例外企', title: '涉外合同法务', direction: '涉外法务', city: '上海', nature: '正式', industry: '制造', description: '处理跨境采购与分销合同，支持海外合规。', benefits: '五险一金，语言津贴。', applicationUrl: 'https://jobs.example.invalid/apply/r23', source: '校友内推', updated: '昨日更新' },
  { id: 'r24', company: '示例券商', title: '投行合规', direction: '金融法律', city: '上海', nature: '正式', industry: '金融', description: '支持投行项目合规审查与信息披露。', benefits: '具有竞争力的薪资与绩效奖金。', applicationUrl: 'https://jobs.example.invalid/apply/r24', source: '企业官网', updated: '今日更新' },
  { id: 'r25', company: '示例科技', title: '隐私合规实习', direction: '数据合规', city: '深圳', nature: '实习', industry: '科技/互联网', description: '协助隐私政策评估与数据合规文档整理。', benefits: '实习津贴，导师带教。', applicationUrl: 'https://jobs.example.invalid/apply/r25', source: '示例公开招聘', updated: '本周' },
  { id: 'r26', company: '示例集团', title: '劳动合规岗', direction: '劳动法', city: '武汉', nature: '正式', industry: '综合企业', description: '负责用工合规、员工关系与制度优化。', benefits: '带薪年假，餐补。', applicationUrl: 'https://jobs.example.invalid/apply/r26', source: '示例公开招聘', updated: '今日更新' },
  { id: 'r27', company: '示例律所', title: '知识产权诉讼助理', direction: '知识产权', city: '北京', nature: '正式', industry: '法律', description: '协助专利与商标侵权诉讼。', benefits: '五险一金，案源支持。', applicationUrl: 'https://jobs.example.invalid/apply/r27', source: '导师推荐', updated: '昨日更新' },
  { id: 'r28', company: '示例银行', title: '反洗钱合规', direction: '金融法律', city: '广州', nature: '正式', industry: '金融', description: '负责反洗钱监测、可疑交易报送与培训。', benefits: '五险一金，年终奖。', applicationUrl: 'https://jobs.example.invalid/apply/r28', source: '企业官网', updated: '今日更新' },
  { id: 'r29', company: '示例机关', title: '法规处见习', direction: '合规风控', city: '南京', nature: '实习', industry: '公共部门', description: '参与规范性文件起草与合规见习。', benefits: '实习津贴。', applicationUrl: 'https://jobs.example.invalid/apply/r29', source: '导师推荐', updated: '本周' },
  { id: 'r30', company: '示例科技', title: '合规运营专员', direction: '合规风控', city: '杭州', nature: '正式', industry: '科技/互联网', description: '负责业务线合规审查与风险预警。', benefits: '弹性工作，定期团建。', applicationUrl: 'https://jobs.example.invalid/apply/r30', source: '示例公开招聘', updated: '今日更新' },
]

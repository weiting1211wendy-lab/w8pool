import { useState } from 'react'

const VERSION_LOG: { version: string; date: string; items: string[] }[] = [
  {
    version: 'v3.0.0', date: '2026-09-06', items: [
      '首页重构为“成就统计 + 日程 + 投递进度 + Robot 动态”的工作台视角：成就统计按日期回看推进动作，日程由任务目标日期自动生成并与任务完成状态联动。',
      '补充数据安全与可恢复能力：加入回收站、云端历史回滚、手动生成快照和容量规则，降低误删、误覆盖和大批量操作带来的数据风险。',
      '完善访客演示与说明体系：访客模式固定虚构演示数据，使用说明按侧栏信息架构重写，版本日志改为阶段式记录，便于招聘者快速理解产品全貌。',
      '优化多端体验：手机端自然展示成就与日程内容，电脑端重点列表默认折叠，岗位详情、任务、共享池等页面保持更连贯的浏览体验。',
    ],
  },
  {
    version: 'v2.5.0', date: '2026-09-02', items: [
      '围绕真实使用反馈强化岗位池操作：新增“待定”状态、Priority 星级、详情页筛选与进度联动、列表返回状态保持和基于筛选结果的详情翻页。',
      '完善任务推进闭环：决定推进的岗位进入任务管理，任务按公司与岗位聚合，求职进度可在岗位池、岗位详情和任务详情之间同步更新。',
      '批量导入升级为 AI 辅助流程：提供整理指令、示例 JSON、导入前校验、重复拦截和群组同步预告，减少大批量导入对个人数据的影响。',
      '修复多轮使用中暴露的数据问题：针对云端同步、重复岗位、备注保存、状态覆盖等场景进行加固，逐步明确私有数据与共享数据边界。',
    ],
  },
  {
    version: 'v2.0.0', date: '2026-08-28', items: [
      '从本地工具升级为云端工作台：接入注册登录、账户隔离、Cloudflare Pages Functions 与 D1，使岗位、任务、材料等私有数据跟随账户保存。',
      '上线群组岗位池：支持创建群组、邀请码加入、共享岗位线索、池内动态和从共享池纳入个人岗位池；个人筛选、备注和投递进度保持私有。',
      '引入访客模式的展示逻辑：访客可直接体验完整功能，但使用独立的 preview 数据空间，不读取、不写入真实账户数据。',
      '重构数据管理：取消默认本地自动备份，保留账户备份下载与从备份恢复，并明确备份只包含当前账户私有数据。',
    ],
  },
  {
    version: 'v1.5.0', date: '2026-08-23', items: [
      '视觉与信息架构升级为蓝紫玻璃风格：统一登录页、侧栏、卡片、按钮和移动端底栏，形成更完整的产品观感。',
      '岗位录入拆分为手动录入与批量导入，并优化列表 / 卡片、筛选、分组、排序等高频操作入口。',
      '网申材料改为按模块和岗位类型维护，支持独立编辑、保存、预览与复制，为后续预填小助手打基础。',
      '账户备份与恢复流程加入预览和校验：恢复前展示新增与重复数量，默认跳过重复项，避免覆盖已有数据。',
    ],
  },
  {
    version: 'v1.1.0', date: '2026-08-19', items: [
      '岗位池从单纯台账扩展为可管理视图：支持表格 / 卡片切换、按企业分组、批量操作、更多筛选和详情页字段维护。',
      '首页加入投递进度、近期截止岗位和便签，开始从“记录岗位”转向“提醒下一步行动”。',
      '详情页支持上一个 / 下一个岗位翻页，并记忆筛选、排序与视图状态，提升连续筛选效率。',
    ],
  },
  {
    version: 'v1.0.0', date: '2026-08-17', items: [
      '首个可用版本上线：建立我的岗位池、智能视图、筛选、排序、岗位详情和岗位信息维护能力。',
      '新增我的任务与网申材料模块，将“决定推进”的岗位拆分为可执行事项，并沉淀常用申请材料。',
      '加入访客模式与虚构演示数据，使未登录用户也能快速理解产品流程。',
      '完成 MVP 的本地数据持久化与 JSON 导入能力，验证“岗位池 + 任务 + 材料”的核心闭环。',
    ],
  },
]

export default function VersionLogContent({ onClose }: { onClose?: () => void }) {
  const [openVersion, setOpenVersion] = useState(VERSION_LOG[0]?.version ?? '')

  return (
    <div className="usage-guide">
      {onClose && <button type="button" className="ug-close" onClick={onClose}>✕</button>}
      <h2 className="usage-guide-title">版本日志</h2>
      <p className="usage-guide-intro">记录工具的迭代历程，点击版本可查看对应的功能更新。</p>
      {VERSION_LOG.map((entry) => {
        const isOpen = entry.version === openVersion
        return (
          <section key={entry.version} className={`version-entry${isOpen ? ' is-open' : ''}`}>
            <h3 className="version-head">
              <button type="button" className="version-toggle" aria-expanded={isOpen} onClick={() => setOpenVersion(entry.version)}>
                <span className="version-badge">{entry.version}</span>
                <span className="version-date">{entry.date}</span>
                <span className="version-chevron" aria-hidden="true">⌄</span>
              </button>
            </h3>
            {isOpen && <ul className="usage-guide-list">{entry.items.map((item) => <li key={item}>{item}</li>)}</ul>}
          </section>
        )
      })}
    </div>
  )
}

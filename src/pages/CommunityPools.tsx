import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppPath } from '../hooks/useAppPath'
import { COMMUNITY_POOLS } from '../data/communityPools'

export default function CommunityPools() {
  const appPath = useAppPath()
  const [query, setQuery] = useState('')

  const pools = useMemo(() => {
    const q = query.trim()
    if (!q) return COMMUNITY_POOLS
    return COMMUNITY_POOLS.filter((p) =>
      (p.name + p.desc + p.jobs.map((j) => j.jobDirection).join('、')).includes(q),
    )
  }, [query])

  return (
    <section>
      <div className="toolbar">
        <div>
          <h1 className="page-title">社区岗位池 <span className="demo-tag">开发中</span></h1>
          <p className="page-desc">按专业与求职方向汇聚公开岗位线索，形成可浏览、可发现机会的社区岗位池。</p>
        </div>
      </div>

      <div className="feature-preview-banner">
        <b>目标功能</b>：社区岗位池按专业、城市、行业、届次与岗位类型汇集公开岗位线索；发现合适机会后，可纳入我的岗位池继续筛选、投递与任务管理。<br /><b>实现路径</b>：持续接入可信岗位来源，完善专业分区与检索体系、岗位审核与更新机制、池内动态及社区协作规则。
      </div>

      <div className="card pool-create-combined">
        <div className="pool-create-col">
          <h2 className="section-title">检索岗位池</h2>
          <input
            className="field-input"
            value={query}
            placeholder="按名称或方向检索，如 知识产权"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="pool-grid">
        {pools.length === 0 ? (
          <div className="empty-state">没有匹配的岗位池。</div>
        ) : (
          pools.map((pool) => (
            <article className="card pool-card" key={pool.id}>
              <div className="pool-card-head">
                <div>
                  <h2 className="pool-card-name">{pool.name}</h2>
                  <div className="pool-card-meta">
                    <span>{pool.memberCount} 名成员</span>
                    <span>·</span>
                    <span>{pool.jobs.length} 条岗位</span>
                  </div>
                </div>
                <span className="pool-role">社区</span>
              </div>
              <div className="pool-card-body">
                <p className="pool-card-desc">{pool.desc}</p>
                <div className="pool-card-actions">
                  <Link to={appPath(`/community-pools/${pool.id}`)} className="btn btn-gradient">
                    进入岗位池
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

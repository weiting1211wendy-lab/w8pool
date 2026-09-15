import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMode } from '../hooks/useMode'
import { useAppData } from '../hooks/useAppData'
import { useAppPath } from '../hooks/useAppPath'
import type { PreviewGroup, PreviewPoolEvent } from '../data/previewSnapshot'

function isPoolVisited(poolId: string): boolean {
  try {
    const visited = JSON.parse(localStorage.getItem('visited-pools') ?? '{}') as Record<string, number>
    return !!visited[poolId]
  } catch { return false }
}

interface Pool {
  id: string
  name: string
  kind: 'personal' | 'group'
  group_id: string | null
  role: 'owner' | 'editor' | 'viewer'
  next_job_no: number
  unread_count?: number
  member_count?: number
  job_count?: number
}

interface Member {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
}

interface InviteSettings {
  maxUses: number
  expiresInDays: number
}

export default function JobPools() {
  const mode = useMode()
  const appPath = useAppPath()
  const [groups, setGroups] = useAppData('groups', [])
  const [poolJobsMap, setPoolJobsMap] = useAppData('pool-jobs', {})
  const [poolEventsMap, setPoolEventsMap] = useAppData('pool-events', {})
  const [message, setMessage] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [transferGroupId, setTransferGroupId] = useState<string | null>(null)
  const [manageGroupId, setManageGroupId] = useState<string | null>(null)
  const [groupMeta, setGroupMeta] = useState<{ memberCount: number }>({ memberCount: 0 })

  const [pools, setPools] = useState<Pool[]>([])
  const [groupName, setGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null)
  const [inviteSettings, setInviteSettings] = useState<InviteSettings>({ maxUses: 1, expiresInDays: 7 })
  const [showTip, setShowTip] = useState(false)

  const loadPools = async () => {
    const response = await fetch('/api/pools')
    if (!response.ok) throw new Error('无法读取群组岗位池')
    const body = await response.json() as { pools: Pool[] }
    const groupPools = body.pools.filter((pool) => pool.kind === 'group')
    setPools(groupPools)
    const eventsMap: Record<string, PreviewPoolEvent[]> = {}
    await Promise.all(groupPools.map(async (pool) => {
      try {
        const res = await fetch(`/api/pools/${pool.id}/events`)
        if (res.ok) {
          const data = await res.json() as { events: PreviewPoolEvent[] }
          eventsMap[pool.id] = data.events.slice(0, 3)
        }
      } catch { /* ignore */ }
    }))
    setPoolEventsMap(eventsMap)
  }

  useEffect(() => {
    if (mode === 'workspace') {
      void loadPools().catch(() => setMessage('群组岗位池暂时无法加载，请稍后刷新。'))
    }
  }, [mode])

  const capacityText = (count?: number) => `${count ?? 0} 名成员`

  // ---------- 预览（演示）流程 ----------
  const previewCreateGroup = () => {
    const name = groupName.trim()
    if (!name) return setMessage('请填写群组岗位池名称。')
    const id = `grp-${Date.now().toString(36)}`
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    const newGroup: PreviewGroup = {
      id, name, kind: 'group', ownerId: 'preview-user', ownerName: '演示用户',
      inviteCode: code, role: 'owner', next_job_no: 1, unreadCount: 0,
      members: [{ id: 'preview-user', name: '演示用户', role: 'owner' }],
    }
    setGroups((current) => [...current, newGroup])
    setPoolJobsMap((current) => ({ ...current, [id]: [] }))
    setPoolEventsMap((current) => ({ ...current, [id]: [] }))
    setGroupName('')
    setNewCode(code)
    setMessage('群组岗位池已创建（仅演示数据）。')
  }

  const previewJoinGroup = () => {
    const code = inviteCode.trim()
    if (!code) return setMessage('请粘贴邀请码。')
    const id = `grp-join-${Date.now().toString(36)}`
    const newGroup: PreviewGroup = {
      id, name: `通过邀请码加入的协作组（${code}）`, kind: 'group',
      ownerId: 'other', ownerName: '协作者',
      inviteCode: code, role: 'editor', next_job_no: 1, unreadCount: 0,
      members: [{ id: 'other', name: '协作者', role: 'owner' }, { id: 'preview-user', name: '演示用户', role: 'editor' }],
    }
    setGroups((current) => [...current, newGroup])
    setPoolJobsMap((current) => ({ ...current, [id]: [] }))
    setPoolEventsMap((current) => ({ ...current, [id]: [] }))
    setInviteCode('')
    setMessage('已加入共享池（仅演示数据）。')
  }

  const previewLeaveGroup = (id: string, name: string) => {
    if (!window.confirm(`确认退出「${name}」？退出后将无法查看该群组岗位池。`)) return
    setGroups((current) => current.filter((g) => g.id !== id))
    setPoolJobsMap((current) => { const next = { ...current }; delete next[id]; return next })
    setPoolEventsMap((current) => { const next = { ...current }; delete next[id]; return next })
    setMessage(`已退出「${name}」（仅演示数据）。`)
  }

  const previewRemoveGroup = (id: string, name: string) => {
    if (!window.confirm(`确认删除「${name}」？该群组岗位池及其全部岗位、动态将被永久删除，且无法恢复。`)) return
    setGroups((current) => current.filter((g) => g.id !== id))
    setPoolJobsMap((current) => { const next = { ...current }; delete next[id]; return next })
    setPoolEventsMap((current) => { const next = { ...current }; delete next[id]; return next })
    setMessage(`已删除「${name}」（仅演示数据）。`)
  }

  const previewTransfer = (id: string, targetId: string, targetName: string) => {
    setGroups((current) => current.map((g) => {
      if (g.id !== id) return g
      return {
        ...g,
        ownerId: targetId, ownerName: targetName,
        members: g.members.map((m) => m.id === g.ownerId ? { ...m, role: 'editor' } : m.id === targetId ? { ...m, role: 'owner' } : m),
      }
    }))
    setMessage('已转让创建者权限（仅演示数据）。')
    setTransferGroupId(null)
  }

  const previewRemoveMember = (groupId: string, memberId: string) => {
    setGroups((current) => current.map((g) => {
      if (g.id !== groupId) return g
      return { ...g, members: g.members.filter((m) => m.id !== memberId) }
    }))
    setMessage('已移除成员（仅演示数据）。')
    setManageGroupId(null)
  }

  const previewGroup = (id: string) => groups.find((g) => g.id === id)

  // ---------- 工作台流程 ----------
  const createGroup = async () => {
    const response = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: groupName.trim() }) })
    const body = await response.json() as { error?: string; inviteCode?: string }
    if (!response.ok) return setMessage(body.error ?? '创建失败，请稍后重试。')
    setGroupName('')
    setNewCode(body.inviteCode ?? '')
    setMessage('群组岗位池已创建。请复制邀请码发送给协作者。')
    await loadPools()
  }

  const joinGroup = async () => {
    const response = await fetch('/api/groups/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteCode: inviteCode.trim() }) })
    const body = await response.json() as { error?: string }
    if (!response.ok) return setMessage(body.error ?? '加入失败，请稍后重试。')
    setInviteCode('')
    setMessage('已加入共享池。')
    await loadPools()
  }

  const openInvite = (groupId: string) => {
    setInviteGroupId(groupId)
    setInviteSettings({ maxUses: 1, expiresInDays: 7 })
  }

  const generateCode = async () => {
    if (inviteGroupId == null) return
    const response = await fetch(`/api/groups/${inviteGroupId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteSettings),
    })
    const body = await response.json() as { error?: string; inviteCode?: string }
    if (!response.ok) return setMessage(body.error ?? '生成邀请码失败。')
    setNewCode(body.inviteCode ?? '')
    setInviteGroupId(null)
    setMessage('已生成新邀请码。')
  }

  const leaveGroup = async (groupId: string, name: string) => {
    if (!window.confirm(`确认退出「${name}」？退出后将无法查看该群组岗位池。`)) return
    const response = await fetch(`/api/groups/${groupId}/leave`, { method: 'POST' })
    const body = await response.json() as { error?: string }
    if (!response.ok) return setMessage(body.error ?? '退出失败，请稍后重试。')
    setMessage(`已退出「${name}」。`)
    await loadPools()
  }

  const openTransfer = async (groupId: string) => {
    const response = await fetch(`/api/groups/${groupId}/members`)
    const body = await response.json() as { members?: Member[]; error?: string }
    if (!response.ok) return setMessage(body.error ?? '无法读取成员列表。')
    setMembers(body.members ?? [])
    setTransferGroupId(groupId)
  }

  const confirmTransfer = async (groupId: string, targetUserId: string) => {
    const response = await fetch(`/api/groups/${groupId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    })
    const body = await response.json() as { error?: string }
    if (!response.ok) return setMessage(body.error ?? '转让失败，请稍后重试。')
    setTransferGroupId(null)
    setMessage('已转让创建者权限。')
    await loadPools()
  }

  const openManageMembers = async (groupId: string) => {
    const response = await fetch(`/api/groups/${groupId}/members`)
    const body = await response.json() as { members?: Member[]; memberCount?: number; error?: string }
    if (!response.ok) return setMessage(body.error ?? '无法读取成员列表。')
    setMembers(body.members ?? [])
    setGroupMeta({ memberCount: body.memberCount ?? 0 })
    setManageGroupId(groupId)
  }

  const changeMemberRole = async (groupId: string, userId: string, newRole: 'editor' | 'viewer') => {
    const response = await fetch(`/api/groups/${groupId}/members/${userId}/role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    const body = await response.json() as { error?: string; role?: string }
    if (!response.ok) return setMessage(body.error ?? '更改权限失败，请稍后重试。')
    setMembers((current) => current.map((m) => m.id === userId ? { ...m, role: newRole } : m))
    setMessage(`已将成员权限更改为${newRole === 'editor' ? '可编辑' : '仅查看'}。`)
  }

  const removeMember = async (groupId: string, userId: string, userName: string) => {
    if (!window.confirm(`确认移除成员「${userName}」？移除后其在该共享池的投递、筛选与已复制标记将被清除（共享岗位与动态保留）。`)) return
    const response = await fetch(`/api/groups/${groupId}/members/${userId}/remove`, { method: 'POST' })
    const body = await response.json() as { error?: string }
    if (!response.ok) return setMessage(body.error ?? '移除失败，请稍后重试。')
    setMembers((current) => current.filter((m) => m.id !== userId))
    setGroupMeta((current) => ({ ...current, memberCount: Math.max(0, current.memberCount - 1) }))
    setMessage('已移除成员。')
  }

  const removeGroup = async (groupId: string, name: string) => {
    if (!window.confirm(`确认删除「${name}」？该群组岗位池及其全部岗位、动态将被永久删除，且无法恢复。`)) return
    const response = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
    const body = await response.json() as { error?: string }
    if (!response.ok) return setMessage(body.error ?? '删除失败，请稍后重试。')
    setMessage(`已删除「${name}」。`)
    await loadPools()
  }

  if (mode === 'preview') {
    const demoGroups = groups
    return (
      <section>
        <div className="toolbar">
          <div>
            <h1 className="page-title">
              群组岗位池
              <button type="button" className="pool-tip-btn" onClick={() => setShowTip((s) => !s)} title="运作规则">运作规则</button>
            </h1>
            <p className="page-desc">与同路人共同汇集岗位线索，在群组岗位池中协作维护。</p>
          </div>
        </div>
        {showTip && (
          <div className="card pool-tip-card">
            <h3 className="pool-tip-title">共享池运作规则</h3>
            <ul className="pool-tip-list">
              <li><b>汇入共享池</b>：组内成员可选择私有池的岗位汇入共享池。方法：导入岗位时勾选同步共享，或导入私有池后再勾选批量复制。</li>
              <li><b>纳入私有池</b>：可将共享池中的岗位复制到私有池，再进行筛选、投递、Priority 与备注等个人管理。</li>
              <li><b>复制而非同步</b>：岗位信息的流转原理是复制，而非动态同步。复制后的副本与原信息互不干扰。</li>
              <li><b>流转范围</b>：流转信息仅包含岗位基本信息，不包含筛选、投递、Priority 与备注内容。</li>
            </ul>
          </div>
        )}
        <div className="card pool-create-combined">
          <div className="pool-create-col">
            <h2 className="section-title">创建共享池</h2>
            <div className="pool-create-row"><input className="field-input" value={groupName} placeholder="例如：2027 法学求职协作组" onChange={(event) => setGroupName(event.target.value)} /><button type="button" className="btn" onClick={previewCreateGroup}>创建</button></div>
          </div>
          <div className="pool-create-col">
            <h2 className="section-title">加入共享池</h2>
            <div className="pool-create-row"><input className="field-input" value={inviteCode} placeholder="粘贴协作者发来的邀请码" onChange={(event) => setInviteCode(event.target.value)} /><button type="button" className="btn" onClick={previewJoinGroup}>加入</button></div>
          </div>
        </div>
        {message && <p className="form-error">{message}</p>}
        {newCode && <div className="card invite-code-card"><span>邀请码（请复制后发给协作者）</span><code>{newCode}</code></div>}
        <div className="pool-grid">
          {demoGroups.length === 0 ? <div className="empty-state">尚未创建或加入共享池。</div> : demoGroups.map((group) => {
            const groupEvents = (poolEventsMap[group.id] ?? []).slice(0, 3)
            return (
              <article className="card pool-card" key={group.id}>
                <div className="pool-card-head">
                  <div>
                    <h2 className="pool-card-name">{group.name}</h2>
                    <div className="pool-card-meta">
                      <span>{group.members.length} 名成员</span>
                      <span>·</span>
                      <span>{(poolJobsMap[group.id] ?? []).length} 条岗位</span>
                      {group.unreadCount > 0 && !isPoolVisited(group.id) && <span className="pool-unread-badge">{group.unreadCount} 条新动态</span>}
                    </div>
                  </div>
                  <span className="pool-role">{group.role === 'owner' ? '我管理' : group.role === 'editor' ? '可编辑' : '仅查看'}</span>
                </div>
                <div className="pool-card-body">
                  <div className="pool-card-actions">
                    <Link to={appPath(`/pools/${group.id}`)} className="btn btn-gradient">进入岗位池</Link>
                    {group.role === 'owner' && <button type="button" className="btn btn-outline" onClick={() => { setNewCode(group.inviteCode); setMessage('已生成邀请码（仅演示）。') }}>生成邀请码</button>}
                    {group.role === 'owner' && group.members.length > 1 && <button type="button" className="btn btn-outline" onClick={() => { setMembers(group.members.filter((m) => m.role !== 'owner')); setTransferGroupId(group.id) }}>转让创建者</button>}
                    {group.role === 'owner' && <button type="button" className="btn btn-outline" onClick={() => setManageGroupId(group.id)}>管理成员</button>}
                    {group.role === 'owner' && <button type="button" className="btn btn-outline btn-danger" onClick={() => previewRemoveGroup(group.id, group.name)}>删除共享池</button>}
                    {group.role !== 'owner' && <button type="button" className="btn btn-outline btn-danger" onClick={() => previewLeaveGroup(group.id, group.name)}>退出</button>}
                  </div>
                  <div className="pool-card-events">
                    <h3 className="pool-events-title">池内动态</h3>
                    {groupEvents.length === 0 ? (
                      <p className="pool-events-empty">暂无动态</p>
                    ) : (
                    <ul className="pool-events-list">
                      {groupEvents.map((ev, i) => {
                        const status = ev.action === 'copied'
                          ? (ev.job_id ? `${ev.actor_name} 新增了岗位` : `${ev.actor_name} 新增了 ${(JSON.parse(ev.changed_fields_json || '{}') as { count?: number }).count ?? 0} 条岗位`)
                          : `${ev.actor_name} 修改了岗位信息`
                        return (
                          <li key={i} className="pool-event-item">
                            <span className="pool-event-status">{status}</span>
                            <span className="pool-event-time">{new Date(ev.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>
                          </li>
                        )
                      })}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
          {transferGroupId && (
            <div className="modal-overlay" onClick={() => setTransferGroupId(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2 className="section-title">转让创建者权限</h2>
                <p className="page-desc">选择一名成员成为新创建者，你将在转让后变为可编辑成员。</p>
                <div className="member-list">
                  {members.map((member) => (
                    <button type="button" key={member.id} className="btn btn-outline member-pick" onClick={() => previewTransfer(transferGroupId, member.id, member.name)}>{member.name}</button>
                  ))}
                </div>
                <div className="modal-actions"><button type="button" className="btn" onClick={() => setTransferGroupId(null)}>取消</button></div>
              </div>
            </div>
          )}
          {manageGroupId && previewGroup(manageGroupId) && (
            <div className="modal-overlay" onClick={() => setManageGroupId(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2 className="section-title">成员管理</h2>
                <p className="page-desc">{capacityText(previewGroup(manageGroupId)!.members.length)}</p>
                <div className="member-manage-list">
                  {previewGroup(manageGroupId)!.members.map((member) => (
                    <div className="member-manage-row" key={member.id}>
                      <span>{member.name}{member.role === 'owner' ? '（群主）' : member.role === 'editor' ? '（可编辑）' : '（仅查看）'}</span>
                      {previewGroup(manageGroupId)!.role === 'owner' && member.role !== 'owner' && (
                        <span className="member-manage-actions">
                          <button
                            type="button"
                            className={`btn btn-sm ${member.role === 'editor' ? 'btn-ready' : 'btn-outline'}`}
                            onClick={() => {
                              setGroups((current) => current.map((g) => g.id === manageGroupId ? { ...g, members: g.members.map((m) => m.id === member.id ? { ...m, role: 'editor' as const } : m) } : g))
                            }}
                          >
                            可编辑
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${member.role === 'viewer' ? 'btn-ready' : 'btn-outline'}`}
                            onClick={() => {
                              setGroups((current) => current.map((g) => g.id === manageGroupId ? { ...g, members: g.members.map((m) => m.id === member.id ? { ...m, role: 'viewer' as const } : m) } : g))
                            }}
                          >
                            仅查看
                          </button>
                          <button type="button" className="btn btn-outline btn-danger btn-sm" onClick={() => previewRemoveMember(manageGroupId, member.id)}>移除</button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="modal-actions"><button type="button" className="btn" onClick={() => setManageGroupId(null)}>关闭</button></div>
              </div>
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="toolbar">
        <div>
          <h1 className="page-title">
            群组岗位池
            <button type="button" className="pool-tip-btn" onClick={() => setShowTip((s) => !s)} title="运作规则">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </button>
          </h1>
          <p className="page-desc">与同路人共同汇集岗位线索，在群组岗位池中协作维护。</p>
        </div>
      </div>
      {showTip && (
        <div className="card pool-tip-card">
          <h3 className="pool-tip-title">共享池运作规则</h3>
          <ul className="pool-tip-list">
              <li><b>汇入共享池</b>：组内成员可选择私有池的岗位汇入共享池。方法：导入岗位时勾选同步共享，或导入私有池后再勾选批量复制。</li>
            <li><b>纳入私有池</b>：可将共享池中的岗位复制到私有池，再进行筛选、投递、Priority 与备注等个人管理。</li>
            <li><b>复制而非同步</b>：岗位信息的流转原理是复制，而非动态同步。复制后的副本与原信息互不干扰。</li>
            <li><b>流转范围</b>：流转信息仅包含岗位基本信息，不包含筛选、投递、Priority 与备注内容。</li>
          </ul>
        </div>
      )}
      <div className="card pool-create-combined">
        <div className="pool-create-col">
          <h2 className="section-title">创建共享池</h2>
          <div className="pool-create-row"><input className="field-input" value={groupName} placeholder="例如：2027 法学求职协作组" onChange={(event) => setGroupName(event.target.value)} /><button type="button" className="btn" onClick={() => void createGroup()}>创建</button></div>
        </div>
        <div className="pool-create-col">
          <h2 className="section-title">加入共享池</h2>
          <div className="pool-create-row"><input className="field-input" value={inviteCode} placeholder="粘贴协作者发来的邀请码" onChange={(event) => setInviteCode(event.target.value)} /><button type="button" className="btn" onClick={() => void joinGroup()}>加入</button></div>
        </div>
      </div>
      {message && <p className="form-error">{message}</p>}
      {newCode && <div className="card invite-code-card"><span>邀请码（请复制后发给协作者）</span><code>{newCode}</code></div>}
      <div className="pool-grid">
        {pools.length === 0 ? <div className="empty-state">尚未创建或加入共享池。</div> : pools.map((pool) => {
          const poolEvents = (poolEventsMap[pool.id] ?? []).slice(0, 3)
          return (
            <article className="card pool-card" key={pool.id}>
              <div className="pool-card-head">
                <div>
                  <h2 className="pool-card-name">{pool.name}</h2>
                  <div className="pool-card-meta">
                    <span>{pool.member_count ?? 0} 名成员</span>
                    <span>·</span>
                    <span>{pool.job_count ?? 0} 条岗位</span>
                    {pool.unread_count && !isPoolVisited(pool.id) ? <span className="pool-unread-badge">{pool.unread_count} 条新动态</span> : ''}
                  </div>
                </div>
                <span className="pool-role">{pool.role === 'owner' ? '我管理' : pool.role === 'editor' ? '可编辑' : '仅查看'}</span>
              </div>
              <div className="pool-card-body">
                <div className="pool-card-actions">
                  <Link to={appPath(`/pools/${pool.id}`)} className="btn btn-gradient">进入岗位池</Link>
                  {pool.role === 'owner' && pool.group_id && <button type="button" className="btn btn-outline" onClick={() => openInvite(pool.group_id ?? '')}>生成邀请码</button>}
                  {pool.role === 'owner' && <button type="button" className="btn btn-outline" onClick={() => void openManageMembers(pool.group_id ?? '')}>管理成员</button>}
                  {pool.role === 'owner' && <button type="button" className="btn btn-outline" onClick={() => void openTransfer(pool.group_id ?? '')}>转让创建者</button>}
                  {pool.role === 'owner' && <button type="button" className="btn btn-outline btn-danger" onClick={() => void removeGroup(pool.id, pool.name)}>删除共享池</button>}
                  {pool.role !== 'owner' && pool.group_id && <button type="button" className="btn btn-outline btn-danger" onClick={() => void leaveGroup(pool.group_id ?? '', pool.name)}>退出</button>}
                </div>
                <div className="pool-card-events">
                  <h3 className="pool-events-title">池内动态</h3>
                  {poolEvents.length === 0 ? (
                    <p className="pool-events-empty">暂无动态</p>
                  ) : (
                    <ul className="pool-events-list">
                      {poolEvents.map((ev, i) => {
                        const status = ev.action === 'copied'
                          ? (ev.job_id ? `${ev.actor_name} 新增了岗位` : `${ev.actor_name} 新增了 ${(JSON.parse(ev.changed_fields_json || '{}') as { count?: number }).count ?? 0} 条岗位`)
                          : `${ev.actor_name} 修改了岗位信息`
                        return (
                          <li key={i} className="pool-event-item">
                            <span className="pool-event-status">{status}</span>
                            <span className="pool-event-time">{new Date(ev.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          )
        })}
        {inviteGroupId && (
          <div className="modal-overlay" onClick={() => setInviteGroupId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="section-title">生成邀请码</h2>
              <p className="page-desc">设置该邀请码的使用次数与有效期（按创建者账户计）。</p>
              <label className="pool-field-label">使用次数<input className="field-input" type="number" min={1} value={inviteSettings.maxUses} onChange={(event) => setInviteSettings((s) => ({ ...s, maxUses: Number(event.target.value) }))} /></label>
              <label className="pool-field-label">有效期（天）<input className="field-input" type="number" min={1} value={inviteSettings.expiresInDays} onChange={(event) => setInviteSettings((s) => ({ ...s, expiresInDays: Number(event.target.value) }))} /></label>
              <div className="modal-actions"><button type="button" className="btn" onClick={() => void generateCode()}>生成</button><button type="button" className="btn btn-outline" onClick={() => setInviteGroupId(null)}>取消</button></div>
            </div>
          </div>
        )}
        {transferGroupId && (
          <div className="modal-overlay" onClick={() => setTransferGroupId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="section-title">转让创建者权限</h2>
              <p className="page-desc">选择一名成员成为新创建者，你将在转让后变为可编辑成员。</p>
              <div className="member-list">
                {members.filter((member) => member.role !== 'owner').map((member) => (
                  <button type="button" key={member.id} className="btn btn-outline member-pick" onClick={() => void confirmTransfer(transferGroupId, member.id)}>{member.name}</button>
                ))}
              </div>
              <div className="modal-actions"><button type="button" className="btn" onClick={() => setTransferGroupId(null)}>取消</button></div>
            </div>
          </div>
        )}
        {manageGroupId && (
          <div className="modal-overlay" onClick={() => setManageGroupId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="section-title">成员管理</h2>
              <p className="page-desc">{capacityText(groupMeta.memberCount)}</p>
              <div className="member-manage-list">
                {members.map((member) => (
                  <div className="member-manage-row" key={member.id}>
                    <span>{member.name}{member.role === 'owner' ? '（群主）' : member.role === 'editor' ? '（可编辑）' : '（仅查看）'}</span>
                    {member.role !== 'owner' && (
                      <span className="member-manage-actions">
                        <button
                          type="button"
                          className={`btn btn-sm ${member.role === 'editor' ? 'btn-ready' : 'btn-outline'}`}
                          onClick={() => void changeMemberRole(manageGroupId, member.id, 'editor')}
                        >
                          可编辑
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${member.role === 'viewer' ? 'btn-ready' : 'btn-outline'}`}
                          onClick={() => void changeMemberRole(manageGroupId, member.id, 'viewer')}
                        >
                          仅查看
                        </button>
                        <button type="button" className="btn btn-outline btn-danger btn-sm" onClick={() => void removeMember(manageGroupId, member.id, member.name)}>移除</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="modal-actions"><button type="button" className="btn" onClick={() => setManageGroupId(null)}>关闭</button></div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

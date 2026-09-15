interface Env {
  DB: D1Database
  BACKUP_SIGNING_KEY?: string
  LEGACY_BACKUP_MIGRATION_HASH?: string
}

const WORKSPACE_DOCUMENT_KEYS = new Set([
  'tasks', 'sticky-notes', 'profile', 'application-events', 'motto',
  'custom-tags', 'job-note-tags', 'app-view', 'workspace-preferences',
])

interface UserRow {
  id: string
  email: string
  username: string
  display_name: string
  password_hash: string
  password_salt: string
}

interface SessionUser {
  id: string
  email: string
  username: string
  displayName: string
  createdAt: string
}

interface JobInput {
  companyName: string
  jobTitle: string
  [key: string]: unknown
}

const SESSION_COOKIE = 'w8pool_session'
const SESSION_DAYS = 30
const MAX_WORKSPACE_DOCUMENT_CHARS = 1_800_000
const MAX_VERSION_DOCUMENT_CHARS = 800_000
const MAX_ACCOUNT_SNAPSHOT_CHARS = 1_800_000
const MAX_IMPORT_ADDED_JOBS = 500
const MAX_IMPORT_CANDIDATES = 3000
const MAX_ACCOUNT_SNAPSHOTS = 6
const SNAPSHOT_RETENTION_HOURS = 48
const TRASH_RETENTION_DAYS = 7
const MAX_TRASH_JOBS = 200
const MAX_APPLICATION_EVENTS = 1000
const ACHIEVEMENT_DETAIL_RETENTION_DAYS = 30
const MAX_PERSONAL_NOTE_CHARS = 100
const encoder = new TextEncoder()
const PRIVATE_OR_SYSTEM_JOB_FIELDS = new Set([
  'id',
  'no',
  'importedAt',
  'createdAt',
  'updatedAt',
  'applicationStatus',
  'screeningStatus',
  'priority',
  'appliedAt',
  'notes',
])

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(data), { ...init, headers })
}

function now(): string {
  return new Date().toISOString()
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function error(message: string, status = 400): Response {
  return json({ error: message }, { status })
}

function isTooBigError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err)
  return text.includes('SQLITE_TOOBIG') || text.includes('string or blob too big')
}

function normalizeWorkspaceDocumentData(documentKey: string, data: unknown): unknown {
  if (documentKey === 'application-events' && Array.isArray(data)) {
    return data.slice(-MAX_APPLICATION_EVENTS)
  }
  return data
}

function parseCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>()
  const raw = request.headers.get('Cookie') ?? ''
  for (const part of raw.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name && value.length > 0) cookies.set(name, decodeURIComponent(value.join('=')))
  }
  return cookies
}

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += String.fromCharCode(byte)
  return btoa(out)
}

function fromBase64(value: string): Uint8Array {
  const raw = atob(value)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return toBase64(new Uint8Array(digest))
}

async function hmacSha256(keyValue: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(keyValue),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return toBase64(new Uint8Array(signature))
}

async function backupSigningKey(env: Env, userId: string): Promise<string | null> {
  if (env.BACKUP_SIGNING_KEY) return env.BACKUP_SIGNING_KEY
  // 本地开发未配置专用密钥时，仍以仅服务端可见的密码哈希作为账户级密钥。
  const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?1').bind(userId).first<{ password_hash: string }>()
  return row?.password_hash ? `${userId}:${row.password_hash}` : null
}

function backupSignaturePayload(userId: string, issuedAt: string, payloadHash: string): string {
  return `w8pool-account-backup:v2:${userId}:${issuedAt}:${payloadHash}`
}

async function passwordHash(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64(salt), iterations: 100000, hash: 'SHA-256' },
    key,
    256,
  )
  return toBase64(new Uint8Array(bits))
}

function cookieSecurity(request: Request): string {
  return new URL(request.url).protocol === 'https:' ? '; Secure' : ''
}

function sessionCookie(token: string, expiresAt: string, request: Request): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${cookieSecurity(request)}; Expires=${new Date(expiresAt).toUTCString()}`
}

function clearSessionCookie(request: Request): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${cookieSecurity(request)}; Max-Age=0`
}

async function getUser(request: Request, env: Env): Promise<SessionUser | null> {
  const token = parseCookies(request).get(SESSION_COOKIE)
  if (!token) return null
  const tokenHash = await sha256(token)
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.username, users.display_name, users.created_at
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?1 AND sessions.expires_at > ?2`,
  )
    .bind(tokenHash, now())
    .first<{ id: string; email: string; username: string; display_name: string; created_at: string }>()
  if (!row) return null
  return { id: row.id, email: row.email, username: row.username, displayName: row.display_name, createdAt: row.created_at }
}

async function requireUser(request: Request, env: Env): Promise<SessionUser | Response> {
  const user = await getUser(request, env)
  return user ?? error('请先登录', 401)
}

function isResponse(value: SessionUser | Response): value is Response {
  return value instanceof Response
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

async function logActivity(
  env: Env,
  userId: string,
  type: string,
  targetType: string,
  targetId: string | null,
  targetTitle: string | null,
  summary: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await env.DB.prepare(
      'INSERT INTO personal_activity_logs (id, user_id, type, target_type, target_id, target_title, summary, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), userId, type, targetType, targetId, targetTitle, summary, JSON.stringify(metadata), now())
      .run()
  } catch (err) {
    console.error('Failed to write personal activity log', { userId, type, targetType, targetId, err })
  }
}

function parseActivityMetadata(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function metadataCount(metadata: Record<string, unknown>, keys: string[], fallback = 1): number {
  for (const key of keys) {
    const value = metadata[key]
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(n) && n > 0) return Math.trunc(n)
  }
  return fallback
}

function emptyAchievementSummary() {
  return {
    addedJobs: 0,
    importedJobs: 0,
    sharedJobs: 0,
    screeningActions: 0,
    progressUpdates: 0,
    completedTasks: 0,
    noteOrTagUpdates: 0,
    totalActions: 0,
  }
}

function addToAchievementSummary(summary: ReturnType<typeof emptyAchievementSummary>, type: unknown, metadata: Record<string, unknown>) {
  if (type === 'job-created') summary.addedJobs += 1
  else if (type === 'job-imported') {
    const count = metadataCount(metadata, ['added', 'count'])
    summary.importedJobs += count
    summary.addedJobs += count
  } else if (type === 'job-copied-to-personal') summary.addedJobs += metadataCount(metadata, ['count'])
  else if (type === 'job-shared-to-group') summary.sharedJobs += metadataCount(metadata, ['count', 'copied', 'added'])
  else if (type === 'job-screening-changed') summary.screeningActions += metadataCount(metadata, ['count'])
  else if (type === 'job-progress-changed') summary.progressUpdates += metadataCount(metadata, ['count'])
  else if (type === 'job-priority-changed') summary.noteOrTagUpdates += metadataCount(metadata, ['count'])
  else if (type === 'task-completed') summary.completedTasks += metadataCount(metadata, ['count'])
  else if (type === 'job-note-updated' || type === 'job-tags-updated') summary.noteOrTagUpdates += metadataCount(metadata, ['count'])
  summary.totalActions = summary.addedJobs + summary.sharedJobs + summary.screeningActions + summary.progressUpdates + summary.completedTasks + summary.noteOrTagUpdates
}

function normalizeJobInput(value: unknown): JobInput | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  const companyName = typeof input.companyName === 'string' ? input.companyName.trim() : ''
  const jobTitle = typeof input.jobTitle === 'string' ? input.jobTitle.trim() : ''
  if (!companyName || !jobTitle) return null
  const shared = Object.fromEntries(
    Object.entries(input).filter(([key]) => !PRIVATE_OR_SYSTEM_JOB_FIELDS.has(key)),
  )
  return { ...shared, companyName, jobTitle }
}

function diff(before: JobInput, after: JobInput): Record<string, { before: unknown; after: unknown }> {
  const result: Record<string, { before: unknown; after: unknown }> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      result[key] = { before: before[key] ?? '', after: after[key] ?? '' }
    }
  }
  return result
}

function jobSignature(job: JobInput): string {
  const company = job.companyName.trim().toLowerCase()
  const title = job.jobTitle.trim().toLowerCase()
  return `${company}||${title}`
}

function jobTitleFromPayload(payloadJson: string | null | undefined): string | null {
  if (!payloadJson) return null
  try {
    const payload = JSON.parse(payloadJson) as { companyName?: unknown; jobTitle?: unknown }
    const companyName = typeof payload.companyName === 'string' ? payload.companyName.trim() : ''
    const jobTitle = typeof payload.jobTitle === 'string' ? payload.jobTitle.trim() : ''
    if (companyName && jobTitle) return `${companyName} · ${jobTitle}`
    return companyName || jobTitle || null
  } catch {
    return null
  }
}

async function personalPoolId(env: Env, userId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT id FROM job_pools WHERE kind = 'personal' AND owner_user_id = ?1",
  )
    .bind(userId)
    .first<{ id: string }>()
  return row?.id ?? null
}

async function resolvePoolId(env: Env, userId: string, poolId: string): Promise<string | null> {
  if (poolId !== 'me') return poolId
  return await personalPoolId(env, userId)
}

async function createSession(env: Env, userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32)))
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  const createdAt = now()
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)',
  )
    .bind(crypto.randomUUID(), userId, await sha256(token), expiresAt, createdAt)
    .run()
  return { token, expiresAt }
}

async function register(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ email?: string; username?: string; password?: string; inviteCode?: string }>(request)
  const email = body?.email?.trim().toLowerCase() ?? ''
  const username = body?.username?.trim() ?? ''
  const password = body?.password ?? ''
  const inviteCode = body?.inviteCode?.trim() ?? ''
  if (!/^\S+@\S+\.\S+$/.test(email)) return error('请输入有效邮箱')
  if (!/^[\p{L}\p{N}_-]{3,32}$/u.test(username)) return error('用户名格式不正确')
  if (password.length < 12) return error('密码至少需要 12 个字符')
  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?1 OR username = ?2 COLLATE NOCASE')
    .bind(email, username)
    .first()
  if (exists) return error('该邮箱已注册', 409)

  const userId = crypto.randomUUID()
  const poolId = crypto.randomUUID()
  const createdAt = now()
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)))
  const hash = await passwordHash(password, salt)
  if (inviteCode) {
    const inviteHash = await sha256(inviteCode)
    const inviteResult = await env.DB.batch([
      env.DB.prepare(
        'UPDATE registration_invites SET claim_token = ?1 WHERE token_hash = ?2 AND used_at IS NULL AND claim_token IS NULL',
      ).bind(userId, inviteHash),
      env.DB.prepare(
        `INSERT INTO users (id, email, username, display_name, password_hash, password_salt, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?3, ?4, ?5, ?6, ?6
         WHERE EXISTS (SELECT 1 FROM registration_invites WHERE token_hash = ?7 AND claim_token = ?1)`,
      ).bind(userId, email, username, hash, salt, createdAt, inviteHash),
      env.DB.prepare(
        `INSERT INTO job_pools (id, name, kind, owner_user_id, created_at, updated_at)
         SELECT ?1, '我的岗位池', 'personal', ?2, ?3, ?3
         WHERE EXISTS (SELECT 1 FROM users WHERE id = ?2)`,
      ).bind(poolId, userId, createdAt),
      env.DB.prepare(
        'UPDATE registration_invites SET used_at = ?1, used_by_user_id = ?2 WHERE token_hash = ?3 AND claim_token = ?2',
      ).bind(createdAt, userId, inviteHash),
    ])
    if (inviteResult[0].meta.changes !== 1) return error('邀请码无效或已被使用', 403)
  } else {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO users (id, email, username, display_name, password_hash, password_salt, created_at, updated_at) VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?6)',
      ).bind(userId, email, username, hash, salt, createdAt),
      env.DB.prepare(
        "INSERT INTO job_pools (id, name, kind, owner_user_id, created_at, updated_at) VALUES (?1, '我的岗位池', 'personal', ?2, ?3, ?3)",
      ).bind(poolId, userId, createdAt),
    ])
  }
  const session = await createSession(env, userId)
  return json(
    { user: { id: userId, email, username, displayName: username, createdAt }, personalPoolId: poolId },
    { status: 201, headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt, request) } },
  )
}

async function login(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ username?: string; password?: string }>(request)
  const username = body?.username?.trim() ?? ''
  const password = body?.password ?? ''
  const user = await env.DB.prepare(
    'SELECT id, email, username, display_name, created_at, password_hash, password_salt FROM users WHERE username = ?1 COLLATE NOCASE',
  )
    .bind(username)
    .first<UserRow & { created_at: string }>()
  if (!user) return error('邮箱或密码错误', 401)
  const candidate = await passwordHash(password, user.password_salt)
  if (candidate !== user.password_hash) return error('邮箱或密码错误', 401)
  const session = await createSession(env, user.id)
  const personalPool = await personalPoolId(env, user.id)
  return json(
    { user: { id: user.id, email: user.email, username: user.username, displayName: user.display_name, createdAt: user.created_at }, personalPoolId: personalPool },
    { headers: { 'Set-Cookie': sessionCookie(session.token, session.expiresAt, request) } },
  )
}

async function listPools(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const pools = await env.DB.prepare(
    `SELECT job_pools.id, job_pools.name, job_pools.kind, job_pools.group_id, job_pools.next_job_no,
            job_pools.created_at, job_pools.updated_at, 'owner' AS role, 0 AS unread_count,
            1 AS member_count,
            (SELECT COUNT(*) FROM jobs WHERE jobs.pool_id = job_pools.id AND jobs.deleted_at IS NULL) AS job_count
     FROM job_pools WHERE job_pools.kind = 'personal' AND job_pools.owner_user_id = ?1
     UNION ALL
     SELECT job_pools.id, job_pools.name, job_pools.kind, job_pools.group_id, job_pools.next_job_no,
            job_pools.created_at, job_pools.updated_at, group_members.role,
            (SELECT COUNT(*) FROM job_events WHERE job_events.pool_id = job_pools.id AND job_events.created_at > COALESCE((SELECT last_seen_at FROM pool_views WHERE pool_views.user_id = ?2 AND pool_views.pool_id = job_pools.id), '1970-01-01')) AS unread_count,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = job_pools.group_id) AS member_count,
            (SELECT COUNT(*) FROM jobs WHERE jobs.pool_id = job_pools.id AND jobs.deleted_at IS NULL) AS job_count
     FROM job_pools JOIN group_members ON group_members.group_id = job_pools.group_id
     LEFT JOIN groups ON groups.id = job_pools.group_id
     WHERE job_pools.kind = 'group' AND group_members.user_id = ?1
     ORDER BY kind, name`,
  )
    .bind(required.id, required.id)
    .all()
  return json({ pools: pools.results })
}

async function poolRole(env: Env, poolId: string, userId: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  const pool = await env.DB.prepare(
    `SELECT CASE
       WHEN job_pools.kind = 'personal' AND job_pools.owner_user_id = ?2 THEN 'owner'
       ELSE group_members.role
     END AS role
     FROM job_pools LEFT JOIN group_members
       ON group_members.group_id = job_pools.group_id AND group_members.user_id = ?2
     WHERE job_pools.id = ?1`,
  )
    .bind(poolId, userId)
    .first<{ role: 'owner' | 'editor' | 'viewer' | null }>()
  return pool?.role ?? null
}

async function listJobs(request: Request, env: Env, poolId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  if (!(await poolRole(env, poolId, required.id))) return error('无权访问该岗位池', 403)
  const jobs = await env.DB.prepare(
    `SELECT jobs.id, jobs.no, jobs.pool_id, jobs.payload_json, jobs.revision, jobs.created_at, jobs.updated_at,
            jobs.added_at, jobs.added_by_user_id, added_by_user.username AS added_by_name,
            CASE WHEN job_pools.kind = 'personal' THEN user_job_states.screening_status END AS screening_status,
            CASE WHEN job_pools.kind = 'personal' THEN user_job_states.application_status END AS application_status,
            CASE WHEN job_pools.kind = 'personal' THEN user_job_states.priority END AS priority,
            CASE WHEN job_pools.kind = 'personal' THEN user_job_states.applied_at END AS applied_at,
            CASE WHEN job_pools.kind = 'personal' THEN user_job_states.personal_notes END AS personal_notes,
            CASE WHEN job_pools.kind = 'personal' THEN user_job_states.revision END AS state_revision,
            (SELECT 1 FROM job_copy_map WHERE job_copy_map.user_id = ?1 AND job_copy_map.source_job_id = jobs.id) IS NOT NULL AS copied_to_personal
     FROM jobs JOIN job_pools ON job_pools.id = jobs.pool_id
     LEFT JOIN users AS added_by_user ON added_by_user.id = jobs.added_by_user_id
     LEFT JOIN user_job_states ON user_job_states.job_id = jobs.id AND user_job_states.user_id = ?1
     WHERE jobs.pool_id = ?2 AND jobs.deleted_at IS NULL ORDER BY jobs.no ASC`,
  )
    .bind(required.id, poolId)
    .all()
  return json({ jobs: jobs.results })
}

async function createJob(request: Request, env: Env, poolId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const role = await poolRole(env, poolId, required.id)
  const isPersonalPool = role === 'owner' && poolId === (await personalPoolId(env, required.id))
  if (!isPersonalPool) return error('岗位只能新增到自己的个人岗位池', 403)
  const input = normalizeJobInput(await readJson<unknown>(request))
  if (!input) return error('企业名称和岗位名称不能为空')
  const pool = await env.DB.prepare('SELECT next_job_no FROM job_pools WHERE id = ?1')
    .bind(poolId)
    .first<{ next_job_no: number }>()
  if (!pool) return error('岗位池不存在', 404)
  const jobId = crypto.randomUUID()
  const timestamp = now()
  const jobNo = pool.next_job_no
  const snapshot = { ...input, id: jobId, no: jobNo }
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO jobs (id, pool_id, no, company_name, job_title, payload_json, created_by, updated_by, created_at, updated_at, added_at, added_by_user_id, source_pool_id, source_job_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, ?8, ?9, ?10, ?11, ?12)',
      ).bind(jobId, poolId, jobNo, input.companyName, input.jobTitle, JSON.stringify(snapshot), required.id, timestamp, timestamp, required.id, null, null),
    env.DB.prepare('UPDATE job_pools SET next_job_no = next_job_no + 1, updated_at = ?1 WHERE id = ?2')
      .bind(timestamp, poolId),
    env.DB.prepare(
      "INSERT INTO job_events (id, pool_id, job_id, actor_user_id, action, revision, changed_fields_json, after_snapshot_json, created_at) VALUES (?1, ?2, ?3, ?4, 'created', 1, ?5, ?6, ?7)",
    ).bind(crypto.randomUUID(), poolId, jobId, required.id, JSON.stringify({}), JSON.stringify(snapshot), timestamp),
    env.DB.prepare(
      "INSERT INTO user_job_states (user_id, job_id, screening_status, application_status, priority, applied_at, personal_notes, created_at, updated_at) VALUES (?1, ?2, 'to_review', 'pending', 0, '', '', ?3, ?3)",
    ).bind(required.id, jobId, timestamp),
  ])
  await logActivity(env, required.id, 'job-created', 'job', jobId, `${input.companyName} · ${input.jobTitle}`, `新增岗位：${input.companyName} · ${input.jobTitle}`)
  return json({ job: snapshot, revision: 1 }, { status: 201 })
}

async function importPersonalJobs(request: Request, env: Env, poolId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const isPersonalPool = poolId === (await personalPoolId(env, required.id))
  if (!isPersonalPool) return error('旧数据只能导入自己的个人岗位池', 403)
  const body = await readJson<{ applications?: unknown[]; skipDuplicates?: boolean }>(request)
  const skipDuplicates = body?.skipDuplicates !== false
  const applications = body?.applications
  if (!Array.isArray(applications) || applications.length === 0) return error('未找到可导入的岗位数据')
  if (applications.length > MAX_IMPORT_CANDIDATES) return error(`单次最多校验 ${MAX_IMPORT_CANDIDATES} 条候选岗位；如文件更大，请先分批导入。`)
  // 批量导入前始终保存完整快照，便于发现数据异常时回到导入前。
  await createAccountSnapshot(env, required.id, 'before-import')
  const existing = await env.DB.prepare('SELECT id, payload_json FROM jobs WHERE pool_id = ?1 AND deleted_at IS NULL')
    .bind(poolId)
    .all<{ id: string; payload_json: string }>()
  const existingIds = new Map<string, string>()
  for (const row of existing.results) {
    const normalized = normalizeJobInput(JSON.parse(row.payload_json) as unknown)
    if (normalized) existingIds.set(jobSignature(normalized), row.id)
  }
  const pool = await env.DB.prepare('SELECT next_job_no FROM job_pools WHERE id = ?1').bind(poolId).first<{ next_job_no: number }>()
  if (!pool) return error('岗位池不存在', 404)
  const statements: D1PreparedStatement[] = []
  const timestamp = now()
  let nextNo = pool.next_job_no
  let added = 0
  let skipped = 0
  let restoredStates = 0
  const importedJobIds: string[] = []
  for (const raw of applications) {
    const input = normalizeJobInput(raw)
    if (!input) continue
    const existingId = existingIds.get(jobSignature(input))
    let jobId: string
    if (existingId && skipDuplicates) {
      // 重复岗位只跳过岗位本身还不够：绝不能把导入文件里的默认状态写回，
      // 否则会覆盖用户已做的筛选、投递、星级与备注。
      skipped++
      continue
    } else {
      if (added >= MAX_IMPORT_ADDED_JOBS) {
        return error(`单次最多新增 ${MAX_IMPORT_ADDED_JOBS} 条岗位。当前文件可新增岗位超过上限，请拆分文件后分批导入。`)
      }
      jobId = crypto.randomUUID()
      const snapshot = { ...input, id: jobId, no: nextNo }
      statements.push(
        env.DB.prepare(
          'INSERT INTO jobs (id, pool_id, no, company_name, job_title, payload_json, created_by, updated_by, created_at, updated_at, added_at, added_by_user_id, source_pool_id, source_job_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, ?8, ?9, ?10, ?11, ?12)',
        ).bind(jobId, poolId, nextNo, input.companyName, input.jobTitle, JSON.stringify(snapshot), required.id, timestamp, timestamp, required.id, null, null),
        env.DB.prepare(
          "INSERT INTO job_events (id, pool_id, job_id, actor_user_id, action, revision, changed_fields_json, after_snapshot_json, created_at) VALUES (?1, ?2, ?3, ?4, 'created', 1, ?5, ?6, ?7)",
        ).bind(crypto.randomUUID(), poolId, jobId, required.id, JSON.stringify({ imported: true }), JSON.stringify(snapshot), timestamp),
      )
      if (!existingId) existingIds.set(jobSignature(input), jobId)
      importedJobIds.push(jobId)
      nextNo++
      added++
    }
    const rawApp = raw as Record<string, unknown>
    const screening = ['to_review', 'maybe', 'selected', 'skipped'].includes(String(rawApp.screeningStatus)) ? String(rawApp.screeningStatus) : 'to_review'
    const application = ['pending', 'submitted', 'written_test', 'interview', 'offer', 'rejected'].includes(String(rawApp.applicationStatus)) ? String(rawApp.applicationStatus) : 'pending'
    const priority = Number.isInteger(rawApp.priority) && Number(rawApp.priority) >= 0 && Number(rawApp.priority) <= 5 ? Number(rawApp.priority) : 0
    statements.push(
      env.DB.prepare(
        `INSERT INTO user_job_states (user_id, job_id, screening_status, application_status, priority, applied_at, personal_notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
      ).bind(required.id, jobId, screening, application, priority, String(rawApp.appliedAt ?? ''), String(rawApp.notes ?? '').slice(0, MAX_PERSONAL_NOTE_CHARS), timestamp),
    )
    restoredStates++
  }
  if (added > 0) statements.push(env.DB.prepare('UPDATE job_pools SET next_job_no = ?1, updated_at = ?2 WHERE id = ?3').bind(nextNo, timestamp, poolId))
  if (statements.length > 0) await env.DB.batch(statements)
  if (added > 0) await logActivity(env, required.id, 'job-imported', 'job', null, `批量导入 ${added} 条`, `批量导入：新增 ${added} 条，拦截重复 ${skipped} 条`, { added, skipped, restoredStates })
  return json({ added, skipped, restoredStates, importedJobIds })
}

async function createGroup(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const body = await readJson<{ name?: string }>(request)
  const name = body?.name?.trim() ?? ''
  if (!name || name.length > 80) return error('群组名称需为 1–80 个字符')
  const groupId = crypto.randomUUID()
  const poolId = crypto.randomUUID()
  const timestamp = now()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO groups (id, name, created_by, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)')
      .bind(groupId, name, required.id, timestamp),
    env.DB.prepare("INSERT INTO job_pools (id, name, kind, group_id, created_at, updated_at) VALUES (?1, ?2, 'group', ?3, ?4, ?4)")
      .bind(poolId, name, groupId, timestamp),
    env.DB.prepare("INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?1, ?2, 'owner', ?3)")
      .bind(groupId, required.id, timestamp),
  ])
  const inviteCode = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  await env.DB.prepare(
    "INSERT INTO group_invites (id, group_id, token_hash, role, expires_at, max_uses, created_by, created_at) VALUES (?1, ?2, ?3, 'editor', ?4, 100, ?5, ?6)",
  ).bind(crypto.randomUUID(), groupId, await sha256(inviteCode), expiresAt, required.id, timestamp).run()
  return json({ group: { id: groupId, name, poolId, role: 'owner' }, inviteCode }, { status: 201 })
}

async function createGroupInvite(request: Request, env: Env, groupId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const membership = await env.DB.prepare('SELECT role FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, required.id)
    .first<{ role: 'owner' | 'editor' | 'viewer' }>()
  if (membership?.role !== 'owner') return error('只有创建者可以生成邀请码', 403)
  const body = await readJson<{ maxUses?: unknown; expiresInDays?: unknown }>(request)
  const maxUses = clampInt(body?.maxUses, 1, 100000, 1)
  const expiresInDays = clampInt(body?.expiresInDays, 1, 3650, 7)
  const inviteCode = crypto.randomUUID()
  const timestamp = now()
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
  await env.DB.prepare(
    "INSERT INTO group_invites (id, group_id, token_hash, role, expires_at, max_uses, created_by, created_at) VALUES (?1, ?2, ?3, 'editor', ?4, ?5, ?6, ?7)",
  ).bind(crypto.randomUUID(), groupId, await sha256(inviteCode), expiresAt, maxUses, required.id, timestamp).run()
  return json({ inviteCode, expiresAt, maxUses, expiresInDays })
}

async function joinGroup(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const body = await readJson<{ inviteCode?: string }>(request)
  const inviteCode = body?.inviteCode?.trim() ?? ''
  if (!inviteCode) return error('请输入邀请码')
  const invite = await env.DB.prepare(
    'SELECT group_id, role, expires_at, max_uses, used_count, revoked_at FROM group_invites WHERE token_hash = ?1',
  ).bind(await sha256(inviteCode)).first<{
    group_id: string
    role: 'editor' | 'viewer'
    expires_at: string
    max_uses: number
    used_count: number
    revoked_at: string | null
  }>()
  if (!invite || invite.revoked_at || invite.expires_at <= now() || invite.used_count >= invite.max_uses) {
    return error('邀请码无效、已过期或使用次数已满', 404)
  }
  const exists = await env.DB.prepare('SELECT 1 AS exists_member FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(invite.group_id, required.id)
    .first<{ exists_member: number }>()
  if (!exists) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?1, ?2, ?3, ?4)')
        .bind(invite.group_id, required.id, invite.role, now()),
      env.DB.prepare('UPDATE group_invites SET used_count = used_count + 1 WHERE token_hash = ?1')
        .bind(await sha256(inviteCode)),
    ])
  }
  return json({ ok: true })
}

async function leaveGroup(request: Request, env: Env, groupId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const membership = await env.DB.prepare('SELECT role FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, required.id)
    .first<{ role: 'owner' | 'editor' | 'viewer' }>()
  if (!membership) return error('你不在该协作岗位池中', 404)
  if (membership.role === 'owner') return error('创建者暂不能退出，请先转让创建者权限', 400)
  await env.DB.prepare('DELETE FROM group_members WHERE group_id = ?1 AND user_id = ?2').bind(groupId, required.id).run()
  return json({ ok: true })
}

async function copyJob(request: Request, env: Env, targetPoolId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const targetRole = await poolRole(env, targetPoolId, required.id)
  if (targetRole !== 'owner' && targetRole !== 'editor') return error('无权复制到该岗位池', 403)
  const body = await readJson<{ sourceJobId?: string }>(request)
  const sourceJobId = body?.sourceJobId ?? ''
  const source = await env.DB.prepare(
    'SELECT id, pool_id, payload_json FROM jobs WHERE id = ?1 AND deleted_at IS NULL',
  )
    .bind(sourceJobId)
    .first<{ id: string; pool_id: string; payload_json: string }>()
  const personalPool = await personalPoolId(env, required.id)
  const targetIsPersonal = targetPoolId === personalPool
  const sourceRole = source ? await poolRole(env, source.pool_id, required.id) : null
  if (!source || !sourceRole) return error('无权复制来源岗位', 403)
  if (targetIsPersonal && source.pool_id === personalPool) return error('岗位已在你的个人岗位池中', 400)
  if (!targetIsPersonal && source.pool_id !== personalPool) return error('协作岗位池只能从个人岗位池复制岗位', 403)
  const input = normalizeJobInput(JSON.parse(source.payload_json) as unknown)
  if (!input) return error('来源岗位数据无效')
  const targetPool = await env.DB.prepare('SELECT next_job_no FROM job_pools WHERE id = ?1')
    .bind(targetPoolId)
    .first<{ next_job_no: number }>()
  if (!targetPool) return error('目标岗位池不存在', 404)
  const jobId = crypto.randomUUID()
  const timestamp = now()
  const jobNo = targetPool.next_job_no
  const snapshot = { ...input, id: jobId, no: jobNo }
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      'INSERT INTO jobs (id, pool_id, no, company_name, job_title, payload_json, created_by, updated_by, created_at, updated_at, added_at, added_by_user_id, source_pool_id, source_job_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)',
      ).bind(jobId, targetPoolId, jobNo, input.companyName, input.jobTitle, JSON.stringify(snapshot), required.id, required.id, timestamp, timestamp, timestamp, required.id, source.pool_id, sourceJobId),
    env.DB.prepare('UPDATE job_pools SET next_job_no = next_job_no + 1, updated_at = ?1 WHERE id = ?2')
      .bind(timestamp, targetPoolId),
  ]
  if (targetIsPersonal) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO user_job_states (user_id, job_id, screening_status, application_status, priority, applied_at, personal_notes, created_at, updated_at) VALUES (?1, ?2, 'to_review', 'pending', 0, '', '', ?3, ?3)",
      ).bind(required.id, jobId, timestamp),
    )
    statements.push(
      env.DB.prepare(
        'INSERT OR IGNORE INTO job_copy_map (user_id, source_job_id, target_job_id, created_at) VALUES (?1, ?2, ?3, ?4)',
      ).bind(required.id, sourceJobId, jobId, timestamp),
    )
    statements.push(
      env.DB.prepare(
        'INSERT OR IGNORE INTO user_job_copies (user_id, source_group_job_id, source_pool_id, personal_job_id, copied_at) VALUES (?1, ?2, ?3, ?4, ?5)',
      ).bind(required.id, sourceJobId, source.pool_id, jobId, timestamp),
    )
  } else {
    statements.push(
      env.DB.prepare(
        "INSERT INTO job_events (id, pool_id, job_id, actor_user_id, action, revision, changed_fields_json, after_snapshot_json, created_at) VALUES (?1, ?2, ?3, ?4, 'copied', 1, ?5, ?6, ?7)",
      ).bind(crypto.randomUUID(), targetPoolId, jobId, required.id, JSON.stringify({}), JSON.stringify(snapshot), timestamp),
    )
  }
  await env.DB.batch(statements)
  await logActivity(env, required.id, 'job-copied-to-personal', 'job', jobId, `${sourceSnapshot.companyName} · ${sourceSnapshot.jobTitle}`, `从群组池纳入：${sourceSnapshot.companyName} · ${sourceSnapshot.jobTitle}`)
  return json({ job: snapshot, revision: 1 }, { status: 201 })
}

async function updateJob(request: Request, env: Env, poolId: string, jobId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const role = await poolRole(env, poolId, required.id)
  if (role !== 'owner' && role !== 'editor') return error('无权编辑该岗位', 403)
  const body = await readJson<{ revision?: number; job?: unknown }>(request)
  const revision = body?.revision
  const after = normalizeJobInput(body?.job)
  if (!Number.isInteger(revision) || !after) return error('岗位数据或版本号无效')
  const job = await env.DB.prepare(
    'SELECT jobs.payload_json, jobs.revision, jobs.deleted_at, job_pools.kind FROM jobs JOIN job_pools ON job_pools.id = jobs.pool_id WHERE jobs.id = ?1 AND jobs.pool_id = ?2',
  )
    .bind(jobId, poolId)
    .first<{ payload_json: string; revision: number; deleted_at: string | null; kind: 'personal' | 'group' }>()
  if (!job || job.deleted_at) return error('未找到岗位', 404)
  if (job.revision !== revision) return error('岗位已被他人更新，请刷新后重试', 409)
  const before = normalizeJobInput(JSON.parse(job.payload_json) as unknown)
  if (!before) return error('岗位历史数据无效', 500)
  const changedFields = diff(before, after)
  if (Object.keys(changedFields).length === 0) return json({ job: before, revision: job.revision })
  const nextRevision = job.revision + 1
  const timestamp = now()
  const snapshot = { ...after, id: jobId }
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE jobs SET company_name = ?1, job_title = ?2, payload_json = ?3, revision = ?4, updated_by = ?5, updated_at = ?6 WHERE id = ?7 AND pool_id = ?8 AND revision = ?9',
    ).bind(after.companyName, after.jobTitle, JSON.stringify(snapshot), nextRevision, required.id, timestamp, jobId, poolId, revision),
    env.DB.prepare(
      "INSERT INTO job_events (id, pool_id, job_id, actor_user_id, action, revision, changed_fields_json, before_snapshot_json, after_snapshot_json, created_at) VALUES (?1, ?2, ?3, ?4, 'updated', ?5, ?6, ?7, ?8, ?9)",
    ).bind(crypto.randomUUID(), poolId, jobId, required.id, nextRevision, JSON.stringify(changedFields), JSON.stringify(before), JSON.stringify(snapshot), timestamp),
  ])
  return json({ job: snapshot, revision: nextRevision })
}

async function deleteJob(request: Request, env: Env, poolId: string, jobId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const role = await poolRole(env, poolId, required.id)
  if (role !== 'owner' && role !== 'editor') return error('无权删除该岗位', 403)
  const job = await env.DB.prepare(
    'SELECT jobs.payload_json, jobs.revision, jobs.deleted_at, jobs.added_by_user_id, job_pools.kind FROM jobs JOIN job_pools ON job_pools.id = jobs.pool_id WHERE jobs.id = ?1 AND jobs.pool_id = ?2',
  )
    .bind(jobId, poolId)
    .first<{ payload_json: string; revision: number; deleted_at: string | null; added_by_user_id: string | null; kind: 'personal' | 'group' }>()
  if (!job || job.deleted_at) return error('未找到岗位', 404)
  if (job.kind === 'group' && job.added_by_user_id !== required.id) return error('只能删除由你添加到共享岗位池的岗位', 403)
  const snapshot = normalizeJobInput(JSON.parse(job.payload_json) as unknown)
  if (!snapshot) return error('岗位历史数据无效', 500)
  const nextRevision = job.revision + 1
  const timestamp = now()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('UPDATE jobs SET deleted_at = ?1, deleted_by = ?2, revision = ?3, updated_by = ?2, updated_at = ?1 WHERE id = ?4 AND pool_id = ?5')
      .bind(timestamp, required.id, nextRevision, jobId, poolId),
  ]
  if (job.kind === 'personal') statements.push(env.DB.prepare(
      "INSERT INTO job_events (id, pool_id, job_id, actor_user_id, action, revision, changed_fields_json, before_snapshot_json, created_at) VALUES (?1, ?2, ?3, ?4, 'deleted', ?5, ?6, ?7, ?8)",
    ).bind(crypto.randomUUID(), poolId, jobId, required.id, nextRevision, JSON.stringify({}), JSON.stringify(snapshot), timestamp))
  await env.DB.batch(statements)
  return json({ ok: true })
}

async function listJobEvents(request: Request, env: Env, poolId: string, jobId: string | null): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  if (!(await poolRole(env, poolId, required.id))) return error('无权查看编辑记录', 403)
  const query = jobId
    ? `SELECT job_events.*, users.display_name AS actor_name FROM job_events JOIN users ON users.id = job_events.actor_user_id WHERE job_events.pool_id = ?1 AND job_events.job_id = ?2 ORDER BY job_events.created_at DESC`
    : `SELECT job_events.*, users.display_name AS actor_name FROM job_events JOIN users ON users.id = job_events.actor_user_id WHERE job_events.pool_id = ?1 ORDER BY job_events.created_at DESC`
  const events = jobId
    ? await env.DB.prepare(query).bind(poolId, jobId).all()
    : await env.DB.prepare(query).bind(poolId).all()
  return json({ events: events.results })
}

async function updatePrivateState(request: Request, env: Env, jobId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const job = await env.DB.prepare('SELECT pool_id, payload_json FROM jobs WHERE id = ?1').bind(jobId).first<{ pool_id: string; payload_json: string }>()
  if (!job || !(await poolRole(env, job.pool_id, required.id))) return error('未找到可访问岗位', 404)
  const title = jobTitleFromPayload(job.payload_json)
  const body = await readJson<{
    screeningStatus?: 'to_review' | 'maybe' | 'selected' | 'skipped'
    applicationStatus?: 'pending' | 'submitted' | 'written_test' | 'interview' | 'offer' | 'rejected'
    priority?: number
    appliedAt?: string
    personalNotes?: string
    revision?: number
  }>(request)
  const state = body ?? {}
  const screening = state.screeningStatus ?? 'to_review'
  const application = state.applicationStatus ?? 'pending'
  const priority = state.priority ?? 0
  const personalNotes = String(state.personalNotes ?? '').slice(0, MAX_PERSONAL_NOTE_CHARS)
  if (!['to_review', 'maybe', 'selected', 'skipped'].includes(screening)) return error('筛选状态无效')
  if (!['pending', 'submitted', 'written_test', 'interview', 'offer', 'rejected'].includes(application)) return error('投递状态无效')
  if (!Number.isInteger(priority) || priority < 0 || priority > 5) return error('Priority 必须为 0–5')
  const current = await env.DB.prepare(
    'SELECT revision, screening_status, application_status, priority, applied_at, personal_notes FROM user_job_states WHERE user_id = ?1 AND job_id = ?2',
  ).bind(required.id, jobId).first<{ revision: number; screening_status: string; application_status: string; priority: number; applied_at: string; personal_notes: string }>()
  const expectedRevision = Number.isInteger(state.revision) ? Number(state.revision) : null
  if (current && expectedRevision !== current.revision) {
    return json({ error: '岗位状态已在其他页面或设备更新，请刷新后重试。', current }, { status: 409 })
  }
  const timestamp = now()
  const nextRevision = (current?.revision ?? 0) + 1
  await env.DB.prepare(
    `INSERT INTO user_job_states (user_id, job_id, screening_status, application_status, priority, applied_at, personal_notes, revision, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
     ON CONFLICT(user_id, job_id) DO UPDATE SET screening_status = excluded.screening_status,
       application_status = excluded.application_status, priority = excluded.priority,
       applied_at = excluded.applied_at, personal_notes = excluded.personal_notes,
       revision = excluded.revision, updated_at = excluded.updated_at`,
  )
    .bind(required.id, jobId, screening, application, priority, state.appliedAt ?? '', personalNotes, nextRevision, timestamp)
    .run()
  if (current) {
    await env.DB.prepare(
      `INSERT INTO user_job_state_versions (id, user_id, job_id, revision, screening_status, application_status, priority, applied_at, personal_notes, reason, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'user-update', ?10)`,
    ).bind(crypto.randomUUID(), required.id, jobId, current.revision, current.screening_status, current.application_status, current.priority, current.applied_at, current.personal_notes, timestamp).run()
  }
  await maybeCreateDailySnapshot(env, required.id, 'job-state')
  const previousScreening = current?.screening_status ?? 'to_review'
  const previousApplication = current?.application_status ?? 'pending'
  const previousPriority = current?.priority ?? 0
  const previousNotes = current?.personal_notes ?? ''
  if (previousScreening !== screening) {
    await logActivity(env, required.id, 'job-screening-changed', 'job', jobId, title, `筛选状态变更：${screening}`, { from: previousScreening, to: screening })
  }
  if (previousApplication !== application) {
    await logActivity(env, required.id, 'job-progress-changed', 'job', jobId, title, `进度变更：${application}`, { from: previousApplication, to: application })
  }
  if (previousPriority !== priority) {
    await logActivity(env, required.id, 'job-priority-changed', 'job', jobId, title, `星级变更：${priority}`, { from: previousPriority, to: priority })
  }
  if (previousNotes !== (state.personalNotes ?? '')) {
    await logActivity(env, required.id, 'job-note-updated', 'job', jobId, title, '更新了备注', {})
  }
  return json({ ok: true, revision: nextRevision, updatedAt: timestamp })
}

async function getWorkspaceDocument(request: Request, env: Env, documentKey: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  if (!WORKSPACE_DOCUMENT_KEYS.has(documentKey)) return error('不支持的数据类型', 404)
  const row = await env.DB.prepare(
    'SELECT data_json, revision, updated_at FROM workspace_documents WHERE user_id = ?1 AND document_key = ?2',
  ).bind(required.id, documentKey).first<{ data_json: string; revision: number; updated_at: string }>()
  return json({ document: row ? { data: JSON.parse(row.data_json), revision: row.revision, updatedAt: row.updated_at } : null })
}

async function workspaceSummary(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const poolId = await personalPoolId(env, required.id)
  const stateRows = poolId
    ? await env.DB.prepare(
      `SELECT user_job_states.screening_status AS status, COUNT(*) AS count
       FROM jobs JOIN user_job_states ON user_job_states.job_id = jobs.id AND user_job_states.user_id = ?1
       WHERE jobs.pool_id = ?2 AND jobs.deleted_at IS NULL GROUP BY user_job_states.screening_status`,
    ).bind(required.id, poolId).all<{ status: string; count: number }>()
    : { results: [] as Array<{ status: string; count: number }> }
  const documents = await env.DB.prepare('SELECT document_key, data_json FROM workspace_documents WHERE user_id = ?1')
    .bind(required.id).all<{ document_key: string; data_json: string }>()
  const documentData = new Map<string, unknown>()
  for (const row of documents.results) {
    try { documentData.set(row.document_key, JSON.parse(row.data_json)) } catch { /* ignore invalid legacy content */ }
  }
  const arrayCount = (key: string) => Array.isArray(documentData.get(key)) ? (documentData.get(key) as unknown[]).length : 0
  const tags = documentData.get('custom-tags')
  const jobTags = documentData.get('job-note-tags')
  const tagCount = (Array.isArray(tags) ? tags.length : 0) + (jobTags && typeof jobTags === 'object'
    ? Object.values(jobTags as Record<string, unknown>).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0)
    : 0)
  const statuses = Object.fromEntries(stateRows.results.map((row) => [row.status, row.count])) as Record<string, number>
  return json({
    jobs: stateRows.results.reduce((total, row) => total + row.count, 0),
    toReview: statuses.to_review ?? 0,
    maybe: statuses.maybe ?? 0,
    selected: statuses.selected ?? 0,
    skipped: statuses.skipped ?? 0,
    tasks: arrayCount('tasks'),
    notes: arrayCount('sticky-notes'),
    events: arrayCount('application-events'),
    tags: tagCount,
    updatedAt: now(),
  })
}

async function putWorkspaceDocument(request: Request, env: Env, documentKey: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  if (!WORKSPACE_DOCUMENT_KEYS.has(documentKey)) return error('不支持的数据类型', 404)
  const body = await readJson<{ data?: unknown; revision?: unknown; reason?: unknown }>(request)
  if (!body || !Object.prototype.hasOwnProperty.call(body, 'data')) return error('缺少数据')
  const normalizedData = normalizeWorkspaceDocumentData(documentKey, body.data)
  const serialized = JSON.stringify(normalizedData)
  if (serialized.length > MAX_WORKSPACE_DOCUMENT_CHARS) return error('该类账户数据已经过大，服务器暂时无法一次性保存。请先下载账户备份，再联系开发者拆分存储结构。')
  const expectedRevision = Number.isInteger(body.revision) ? Number(body.revision) : 0
  const current = await env.DB.prepare(
    'SELECT data_json, revision FROM workspace_documents WHERE user_id = ?1 AND document_key = ?2',
  ).bind(required.id, documentKey).first<{ data_json: string; revision: number }>()
  if ((current?.revision ?? 0) !== expectedRevision) {
    return json({ error: '数据已在其他页面或设备更新。为保护内容，本次未覆盖。', current: current ? { data: JSON.parse(current.data_json), revision: current.revision } : null }, { status: 409 })
  }
  const timestamp = now()
  const nextRevision = expectedRevision + 1
  const statements: D1PreparedStatement[] = []
  if (current && current.data_json.length <= MAX_VERSION_DOCUMENT_CHARS) {
    statements.push(env.DB.prepare(
      'INSERT INTO workspace_document_versions (id, user_id, document_key, revision, data_json, reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    ).bind(crypto.randomUUID(), required.id, documentKey, current.revision, current.data_json, typeof body.reason === 'string' ? body.reason.slice(0, 60) : 'update', timestamp))
  } else if (current) {
    console.warn('Skip oversized workspace document version', { userId: required.id, documentKey, length: current.data_json.length })
  }
  statements.push(env.DB.prepare(
    `INSERT INTO workspace_documents (user_id, document_key, data_json, revision, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(user_id, document_key) DO UPDATE SET data_json = excluded.data_json, revision = excluded.revision, updated_at = excluded.updated_at`,
  ).bind(required.id, documentKey, serialized, nextRevision, timestamp))
  try {
    await env.DB.batch(statements)
  } catch (err) {
    if (isTooBigError(err)) return error('该类账户数据体积过大，D1 暂时无法保存本次变更。请先下载账户备份，后续需要把该类数据拆分存储。', 413)
    throw err
  }
  await maybeCreateDailySnapshot(env, required.id, `document:${documentKey}`)
  if (documentKey === 'tasks') {
    try {
      const oldTasks = current ? JSON.parse(current.data_json) as Array<{ id: string; done: boolean; title?: string; applicationId?: string }> : []
      const newTasks = normalizedData as Array<{ id: string; done: boolean; title?: string; applicationId?: string }>
      const oldDone = new Set(oldTasks.filter((t) => t.done).map((t) => t.id))
      const newlyDone = newTasks.filter((t) => t.done && !oldDone.has(t.id))
      const appIds = [...new Set(newlyDone.map((t) => t.applicationId).filter((value): value is string => Boolean(value)))]
      const jobTitles = new Map<string, string>()
      for (const appId of appIds) {
        const job = await env.DB.prepare(
          `SELECT jobs.payload_json FROM jobs
           JOIN job_pools ON job_pools.id = jobs.pool_id
           WHERE jobs.id = ?1 AND job_pools.owner_user_id = ?2 AND job_pools.kind = 'personal'`,
        ).bind(appId, required.id).first<{ payload_json: string }>()
        const title = jobTitleFromPayload(job?.payload_json)
        if (title) jobTitles.set(appId, title)
      }
      for (const t of newlyDone) {
        const jobTitle = t.applicationId ? jobTitles.get(t.applicationId) : null
        const taskTitle = t.title ?? '任务'
        await logActivity(
          env,
          required.id,
          'task-completed',
          'task',
          t.id,
          jobTitle ? `${jobTitle}｜${taskTitle}` : taskTitle,
          `完成任务：${taskTitle}`,
          { applicationId: t.applicationId ?? null, jobTitle },
        )
      }
    } catch { /* ignore parse errors */ }
  }
  if (documentKey === 'job-note-tags' && current) {
    try {
      const oldTags = JSON.parse(current.data_json)
      if (JSON.stringify(oldTags) !== JSON.stringify(normalizedData)) {
        await logActivity(env, required.id, 'job-tags-updated', 'job', null, null, '更新了岗位标签', {})
      }
    } catch { /* ignore parse errors */ }
  }
  return json({ ok: true, revision: nextRevision, updatedAt: timestamp })
}

async function createAccountSnapshot(env: Env, userId: string, reason: string): Promise<void> {
  try {
    const documents = await env.DB.prepare('SELECT document_key, data_json, revision, updated_at FROM workspace_documents WHERE user_id = ?1')
      .bind(userId).all<{ document_key: string; data_json: string; revision: number; updated_at: string }>()
    const jobs = await env.DB.prepare(
      `SELECT jobs.id, jobs.no, jobs.payload_json, jobs.revision, jobs.created_at, jobs.updated_at,
              user_job_states.screening_status, user_job_states.application_status, user_job_states.priority,
              user_job_states.applied_at, user_job_states.personal_notes, user_job_states.revision AS state_revision
       FROM jobs JOIN job_pools ON job_pools.id = jobs.pool_id
       LEFT JOIN user_job_states ON user_job_states.user_id = ?1 AND user_job_states.job_id = jobs.id
       WHERE job_pools.owner_user_id = ?1 AND job_pools.kind = 'personal' AND jobs.deleted_at IS NULL`,
    ).bind(userId).all()
    const payload = JSON.stringify({
      version: 1,
      capturedAt: now(),
      documents: documents.results.map((row) => ({ ...row, data: JSON.parse(row.data_json) })),
      personalJobs: jobs.results,
    })
    if (payload.length > MAX_ACCOUNT_SNAPSHOT_CHARS) {
      console.warn('Skip oversized account snapshot', { userId, reason, length: payload.length })
      return
    }
    await env.DB.prepare('INSERT INTO account_snapshots (id, user_id, reason, payload_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(crypto.randomUUID(), userId, reason, payload, now()).run()
    await cleanupAccountSnapshots(env, userId)
  } catch (err) {
    console.error('Failed to create account snapshot', { userId, reason, err })
  }
}

async function cleanupAccountSnapshots(env: Env, userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_HOURS * 60 * 60 * 1000).toISOString()
  await env.DB.prepare('DELETE FROM account_snapshots WHERE user_id = ?1 AND created_at < ?2')
    .bind(userId, cutoff).run()
  const rows = await env.DB.prepare('SELECT id FROM account_snapshots WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 100')
    .bind(userId).all<{ id: string }>()
  const stale = rows.results.slice(MAX_ACCOUNT_SNAPSHOTS)
  for (const row of stale) {
    await env.DB.prepare('DELETE FROM account_snapshots WHERE user_id = ?1 AND id = ?2')
      .bind(userId, row.id).run()
  }
}

/** 有账户写入时定期保留完整云端快照；正常同步不依赖该快照，快照仅用于灾难恢复。 */
async function maybeCreateDailySnapshot(env: Env, userId: string, reason: string): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const existing = await env.DB.prepare('SELECT id FROM account_snapshots WHERE user_id = ?1 AND created_at >= ?2 LIMIT 1')
      .bind(userId, cutoff).first()
    if (!existing) await createAccountSnapshot(env, userId, reason)
    else await cleanupAccountSnapshots(env, userId)
  } catch (err) {
    console.error('Failed to create account snapshot', { userId, reason, err })
  }
}

async function listRecoverySnapshots(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  await cleanupAccountSnapshots(env, required.id)
  const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_HOURS * 60 * 60 * 1000).toISOString()
  const rows = await env.DB.prepare(
    'SELECT id, reason, payload_json, created_at FROM account_snapshots WHERE user_id = ?1 AND created_at >= ?2 ORDER BY created_at DESC LIMIT ?3',
  ).bind(required.id, cutoff, MAX_ACCOUNT_SNAPSHOTS).all<{ id: string; reason: string; payload_json: string; created_at: string }>()
  const snapshots = rows.results.map((row) => {
    let jobs = 0
    let toReview = 0
    let maybe = 0
    let selected = 0
    let skipped = 0
    let documents = 0
    let tasks = 0
    try {
      const data = JSON.parse(row.payload_json) as { personalJobs?: Array<{ screening_status?: string }>; documents?: Array<{ document_key?: string; data?: unknown }> }
      jobs = data.personalJobs?.length ?? 0
      toReview = data.personalJobs?.filter((job) => job.screening_status === 'to_review').length ?? 0
      maybe = data.personalJobs?.filter((job) => job.screening_status === 'maybe').length ?? 0
      selected = data.personalJobs?.filter((job) => job.screening_status === 'selected').length ?? 0
      skipped = data.personalJobs?.filter((job) => job.screening_status === 'skipped').length ?? 0
      documents = data.documents?.length ?? 0
      const taskDocument = data.documents?.find((document) => document.document_key === 'tasks')?.data
      tasks = Array.isArray(taskDocument) ? taskDocument.length : 0
    } catch { /* legacy malformed snapshot is ignored in summary */ }
    return { id: row.id, reason: row.reason, createdAt: row.created_at, jobs, toReview, maybe, selected, skipped, tasks, documents }
  })
  return json({ snapshots })
}

async function createManualRecoverySnapshot(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  await createAccountSnapshot(env, required.id, 'manual')
  return json({ ok: true, message: '已生成当前账户私有数据快照。' }, { status: 201 })
}

async function restoreRecoverySnapshot(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const body = await readJson<{ snapshotId?: string }>(request)
  const snapshotId = body?.snapshotId ?? ''
  const row = await env.DB.prepare('SELECT payload_json FROM account_snapshots WHERE id = ?1 AND user_id = ?2')
    .bind(snapshotId, required.id).first<{ payload_json: string }>()
  if (!row) return error('未找到该账户快照', 404)
  let snapshot: { documents?: Array<{ document_key: string; data?: unknown }>; personalJobs?: Array<Record<string, unknown>> }
  try { snapshot = JSON.parse(row.payload_json) as typeof snapshot } catch { return error('快照内容无法读取', 500) }
  // 回滚前强制保留当前完整副本；后续可立即回到操作前状态。
  await createAccountSnapshot(env, required.id, 'before-rollback')
  const personalId = await personalPoolId(env, required.id)
  const currentJobs = personalId ? await env.DB.prepare(
    `SELECT jobs.id, user_job_states.revision, user_job_states.screening_status, user_job_states.application_status,
            user_job_states.priority, user_job_states.applied_at, user_job_states.personal_notes
     FROM jobs JOIN user_job_states ON user_job_states.job_id = jobs.id AND user_job_states.user_id = ?1
     WHERE jobs.pool_id = ?2 AND jobs.deleted_at IS NULL`,
  ).bind(required.id, personalId).all<{ id: string; revision: number; screening_status: string; application_status: string; priority: number; applied_at: string; personal_notes: string }>() : { results: [] as Array<{ id: string; revision: number; screening_status: string; application_status: string; priority: number; applied_at: string; personal_notes: string }> }
  const currentById = new Map(currentJobs.results.map((job) => [job.id, job]))
  const statements: D1PreparedStatement[] = []
  let restoredStates = 0
  const timestamp = now()
  for (const saved of snapshot.personalJobs ?? []) {
    const id = typeof saved.id === 'string' ? saved.id : ''
    const current = currentById.get(id)
    if (!current) continue // 不删除快照后新增岗位，也不尝试恢复已删除岗位。
    const screening = typeof saved.screening_status === 'string' ? saved.screening_status : current.screening_status
    const application = typeof saved.application_status === 'string' ? saved.application_status : current.application_status
    const priority = typeof saved.priority === 'number' ? saved.priority : current.priority
    const appliedAt = typeof saved.applied_at === 'string' ? saved.applied_at : current.applied_at
    const notes = typeof saved.personal_notes === 'string' ? saved.personal_notes : current.personal_notes
    const nextRevision = current.revision + 1
    statements.push(env.DB.prepare(
      `INSERT INTO user_job_state_versions (id, user_id, job_id, revision, screening_status, application_status, priority, applied_at, personal_notes, reason, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'before-rollback', ?10)`,
    ).bind(crypto.randomUUID(), required.id, id, current.revision, current.screening_status, current.application_status, current.priority, current.applied_at, current.personal_notes, timestamp))
    statements.push(env.DB.prepare(
      'UPDATE user_job_states SET screening_status = ?1, application_status = ?2, priority = ?3, applied_at = ?4, personal_notes = ?5, revision = ?6, updated_at = ?7 WHERE user_id = ?8 AND job_id = ?9',
    ).bind(screening, application, priority, appliedAt, notes, nextRevision, timestamp, required.id, id))
    restoredStates++
  }
  for (const document of snapshot.documents ?? []) {
    if (!WORKSPACE_DOCUMENT_KEYS.has(document.document_key)) continue
    const current = await env.DB.prepare('SELECT data_json, revision FROM workspace_documents WHERE user_id = ?1 AND document_key = ?2')
      .bind(required.id, document.document_key).first<{ data_json: string; revision: number }>()
    const nextRevision = (current?.revision ?? 0) + 1
    if (current) statements.push(env.DB.prepare(
      'INSERT INTO workspace_document_versions (id, user_id, document_key, revision, data_json, reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    ).bind(crypto.randomUUID(), required.id, document.document_key, current.revision, current.data_json, 'before-rollback', timestamp))
    const normalizedDocumentData = normalizeWorkspaceDocumentData(document.document_key, document.data ?? null)
    statements.push(env.DB.prepare(
      `INSERT INTO workspace_documents (user_id, document_key, data_json, revision, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(user_id, document_key) DO UPDATE SET data_json = excluded.data_json, revision = excluded.revision, updated_at = excluded.updated_at`,
    ).bind(required.id, document.document_key, JSON.stringify(normalizedDocumentData), nextRevision, timestamp))
  }
  // D1 batch 有大小限制，按小批次执行，避免大型岗位池的回滚失败。
  for (let index = 0; index < statements.length; index += 100) await env.DB.batch(statements.slice(index, index + 100))
  return json({ ok: true, restoredStates, preservedNewJobs: currentJobs.results.length - restoredStates })
}

async function previewRecoverySnapshot(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const body = await readJson<{ snapshotId?: string }>(request)
  const row = await env.DB.prepare('SELECT payload_json, created_at FROM account_snapshots WHERE id = ?1 AND user_id = ?2')
    .bind(body?.snapshotId ?? '', required.id).first<{ payload_json: string; created_at: string }>()
  if (!row) return error('未找到该账户快照', 404)
  let snapshot: { documents?: Array<{ document_key: string; data?: unknown }>; personalJobs?: Array<Record<string, unknown>> }
  try { snapshot = JSON.parse(row.payload_json) as typeof snapshot } catch { return error('快照内容无法读取', 500) }
  const personalId = await personalPoolId(env, required.id)
  const currentJobs = personalId ? await env.DB.prepare(
    `SELECT jobs.id, jobs.payload_json, user_job_states.screening_status, user_job_states.application_status,
            user_job_states.priority, user_job_states.applied_at, user_job_states.personal_notes
     FROM jobs JOIN user_job_states ON user_job_states.job_id = jobs.id AND user_job_states.user_id = ?1
     WHERE jobs.pool_id = ?2 AND jobs.deleted_at IS NULL`,
  ).bind(required.id, personalId).all<{ id: string; payload_json: string; screening_status: string; application_status: string; priority: number; applied_at: string; personal_notes: string }>() : { results: [] as Array<{ id: string; payload_json: string; screening_status: string; application_status: string; priority: number; applied_at: string; personal_notes: string }> }
  const savedById = new Map((snapshot.personalJobs ?? []).map((job) => [typeof job.id === 'string' ? job.id : '', job]))
  const stateChanges = currentJobs.results.flatMap((current) => {
    const saved = savedById.get(current.id)
    if (!saved) return []
    const after = {
      screeningStatus: typeof saved.screening_status === 'string' ? saved.screening_status : current.screening_status,
      applicationStatus: typeof saved.application_status === 'string' ? saved.application_status : current.application_status,
      priority: typeof saved.priority === 'number' ? saved.priority : current.priority,
      appliedAt: typeof saved.applied_at === 'string' ? saved.applied_at : current.applied_at,
      notes: typeof saved.personal_notes === 'string' ? saved.personal_notes : current.personal_notes,
    }
    const before = { screeningStatus: current.screening_status, applicationStatus: current.application_status, priority: current.priority, appliedAt: current.applied_at, notes: current.personal_notes }
    if (JSON.stringify(before) === JSON.stringify(after)) return []
    let payload: { companyName?: string; jobTitle?: string } = {}
    try { payload = JSON.parse(current.payload_json) as typeof payload } catch { /* retain id-only state if a legacy payload is malformed */ }
    return [{ id: current.id, companyName: payload.companyName ?? '未命名企业', jobTitle: payload.jobTitle ?? '未命名岗位', before, after }]
  })
  const currentDocuments = await env.DB.prepare('SELECT document_key, data_json FROM workspace_documents WHERE user_id = ?1')
    .bind(required.id).all<{ document_key: string; data_json: string }>()
  const currentByKey = new Map(currentDocuments.results.map((document) => [document.document_key, document.data_json]))
  const documentChanges = (snapshot.documents ?? []).flatMap((document) => {
    if (!WORKSPACE_DOCUMENT_KEYS.has(document.document_key)) return []
    const before = currentByKey.get(document.document_key) ?? 'null'
    const after = JSON.stringify(document.data ?? null)
    if (before === after) return []
    const count = (value: unknown) => Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : value ? 1 : 0
    let beforeData: unknown = null
    try { beforeData = JSON.parse(before) } catch { /* retain count as zero */ }
    return [{ key: document.document_key, beforeCount: count(beforeData), afterCount: count(document.data) }]
  })
  return json({
    scope: '仅当前账户私有数据；不包含共享岗位池、成员或共享动态',
    snapshotAt: row.created_at,
    stateChanges,
    documentChanges,
    preservedNewJobs: currentJobs.results.filter((job) => !savedById.has(job.id)).length,
    unavailableJobs: (snapshot.personalJobs ?? []).filter((job) => typeof job.id === 'string' && !currentJobs.results.some((current) => current.id === job.id)).length,
  })
}

async function markPoolViewed(request: Request, env: Env, poolId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  if (!(await poolRole(env, poolId, required.id))) return error('无权访问该岗位池', 403)
  const timestamp = now()
  await env.DB.prepare(
    `INSERT INTO pool_views (user_id, pool_id, last_seen_at) VALUES (?1, ?2, ?3)
     ON CONFLICT(user_id, pool_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
  )
    .bind(required.id, poolId, timestamp)
    .run()
  return json({ ok: true })
}

async function transferGroup(request: Request, env: Env, groupId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const membership = await env.DB.prepare('SELECT role FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, required.id)
    .first<{ role: string }>()
  if (membership?.role !== 'owner') return error('只有创建者可以转让创建者权限', 403)
  const body = await readJson<{ targetUserId?: string }>(request)
  const targetUserId = body?.targetUserId ?? ''
  if (!targetUserId || targetUserId === required.id) return error('请选择其他成员作为新创建者')
  const target = await env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, targetUserId)
    .first()
  if (!target) return error('目标成员不在该协作岗位池中', 404)
  await env.DB.batch([
    env.DB.prepare("UPDATE group_members SET role = 'editor' WHERE group_id = ?1 AND user_id = ?2").bind(groupId, required.id),
    env.DB.prepare("UPDATE group_members SET role = 'owner' WHERE group_id = ?1 AND user_id = ?2").bind(groupId, targetUserId),
  ])
  return json({ ok: true })
}

async function deleteGroup(request: Request, env: Env, groupId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const membership = await env.DB.prepare('SELECT role FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, required.id)
    .first<{ role: string }>()
  if (membership?.role !== 'owner') return error('只有创建者可以删除协作岗位池', 403)
  const pool = await env.DB.prepare("SELECT id FROM job_pools WHERE group_id = ?1 AND kind = 'group'")
    .bind(groupId)
    .first<{ id: string }>()
  const statements: D1PreparedStatement[] = []
  if (pool) {
    statements.push(env.DB.prepare('DELETE FROM job_events WHERE pool_id = ?1').bind(pool.id))
    statements.push(env.DB.prepare('DELETE FROM jobs WHERE pool_id = ?1').bind(pool.id))
    statements.push(env.DB.prepare('DELETE FROM job_pools WHERE id = ?1').bind(pool.id))
  }
  statements.push(env.DB.prepare('DELETE FROM group_invites WHERE group_id = ?1').bind(groupId))
  statements.push(env.DB.prepare('DELETE FROM group_members WHERE group_id = ?1').bind(groupId))
  statements.push(env.DB.prepare('DELETE FROM groups WHERE id = ?1').bind(groupId))
  await env.DB.batch(statements)
  return json({ ok: true })
}

async function listGroupMembers(request: Request, env: Env, groupId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const membership = await env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, required.id)
    .first()
  if (!membership) return error('你不在该协作岗位池中', 404)
  const members = await env.DB.prepare(
    'SELECT group_members.user_id AS id, users.display_name AS name, group_members.role AS role FROM group_members JOIN users ON users.id = group_members.user_id WHERE group_members.group_id = ?1 ORDER BY group_members.joined_at ASC',
  )
    .bind(groupId)
    .all()
  const meta = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = ?1) AS member_count FROM groups WHERE id = ?1',
  )
    .bind(groupId)
    .first<{ member_count: number }>()
  return json({
    members: members.results,
    memberCount: meta?.member_count ?? members.results.length,
  })
}

async function updateMemberRole(request: Request, env: Env, groupId: string, userId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const myRole = await env.DB.prepare('SELECT role FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, required.id)
    .first<{ role: string }>()
  if (myRole?.role !== 'owner') return error('只有创建者可以更改成员权限', 403)
  if (userId === required.id) return error('不能更改自己的权限', 400)
  const body = await request.json() as { role?: string }
  const newRole = body.role
  if (newRole !== 'editor' && newRole !== 'viewer') return error('角色必须为 editor 或 viewer', 400)
  const target = await env.DB.prepare('SELECT role FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, userId)
    .first<{ role: string }>()
  if (!target) return error('该成员不在共享岗位池中', 404)
  if (target.role === 'owner') return error('不能更改创建者的权限', 400)
  await env.DB.prepare('UPDATE group_members SET role = ?1 WHERE group_id = ?2 AND user_id = ?3')
    .bind(newRole, groupId, userId).run()
  return json({ ok: true, role: newRole })
}

async function removeMember(request: Request, env: Env, groupId: string, userId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const myRole = await env.DB.prepare('SELECT role FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, required.id)
    .first<{ role: string }>()
  if (myRole?.role !== 'owner') return error('只有创建者可以移除成员', 403)
  if (userId === required.id) return error('不能移除自己，请先转让创建者权限', 400)
  const target = await env.DB.prepare('SELECT role FROM group_members WHERE group_id = ?1 AND user_id = ?2')
    .bind(groupId, userId)
    .first<{ role: string }>()
  if (!target) return error('该成员不在协作岗位池中', 404)
  if (target.role === 'owner') return error('不能移除创建者，请先转让', 400)
  const pool = await env.DB.prepare("SELECT id FROM job_pools WHERE group_id = ?1 AND kind = 'group'")
    .bind(groupId)
    .first<{ id: string }>()
  const statements: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM group_members WHERE group_id = ?1 AND user_id = ?2').bind(groupId, userId),
    env.DB.prepare('DELETE FROM pool_views WHERE user_id = ?1 AND pool_id = ?2').bind(userId, pool?.id ?? ''),
  ]
  if (pool) {
    const jobIds = await env.DB.prepare('SELECT id FROM jobs WHERE pool_id = ?1').bind(pool.id).all<{ id: string }>()
    for (const row of jobIds.results) {
      statements.push(env.DB.prepare('DELETE FROM user_job_states WHERE user_id = ?1 AND job_id = ?2').bind(userId, row.id))
      statements.push(env.DB.prepare('DELETE FROM job_copy_map WHERE user_id = ?1 AND source_job_id = ?2').bind(userId, row.id))
      statements.push(env.DB.prepare('DELETE FROM user_job_copies WHERE user_id = ?1 AND source_group_job_id = ?2').bind(userId, row.id))
    }
  }
  await env.DB.batch(statements)
  return json({ ok: true })
}

async function deleteAccount(request: Request, env: Env): Promise<Response> {
    const required = await requireUser(request, env)
    if (isResponse(required)) return required
    const owned = await env.DB.prepare('SELECT id FROM groups WHERE created_by = ?1').bind(required.id).all<{ id: string }>()
    if ((owned.results ?? []).length > 0) {
      return error(`你是 ${(owned.results ?? []).length} 个协作岗位池的创建者，请先在「协作岗位池」转让或删除后再注销账户。`, 400)
    }
    const personal = await env.DB.prepare("SELECT id FROM job_pools WHERE owner_user_id = ?1 AND kind = 'personal'").bind(required.id).first<{ id: string }>()
    const pid = personal?.id ?? ''
    const statements: D1PreparedStatement[] = [
      env.DB.prepare('DELETE FROM job_events WHERE pool_id = ?1 OR job_id IN (SELECT id FROM jobs WHERE pool_id = ?1)').bind(pid),
      env.DB.prepare('DELETE FROM jobs WHERE pool_id = ?1').bind(pid),
      env.DB.prepare('DELETE FROM job_pools WHERE id = ?1').bind(pid),
      env.DB.prepare('DELETE FROM user_job_states WHERE user_id = ?1').bind(required.id),
      env.DB.prepare('DELETE FROM job_copy_map WHERE user_id = ?1').bind(required.id),
      env.DB.prepare('DELETE FROM user_job_copies WHERE user_id = ?1').bind(required.id),
      env.DB.prepare('DELETE FROM group_members WHERE user_id = ?1').bind(required.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(required.id),
      env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(required.id),
    ]
    await env.DB.batch(statements)
    return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(request) } })
  }

async function signBackup(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const body = await readJson<{ payloadHash?: unknown }>(request)
  const payloadHash = typeof body?.payloadHash === 'string' ? body.payloadHash.trim() : ''
  if (!payloadHash || payloadHash.length > 128) return error('备份内容校验失败')
  const key = await backupSigningKey(env, required.id)
  if (!key) return error('无法创建账户备份签名', 500)
  const issuedAt = now()
  const signature = await hmacSha256(key, backupSignaturePayload(required.id, issuedAt, payloadHash))
  return json({ version: 2, issuedAt, signature })
}

async function verifyBackup(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const body = await readJson<{ payloadHash?: unknown; metadata?: { version?: unknown; issuedAt?: unknown; signature?: unknown } }>(request)
  const payloadHash = typeof body?.payloadHash === 'string' ? body.payloadHash.trim() : ''
  const metadata = body?.metadata
  const issuedAt = typeof metadata?.issuedAt === 'string' ? metadata.issuedAt : ''
  const signature = typeof metadata?.signature === 'string' ? metadata.signature : ''
  if (metadata?.version !== 2 || !payloadHash || !issuedAt || !signature) {
    return error('备份文件缺少账户绑定信息，无法恢复。', 400)
  }
  const key = await backupSigningKey(env, required.id)
  if (!key) return error('无法验证账户备份', 500)
  const expected = await hmacSha256(key, backupSignaturePayload(required.id, issuedAt, payloadHash))
  if (signature !== expected) return error('此备份不属于当前账户，无法恢复。', 403)
  return json({ ok: true })
}

async function verifyLegacyBackupMigration(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const body = await readJson<{ payloadHash?: unknown }>(request)
  const payloadHash = typeof body?.payloadHash === 'string' ? body.payloadHash.trim() : ''
  if (!env.LEGACY_BACKUP_MIGRATION_HASH || !payloadHash || payloadHash !== env.LEGACY_BACKUP_MIGRATION_HASH) {
    return error('此旧备份未获迁移授权。', 403)
  }
  return json({ ok: true })
}

async function listTrashJobs(request: Request, env: Env, poolId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const resolvedPoolId = await resolvePoolId(env, required.id, poolId)
  if (!resolvedPoolId) return error('未找到当前账户的个人岗位池', 404)
  const isPersonalPool = resolvedPoolId === (await personalPoolId(env, required.id))
  if (!isPersonalPool) return error('只能查看自己的个人岗位池回收站', 403)
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const jobs = await env.DB.prepare(
    `SELECT jobs.id, jobs.no, jobs.payload_json, jobs.revision, jobs.deleted_at,
            user_job_states.screening_status, user_job_states.application_status,
            user_job_states.priority, user_job_states.applied_at, user_job_states.personal_notes
     FROM jobs JOIN job_pools ON job_pools.id = jobs.pool_id
     LEFT JOIN user_job_states ON user_job_states.job_id = jobs.id AND user_job_states.user_id = ?1
     WHERE jobs.pool_id = ?2 AND jobs.deleted_at IS NOT NULL AND jobs.deleted_at >= ?3
     ORDER BY jobs.deleted_at DESC LIMIT ?4`,
  )
    .bind(required.id, resolvedPoolId, cutoff, MAX_TRASH_JOBS)
    .all()
  const trashJobs = jobs.results.map((row) => {
    let taskCount = 0
    return {
      id: row.id,
      no: row.no,
      payload_json: row.payload_json,
      revision: row.revision,
      deleted_at: row.deleted_at,
      screening_status: row.screening_status ?? 'to_review',
      application_status: row.application_status ?? 'pending',
      priority: row.priority ?? 0,
      applied_at: row.applied_at ?? '',
      personal_notes: row.personal_notes ?? '',
      taskCount,
    }
  })
  return json({ jobs: trashJobs })
}

async function restoreJob(request: Request, env: Env, poolId: string, jobId: string): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const resolvedPoolId = await resolvePoolId(env, required.id, poolId)
  if (!resolvedPoolId) return error('未找到当前账户的个人岗位池', 404)
  const isPersonalPool = resolvedPoolId === (await personalPoolId(env, required.id))
  if (!isPersonalPool) return error('只能恢复自己的个人岗位池岗位', 403)
  const job = await env.DB.prepare(
    'SELECT jobs.id, jobs.revision, jobs.deleted_at, jobs.payload_json FROM jobs WHERE jobs.id = ?1 AND jobs.pool_id = ?2',
  )
    .bind(jobId, resolvedPoolId)
    .first<{ id: string; revision: number; deleted_at: string | null; payload_json: string }>()
  if (!job) return error('未找到该岗位', 404)
  if (!job.deleted_at) return error('该岗位未被删除，无需恢复', 400)
  const timestamp = now()
  const nextRevision = job.revision + 1
  await env.DB.batch([
    env.DB.prepare('UPDATE jobs SET deleted_at = NULL, deleted_by = NULL, revision = ?1, updated_by = ?2, updated_at = ?3 WHERE id = ?4')
      .bind(nextRevision, required.id, timestamp, jobId),
    env.DB.prepare(
      "INSERT INTO job_events (id, pool_id, job_id, actor_user_id, action, revision, changed_fields_json, created_at) VALUES (?1, ?2, ?3, ?4, 'restored', ?5, ?6, ?7)",
    ).bind(crypto.randomUUID(), resolvedPoolId, jobId, required.id, nextRevision, JSON.stringify({}), timestamp),
  ])
  return json({ ok: true, revision: nextRevision })
}

async function getAchievements(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const url = new URL(request.url)
  const startAt = url.searchParams.get('startAt') ?? ''
  const endAt = url.searchParams.get('endAt') ?? ''
  if (!startAt || !endAt) return error('缺少 startAt 或 endAt 参数')
  const detailCutoff = new Date(Date.now() - ACHIEVEMENT_DETAIL_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  if (endAt < detailCutoff) {
    const summaryRows = await env.DB.prepare(
      `SELECT type, metadata_json
       FROM personal_activity_logs
       WHERE user_id = ?1 AND created_at >= ?2 AND created_at < ?3`,
    ).bind(required.id, startAt, endAt).all()
    const summary = emptyAchievementSummary()
    for (const row of summaryRows.results ?? []) {
      addToAchievementSummary(summary, (row as Record<string, unknown>).type, parseActivityMetadata((row as Record<string, unknown>).metadata_json))
    }
    return json({ startAt, endAt, summary, details: [], detailLimited: true, message: '该日期已超过 30 天，仅保留成就汇总，不再展示详细条目。' })
  }
  const rows = await env.DB.prepare(
    `SELECT personal_activity_logs.id, personal_activity_logs.type, personal_activity_logs.target_type,
            personal_activity_logs.target_id, personal_activity_logs.target_title,
            personal_activity_logs.summary, personal_activity_logs.metadata_json,
            personal_activity_logs.created_at, jobs.payload_json AS job_payload_json
     FROM personal_activity_logs
     LEFT JOIN jobs ON jobs.id = personal_activity_logs.target_id
     WHERE personal_activity_logs.user_id = ?1
       AND personal_activity_logs.created_at >= ?2
       AND personal_activity_logs.created_at < ?3
     ORDER BY personal_activity_logs.created_at DESC`,
  ).bind(required.id, startAt, endAt).all()
  const details = (rows.results ?? []).map((r: Record<string, unknown>) => {
    const metadata = parseActivityMetadata(r.metadata_json)
    const metadataJobTitle = typeof metadata.jobTitle === 'string' ? metadata.jobTitle : ''
    return {
      id: r.id,
      type: r.type,
      targetType: r.target_type,
      targetId: r.target_id,
      targetTitle: r.target_title || metadataJobTitle || jobTitleFromPayload(typeof r.job_payload_json === 'string' ? r.job_payload_json : null),
      summary: r.summary,
      metadata,
      createdAt: r.created_at,
    }
  })
  const summary = emptyAchievementSummary()
  for (const d of details) {
    addToAchievementSummary(summary, d.type, d.metadata)
  }
  return json({ startAt, endAt, summary, details })
}

async function getAchievementCalendar(request: Request, env: Env): Promise<Response> {
  const required = await requireUser(request, env)
  if (isResponse(required)) return required
  const url = new URL(request.url)
  const month = url.searchParams.get('month') ?? ''
  if (!/^\d{4}-\d{2}$/.test(month)) return error('month 格式须为 YYYY-MM')
  const fallbackStart = `${month}-01T00:00:00.000Z`
  const [year, monthPart] = month.split('-').map(Number)
  const fallbackEnd = `${year + (monthPart === 12 ? 1 : 0)}-${String(monthPart === 12 ? 1 : monthPart + 1).padStart(2, '0')}-01T00:00:00.000Z`
  const startAt = url.searchParams.get('startAt') ?? fallbackStart
  const endAt = url.searchParams.get('endAt') ?? fallbackEnd
  const tzOffset = clampInt(url.searchParams.get('tzOffset'), -840, 840, 0)
  const rows = await env.DB.prepare(
    'SELECT type, metadata_json, created_at FROM personal_activity_logs WHERE user_id = ?1 AND created_at >= ?2 AND created_at < ?3 ORDER BY created_at',
  ).bind(required.id, startAt, endAt).all()
  const dayMap = new Map<string, ReturnType<typeof emptyAchievementSummary>>()
  for (const row of rows.results ?? []) {
    const createdAt = String((row as Record<string, unknown>).created_at ?? '')
    const localDate = new Date(new Date(createdAt).getTime() - tzOffset * 60_000).toISOString().slice(0, 10)
    const summary = dayMap.get(localDate) ?? emptyAchievementSummary()
    addToAchievementSummary(summary, (row as Record<string, unknown>).type, parseActivityMetadata((row as Record<string, unknown>).metadata_json))
    dayMap.set(localDate, summary)
  }
  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, summary]) => ({
    date,
    totalActions: summary.totalActions,
    addedJobs: summary.addedJobs,
    completedTasks: summary.completedTasks,
  }))
  return json({ month, days })
}

async function router(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url
  if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
  if (pathname === '/api/auth/register' && request.method === 'POST') return register(request, env)
  if (pathname === '/api/auth/login' && request.method === 'POST') return login(request, env)
  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const user = await getUser(request, env)
    return json({ user })
  }
  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    const token = parseCookies(request).get(SESSION_COOKIE)
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(await sha256(token)).run()
    return json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie(request) } })
  }
  if (pathname === '/api/auth/account' && request.method === 'DELETE') return deleteAccount(request, env)
  if (pathname === '/api/backups/sign' && request.method === 'POST') return signBackup(request, env)
  if (pathname === '/api/backups/verify' && request.method === 'POST') return verifyBackup(request, env)
  if (pathname === '/api/backups/verify-legacy-migration' && request.method === 'POST') return verifyLegacyBackupMigration(request, env)
  if (pathname === '/api/pools' && request.method === 'GET') return listPools(request, env)
  if (pathname === '/api/groups' && request.method === 'POST') return createGroup(request, env)
  if (pathname === '/api/groups/join' && request.method === 'POST') return joinGroup(request, env)
  const groupInviteMatch = pathname.match(/^\/api\/groups\/([^/]+)\/invites$/)
  if (groupInviteMatch && request.method === 'POST') return createGroupInvite(request, env, groupInviteMatch[1])
  const groupLeaveMatch = pathname.match(/^\/api\/groups\/([^/]+)\/leave$/)
  if (groupLeaveMatch && request.method === 'POST') return leaveGroup(request, env, groupLeaveMatch[1])
  const groupTransferMatch = pathname.match(/^\/api\/groups\/([^/]+)\/transfer$/)
  if (groupTransferMatch && request.method === 'POST') return transferGroup(request, env, groupTransferMatch[1])
  const groupDeleteMatch = pathname.match(/^\/api\/groups\/([^/]+)$/)
  if (groupDeleteMatch && request.method === 'DELETE') return deleteGroup(request, env, groupDeleteMatch[1])
  const groupMembersMatch = pathname.match(/^\/api\/groups\/([^/]+)\/members$/)
  if (groupMembersMatch && request.method === 'GET') return listGroupMembers(request, env, groupMembersMatch[1])
  const groupMemberRemoveMatch = pathname.match(/^\/api\/groups\/([^/]+)\/members\/([^/]+)\/remove$/)
  if (groupMemberRemoveMatch && request.method === 'POST') return removeMember(request, env, groupMemberRemoveMatch[1], groupMemberRemoveMatch[2])
  const groupMemberRoleMatch = pathname.match(/^\/api\/groups\/([^/]+)\/members\/([^/]+)\/role$/)
  if (groupMemberRoleMatch && request.method === 'POST') return updateMemberRole(request, env, groupMemberRoleMatch[1], groupMemberRoleMatch[2])
  const poolViewMatch = pathname.match(/^\/api\/pools\/([^/]+)\/view$/)
  if (poolViewMatch && request.method === 'POST') return markPoolViewed(request, env, poolViewMatch[1])
  const jobsMatch = pathname.match(/^\/api\/pools\/([^/]+)\/jobs$/)
  if (jobsMatch && request.method === 'GET') return listJobs(request, env, jobsMatch[1])
  if (jobsMatch && request.method === 'POST') return createJob(request, env, jobsMatch[1])
  const importMatch = pathname.match(/^\/api\/pools\/([^/]+)\/jobs\/import$/)
  if (importMatch && request.method === 'POST') return importPersonalJobs(request, env, importMatch[1])
  const copyMatch = pathname.match(/^\/api\/pools\/([^/]+)\/jobs\/copy$/)
  if (copyMatch && request.method === 'POST') return copyJob(request, env, copyMatch[1])
  const trashMatch = pathname.match(/^\/api\/pools\/([^/]+)\/jobs\/trash$/)
  if (trashMatch && request.method === 'GET') return listTrashJobs(request, env, trashMatch[1])
  const restoreMatch = pathname.match(/^\/api\/pools\/([^/]+)\/jobs\/([^/]+)\/restore$/)
  if (restoreMatch && request.method === 'POST') return restoreJob(request, env, restoreMatch[1], restoreMatch[2])
  const jobMatch = pathname.match(/^\/api\/pools\/([^/]+)\/jobs\/([^/]+)$/)
  if (jobMatch && request.method === 'PATCH') return updateJob(request, env, jobMatch[1], jobMatch[2])
  if (jobMatch && request.method === 'DELETE') return deleteJob(request, env, jobMatch[1], jobMatch[2])
  const poolEventsMatch = pathname.match(/^\/api\/pools\/([^/]+)\/events$/)
  if (poolEventsMatch && request.method === 'GET') return listJobEvents(request, env, poolEventsMatch[1], null)
  const jobEventsMatch = pathname.match(/^\/api\/pools\/([^/]+)\/jobs\/([^/]+)\/events$/)
  if (jobEventsMatch && request.method === 'GET') return listJobEvents(request, env, jobEventsMatch[1], jobEventsMatch[2])
  if (pathname === '/api/workspace/summary' && request.method === 'GET') return workspaceSummary(request, env)
  if (pathname === '/api/workspace/recovery/snapshots' && request.method === 'GET') return listRecoverySnapshots(request, env)
  if (pathname === '/api/workspace/recovery/snapshots' && request.method === 'POST') return createManualRecoverySnapshot(request, env)
  if (pathname === '/api/workspace/recovery/preview' && request.method === 'POST') return previewRecoverySnapshot(request, env)
  if (pathname === '/api/workspace/recovery/restore' && request.method === 'POST') return restoreRecoverySnapshot(request, env)
  if (pathname === '/api/workspace/achievements' && request.method === 'GET') return getAchievements(request, env)
  if (pathname === '/api/workspace/achievements/calendar' && request.method === 'GET') return getAchievementCalendar(request, env)
  const workspaceDocumentMatch = pathname.match(/^\/api\/workspace\/documents\/([a-z-]+)$/)
  if (workspaceDocumentMatch && request.method === 'GET') return getWorkspaceDocument(request, env, workspaceDocumentMatch[1])
  if (workspaceDocumentMatch && request.method === 'PUT') return putWorkspaceDocument(request, env, workspaceDocumentMatch[1])
  const stateMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/state$/)
  if (stateMatch && request.method === 'PUT') return updatePrivateState(request, env, stateMatch[1])
  return error('未找到接口', 404)
}

export default {
  fetch(request, env): Promise<Response> {
    return router(request, env).catch((cause: unknown) => {
      console.error(cause)
      const message = cause instanceof Error ? cause.message : String(cause)
      return error('服务器暂时无法处理请求：' + message, 500)
    })
  },
} satisfies ExportedHandler<Env>

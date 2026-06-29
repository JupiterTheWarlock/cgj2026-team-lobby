type Env = {
  DB: D1Database
  CRESTS: R2Bucket
  ACTIVITY_CODE: string
  ADMIN_PASSWORD: string
}

type DeveloperRow = {
  id: string
  wechat_name: string
  intro: string | null
  wechat_id: string | null
  created_at: string
  updated_at: string
}

type TeamRow = {
  id: string
  name: string
  status: 'recruiting' | 'ready'
  contact_wechat: string
  crest_key: string | null
  intro: string | null
  created_at: string
  updated_at: string
}

const DEFAULT_SKILLS = [
  '程序',
  '策划',
  '美术',
  '音乐',
  '摸鱼',
  'solo',
  'Unity',
  'Godot',
  'Unreal',
  '其他',
]

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const path = url.pathname.replace(/^\/api\/?/, '')
  const method = context.request.method

  try {
    if (path === 'lobby' && method === 'GET') {
      requireVisitor(context.request, context.env)
      return json(await getLobby(context.env))
    }

    if (path === 'developers' && method === 'POST') {
      requireVisitor(context.request, context.env)
      return json(await saveDeveloper(context.env, await context.request.json()))
    }

    if (path.startsWith('developers/') && method === 'PUT') {
      requireVisitor(context.request, context.env)
      return json(
        await saveDeveloper(
          context.env,
          await context.request.json(),
          path.split('/')[1],
        ),
      )
    }

    if (path.startsWith('developers/') && method === 'DELETE') {
      requireVisitor(context.request, context.env)
      return json(await deleteDeveloper(context.env, path.split('/')[1]))
    }

    if (path === 'teams' && method === 'POST') {
      requireVisitor(context.request, context.env)
      return json(await saveTeam(context.env, await context.request.json()))
    }

    if (path.startsWith('teams/') && method === 'PUT') {
      requireVisitor(context.request, context.env)
      return json(
        await saveTeam(context.env, await context.request.json(), path.split('/')[1]),
      )
    }

    if (path.startsWith('teams/') && method === 'DELETE') {
      requireVisitor(context.request, context.env)
      return json(await deleteTeam(context.env, path.split('/')[1]))
    }

    if (path === 'uploads/crest' && method === 'POST') {
      requireVisitor(context.request, context.env)
      return json(await uploadCrest(context.request, context.env))
    }

    if (path.startsWith('files/') && method === 'GET') {
      return serveFile(context.env, decodeURIComponent(path.slice('files/'.length)))
    }

    if (path === 'admin/export' && method === 'GET') {
      requireAdmin(context.request, context.env)
      return exportCsv(context.env, url.searchParams.get('kind') || 'teams')
    }

    return json({ error: '未找到接口' }, 404)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof Error ? error.message : '服务异常'
    return json({ error: message }, status)
  }
}

async function getLobby(env: Env) {
  const [developers, developerSkills, teams, members, currentSkills, wantedSkills] =
    await Promise.all([
      env.DB.prepare('SELECT * FROM developers ORDER BY created_at DESC').all<DeveloperRow>(),
      env.DB.prepare('SELECT developer_id, skill FROM developer_skills').all<{
        developer_id: string
        skill: string
      }>(),
      env.DB.prepare('SELECT * FROM teams ORDER BY created_at DESC').all<TeamRow>(),
      env.DB.prepare(
        `SELECT team_members.team_id, developers.id, developers.wechat_name
         FROM team_members
         JOIN developers ON developers.id = team_members.developer_id
         ORDER BY team_members.created_at ASC`,
      ).all<{ team_id: string; id: string; wechat_name: string }>(),
      env.DB.prepare('SELECT team_id, skill FROM team_current_skills').all<{
        team_id: string
        skill: string
      }>(),
      env.DB.prepare('SELECT team_id, skill FROM team_wanted_skills').all<{
        team_id: string
        skill: string
      }>(),
    ])

  return {
    developers: developers.results.map((developer) => ({
      id: developer.id,
      wechatName: developer.wechat_name,
      skills: pickSkills(developerSkills.results, 'developer_id', developer.id),
      intro: developer.intro || '',
      wechatId: developer.wechat_id || '',
      createdAt: developer.created_at,
      updatedAt: developer.updated_at,
    })),
    teams: teams.results.map((team) => ({
      id: team.id,
      name: team.name,
      status: team.status,
      members: members.results
        .filter((member) => member.team_id === team.id)
        .map((member) => ({ id: member.id, wechatName: member.wechat_name })),
      contactWechat: team.contact_wechat,
      crestKey: team.crest_key || '',
      crestUrl: team.crest_key ? `/api/files/${encodeURIComponent(team.crest_key)}` : '',
      currentSkills: pickSkills(currentSkills.results, 'team_id', team.id),
      wantedSkills: pickSkills(wantedSkills.results, 'team_id', team.id),
      intro: team.intro || '',
      createdAt: team.created_at,
      updatedAt: team.updated_at,
    })),
    skillTags: DEFAULT_SKILLS,
  }
}

async function saveDeveloper(env: Env, input: unknown, id: string = crypto.randomUUID()) {
  const data = normalizeDeveloper(input)
  const now = new Date().toISOString()
  const exists = await env.DB.prepare('SELECT id FROM developers WHERE id = ?')
    .bind(id)
    .first()

  const statements = [
    exists
      ? env.DB.prepare(
          `UPDATE developers
           SET wechat_name = ?, intro = ?, wechat_id = ?, updated_at = ?
           WHERE id = ?`,
        ).bind(data.wechatName, data.intro, data.wechatId, now, id)
      : env.DB.prepare(
          `INSERT INTO developers
           (id, wechat_name, intro, wechat_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(id, data.wechatName, data.intro, data.wechatId, now, now),
    env.DB.prepare('DELETE FROM developer_skills WHERE developer_id = ?').bind(id),
    ...data.skills.map((skill) =>
      env.DB.prepare('INSERT INTO developer_skills (developer_id, skill) VALUES (?, ?)').bind(
        id,
        skill,
      ),
    ),
  ]
  await env.DB.batch(statements)
  return { ok: true, id }
}

async function deleteDeveloper(env: Env, id: string) {
  await env.DB.prepare('DELETE FROM developers WHERE id = ?').bind(id).run()
  return { ok: true, id }
}

async function saveTeam(env: Env, input: unknown, id: string = crypto.randomUUID()) {
  const data = normalizeTeam(input)
  const memberIds = await validMemberIds(env, data.memberIds)
  if (memberIds.length !== data.memberIds.length) {
    throw new HttpError(400, '成员包含不存在的开发者，请刷新后重试')
  }
  const now = new Date().toISOString()
  const exists = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(id).first()
  const statements = [
    exists
      ? env.DB.prepare(
          `UPDATE teams
           SET name = ?, status = ?, contact_wechat = ?, crest_key = ?, intro = ?, updated_at = ?
           WHERE id = ?`,
        ).bind(
          data.name,
          data.status,
          data.contactWechat,
          data.crestKey,
          data.intro,
          now,
          id,
        )
      : env.DB.prepare(
          `INSERT INTO teams
           (id, name, status, contact_wechat, crest_key, intro, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          id,
          data.name,
          data.status,
          data.contactWechat,
          data.crestKey,
          data.intro,
          now,
          now,
        ),
    env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(id),
    env.DB.prepare('DELETE FROM team_current_skills WHERE team_id = ?').bind(id),
    env.DB.prepare('DELETE FROM team_wanted_skills WHERE team_id = ?').bind(id),
    ...memberIds.map((developerId) =>
      env.DB.prepare(
        'INSERT INTO team_members (team_id, developer_id, created_at) VALUES (?, ?, ?)',
      ).bind(id, developerId, now),
    ),
    ...data.currentSkills.map((skill) =>
      env.DB.prepare('INSERT INTO team_current_skills (team_id, skill) VALUES (?, ?)').bind(
        id,
        skill,
      ),
    ),
    ...data.wantedSkills.map((skill) =>
      env.DB.prepare('INSERT INTO team_wanted_skills (team_id, skill) VALUES (?, ?)').bind(
        id,
        skill,
      ),
    ),
  ]
  await env.DB.batch(statements)
  return { ok: true, id }
}

async function deleteTeam(env: Env, id: string) {
  const team = await env.DB.prepare('SELECT crest_key FROM teams WHERE id = ?')
    .bind(id)
    .first<{ crest_key: string | null }>()
  await env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(id).run()
  if (team?.crest_key) await env.CRESTS.delete(team.crest_key).catch(() => undefined)
  return { ok: true, id }
}

async function validMemberIds(env: Env, memberIds: string[]) {
  if (!memberIds.length) return []
  const placeholders = memberIds.map(() => '?').join(', ')
  const { results } = await env.DB.prepare(
    `SELECT id FROM developers WHERE id IN (${placeholders})`,
  )
    .bind(...memberIds)
    .all<{ id: string }>()
  return results.map((row) => row.id)
}

async function uploadCrest(request: Request, env: Env) {
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw new HttpError(400, '请选择队徽文件')
  if (file.size > 2 * 1024 * 1024) throw new HttpError(400, '队徽不能超过 2MB')

  const extByType: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  }
  const ext = extByType[file.type]
  if (!ext) throw new HttpError(400, '队徽仅支持 png / jpg / webp')

  const key = `crests/${crypto.randomUUID()}.${ext}`
  await env.CRESTS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })
  return { key, url: `/api/files/${encodeURIComponent(key)}` }
}

async function serveFile(env: Env, key: string) {
  if (!key.startsWith('crests/') || key.includes('..')) {
    throw new HttpError(400, '文件路径无效')
  }
  const object = await env.CRESTS.get(key)
  if (!object?.body) throw new HttpError(404, '文件不存在')
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('cache-control', 'no-store')
  headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}

async function exportCsv(env: Env, kind: string) {
  const lobby = await getLobby(env)
  const rows =
    kind === 'developers'
      ? [
          ['微信名', '技能', '介绍', '微信号'],
          ...lobby.developers.map((developer) => [
            developer.wechatName,
            developer.skills.join('、'),
            developer.intro,
            developer.wechatId,
          ]),
        ]
      : [
          ['队伍名称', '状态', '成员', '联系微信', '当前技能', '寻找技能', '介绍'],
          ...lobby.teams.map((team) => [
            team.name,
            team.status === 'recruiting' ? '待加入' : '准备完成',
            team.members.map((member) => member.wechatName).join('、'),
            team.contactWechat,
            team.currentSkills.join('、'),
            team.wantedSkills.join('、'),
            team.intro,
          ]),
        ]
  const body = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="cgj2026-${kind}.csv"`,
    },
  })
}

function normalizeDeveloper(input: unknown) {
  const data = assertRecord(input)
  const wechatName = cleanText(data.wechatName, 40)
  if (!wechatName) throw new HttpError(400, '微信名必填')
  return {
    wechatName,
    skills: cleanList(data.skills),
    intro: cleanText(data.intro, 1000),
    wechatId: cleanText(data.wechatId, 80),
  }
}

function normalizeTeam(input: unknown) {
  const data = assertRecord(input)
  const name = cleanText(data.name, 60)
  const contactWechat = cleanText(data.contactWechat, 80)
  if (!name) throw new HttpError(400, '队伍名称必填')
  if (!contactWechat) throw new HttpError(400, '联系微信必填')
  return {
    name,
    status: data.status === 'ready' ? 'ready' : 'recruiting',
    memberIds: cleanIdList(data.memberIds).slice(0, 12),
    contactWechat,
    crestKey: cleanText(data.crestKey, 160),
    currentSkills: cleanList(data.currentSkills),
    wantedSkills: cleanList(data.wantedSkills),
    intro: cleanText(data.intro, 1200),
  }
}

function assertRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, '请求数据无效')
  }
  return input as Record<string, unknown>
}

function cleanText(value: unknown, max: number) {
  return String(value || '')
    .trim()
    .slice(0, max)
}

function cleanList(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item, 30))
        .filter(Boolean)
        .slice(0, 20),
    ),
  )
}

function cleanIdList(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item, 80))
        .filter(Boolean)
        .slice(0, 20),
    ),
  )
}

function pickSkills(
  rows: Array<Record<string, string>>,
  key: string,
  id: string,
) {
  return rows.filter((row) => row[key] === id).map((row) => row.skill)
}

function requireVisitor(request: Request, env: Env) {
  if (isAdmin(request, env)) return
  const code = request.headers.get('x-activity-code') || ''
  if (!env.ACTIVITY_CODE || code !== env.ACTIVITY_CODE) {
    throw new HttpError(401, '活动码不正确')
  }
}

function requireAdmin(request: Request, env: Env) {
  if (!isAdmin(request, env)) throw new HttpError(401, '管理员密码不正确')
}

function isAdmin(request: Request, env: Env) {
  const password = request.headers.get('x-admin-password') || ''
  return Boolean(env.ADMIN_PASSWORD && password === env.ADMIN_PASSWORD)
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

function csvCell(value: string) {
  return `"${String(value || '').replaceAll('"', '""')}"`
}

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

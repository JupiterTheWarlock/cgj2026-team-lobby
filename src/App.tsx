import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type Developer = {
  id: string
  wechatName: string
  skills: string[]
  intro: string
  wechatId: string
  createdAt: string
  updatedAt: string
}

type Team = {
  id: string
  name: string
  status: 'recruiting' | 'ready'
  members: { id: string; wechatName: string }[]
  contactWechat: string
  crestKey: string
  crestUrl: string
  currentSkills: string[]
  wantedSkills: string[]
  intro: string
  createdAt: string
  updatedAt: string
}

type LobbyData = {
  developers: Developer[]
  teams: Team[]
  skillTags: string[]
}

type DeveloperDraft = {
  id?: string
  wechatName: string
  skills: string[]
  intro: string
  wechatId: string
}

type TeamDraft = {
  id?: string
  name: string
  status: 'recruiting' | 'ready'
  memberIds: string[]
  contactWechat: string
  crestKey: string
  currentSkills: string[]
  wantedSkills: string[]
  intro: string
}

const DEFAULT_SKILLS = [
  '程序',
  '策划',
  '美术',
  '音乐',
  'solo',
  'Unity',
  'Godot',
  'Unreal',
  '其他',
]

const emptyDeveloper: DeveloperDraft = {
  wechatName: '',
  skills: [],
  intro: '',
  wechatId: '',
}

const emptyTeam: TeamDraft = {
  name: '',
  status: 'recruiting',
  memberIds: [],
  contactWechat: '',
  crestKey: '',
  currentSkills: [],
  wantedSkills: [],
  intro: '',
}

function App() {
  const [activityCode, setActivityCode] = useState(
    () => localStorage.getItem('cgj2026.activityCode') || '',
  )
  const [adminPassword, setAdminPassword] = useState(
    () => sessionStorage.getItem('cgj2026.adminPassword') || '',
  )
  const [pendingCode, setPendingCode] = useState(activityCode)
  const [pendingAdmin, setPendingAdmin] = useState('')
  const [data, setData] = useState<LobbyData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [area, setArea] = useState<'teams' | 'developers' | 'admin'>('teams')
  const [teamView, setTeamView] = useState<'recruiting' | 'all'>('recruiting')
  const [developerView, setDeveloperView] = useState<'board' | 'table'>('board')
  const [teamFilter, setTeamFilter] = useState({
    currentSkill: '',
    wantedSkill: '',
    keyword: '',
    contactOnly: false,
  })
  const [developerFilter, setDeveloperFilter] = useState('')
  const [developerDraft, setDeveloperDraft] = useState<DeveloperDraft | null>(
    null,
  )
  const [teamDraft, setTeamDraft] = useState<TeamDraft | null>(null)
  const [crestFile, setCrestFile] = useState<File | null>(null)

  const adminMode = Boolean(adminPassword)
  const skillTags = useMemo(
    () => Array.from(new Set([...(data?.skillTags || []), ...DEFAULT_SKILLS])),
    [data],
  )

  const api = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (activityCode) headers.set('x-activity-code', activityCode)
    if (adminPassword) headers.set('x-admin-password', adminPassword)
    if (!(init.body instanceof FormData) && init.body) {
      headers.set('content-type', 'application/json')
    }
    const response = await fetch(path, { ...init, headers })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error || `请求失败：${response.status}`)
    }
    return (await response.json()) as T
  }, [activityCode, adminPassword])

  const loadLobby = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await api<LobbyData>('/api/lobby'))
    } catch (err) {
      setData(null)
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (activityCode || adminPassword) {
      void loadLobby()
    }
  }, [activityCode, adminPassword, loadLobby])

  function saveActivityCode(event: FormEvent) {
    event.preventDefault()
    localStorage.setItem('cgj2026.activityCode', pendingCode.trim())
    setActivityCode(pendingCode.trim())
  }

  function saveAdmin(event: FormEvent) {
    event.preventDefault()
    sessionStorage.setItem('cgj2026.adminPassword', pendingAdmin)
    setAdminPassword(pendingAdmin)
    setPendingAdmin('')
    setArea('admin')
  }

  function logout() {
    localStorage.removeItem('cgj2026.activityCode')
    sessionStorage.removeItem('cgj2026.adminPassword')
    setActivityCode('')
    setAdminPassword('')
    setData(null)
  }

  async function saveDeveloper(event: FormEvent) {
    event.preventDefault()
    if (!developerDraft) return
    const method = developerDraft.id ? 'PUT' : 'POST'
    const path = developerDraft.id
      ? `/api/developers/${developerDraft.id}`
      : '/api/developers'
    await api(path, { method, body: JSON.stringify(developerDraft) })
    setDeveloperDraft(null)
    await loadLobby()
  }

  async function deleteDeveloper() {
    if (!developerDraft?.id || !confirm('确认删除这个开发者？')) return
    await api(`/api/developers/${developerDraft.id}`, { method: 'DELETE' })
    setDeveloperDraft(null)
    await loadLobby()
  }

  async function uploadCrest() {
    if (!crestFile) return teamDraft?.crestKey || ''
    const form = new FormData()
    form.append('file', crestFile)
    const uploaded = await api<{ key: string }>('/api/uploads/crest', {
      method: 'POST',
      body: form,
    })
    return uploaded.key
  }

  async function saveTeam(event: FormEvent) {
    event.preventDefault()
    if (!teamDraft) return
    const crestKey = await uploadCrest()
    const payload = { ...teamDraft, crestKey }
    const method = payload.id ? 'PUT' : 'POST'
    const path = payload.id ? `/api/teams/${payload.id}` : '/api/teams'
    await api(path, { method, body: JSON.stringify(payload) })
    setTeamDraft(null)
    setCrestFile(null)
    await loadLobby()
  }

  async function deleteTeam() {
    if (!teamDraft?.id || !confirm('确认删除这个队伍？')) return
    await api(`/api/teams/${teamDraft.id}`, { method: 'DELETE' })
    setTeamDraft(null)
    setCrestFile(null)
    await loadLobby()
  }

  if (!activityCode && !adminPassword) {
    return (
      <main className="gate">
        <section className="gate-panel">
          <p className="eyebrow">CGJ2026</p>
          <h1>组队大厅</h1>
          <p className="gate-copy">
            输入活动码进入大厅。大厅内会展示微信号，请只在活动参与者范围内使用。
          </p>
          <form className="gate-form" onSubmit={saveActivityCode}>
            <input
              value={pendingCode}
              onChange={(event) => setPendingCode(event.target.value)}
              placeholder="活动码"
              aria-label="活动码"
            />
            <button type="submit">进入大厅</button>
          </form>
          <form className="gate-form admin-login" onSubmit={saveAdmin}>
            <input
              value={pendingAdmin}
              onChange={(event) => setPendingAdmin(event.target.value)}
              placeholder="管理员密码"
              aria-label="管理员密码"
              type="password"
            />
            <button type="submit">管理员进入</button>
          </form>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">复古街机 × 城市社区 × RPG 组队面板</p>
          <h1>CGJ2026组队大厅</h1>
        </div>
        <nav className="top-actions" aria-label="主导航">
          <button
            className={area === 'teams' ? 'active' : ''}
            onClick={() => setArea('teams')}
            type="button"
          >
            队伍
          </button>
          <button
            className={area === 'developers' ? 'active' : ''}
            onClick={() => setArea('developers')}
            type="button"
          >
            开发者
          </button>
          <button
            className={area === 'admin' ? 'active' : ''}
            onClick={() => setArea('admin')}
            type="button"
          >
            管理
          </button>
          <button className="ghost" onClick={logout} type="button">
            退出
          </button>
        </nav>
      </header>

      {error && <p className="banner error">{error}</p>}
      {loading && <p className="banner">读取大厅数据中...</p>}

      {data && area === 'teams' && (
        <TeamSection
          data={data}
          filter={teamFilter}
          setFilter={setTeamFilter}
          setDraft={setTeamDraft}
          view={teamView}
          setView={setTeamView}
        />
      )}

      {data && area === 'developers' && (
        <DeveloperSection
          developers={data.developers}
          filter={developerFilter}
          setFilter={setDeveloperFilter}
          setDraft={setDeveloperDraft}
          skillTags={skillTags}
          view={developerView}
          setView={setDeveloperView}
        />
      )}

      {data && area === 'admin' && (
        <AdminSection
          adminMode={adminMode}
          pendingAdmin={pendingAdmin}
          setPendingAdmin={setPendingAdmin}
          saveAdmin={saveAdmin}
          data={data}
          adminPassword={adminPassword}
          reload={loadLobby}
          setArea={setArea}
        />
      )}

      {developerDraft && (
        <Dialog title={developerDraft.id ? '编辑开发者' : '新增开发者'}>
          <DeveloperForm
            draft={developerDraft}
            setDraft={setDeveloperDraft}
            skillTags={skillTags}
            onCancel={() => setDeveloperDraft(null)}
            onDelete={developerDraft.id ? deleteDeveloper : undefined}
            onSubmit={saveDeveloper}
          />
        </Dialog>
      )}

      {teamDraft && data && (
        <Dialog title={teamDraft.id ? '编辑队伍' : '新增队伍'}>
          <TeamForm
            draft={teamDraft}
            setDraft={setTeamDraft}
            developers={data.developers}
            skillTags={skillTags}
            crestFile={crestFile}
            setCrestFile={setCrestFile}
            onCancel={() => {
              setTeamDraft(null)
              setCrestFile(null)
            }}
            onDelete={teamDraft.id ? deleteTeam : undefined}
            onSubmit={saveTeam}
          />
        </Dialog>
      )}
    </main>
  )
}

function TeamSection({
  data,
  filter,
  setFilter,
  setDraft,
  view,
  setView,
}: {
  data: LobbyData
  filter: {
    currentSkill: string
    wantedSkill: string
    keyword: string
    contactOnly: boolean
  }
  setFilter: (filter: {
    currentSkill: string
    wantedSkill: string
    keyword: string
    contactOnly: boolean
  }) => void
  setDraft: (draft: TeamDraft) => void
  view: 'recruiting' | 'all'
  setView: (view: 'recruiting' | 'all') => void
}) {
  const teams = data.teams.filter((team) => {
    if (view === 'recruiting' && team.status !== 'recruiting') return false
    if (filter.currentSkill && !team.currentSkills.includes(filter.currentSkill)) {
      return false
    }
    if (filter.wantedSkill && !team.wantedSkills.includes(filter.wantedSkill)) {
      return false
    }
    if (filter.contactOnly && !team.contactWechat.trim()) return false
    const keyword = filter.keyword.trim().toLowerCase()
    if (!keyword) return true
    return [team.name, team.contactWechat, team.intro, ...team.currentSkills, ...team.wantedSkills]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })

  return (
    <section className="workspace">
      <div className="section-head">
        <div>
          <p className="eyebrow">Team Lobby</p>
          <h2>队伍页面</h2>
        </div>
        <button type="button" onClick={() => setDraft(emptyTeam)}>
          + 创建队伍
        </button>
      </div>

      <div className="view-tabs" role="tablist" aria-label="队伍视图">
        <button
          className={view === 'recruiting' ? 'active' : ''}
          onClick={() => setView('recruiting')}
          type="button"
        >
          组建中的队伍
        </button>
        <button
          className={view === 'all' ? 'active' : ''}
          onClick={() => setView('all')}
          type="button"
        >
          全部队伍
        </button>
      </div>

      <div className="filters">
        <select
          value={filter.currentSkill}
          onChange={(event) =>
            setFilter({ ...filter, currentSkill: event.target.value })
          }
          aria-label="筛选当前技能"
        >
          <option value="">当前技能</option>
          {data.skillTags.map((skill) => (
            <option key={skill} value={skill}>
              {skill}
            </option>
          ))}
        </select>
        <select
          value={filter.wantedSkill}
          onChange={(event) =>
            setFilter({ ...filter, wantedSkill: event.target.value })
          }
          aria-label="筛选寻找技能"
        >
          <option value="">寻找技能</option>
          {data.skillTags.map((skill) => (
            <option key={skill} value={skill}>
              {skill}
            </option>
          ))}
        </select>
        <input
          value={filter.keyword}
          onChange={(event) =>
            setFilter({ ...filter, keyword: event.target.value })
          }
          placeholder="搜索队伍、题材、微信"
        />
        <label className="check">
          <input
            checked={filter.contactOnly}
            onChange={(event) =>
              setFilter({ ...filter, contactOnly: event.target.checked })
            }
            type="checkbox"
          />
          有联系方式
        </label>
      </div>

      <div className="team-grid">
        {teams.map((team) => (
          <article className="team-card" key={team.id}>
            <div className="card-top">
              <div className="crest">
                {team.crestUrl ? (
                  <img src={team.crestUrl} alt="" />
                ) : (
                  <span>{team.name.slice(0, 1) || '队'}</span>
                )}
              </div>
              <div>
                <h3>{team.name}</h3>
                <span className={`status ${team.status}`}>
                  {team.status === 'recruiting' ? '待加入' : '准备完成'}
                </span>
              </div>
            </div>
            <p className="card-copy">{team.intro || '队伍还没有填写介绍。'}</p>
            <TagRow label="成员" tags={team.members.map((member) => member.wechatName)} />
            <TagRow label="已有" tags={team.currentSkills} />
            <TagRow label="寻找" tags={team.wantedSkills} accent />
            <div className="contact">微信：{team.contactWechat || '未填写'}</div>
            <button
              className="ghost stretch"
              type="button"
              onClick={() => setDraft(teamToDraft(team))}
            >
              编辑队伍
            </button>
          </article>
        ))}
      </div>

      {!teams.length && <p className="empty">当前筛选下没有队伍。</p>}
    </section>
  )
}

function DeveloperSection({
  developers,
  filter,
  setFilter,
  setDraft,
  skillTags,
  view,
  setView,
}: {
  developers: Developer[]
  filter: string
  setFilter: (filter: string) => void
  setDraft: (draft: DeveloperDraft) => void
  skillTags: string[]
  view: 'board' | 'table'
  setView: (view: 'board' | 'table') => void
}) {
  const visible = developers.filter((developer) => {
    const keyword = filter.trim().toLowerCase()
    if (!keyword) return true
    return [developer.wechatName, developer.wechatId, developer.intro, ...developer.skills]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
  const groups = new Map<string, Developer[]>()
  for (const skill of skillTags) groups.set(skill, [])
  groups.set('未分类', [])
  for (const developer of visible) {
    const skills = developer.skills.length ? developer.skills : ['未分类']
    for (const skill of skills) {
      if (!groups.has(skill)) groups.set(skill, [])
      groups.get(skill)?.push(developer)
    }
  }

  return (
    <section className="workspace">
      <div className="section-head">
        <div>
          <p className="eyebrow">Developer Board</p>
          <h2>开发者页面</h2>
        </div>
        <button type="button" onClick={() => setDraft(emptyDeveloper)}>
          + 填写个人信息
        </button>
      </div>
      <div className="view-tabs" role="tablist" aria-label="开发者视图">
        <button
          className={view === 'board' ? 'active' : ''}
          onClick={() => setView('board')}
          type="button"
        >
          看板
        </button>
        <button
          className={view === 'table' ? 'active' : ''}
          onClick={() => setView('table')}
          type="button"
        >
          表格
        </button>
      </div>
      <div className="filters">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="搜索昵称、技能、介绍、微信"
        />
      </div>

      {view === 'board' ? (
        <div className="dev-board">
          {Array.from(groups.entries())
            .filter(([, items]) => items.length)
            .map(([skill, items]) => (
              <section className="dev-column" key={skill}>
                <h3>
                  {skill} <span>{items.length}</span>
                </h3>
                {items.map((developer) => (
                  <article className="dev-card" key={`${skill}-${developer.id}`}>
                    <strong>{developer.wechatName}</strong>
                    <p>{developer.intro || '还没有填写介绍。'}</p>
                    <small>{developer.wechatId || '未公开微信号'}</small>
                    <button
                      className="ghost stretch"
                      type="button"
                      onClick={() => setDraft(developerToDraft(developer))}
                    >
                      编辑
                    </button>
                  </article>
                ))}
              </section>
            ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>微信名</th>
                <th>技能</th>
                <th>介绍</th>
                <th>微信号（自愿）</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((developer) => (
                <tr key={developer.id}>
                  <td>{developer.wechatName}</td>
                  <td>
                    <TagList tags={developer.skills} />
                  </td>
                  <td>{developer.intro}</td>
                  <td>{developer.wechatId}</td>
                  <td>
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => setDraft(developerToDraft(developer))}
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AdminSection({
  adminMode,
  pendingAdmin,
  setPendingAdmin,
  saveAdmin,
  data,
  adminPassword,
  reload,
  setArea,
}: {
  adminMode: boolean
  pendingAdmin: string
  setPendingAdmin: (value: string) => void
  saveAdmin: (event: FormEvent) => void
  data: LobbyData
  adminPassword: string
  reload: () => Promise<void>
  setArea: (area: 'teams' | 'developers' | 'admin') => void
}) {
  async function download(kind: 'developers' | 'teams') {
    const response = await fetch(`/api/admin/export?kind=${kind}`, {
      headers: { 'x-admin-password': adminPassword },
    })
    if (!response.ok) return
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cgj2026-${kind}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!adminMode) {
    return (
      <section className="workspace narrow">
        <p className="eyebrow">Admin</p>
        <h2>管理员入口</h2>
        <form className="gate-form" onSubmit={saveAdmin}>
          <input
            value={pendingAdmin}
            onChange={(event) => setPendingAdmin(event.target.value)}
            placeholder="管理员密码"
            type="password"
          />
          <button type="submit">进入管理</button>
        </form>
      </section>
    )
  }

  return (
    <section className="workspace">
      <div className="section-head">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h2>管理后台</h2>
        </div>
        <button className="ghost" onClick={() => void reload()} type="button">
          刷新
        </button>
      </div>
      <div className="stats">
        <div>
          <strong>{data.developers.length}</strong>
          <span>开发者</span>
        </div>
        <div>
          <strong>{data.teams.length}</strong>
          <span>队伍</span>
        </div>
        <div>
          <strong>{data.teams.filter((team) => team.status === 'recruiting').length}</strong>
          <span>组建中</span>
        </div>
        <div>
          <strong>{data.skillTags.length}</strong>
          <span>技能标签</span>
        </div>
      </div>
      <div className="admin-actions">
        <button type="button" onClick={() => void download('developers')}>
          导出开发者 CSV
        </button>
        <button type="button" onClick={() => void download('teams')}>
          导出队伍 CSV
        </button>
        <button type="button" onClick={() => setArea('teams')}>
          去编辑队伍
        </button>
        <button type="button" onClick={() => setArea('developers')}>
          去编辑开发者
        </button>
      </div>
    </section>
  )
}

function DeveloperForm({
  draft,
  setDraft,
  skillTags,
  onCancel,
  onDelete,
  onSubmit,
}: {
  draft: DeveloperDraft
  setDraft: (draft: DeveloperDraft) => void
  skillTags: string[]
  onCancel: () => void
  onDelete?: () => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <form className="editor" onSubmit={onSubmit}>
      <label>
        微信名
        <input
          value={draft.wechatName}
          onChange={(event) => setDraft({ ...draft, wechatName: event.target.value })}
          required
        />
      </label>
      <SkillPicker
        label="技能"
        selected={draft.skills}
        options={skillTags}
        onChange={(skills) => setDraft({ ...draft, skills })}
      />
      <label>
        介绍
        <textarea
          value={draft.intro}
          onChange={(event) => setDraft({ ...draft, intro: event.target.value })}
          rows={4}
        />
      </label>
      <label>
        微信号（自愿）
        <input
          value={draft.wechatId}
          onChange={(event) => setDraft({ ...draft, wechatId: event.target.value })}
        />
      </label>
      <FormActions onCancel={onCancel} onDelete={onDelete} />
    </form>
  )
}

function TeamForm({
  draft,
  setDraft,
  developers,
  skillTags,
  crestFile,
  setCrestFile,
  onCancel,
  onDelete,
  onSubmit,
}: {
  draft: TeamDraft
  setDraft: (draft: TeamDraft) => void
  developers: Developer[]
  skillTags: string[]
  crestFile: File | null
  setCrestFile: (file: File | null) => void
  onCancel: () => void
  onDelete?: () => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <form className="editor" onSubmit={onSubmit}>
      <label>
        队伍名称
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          required
        />
      </label>
      <label>
        组队状态
        <select
          value={draft.status}
          onChange={(event) =>
            setDraft({
              ...draft,
              status: event.target.value as TeamDraft['status'],
            })
          }
        >
          <option value="recruiting">待加入</option>
          <option value="ready">准备完成</option>
        </select>
      </label>
      <label>
        联系微信
        <input
          value={draft.contactWechat}
          onChange={(event) =>
            setDraft({ ...draft, contactWechat: event.target.value })
          }
          required
        />
      </label>
      <label>
        队徽（png / jpg / webp，2MB 内）
        <input
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setCrestFile(event.target.files?.[0] || null)}
          type="file"
        />
        {crestFile && <small>{crestFile.name}</small>}
      </label>
      <fieldset>
        <legend>成员</legend>
        <div className="choice-grid">
          {developers.map((developer) => (
            <label className="check" key={developer.id}>
              <input
                checked={draft.memberIds.includes(developer.id)}
                onChange={() =>
                  setDraft({
                    ...draft,
                    memberIds: toggle(draft.memberIds, developer.id),
                  })
                }
                type="checkbox"
              />
              {developer.wechatName}
            </label>
          ))}
        </div>
      </fieldset>
      <SkillPicker
        label="当前技能"
        selected={draft.currentSkills}
        options={skillTags}
        onChange={(currentSkills) => setDraft({ ...draft, currentSkills })}
      />
      <SkillPicker
        label="寻找技能"
        selected={draft.wantedSkills}
        options={skillTags}
        onChange={(wantedSkills) => setDraft({ ...draft, wantedSkills })}
      />
      <label>
        介绍（团队特点、开发理念、组队需求等）
        <textarea
          value={draft.intro}
          onChange={(event) => setDraft({ ...draft, intro: event.target.value })}
          rows={4}
        />
      </label>
      <FormActions onCancel={onCancel} onDelete={onDelete} />
    </form>
  )
}

function SkillPicker({
  label,
  selected,
  options,
  onChange,
}: {
  label: string
  selected: string[]
  options: string[]
  onChange: (skills: string[]) => void
}) {
  const [custom, setCustom] = useState('')

  function addCustom() {
    const next = custom
      .split(/[,\s，、]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (!next.length) return
    onChange(Array.from(new Set([...selected, ...next])))
    setCustom('')
  }

  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="tag-picker">
        {options.map((skill) => (
          <button
            className={selected.includes(skill) ? 'selected' : ''}
            key={skill}
            onClick={() => onChange(toggle(selected, skill))}
            type="button"
          >
            {skill}
          </button>
        ))}
      </div>
      <div className="custom-skill">
        <input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="自填标签，可用逗号分隔"
        />
        <button type="button" onClick={addCustom}>
          添加
        </button>
      </div>
    </fieldset>
  )
}

function Dialog({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="dialog-backdrop">
      <section className="dialog" role="dialog" aria-modal="true">
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  )
}

function FormActions({
  onCancel,
  onDelete,
}: {
  onCancel: () => void
  onDelete?: () => void
}) {
  return (
    <div className="form-actions">
      {onDelete && (
        <button className="danger" type="button" onClick={() => void onDelete()}>
          删除
        </button>
      )}
      <button className="ghost" type="button" onClick={onCancel}>
        取消
      </button>
      <button type="submit">保存</button>
    </div>
  )
}

function TagRow({
  label,
  tags,
  accent,
}: {
  label: string
  tags: string[]
  accent?: boolean
}) {
  return (
    <div className="tag-row">
      <span>{label}</span>
      <TagList accent={accent} tags={tags} />
    </div>
  )
}

function TagList({ tags, accent }: { tags: string[]; accent?: boolean }) {
  if (!tags.length) return <small>未填写</small>
  return (
    <div className="tags">
      {tags.map((tag) => (
        <span className={accent ? 'accent' : ''} key={tag}>
          {tag}
        </span>
      ))}
    </div>
  )
}

function toggle(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function developerToDraft(developer: Developer): DeveloperDraft {
  return {
    id: developer.id,
    wechatName: developer.wechatName,
    skills: developer.skills,
    intro: developer.intro,
    wechatId: developer.wechatId,
  }
}

function teamToDraft(team: Team): TeamDraft {
  return {
    id: team.id,
    name: team.name,
    status: team.status,
    memberIds: team.members.map((member) => member.id),
    contactWechat: team.contactWechat,
    crestKey: team.crestKey,
    currentSkills: team.currentSkills,
    wantedSkills: team.wantedSkills,
    intro: team.intro,
  }
}

export default App

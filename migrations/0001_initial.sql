PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS developers (
  id TEXT PRIMARY KEY,
  wechat_name TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  wechat_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_tags (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS developer_skills (
  developer_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  PRIMARY KEY (developer_id, skill),
  FOREIGN KEY (developer_id) REFERENCES developers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('recruiting', 'ready')),
  contact_wechat TEXT NOT NULL,
  crest_key TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL,
  developer_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (team_id, developer_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (developer_id) REFERENCES developers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_current_skills (
  team_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  PRIMARY KEY (team_id, skill),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_wanted_skills (
  team_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  PRIMARY KEY (team_id, skill),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
CREATE INDEX IF NOT EXISTS idx_developer_skills_skill ON developer_skills(skill);
CREATE INDEX IF NOT EXISTS idx_team_current_skills_skill ON team_current_skills(skill);
CREATE INDEX IF NOT EXISTS idx_team_wanted_skills_skill ON team_wanted_skills(skill);

INSERT OR IGNORE INTO skill_tags (name) VALUES
  ('程序'),
  ('策划'),
  ('美术'),
  ('音乐'),
  ('摸鱼'),
  ('solo'),
  ('Unity'),
  ('Godot'),
  ('Unreal'),
  ('其他');

# Cloudflare 部署手册

当前代码已完成并推送到 GitHub：

- 仓库：`https://github.com/JupiterTheWarlock/cgj2026-team-lobby`
- Cloudflare Account ID：`5d52486e48c9e29dbed4a924f6cb1b8a`
- Pages 项目名：`cgj2026-team-lobby`
- D1 数据库名：`cgj2026-team-lobby`
- R2 bucket 名：`cgj2026-team-crests`

## 当前部署

已部署：

- Production URL：`https://cgj2026-team-lobby.pages.dev/`
- D1 database_id：`573fa7df-bbd0-4041-8a45-34b0a368bda2`
- R2 bucket：`cgj2026-team-crests`

生产凭据保存在本机输出文件，不提交到 Git：

```txt
C:\Users\Administrator\Documents\Codex\2026-06-29\https-peropero-feishu-cn-base-sknobighaalfuzsx437cypxonad\outputs\cgj2026-deploy-credentials.json
```

## 重新部署步骤

在项目目录执行：

```powershell
cd C:\Users\Administrator\Documents\Codex\2026-06-29\https-peropero-feishu-cn-base-sknobighaalfuzsx437cypxonad\work\cgj2026-team-lobby
```

如果 schema 变更，先应用远端 migration：

```powershell
npm run d1:migrate:remote
```

如需轮换生产 secrets：

```powershell
"<活动码>" | npx wrangler pages secret put ACTIVITY_CODE --project-name cgj2026-team-lobby
"<管理员密码>" | npx wrangler pages secret put ADMIN_PASSWORD --project-name cgj2026-team-lobby
```

部署：

```powershell
npm run deploy
```

## 部署后验收

1. 打开 Pages 返回的默认域名。
2. 用活动码进入大厅。
3. 新增开发者。
4. 上传队徽并创建队伍。
5. 切换「组建中的队伍 / 全部队伍」。
6. 用管理员密码进入后台。
7. 导出开发者 CSV 和队伍 CSV。

## 本地验证记录

本地已经通过：

```powershell
npm run build
npm run lint
npx wrangler d1 migrations apply cgj2026-team-lobby --local --persist-to C:\cf-d1-cgj2026
npx wrangler pages dev ./dist --persist-to C:\cf-d1-cgj2026 --port 8788
```

端到端验证已覆盖：

- 活动码鉴权
- 新增开发者
- R2 队徽上传
- 新建队伍并关联成员
- 大厅读取
- 队徽文件读取
- 管理员 CSV 导出

## 线上验证记录

已验证：

- `GET /` 返回 200
- 未带活动码访问 `/api/lobby` 返回 401
- 带活动码访问 `/api/lobby` 返回 200
- 队徽可上传到 R2 并通过 `/api/files/:key` 读取
- 管理员 CSV 导出返回 200
- 验证用 R2 object 已删除
- 远端 D1 当前 `developers = 0`、`teams = 0`

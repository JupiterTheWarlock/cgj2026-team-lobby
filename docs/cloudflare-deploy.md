# Cloudflare 部署手册

当前代码已完成并推送到 GitHub：

- 仓库：`https://github.com/JupiterTheWarlock/cgj2026-team-lobby`
- Cloudflare Account ID：`5d52486e48c9e29dbed4a924f6cb1b8a`
- Pages 项目名：`cgj2026-team-lobby`
- D1 数据库名：`cgj2026-team-lobby`
- R2 bucket 名：`cgj2026-team-crests`

## 当前阻塞

当前环境变量 `CLOUDFLARE_API_TOKEN` 能通过 `wrangler whoami`，但不能访问 D1、R2、Pages：

```txt
Authentication error [code: 10000]
Are you missing the User->Memberships->Read permission?
```

最省事的处理方式是在交互终端运行：

```powershell
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
npx wrangler login
npx wrangler whoami
```

如果继续使用 API token，需要给 token 至少覆盖这些能力：

- User Memberships Read
- Account 级 Cloudflare Pages 读写
- Account 级 D1 读写
- Account 级 R2 读写

## 权限恢复后的部署步骤

在项目目录执行：

```powershell
cd C:\Users\Administrator\Documents\Codex\2026-06-29\https-peropero-feishu-cn-base-sknobighaalfuzsx437cypxonad\work\cgj2026-team-lobby
```

创建 D1：

```powershell
npx wrangler d1 create cgj2026-team-lobby
```

把返回的 `database_id` 写入 `wrangler.jsonc`：

```jsonc
"database_id": "<真实 D1 database_id>"
```

创建 R2：

```powershell
npx wrangler r2 bucket create cgj2026-team-crests
```

应用远端 migration：

```powershell
npm run d1:migrate:remote
```

创建 Pages 项目：

```powershell
npx wrangler pages project create cgj2026-team-lobby --production-branch main
```

设置生产 secrets：

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

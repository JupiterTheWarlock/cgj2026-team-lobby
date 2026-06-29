# CGJ2026组队大厅

CGJ2026 活动组队大厅。前端使用 Vite + React，部署在 Cloudflare Pages，API 使用 Pages Functions，数据存在 D1，队徽存在 R2。

## 功能

- 活动码进入大厅，避免公开暴露微信号。
- 开发者页：看板 view、表格 view、技能筛选、自填标签。
- 队伍页：组建中的队伍、全部队伍、状态/技能/关键词筛选。
- 队伍字段：队伍名称、状态、成员、联系微信、队徽、当前技能、寻找技能、介绍。
- 管理后台：管理员密码进入，查看统计，导出开发者/队伍 CSV。

## 本地开发

```bash
npm install
Copy-Item .dev.vars.example .dev.vars
npm run build
npm run pages:dev
```

`.dev.vars` 里配置：

```txt
ACTIVITY_CODE="活动码"
ADMIN_PASSWORD="管理员密码"
```

## Cloudflare 资源

需要创建：

```bash
npx wrangler d1 create cgj2026-team-lobby
npx wrangler r2 bucket create cgj2026-team-crests
```

把 D1 返回的 `database_id` 写入 `wrangler.jsonc`，然后执行：

```bash
npm run d1:migrate:remote
npx wrangler pages project create cgj2026-team-lobby --production-branch main
printf "活动码" | npx wrangler pages secret put ACTIVITY_CODE --project-name cgj2026-team-lobby
printf "管理员密码" | npx wrangler pages secret put ADMIN_PASSWORD --project-name cgj2026-team-lobby
npm run deploy
```

GitHub Pages 集成也可以在 Cloudflare Dashboard 里连接本仓库，构建命令为 `npm run build`，输出目录为 `dist`。

如果 Wrangler 报 `User->Memberships->Read` 或 `Authentication error [code: 10000]`，按 [Cloudflare 部署手册](docs/cloudflare-deploy.md) 恢复权限后再部署。

## 数据安全

- 不提交 `.dev.vars`。
- 不提交 D1 导出的活动数据。
- 队徽文件通过 R2 保存，D1 只保存 R2 key。
- 微信号只在活动码或管理员密码通过后返回。

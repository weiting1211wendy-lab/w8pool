# W8Pool｜校招求职岗位池

W8Pool 是一款面向校招求职的岗位信息与行动管理工具。它围绕“岗位池”组织求职流程，帮助用户把分散在招聘网站、社群、表格和朋友转发中的岗位线索，沉淀为可筛选、可追踪、可执行的个人工作台。

在线体验：[https://w8-pool.pages.dev/](https://w8-pool.pages.dev/)

## 核心功能

- 我的岗位池：记录岗位信息，支持搜索、筛选、分组、排序、状态管理、Priority 星级、个人备注与岗位标签。
- 任务管理：将重点岗位拆分为投递、笔试、面试、材料准备和跟进事项，并按公司、岗位与目标日期推进。
- 网申材料管理：按岗位类型维护个人材料模块，支持预览、复制和多版本复用。
- 群组岗位池：与同学或伙伴共享岗位线索，个人筛选、备注、投递进度保持私有。
- 访客模式：使用独立的虚构演示数据体验完整功能，不读取、不写入真实账户数据。
- 数据安全：支持账户备份、恢复预览、云端快照、回滚和个人岗位回收站。
- 开发中功能：智巡岗位 Robot、社区岗位池、网申预填小助手。

## 技术栈

- 前端：React、TypeScript、Vite
- 部署：Cloudflare Pages
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1
- AI 协作：Codex、OpenCode 等 AI coding 工具

## 本地运行

```bash
npm install
npm run dev
```

构建与检查：

```bash
npm run build
npm run lint
```

## Cloudflare 配置

公开仓库中不提交真实 `wrangler.jsonc`。如需自行部署：

1. 复制 `wrangler.example.jsonc` 为 `wrangler.jsonc`；
2. 在 Cloudflare 创建 Pages 项目和 D1 数据库；
3. 将 `database_id` 替换为自己的 D1 数据库 ID；
4. 执行数据库迁移；
5. 部署到 Cloudflare Pages。

```bash
cp wrangler.example.jsonc wrangler.jsonc
npm run cf:d1:migrate
npx wrangler pages deploy dist
```

## 数据与隐私说明

- 仓库不应包含真实用户数据、个人岗位备份、Cloudflare 账号凭据或 D1 真实数据库 ID。
- 访客模式数据为虚构演示数据，仅用于展示产品流程。
- 工作台数据按账户隔离保存；群组岗位池中的共享岗位与个人筛选、备注、投递进度分离。

## 项目背景

该项目由开发者基于真实校招求职管理需求独立设计，并借助 AI coding 工具完成开发迭代。项目重点不在于单一技术炫技，而在于通过产品化方式梳理信息流、行动流和数据边界，将“岗位记录”扩展为“岗位获取、筛选决策、任务推进、材料复用与协作共享”的完整闭环。

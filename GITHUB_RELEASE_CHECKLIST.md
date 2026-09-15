# GitHub 发布前检查清单

这份清单用于将 W8Pool 发布到 GitHub 前做最后确认，避免把本地私有数据、部署凭据或作品集草稿一起提交。

## 已整理

- `.gitignore` 已排除：
  - `node_modules/`
  - `dist/`
  - `.wrangler/`
  - `.env`、`.dev.vars`
  - 本地日志
  - PPT / Word / PDF / Excel 草稿
  - 备份 JSON 与旧个人导出文件
  - PPT 检查中间产物与临时目录
- 已新增 `wrangler.example.jsonc`：
  - 保留 Cloudflare Pages + D1 配置结构；
  - 使用 `YOUR_D1_DATABASE_ID` 占位；
  - 不暴露真实 D1 数据库 ID。
- 已重写 `README.md`：
  - 说明产品定位、核心功能、技术栈、本地运行方式、Cloudflare 配置方式和数据隐私边界。

## 发布前请再次确认

1. 不要提交真实 `wrangler.jsonc`
   - 当前本地 `wrangler.jsonc` 含真实 D1 `database_id`；
   - 已通过 `.gitignore` 排除；
   - GitHub 上只应提交 `wrangler.example.jsonc`。

2. 不要提交构建产物和依赖目录
   - `dist/`、`node_modules/` 已排除。

3. 不要提交个人作品集草稿
   - 根目录中的 `.ppt-*`、`.resume-review/`、`ppt_build/`、各类 `.pptx`、`.inspect.ndjson` 已排除。

4. 不要提交个人备份文件
   - `*backup*.json`、`*备份*.json`、`w8pool-backup-*.json`、`wendy*.json` 已排除。

5. 访客演示数据可以保留
   - 访客模式使用虚构演示数据；
   - 如后续新增演示数据，需继续确认不包含真实企业、真实个人经历、真实联系方式或真实岗位备注。

6. 开发者姓名和联系方式可以保留
   - 使用说明中的开发者姓名与联系方式是刻意保留的信息。

## 建议发布方式

如果此前没有干净的 Git 历史，建议新建一个全新的 GitHub 仓库，只提交当前整理后的公开版本：

```bash
git init
git add .
git commit -m "Initial public version of W8Pool"
git branch -M main
git remote add origin <你的 GitHub 仓库地址>
git push -u origin main
```

提交前可先运行：

```bash
git status --ignored
npm run build
npm run lint
```

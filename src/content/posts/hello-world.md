---
title: Hello World — 开始使用这个博客模板
pubDate: '2026-07-08'
description: 快速了解这个 Astro 博客模板的目录结构、写作流程和常用命令。
---

欢迎！这是本模板的第一篇示例文章。如果你能在浏览器里看到它，说明一切运行正常。

## 快速开始

```bash
pnpm install   # 安装依赖
pnpm dev       # 启动开发服务器（http://localhost:4321）
pnpm build     # 构建生产版本到 dist/
```

## 写一篇新文章

推荐使用内置脚本自动生成 frontmatter：

```bash
pnpm new "我的第一篇文章" --slug my-first-post
```

这会在 `src/content/posts/` 下创建 `my-first-post.md`（文件名会自动转为 kebab-case）。以 `_` 开头的文件名会被视为草稿。

每篇文章的 frontmatter 支持以下字段：

```yaml
---
title: 文章标题 # 必填
pubDate: '2026-07-08' # 必填，发布日期
updatedDate: '2026-07-09' # 可选，更新日期
description: 摘要 # 可选，用于 SEO 和列表页
image: /og/cover.png # 可选，封面图
hasMath: true # 可选，启用 KaTeX 数学公式
---
```

## 站点配置

打开 `src/config.ts`，修改站点标题、作者、域名、语言等信息——所有配置都集中在这一个文件里，并且有完整的类型检查。

## 接下来

- 看看 [Markdown 语法示例](/markdown-syntax-guide) 了解支持的排版效果
- 看看 [数学公式示例](/math-with-katex) 了解 KaTeX 用法
- 编辑 `src/content/about/about.mdx` 修改欢迎首页
- 删掉这些示例文章，开始写你自己的内容吧！

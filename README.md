# Astro Blog Template

一个简洁、快速的个人博客模板，基于 **Astro 5** 构建，支持 MDX、KaTeX 数学公式，一键部署到 Netlify。

## ✨ 特性

- ⚡ **Astro 5** — 极致的加载性能，默认零 JS
- 📝 **Markdown / MDX** — 在文章里直接使用 Astro 组件
- 🧮 **KaTeX** — 完整的 LaTeX 数学公式支持
- 🌗 **深浅色主题** — 跟随系统，支持手动切换
- 🔗 **链接卡片** — 裸链接自动渲染为带预览的卡片
- 📋 **代码块** — 语法高亮 + 一键复制
- 🖼️ **图片查看器** — 点击放大浏览
- 📡 **RSS / Atom 订阅** + Sitemap + Open Graph 图片自动生成
- 🤖 **AI 摘要**（可选）— 基于 Gemini 的文章摘要组件
- 🔤 **中英文皆宜** — 通过 `src/config.ts` 一处切换语言

## 🚀 使用本模板

1. 点击本仓库右上角的 **「Use this template」→「Create a new repository」**
2. 克隆你的新仓库并安装依赖：

```bash
git clone https://github.com/<你的用户名>/<你的仓库名>.git
cd <你的仓库名>
pnpm install
pnpm dev
```

访问 `http://localhost:4321` 即可预览。

> 需要 Node.js 18+ 和 [pnpm](https://pnpm.io/)。

## 📝 写作

```bash
pnpm new "我的第一篇文章"    # 创建新文章
pnpm new "_我的草稿"         # 创建草稿（文件名以 _ 开头，不会公开）
```

文章存放在 `src/content/posts/`，支持 `.md` 和 `.mdx`。frontmatter 字段：

```yaml
---
title: 文章标题            # 必填
pubDate: '2026-07-08'      # 必填
updatedDate: '2026-07-09'  # 可选
description: 摘要           # 可选
image: /og/cover.png       # 可选，封面图
hasMath: true              # 可选，启用 KaTeX
---
```

模板自带几篇示例文章（Markdown 语法、数学公式、MDX 组件用法），熟悉之后删掉即可。更详细的写作说明见 [USAGE.md](./USAGE.md)。

## ⚙️ 配置

所有站点配置集中在 **`src/config.ts`**：站点标题、作者、域名、语言、布局宽度、主题切换、目录、阅读时间、链接卡片等，均有类型检查。

「关于」页面在 `src/content/about/about.mdx`。

## 📦 常用命令

| 命令                | 作用                       |
| ------------------- | -------------------------- |
| `pnpm dev`          | 启动开发服务器             |
| `pnpm build`        | 构建生产版本到 `dist/`     |
| `pnpm preview`      | 本地预览构建产物           |
| `pnpm new <标题>`   | 创建新文章                 |
| `pnpm lint`         | ESLint 检查                |
| `pnpm format`       | Prettier 格式化            |

## ☁️ 部署到 Netlify

本模板使用 `@astrojs/netlify` 适配器（SSR），配置见 `netlify.toml`。

1. 把仓库推送到 GitHub
2. 在 [Netlify](https://app.netlify.com/) 中 **Add new site → Import an existing project**，选择你的仓库
3. 构建命令和输出目录会自动从 `netlify.toml` 读取，直接部署即可
4. 部署完成后，把 `src/config.ts` 中的 `site.website` 改成你的正式域名

## 📂 目录结构

```
src/
├── config.ts          # 站点配置（从这里开始改）
├── content/
│   ├── posts/         # 博客文章（.md / .mdx）
│   └── about/         # 关于页面
├── pages/             # 路由（文章页、RSS、API 等）
├── components/        # Astro / React 组件
├── layouts/           # 页面布局
├── plugins/           # remark / rehype 插件
└── styles/            # 全局样式
scripts/               # 建文章、切换代理等脚本
```

## 📄 License

[MIT](./LICENSE)

# Abo Astro Blog Theme

一个基于 **Astro 5、MDX 和 TypeScript** 的个人博客模板，提供文章写作、全文搜索和常用独立页面，默认适配 Netlify 部署。

开箱包含中性的文字品牌、欢迎页和示例文章。修改站点配置与示例内容，即可搭建自己的博客。

## 功能

- **阅读与布局**：欢迎页、三栏文章布局、移动端导航、深浅主题、字体大小调整。
- **文章写作**：Markdown / MDX、KaTeX 公式、目录、阅读时间、代码复制、图片缩放、渐变封面和相关文章。
- **内容发现**：Pagefind 全文搜索、分类浏览、书签、友链和近况页面。
- **分享与订阅**：RSS / Atom、文章分享图、canonical、JSON-LD、sitemap 和 robots.txt。
- **扩展功能**：Giscus 评论、点赞与访问统计、在线笔记，以及支持 R2 和外部视频的高光页面。

## 快速开始

环境要求：**Node.js 22**、**pnpm 10.15.0**。

将仓库复制到自己的 GitHub 账号后，克隆并运行：

```bash
git clone https://github.com/<your-name>/<your-repo>.git
cd <your-repo>
pnpm install --frozen-lockfile
pnpm dev
```

打开 `http://localhost:4321/` 查看欢迎页，访问 `/blog/` 浏览文章。

## 换成自己的博客

| 内容                         | 配置或文件                                                                 |
| ---------------------------- | -------------------------------------------------------------------------- |
| 域名、标题、作者、描述、语言 | `src/config.ts` → `themeConfig.site`                                       |
| 主题、布局、日期与文章功能   | `src/config.ts` → `general`、`date`、`post`                                |
| 侧栏简介、作者链接、快捷外链 | `src/config.ts` → `integrationConfig.profile`                              |
| 欢迎页                       | `src/content/about/about.mdx`，默认读取站点配置                            |
| 文章                         | `src/content/posts/`                                                       |
| 近况                         | `src/pages/now.astro`                                                      |
| 书签 / 友链                  | `src/data/links.json` / `src/data/friends.ts`                              |
| 导航                         | `src/lib/navigation.ts`                                                    |
| Logo 与图标                  | `public/logo-*.png`、`favicon*.png`、`favicon.svg`、`apple-touch-icon.png` |
| 默认站点分享图               | `public/og/site.png`                                                       |

`site.website` 请填写正式域名，并保留结尾的 `/`。该配置用于 canonical、订阅源、sitemap 和结构化数据。

默认 Logo 为 BLOG / B 文字占位图。更换站点名称后，也请替换默认分享图；文章分享图的标题和作者会在构建时自动生成。熟悉主题后，可删除自带的示例文章。

## 写文章

```bash
pnpm new "我的第一篇文章" --slug my-first-post
pnpm new "_待完成的文章" --slug draft-post
```

中文标题需提供英文 slug。文件保存在 `src/content/posts/`，支持 `.md` 和 `.mdx`：

```yaml
---
title: '我的第一篇文章'
pubDate: '2026-10-29'
description: '这篇文章的简短介绍'
---
```

顶层文件名以 `_` 开头的文章作为草稿，不生成公开文章页面。分类可使用标题前缀，例如 `【技术】我的第一篇文章`。图片、公式、MDX 与完整 frontmatter 说明见 [使用指南](./USAGE.md#4-写文章)。

## 构建与预览

```bash
pnpm build
pnpm preview
```

构建产物位于 `dist/`，搜索索引随构建生成。预览地址为 **`http://localhost:1414/`**，可检查页面与全文搜索。

`pnpm preview` 使用 Pagefind 的静态预览服务，不运行动态 API。开发服务器上的搜索会显示降级提示；修改文章后需要重新构建才能更新搜索索引。

## 可选服务

| 功能                 | 所需配置                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| Giscus 评论          | 在 `integrationConfig.giscus` 中填入自己的仓库与分类 ID，再启用；默认关闭 |
| 点赞、阅读与访问统计 | 自己的 Netlify 站点及 Netlify Blobs                                       |
| 在线笔记管理         | Netlify Blobs 与 `PRIVATE_MEMO_ADMIN_PASSCODE`                            |
| 视频高光管理         | 管理员口令；启用 R2 时另配桶凭据、公开媒体域名与 CSP                      |

基础页面和文章写作无需填写密钥。管理员口令默认为空，视频列表默认为空，玩家 ID 不预设账号。笔记内容对访客公开，管理员口令用于限制编辑。

本地环境变量可参考 [.env.example](./.env.example)；生产环境在 Netlify 单独配置。各服务的完整接入方法见 [使用指南](./USAGE.md)。视频示例、R2、CORS 与后台操作见 [高光页配置指南](./HIGHLIGHTS.md)。

## 部署到 Netlify

1. 将自己的仓库导入 Netlify。
2. 使用 Node.js 22，构建命令 `pnpm build`，发布目录 `dist`；构建与响应头配置见 `netlify.toml`。
3. 按需添加环境变量，并将 `site.website` 改为正式域名后部署。

页面在构建时预渲染，`src/pages/api/` 由 Netlify 服务端函数运行。纯静态托管仅能提供生成的页面，不能运行在线笔记、点赞、统计或视频管理 API。

## 常用命令

| 命令                        | 用途                               |
| --------------------------- | ---------------------------------- |
| `pnpm dev`                  | 开发服务器与热更新                 |
| `pnpm build`                | 生产构建与搜索索引                 |
| `pnpm preview`              | 静态产物预览，端口 1414            |
| `pnpm lint`                 | ESLint 检查                        |
| `pnpm check`                | Astro / TypeScript 检查            |
| `pnpm test`                 | 脚本与 API 回归检查                |
| `pnpm format:check`         | 格式检查                           |
| `pnpm subset-fonts`         | 生成字体子集                       |
| `pnpm cache-bookmark-icons` | 缓存书签图标                       |
| `pnpm update-theme`         | 合并主题更新，保留待审阅的合并结果 |

升级前先提交自己的改动。迁移配置与处理合并冲突的方法见 [主题升级与迁移](./USAGE.md#10-主题升级与迁移)。版本变更见 [CHANGELOG.md](./CHANGELOG.md)。

## 来源与许可

本主题由 [Astro Chiri](https://github.com/the3ash/astro-chiri) 演进，并复用 [Abo Blog](https://github.com/skywalker23241/blog-abohack) 的布局与功能实现。

代码采用 [MIT](./LICENSE) 许可；文章与第三方媒体请按各自许可使用。

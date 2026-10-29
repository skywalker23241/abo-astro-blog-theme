# 使用与配置指南

## 1. 环境和本地运行

使用 Node.js 22、pnpm 10.15.0。运行 `pnpm install --frozen-lockfile`，然后 `pnpm dev`，打开 `http://localhost:4321/`。生产检查使用 `pnpm lint`、`pnpm check`、`pnpm test`、`pnpm build`。

`pnpm preview` 使用 Pagefind 内置服务查看生成的页面（`http://localhost:1414/`），支持搜索，不运行动态 API。Netlify 适配器不支持原生 `astro preview`。涉及 Blobs、服务端函数、R2 管理的完整验证，应在你自己的 Netlify 测试部署中进行；本地没有 Blobs 上下文时，相关 API 可能返回不可用状态。

## 2. 首次配置清单

`src/config.ts` 导出两组配置：

| 配置                                       | 作用                                           |
| ------------------------------------------ | ---------------------------------------------- |
| `themeConfig.site`                         | 域名、名称、作者、描述、语言、运行天数起始日期 |
| `themeConfig.general`                      | 内容宽度、居中、主题切换、列表分隔线、页脚     |
| `themeConfig.date`                         | 日期格式、分隔符、位置                         |
| `themeConfig.post`                         | 阅读时间、目录、图片查看器、代码复制、链接卡片 |
| `integrationConfig.profile`                | 侧栏简介、页脚作者链接、快捷导航外链           |
| `integrationConfig.giscus`                 | 评论开关与你自己的仓库和分类 ID                |
| `integrationConfig.highlights.mediaOrigin` | R2 视频的公开 HTTPS 源，无尾部斜杠             |

`site.website` 必须是完整网址并以 `/` 结尾，例如 `https://example.com/`。这会影响 canonical、订阅源、sitemap、友链信息和结构化数据；上线前务必修改。

`site.language` 默认 `zh_CN`。该字段用于元数据及部分组件文案，主题专属页面仍有中文文案，切换为 `en` 不会自动翻译整个网站。

图片查看器配置为对象：

```ts
imageViewer: {
  enabled: true,
  maxScale: 4,
  doubleTapScale: 2
}
```

新版已移除 `general.fadeAnimation` 和 Glimm，页面切换由 `PageTransition.astro` 管理。旧版 `post.imageViewer: true` 需迁移为上述对象。

## 3. 页面与资源

| URL            | 编辑位置                                                                     |
| -------------- | ---------------------------------------------------------------------------- |
| `/`            | `src/content/about/about.mdx`（欢迎页内容），`src/pages/index.astro`（布局） |
| `/blog/`       | `src/pages/blog.astro`，文章来自内容集合                                     |
| `/categories/` | 分类和 Pagefind 全文搜索                                                     |
| `/now/`        | `src/pages/now.astro`：修改生活、学习和项目三个通用示例                      |
| `/nav/`        | `src/data/links.json`：书签分组和条目                                        |
| `/friends/`    | `src/data/friends.ts`：名称、网址、简介、图标、RSS                           |
| `/newsletter/` | RSS / Atom 订阅说明，不含邮件投递服务                                        |
| `/para-notes/` | 管理员可编辑的笔记，笔记内容对访客公开                                       |
| `/highlights/` | 视频作品集与管理员功能                                                       |

`/about` 重定向到欢迎首页。导航定义在 `src/lib/navigation.ts`；增删路由时同时检查 `Header.astro`、`SiteSidebar.astro` 的图标及页面识别逻辑。

模板默认使用中性的 BLOG / B 文字品牌，不包含原博客插画与标志。可替换 `public/logo-light.png`、`logo-dark.png`、`favicon.png`、`favicon-dark.png`、`favicon.svg`、`apple-touch-icon.png`。文章分享图使用纯色 `public/og/og-bg.png` 背景，标题和作者来自文章及站点配置；默认站点分享图为 `public/og/site.png`，更换站点名称后请替换该占位图片。欢迎页文字直接读取站点配置，无需准备插画。

书签图标缓存来自 `pnpm cache-bookmark-icons`，输出在 `public/bookmark-icons/` 和 `src/data/bookmark-icons.json`。模板不携带原博客的个人书签缓存。

## 4. 写文章

```bash
pnpm new "中文文章标题" --slug my-first-post
pnpm new "_中文草稿" --slug my-draft
pnpm new "An English Post"
```

中文标题需提供英文 slug；空 slug 会报错，已有文件不会覆盖。脚本会将标题正确转义为 YAML 字符串。

文章位于 `src/content/posts/`，支持 `.md` 和 `.mdx`：

```yaml
---
title: '文章标题'
displayTitle: '可选的展示标题'
pubDate: '2026-10-29'
updatedDate: '2026-10-30'
description: '供列表、搜索和元数据使用的简短摘要'
image: './_assets/my-first-post/cover.webp'
hasMath: false
---
```

只有 `title` 和 `pubDate` 必填。具体以 `src/content.config.ts` 为准。分类使用标题前缀（例如 `【技术】文章标题`，参见 `src/utils/category.ts`），不是 `tags` 或 `category` frontmatter 字段。

图片建议按文章存放在 `src/content/posts/_assets/<slug>/`，正文写作 `![图片说明](./_assets/my-first-post/example.webp)`。设置 `hasMath: true` 后可使用 KaTeX。MDX 组件用法见自带示例。

顶层文件名以 `_` 开头的文章会从公开文章路由、列表、订阅和分享图中排除；这不是访问权限机制，敏感内容不要放入仓库。不要依靠未来发布日期隐藏文章。发布草稿时移除文件名前的 `_`。

## 5. 搜索与 SEO

`pnpm build` 在 Astro 构建完成后运行 `pagefind --site dist`。本地搜索调试先构建，再运行 `pnpm preview`（端口 1414）。开发服务器不提供 `dist/pagefind/` 索引，开发时搜索会使用页面的降级提示。修改文章后重新构建以更新索引。

发布前检查 `/rss.xml`、`/atom.xml`、`/sitemap-index.xml`、`/robots.txt` 和 `/open-graph/hello-world.png`。模板已移除原博客的旧文章重定向；你迁移已有博客时需要在 `netlify.toml` 添加自己的重定向，避免旧链接失效。

`/nav/` 和 `/newsletter/` 不进入 sitemap，并带 noindex。切勿直接复用原博客的 canonical 域名、评论仓库 ID 或站点验证文件。

## 6. 可选 Giscus 评论

默认关闭。到你自己的 Giscus 配置页启用仓库 Discussions，获得 repo、repoId、category、categoryId，填写 `integrationConfig.giscus` 后将 `enabled` 设为 `true`。配置缺失时不会加载评论脚本。配置变化需要重新构建。

## 7. Netlify Blobs 与管理员笔记

点赞、阅读统计、站点统计、笔记和高光互动使用 Netlify Blobs。将项目部署到你自己的 Netlify 站点，数据存储与站点关联，不会复制原站数据。

复制 `.env.example` 为 `.env.local` 可用于本地配置；生产环境在 Netlify 的环境变量中单独填写并重新部署。保持密钥在服务端，禁止使用 `PUBLIC_` 前缀。

| 环境变量                        | 用途                                               |
| ------------------------------- | -------------------------------------------------- |
| `PRIVATE_MEMO_ADMIN_PASSCODE`   | 笔记和视频高光共用的管理员口令；留空时管理写入关闭 |
| `HIGHLIGHT_INTERACTIONS_SECRET` | 高光互动身份签名，可选；未设置时回退到 R2 secret   |

笔记开发模式使用独立 `preview-notes` 记录，避免直接改生产笔记。管理员口令仅限制编辑，笔记不是私密资料保险箱。

## 8. 可选视频高光与 R2

分步接入、示例数据、CORS、后台操作及故障排查见 [高光页配置指南](./HIGHLIGHTS.md)。

未配置 R2 时展示 `src/data/game-highlights.ts` 的本地回退列表，默认空。可以在该文件添加 `GameHighlight` 记录进行页面和外部视频演示。游戏名称及玩家 ID 也在该文件维护，玩家 ID 默认留空，不预设个人游戏账号。

启用 R2 时配置：

| 环境变量               | 说明                                     |
| ---------------------- | ---------------------------------------- |
| `R2_ACCOUNT_ID`        | Cloudflare 账户 ID，用于推导 S3 endpoint |
| `R2_ENDPOINT`          | 可选，显式 HTTPS S3 endpoint             |
| `R2_ACCESS_KEY_ID`     | 具有该桶读写权限的访问密钥 ID            |
| `R2_SECRET_ACCESS_KEY` | 对应 secret                              |
| `R2_BUCKET_NAME`       | 默认 `clips`                             |
| `R2_HIGHLIGHTS_KEY`    | 默认 `meta/game-highlights.json`         |

同时设置 `integrationConfig.highlights.mediaOrigin`，并将 `netlify.toml` 的 CSP `media-src` 中 `https://media.example.com` 改成同一个公开媒体域名。该域名是访问视频的公共地址，不是 S3 API endpoint。按使用场景配置桶 CORS，允许你的博客源站读取视频。

媒体按 `val/`、`df/`、`lol/`、`cs2/` 前缀发现，元数据写入上述 JSON key。保留现有存储字段和路径，不要直接重命名已有对象。支持 MP4、WebM 等视频及 Bilibili / YouTube / 抖音链接。管理员操作涉及持久化数据，先在自己的测试桶验证。

访客可浏览、搜索、筛选和播放；管理入口认证成功后才显示编辑、删除、同步等控件。播放器沿用源项目当前实现，外部播放器按打开视频时加载，失败时保留原生控件。

## 9. 构建与部署

Netlify 使用仓库 `netlify.toml`：构建命令 `pnpm build`，发布 `dist`，Node.js 22。密钥在 Netlify 中配置。完整动态功能依赖 Netlify 适配器和 Blobs，不是上传静态文件就能工作。

构建前 `scripts/toggle-proxy.ts` 会依据 `post.linkCard` 开关启停 `src/pages/api/proxy.ts`。构建后检查 Git 状态；关闭开关可能产生预期的代理文件改名。模板默认开启。

缓存、Pagefind WASM、视频嵌入权限见 `netlify.toml`。新增媒体源时同步修改 CSP。`dist/`、`.astro/`、`.netlify/` 和 `.env.local` 不提交。

## 10. 主题升级与迁移

本模板已同步 `blog-abohack` 的界面与运行代码，文章仍使用模板示例，个人域名、评论 ID、玩家 ID 和环境文件已替换。

后续使用本主题仓库作为上游：先提交自己的改动，再运行 `pnpm update-theme`。脚本使用独立 `theme` remote，不再合并最初的 Chiri 仓库；更新后保留未提交的合并结果供审阅。有冲突时手动解决，取消待完成合并可运行 `git merge --abort`。检查配置和内容，运行 lint/check/build，再提交。

若你已有旧版主题博客，迁移时保留自己的 `src/content/posts/`、`public/` 素材和站点配置，按本文迁移新增配置字段。不要将整个个人博客仓库当作模板覆盖，否则会引入他人的文章、域名和服务配置。

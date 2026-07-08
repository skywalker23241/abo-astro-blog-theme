# Cooper 博客系统使用指南

这份文档旨在帮助你快速上手 Cooper 博客系统，包括如何撰写文章、管理图片资源以及自定义网站配置。

## 1. 快速开始 (Quick Start)

确保你的电脑上已经安装了 Node.js。本项目推荐使用 `pnpm` 进行包管理。

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

在本地预览网站，实时查看修改效果：

```bash
pnpm dev
```
> 访问地址通常为: `http://localhost:4321`

### 构建生产版本

当你准备发布时，运行以下命令构建静态文件：

```bash
pnpm build
```
> 构建产物将位于 `dist/` 目录中。

---

## 2. 写作指南 (Writing Content)

所有的博客文章都存放在 `src/content/posts/` 目录下，支持 `.md` 和 `.mdx` 格式。

### 自动创建新文章（推荐）

项目内置了一个脚本，可以快速生成包含基础元数据（Frontmatter）的空文章。

**命令格式：**
```bash
pnpm new "你的文章标题"
```

**示例：**
1.  **创建普通文章：**
    ```bash
    pnpm new "My First Post"
    ```
    *这将创建 `src/content/posts/my-first-post.md`*

2.  **创建草稿（以 `_` 开头）：**
    ```bash
    pnpm new "_My Draft"
    ```
    *这将创建 `src/content/posts/_my-draft.md`。按照惯例，以 `_` 开头的文件通常被视为草稿或不被公开索引（具体取决于构建逻辑，但这是一个好的组织习惯）。*

### 手动创建文章

你也可以直接在 `src/content/posts/` 下新建文件。文件的头部必须包含 **Frontmatter**（元数据），格式如下：

```markdown
---
title: 文章标题
pubDate: '2025-12-03'
image: ./_assets/cover.png  # 可选：文章封面图路径
---

这里是文章的正文内容...
```

### Frontmatter 字段说明

根据 `src/content.config.ts` 的定义，目前支持以下字段：

| 字段 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `title` | 字符串 | **是** | 文章的标题 |
| `pubDate` | 日期 | **是** | 发布日期 (格式: YYYY-MM-DD) |
| `image` | 字符串 | 否 | 文章封面图/预览图的路径 |

---

## 3. 图片配置与管理 (Image Configuration)

这是本项目的核心功能之一，建议按照以下规范管理图片。

### 图片存放位置
建议将所有博客文章相关的图片存放在：
**`src/content/posts/_assets/`**

这样做的优点是图片与文章内容在同一级目录下（内容集合），便于引用和管理。

### 在文章中插入图片

#### 方式一：正文插图 (Markdown 标准语法)
在 `.md` 或 `.mdx` 文件中，使用相对路径引用 `_assets` 文件夹中的图片。

```markdown
![图片描述](./_assets/my-image.png)
```

#### 方式二：设置文章封面 (Frontmatter)
如果你希望文章在列表页显示缩略图或封面，请在文件头部的 `image` 字段中指定路径。

```yaml
---
title: 我的生活
pubDate: '2025-12-03'
image: ./_assets/life-cover.jpg
---
```

### 注意事项
*   **图片优化**：Astro 会自动处理引用的本地图片，进行压缩和格式转换。
*   **命名规范**：建议图片文件名使用小写字母和连字符（例如 `demo-yasb.png`），避免使用空格或特殊字符。

---

## 4. 网站全局配置 (Site Configuration)

网站的核心配置位于 `src/config.ts` 文件中。你可以修改此文件来个性化你的博客。

### 主要配置项 (`themeConfig`)

打开 `src/config.ts`，你可以看到如下配置块：

#### 1. 站点信息 (Site Info)
```typescript
site: {
  website: 'https://your-domain.com/', // 你的网站域名
  title: 'Cooper',                     // 网站标题 (显示在浏览器标签页)
  author: 'Your Name',                 // 作者名称
  description: '...',                  // 网站 SEO 描述
  language: 'zh_CN'                    // 默认语言
},
```

#### 2. 通用设置 (General)
```typescript
general: {
  contentWidth: '50rem',    // 内容区域宽度
  centeredLayout: true,     // 是否居中布局
  themeToggle: true,        // 是否显示深色/浅色模式切换按钮
  postListDottedDivider: false, // 文章列表是否显示虚线分割
  footer: true,             // 是否显示页脚
  fadeAnimation: true       // 是否启用页面切换时的淡入淡出动画
},
```

#### 3. 文章页设置 (Post)
```typescript
post: {
  readingTime: true,  // 显示预估阅读时间
  toc: true,          // 显示文章目录 (Table of Contents)
  imageViewer: true,  // 启用图片点击放大查看功能
  copyCode: true,     // 代码块显示“复制”按钮
  linkCard: true      // 启用链接卡片样式
}
```

---

## 5. 常用命令速查

| 功能 | 命令 | 说明 |
| :--- | :--- | :--- |
| **启动** | `pnpm dev` | 开启本地开发环境 |
| **新建** | `pnpm new "标题"` | 自动创建新文章 |
| **构建** | `pnpm build` | 打包生成静态文件 |
| **格式化** | `pnpm format` | 使用 Prettier 格式化代码 |
| **检查** | `pnpm lint` | 检查代码规范 |

---

## 6. 常见问题 (FAQ)

*   **如何修改导航栏？**
    *   导航栏通常在 `src/components/layout/Header.astro` 或 `src/pages/nav.astro` 中定义，或者查看是否使用了 `src/data/links.json` (如果在项目中存在) 来管理链接。
*   **如何添加自定义页面？**
    *   在 `src/pages/` 目录下新建 `.astro` 或 `.md` 文件即可。例如新建 `src/pages/about-me.astro`，访问路径即为 `/about-me`。

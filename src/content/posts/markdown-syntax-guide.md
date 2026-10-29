---
title: Markdown 语法与排版示例
pubDate: '2026-07-06'
description: 展示本模板支持的 Markdown 排版效果：标题、列表、表格、代码块、引用、链接卡片等。
---

这篇文章展示模板支持的各种 Markdown 排版效果，可以作为写作时的速查参考。

## 文本样式

**粗体**、_斜体_、**_粗斜体_**、~~删除线~~、`行内代码`，以及 [普通链接](https://astro.build)。

## 列表

无序列表：

- 第一项
- 第二项
  - 嵌套子项
- 第三项

有序列表：

1. 克隆仓库
2. 安装依赖
3. 开始写作

任务列表：

- [x] 添加示例文章
- [x] 完善 README
- [ ] 写第一篇真正的博客

## 引用

> 好的工具应该让你专注于内容本身，而不是工具。
>
> —— 某位博主

## 代码块

代码块自带语法高亮和一键复制按钮（可在 `src/config.ts` 的 `post.copyCode` 中开关）：

```ts
interface Post {
  title: string
  pubDate: Date
  description?: string
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
```

```python
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

## 表格

| 命令         | 作用           |
| ------------ | -------------- |
| `pnpm dev`   | 启动开发服务器 |
| `pnpm build` | 构建生产版本   |
| `pnpm new`   | 创建新文章     |
| `pnpm lint`  | 代码检查       |

## 分割线

---

## 图片

把图片放到 `src/assets/` 或 `public/` 中，然后用标准 Markdown 语法引用：

```md
![图片描述](../../assets/example.png)
```

启用图片查看器后（`post.imageViewer`），点击图片可以放大浏览。

## 链接卡片

启用 `post.linkCard` 后，独立成段的裸链接会自动渲染为带预览的卡片：

https://astro.build

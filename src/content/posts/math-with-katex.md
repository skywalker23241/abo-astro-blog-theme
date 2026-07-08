---
title: 用 KaTeX 书写数学公式
pubDate: '2026-07-04'
description: 在文章中启用 hasMath 后，即可使用 LaTeX 语法书写行内与块级数学公式。
hasMath: true
---

在 frontmatter 中设置 `hasMath: true`，就可以在文章里使用 [KaTeX](https://katex.org/) 渲染数学公式。

## 行内公式

用单个 `$` 包裹：质能方程 $E = mc^2$，欧拉恒等式 $e^{i\pi} + 1 = 0$，黄金分割比 $\varphi = \frac{1 + \sqrt{5}}{2}$。

## 块级公式

用 `$$` 包裹独立成段的公式。

高斯积分：

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

矩阵：

$$
\begin{pmatrix}
\cos\theta & -\sin\theta \\
\sin\theta & \cos\theta
\end{pmatrix}
\begin{pmatrix} x \\ y \end{pmatrix}
=
\begin{pmatrix} x\cos\theta - y\sin\theta \\ x\sin\theta + y\cos\theta \end{pmatrix}
$$

分段函数：

$$
f(x) =
\begin{cases}
x^2 & x \ge 0 \\
-x  & x < 0
\end{cases}
$$

求和与极限：

$$
\lim_{n \to \infty} \sum_{k=1}^{n} \frac{1}{k^2} = \frac{\pi^2}{6}
$$

## 注意事项

- 只有设置了 `hasMath: true` 的文章才会加载 KaTeX 样式，未启用的文章不会有额外开销。
- 语法与标准 LaTeX 数学模式一致，支持的命令列表见 [KaTeX 文档](https://katex.org/docs/supported.html)。

# 高光页配置指南

高光页地址为 `/highlights/`，支持按游戏、关键词和标签筛选，点击录像打开播放器。模板默认列表为空，不包含个人录像或游戏账号。

本指南对应当前仓库实现。所有域名、桶名和示例视频均需替换为自己的配置。

## 1. 选择使用方式

| 使用方式      | 需要准备                                   | 可以做什么                                               |
| ------------- | ------------------------------------------ | -------------------------------------------------------- |
| 本地列表      | 编辑 `src/data/game-highlights.ts`         | 展示固定视频列表；更新内容后重新构建                     |
| R2 动态录像库 | R2 桶、S3 凭据、公开媒体域名、Netlify 部署 | 自动发现视频；后台编辑标题、描述和标签；保存外部视频链接 |
| 点赞与评论    | Netlify Blobs、互动签名密钥                | 保存访客互动，独立于视频文件存储                         |

仅设置管理员口令可以通过身份验证，但不会获得持久化存储。后台新增、编辑、删除和同步功能还需要有效的 R2 配置，包括仅登记 Bilibili / YouTube 等外链视频的情况。

## 2. 不接 R2：先用本地列表

编辑 `src/data/game-highlights.ts`，保留已有类型定义，将末尾的空数组改为自己的内容：

```ts
export const gameHighlights: GameHighlight[] = [
  {
    id: 'my-first-clip',
    game: 'valorant',
    source: 'bilibili',
    url: 'https://www.bilibili.com/video/BV1xxxxxxxxx',
    title: '我的第一条游戏录像',
    date: '2026-10-29',
    description: '记录这次对局中值得回看的片段。',
    tags: ['残局', '步枪']
  }
]
```

请将上面的占位 BV 号换成真实视频地址。可以使用的 `source`：

| 值         | 链接形式                                                            |
| ---------- | ------------------------------------------------------------------- |
| `bilibili` | 包含 BV / av 号的完整视频页链接                                     |
| `youtube`  | 完整视频页、`youtu.be`、Shorts 或嵌入链接                           |
| `douyin`   | 包含数字视频 ID 的完整视频链接；短分享链接需先解析为完整地址        |
| `r2`       | 与 `integrationConfig.highlights.mediaOrigin` 同源的 HTTPS 视频直链 |

`id` 请使用稳定且唯一的字母、数字、连字符或下划线，避免改名导致互动记录无法对应。`game` 必须使用下一节列出的内部 ID。`date`、`description` 和 `tags` 可省略。

运行：

```bash
pnpm dev
```

打开 `http://localhost:4321/highlights/`。本地列表会被预渲染到页面中；未配置 R2 时，API 也返回该列表。R2 正常接入后，页面以动态扫描结果为准，本地数组不再作为日常内容管理入口。

外部视频能否播放还取决于平台嵌入权限及视频本身的可用状态。

## 3. 游戏名称与玩家 ID

同一文件中的 `gameProfiles` 配置展示名称、简称和玩家 ID。玩家 ID 默认留空，可按需填写。

| 内部 `game` ID      | 默认名称   | R2 对象前缀 |
| ------------------- | ---------- | ----------- |
| `valorant`          | 无畏契约   | `val/`      |
| `delta-force`       | 三角洲行动 | `df/`       |
| `league-of-legends` | 英雄联盟   | `lol/`      |
| `cs2`               | CS2        | `cs2/`      |

只改展示名称或玩家 ID 时，修改 `gameProfiles` 即可。当前游戏种类是代码中的固定集合，增加新游戏需要同时修改 `GameId`、API 的 `R2_GAME_PREFIXES`、标题解析映射，以及 `src/pages/highlights.astro` 的筛选标签和图标映射。

## 4. R2：创建桶并准备凭据

1. 在自己的 Cloudflare 账户中创建用于公开游戏录像的 R2 桶，例如 `clips`。
2. 创建 R2 S3 访问凭据，后台管理使用 **Object Read & Write** 权限，并将范围限制到该桶。保存生成的 Access Key ID 与 Secret Access Key；不要把普通 Cloudflare Bearer API Token 当成这两个值填写。具体入口与凭据说明见 [Cloudflare R2 身份验证文档](https://developers.cloudflare.com/r2/api/tokens/)。
3. 给该桶接入公开 HTTPS 媒体域名，例如 `https://media.example.com`。公开读取与 S3 API 访问是两项配置，接入方式见 [Cloudflare 公开桶文档](https://developers.cloudflare.com/r2/buckets/public-buckets/)。

本实现通过公开直链播放视频，不生成带有效期的私有播放地址。公开桶内不要混放私密文件，管理员口令只保护管理操作。

### 配置服务端环境变量

本地复制 `.env.example` 为 `.env.local`，在其中填写；生产环境在 Netlify 为站点的构建和函数运行环境配置相同变量，再重新部署。

```dotenv
PRIVATE_MEMO_ADMIN_PASSCODE=替换为自己的管理员口令
R2_ACCOUNT_ID=替换为自己的账户ID
R2_ACCESS_KEY_ID=替换为自己的访问密钥ID
R2_SECRET_ACCESS_KEY=替换为自己的访问密钥Secret
R2_BUCKET_NAME=clips
R2_HIGHLIGHTS_KEY=meta/game-highlights.json
```

| 变量                                        | 说明                                                       |
| ------------------------------------------- | ---------------------------------------------------------- |
| `PRIVATE_MEMO_ADMIN_PASSCODE`               | 高光页与笔记共用的管理员口令；留空则拒绝管理操作           |
| `R2_ACCOUNT_ID`                             | 用于推导 `https://<账户ID>.r2.cloudflarestorage.com`       |
| `R2_ENDPOINT`                               | 可选，显式指定完整 HTTPS S3 endpoint；设置后优先于自动推导 |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | 服务端列举对象、读取及写入元数据所用的凭据                 |
| `R2_BUCKET_NAME`                            | 桶名，默认 `clips`                                         |
| `R2_HIGHLIGHTS_KEY`                         | 元数据对象 key，默认 `meta/game-highlights.json`           |

特殊地域的桶应按 Cloudflare 提供的 endpoint 填写 `R2_ENDPOINT`。环境文件不要提交到 Git，也不要给这些变量加 `PUBLIC_` 前缀。

### 配置公开媒体域名与 CSP

修改 `src/config.ts` 中现有的配置项：

```ts
highlights: {
  mediaOrigin: 'https://media.example.com'
}
```

这里填写视频的公开源站，只包含协议和域名，不加路径与尾部 `/`，也不要填写 S3 API endpoint。

同步修改 `netlify.toml` 中现有 CSP 的 `media-src` 指令，将占位域名替换为自己的媒体域名：

```text
media-src 'self' https://media.example.com blob:;
```

保留同一 CSP 中的其他指令。配置变更后重新构建部署；仅更改环境变量不会改变已经打包的 `mediaOrigin`。

### 配置桶 CORS

下面是供桶的 CORS 编辑器使用的示例。将博客源站换成自己的域名；本地地址只在需要本地播放调试时保留，端口应与实际开发服务器一致：

```json
[
  {
    "AllowedOrigins": [
      "https://blog.example.com",
      "http://localhost:4321",
      "http://127.0.0.1:4321"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

源站写完整协议、域名及端口，不带页面路径。本示例允许浏览器读取媒体，不允许浏览器直接写桶；服务端通过 S3 签名写元数据。CORS 的字段和跨域响应规则参见 [Cloudflare CORS 文档](https://developers.cloudflare.com/r2/buckets/cors/)。

## 5. 上传视频与元数据

使用 R2 控制台或自己的 S3 工具上传视频，按游戏前缀组织对象：

```text
clips/
├── val/
│   └── my-first-clip.mp4
├── df/
│   └── extraction.webm
├── lol/
│   └── team-fight.mp4
├── cs2/
│   └── clutch.mp4
└── meta/
    └── game-highlights.json
```

图中的 `clips` 是桶名，不要在桶内再创建同名根目录。`val/my-first-clip.mp4` 对应的播放地址为 `https://media.example.com/val/my-first-clip.mp4`。

当前扫描识别 `.mp4`、`.webm`、`.mov`、`.m4v`、`.ogv`；识别扩展名不代表浏览器支持其中的所有编码。可先用浏览器兼容的视频编码制作一条小样片，确认播放和拖动进度正常后再批量上传。

新视频按上述前缀自动归类，默认标题来自文件名或标题解析规则，日期默认来自对象修改时间。新对象放在无法识别的目录下可能不会进入列表。

`meta/game-highlights.json` 保存标题、标签、描述与外部视频记录，是 JSON 数组。首次使用通常不需要手动创建，后台首次保存时会写入。不要向已有元数据文件填入 `{}` 或其他占位内容。

**高光页没有视频上传功能。** 后台“同步”会重新列举桶中已有对象，不会将电脑上的文件上传到 R2。

## 6. 后台日常操作

部署后打开 `/highlights/`，通过管理入口输入口令。访客可浏览和播放，认证成功后才显示管理控件。

| 操作         | 实际行为                                                   |
| ------------ | ---------------------------------------------------------- |
| 添加外部录像 | 登记 Bilibili / YouTube / 抖音链接，将记录保存到 R2 元数据 |
| 编辑录像     | 修改标题、描述、标签等元数据，不转码、不改写视频文件       |
| 同步         | 重新扫描桶中视频并刷新列表                                 |
| 删除外部录像 | 移除元数据中的外链记录，不删除平台原视频                   |
| 移除 R2 录像 | 需在 R2 中自行删除对应对象，再同步；页面不提供视频对象删除 |

R2 视频的游戏归类优先由对象前缀决定；要更改其游戏分类，应按前缀规划处理对象路径。对象改名或移动会影响播放 URL 和自动生成的 ID，已有标题、标签或互动记录可能无法继续对应。

元数据保存使用版本条件防止覆盖他人的更新。遇到冲突先刷新列表，再重新编辑，不要用空文件覆盖元数据。对已修改标题的旧录像，日常更新优先使用后台编辑，不要靠重新命名文件维护标题。

## 7. 点赞和评论

高光页的点赞与评论使用 `/api/highlight-interactions` 和 Netlify Blobs，**不使用 Giscus**。Giscus 的配置不会控制这部分评论。

在 Netlify 配置稳定的签名密钥：

```dotenv
HIGHLIGHT_INTERACTIONS_SECRET=替换为自己生成的随机长字符串
```

未设置该值时，当前实现回退使用 `R2_SECRET_ACCESS_KEY`；两者均为空时互动 API 返回不可用。视频播放本身不依赖互动可用。

互动按录像 ID 关联。访客身份通过签名 Cookie 识别，管理员可删除评论。完整验证需要自己的 Netlify Blobs 环境；静态预览不会运行这些 API。

## 8. 部署后验证

先在本地运行：

```bash
pnpm lint
pnpm check
pnpm test
pnpm build
pnpm preview
```

`http://localhost:1414/highlights/` 可查看构建后的页面和本地回退内容；Pagefind 预览服务不运行 R2 或互动 API。实际动态配置请在自己的 Netlify 测试站点验证：

1. 直接打开一条公开媒体 URL，确认无需登录即可访问。
2. 打开 `/api/game-highlights`，确认 `storageAvailable` 为 `true`，并检查返回的录像是否符合预期。仅 HTTP 200 不能证明 R2 已连接成功。
3. 用访客身份检查搜索、游戏和标签筛选、播放、关闭及滚动恢复。
4. 通过管理入口验证认证、编辑、添加外链和同步。
5. 若启用互动，验证点赞、发表评论及管理员删除评论。
6. 检查手机布局、浏览器控制台和媒体请求，确认没有 CSP / CORS 拦截。

新增视频和修改元数据通常无需重建博客；站点配置、源代码或本地列表变化需要重新构建。公开列表有短时缓存，管理员同步与普通访客的刷新结果可能不会在同一时刻更新。

## 9. 常见问题

| 现象                         | 检查方向                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------- |
| 默认页面没有录像             | 本地数组默认为空；先加示例，或配置 R2 并上传正确前缀的视频                   |
| API 返回 200，但仍是本地列表 | 查看 `storageAvailable` 和 `storageIssue`；确认 Netlify 变量已部署到运行环境 |
| `r2-not-configured`          | 检查账户 ID / endpoint、Access Key ID、Secret 是否完整                       |
| `r2-unavailable`             | 检查 endpoint、桶名、凭据有效性及桶权限                                      |
| `metadata-invalid`           | 检查元数据是不是合法的录像数组；恢复备份，避免覆盖已有记录                   |
| 管理入口验证失败             | 检查口令是否在 Netlify 配置，并已重新部署                                    |
| 认证成功但无法保存           | 口令认证与 R2 存储检查分开；继续检查 R2 配置和写入权限                       |
| 视频在桶里但未显示           | 检查目录前缀、扩展名和 API 的未分类提示，然后同步                            |
| 能看到卡片却无法播放         | 检查公开媒体域名、对象是否存在、CSP、CORS 和视频编码                         |
| R2 视频无法在页面删除        | 当前设计如此；在桶内删除对象后同步                                           |
| 点赞或评论不可用             | 检查签名密钥、Netlify Blobs、录像 ID，以及互动 API 的响应                    |
| 本地预览显示 API 请求失败    | `pnpm preview` 仅提供静态文件，动态流程请在 Netlify 验证                     |

## 10. 相关文件

| 文件                                      | 职责                         |
| ----------------------------------------- | ---------------------------- |
| `src/config.ts`                           | 公开媒体域名                 |
| `src/data/game-highlights.ts`             | 游戏资料、类型与本地回退列表 |
| `src/pages/highlights.astro`              | 页面和管理表单               |
| `src/pages/api/game-highlights.ts`        | R2 扫描与元数据管理          |
| `src/pages/api/highlight-interactions.ts` | 点赞与评论 API               |
| `src/lib/game-video.ts`                   | 视频来源校验和链接解析       |
| `src/lib/game-highlight-title.ts`         | 自动标题解析                 |
| `src/scripts/game-highlights.js`          | 筛选、播放器与管理交互       |
| `netlify.toml`                            | 部署、CSP、嵌入权限与缓存    |

返回 [README](./README.md) · [完整使用指南](./USAGE.md)

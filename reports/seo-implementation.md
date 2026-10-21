已在 `seo` 分支、基线 `main` 的 `49f1fea` 上完成三档 SEO。`npm test` 为 **102/102 通过**（原有 87 + 新增 15），`npm run build` 成功，`node scripts/verify-seo.mjs` 对最终 `dist` 的逐项断言全部通过。未新增依赖、SSR 框架或运行时服务，未改动数据层、窗口常量及现有筛选/聚合口径。

第一档在 `index.html` 补齐绝对分享图 URL、2240×1120 尺寸、Twitter 大图卡及图片、32px PNG / Apple Touch / 原尺寸 PNG 三组图标链接，保留 `theme-color=#f7f1e8`。description、og:description、twitter:description 均去掉数据来源表述，保留六个品牌、市场词、趋势/主题/节奏及 OnePage 卖点。直接引用已有素材，没有改名或修改图片。

第二档由 `scripts/seo-plugin.ts` 接入现有 Vite 构建。使用已安装的 `react-dom/server` 将纯展示组件 `SiteIntroduction` 渲染为 HTML，注入首页 `#root`；没有加载 App 的数据逻辑。该组件也位于运行时 `DashboardHeader` 首部，包含唯一站点 H1、简介、8 个市场链接、六品牌列表，以及邮件/看板/报告视图说明。静态首屏只写“覆盖 8 个市场、6 个品牌”，不包含冻结邮件总数。CSS、父容器及组件位置在构建期与运行时一致，React 现有 `createRoot` 在首次 commit 原位替换静态树，不提前清空 root；简介继续保留，不额外追加第二份。挂载测试确认静态旧树被替换，多次 render 后只有一个 H1 和 8 个市场链接。真实浏览器的视觉验证限制见下文。

首页同时注入一份有效 JSON-LD，包含 WebSite 和 Organization，使用本站名称、域名、语言及 publisher 引用，不含评分、评价、虚构搜索接口等信息。

第三档在同一 Vite 插件中生成 `dist/markets/{us,uk,au,fr,de,it,es,nl}/index.html`。每页有含国名及品牌词的独立中文 title / description、自身 canonical / og:url、一个 H1、三段市场说明、六品牌列表、返回首页以及 `/#emails/<大写市场代码>` 深链接；现有 URL 状态解析及站点同步已支持该格式。文案注明各市场不保证覆盖全部品牌。页面继承全站图标、分享图、Twitter 卡和构建后的 CSS，移除应用入口、模块预加载与数据接口 preconnect，直接访问时保持市场页，不会被 React 覆盖为首页。

样本计数由 `src/seo.ts` 在构建时使用 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY` 调用公开只读 `/rest/v1/emails` 接口：每市场一次 `HEAD`、`Prefer: count=exact`、市场过滤，以及直接导入 `LIVE_WINDOW` 的起止日期。没有写请求、管理员密钥、下载全量邮件或使用历史冻结计数。正数仅在收到有效精确 `Content-Range` 后显示，并注明构建日、窗口和“收录样本不代表全部发送量”；单请求 8 秒超时。HTTP/网络/超时失败、缺配置、未知/不安全总数或 JSON 回滚模式均省略数字。零样本（含 ES）显示“持续收录中”，不写“0 封”。

本次沙箱的 Node 请求报 `EPERM`，curl 也无法连接 egress 代理，因此 8 个市场的实际产物全部使用无数字降级文案。没有据此推断其他市场没有样本，也没有声称取到了 ES 的实时零值。成功计数、真实零值、部分市场失败、超时和未知总数的分支均由隔离网络的测试覆盖。部署构建能访问 Supabase 且配置相同公开环境变量后，将自动输出真实正数，无需更改代码。

`public/sitemap.xml` 的旧静态文件已移除，改由构建生成 `dist/sitemap.xml`，共首页 + 8 市场页，首页 daily、市场 weekly；全部 `lastmod` 取一次构建的 UTC 日期。本次运行环境的 `new Date().toISOString()` / UTC 时钟为 **2026-10-21**，所以产物为 `2026-10-21`；与任务上下文日期 2026-10-22 有差异，未人为伪造构建日期。以后随构建环境时钟自动更新。

Cloudflare Pages 继续使用 `npm run build`、输出目录 `dist`。`_headers` 原样复制：只有 `/assets/*` 使用一年 immutable 缓存，`/*` 的三项安全头同样适用于市场 HTML；没有强制 HTML 类型或覆盖路由的规则。未新增 `_redirects`、`_worker.js` 或顶层 `404.html`。根据 [Cloudflare 路径匹配规则](https://developers.cloudflare.com/pages/configuration/serving-pages/)，匹配到 `/markets/us/index.html` 等静态文件就服务该文件，没有匹配文件时仍使用原有 SPA 回退；[静态响应的 `_headers` 规则](https://developers.cloudflare.com/pages/configuration/headers/)与此兼容。8 个目录中的 HTML 已逐一核验，但本次未部署线上，也没有将本地产物检查宣称为线上 HTTP 实测。

最终产物执行 `node scripts/verify-seo.mjs`，完整输出保存在 [seo-dist-verification.txt](seo-dist-verification.txt)。该脚本独立读取 `dist`，不调用生成函数，也不联网。结果如下：

| 产物 | 自验结果 |
| --- | --- |
| `dist/index.html` | root 非空；唯一 H1、简介、8 市场入口、六品牌、三视图链接、WebSite/Organization JSON-LD 均存在 |
| 首页与 8 市场页 | canonical 唯一且正确，分享图/尺寸、Twitter 大图卡、三图标 link、主题色一致；三种描述均不含数据来源名 |
| `dist/markets/us/index.html` | 美国专属 title/description/H1，三段说明，六品牌，`/#emails/US`，计数降级，无 SPA 脚本 |
| `dist/markets/uk/index.html` | 英国专属 title/description/H1，三段说明，六品牌，`/#emails/UK`，计数降级，无 SPA 脚本 |
| `dist/markets/au/index.html` | 澳大利亚专属 title/description/H1，三段说明，六品牌，`/#emails/AU`，计数降级，无 SPA 脚本 |
| `dist/markets/fr/index.html` | 法国专属 title/description/H1，三段说明，六品牌，`/#emails/FR`，计数降级，无 SPA 脚本 |
| `dist/markets/de/index.html` | 德国专属 title/description/H1，三段说明，六品牌，`/#emails/DE`，计数降级，无 SPA 脚本 |
| `dist/markets/it/index.html` | 意大利专属 title/description/H1，三段说明，六品牌，`/#emails/IT`，计数降级，无 SPA 脚本 |
| `dist/markets/es/index.html` | 西班牙专属 title/description/H1，三段说明，六品牌，`/#emails/ES`，“持续收录中”，无“0 封”，无 SPA 脚本 |
| `dist/markets/nl/index.html` | 荷兰专属 title/description/H1，三段说明，六品牌，`/#emails/NL`，计数降级，无 SPA 脚本 |
| `dist/sitemap.xml` | 9 条绝对 URL，统一 lastmod，首页 daily，8 市场 weekly |
| `_headers`、`robots.txt`、4 张素材 | 与 `public` 对应文件逐字节一致；robots 仍指向原 sitemap URL |
| 全部 HTML 引用的 CSS | 均真实存在，并包含简介、市场页和列表所需的样式选择器 |

实际执行的 `rg` 关键标签检查及摘录：

```sh
rg -o '<meta (property="og:image[^"]*"|name="twitter:(card|image)"|name="theme-color")[^>]*>|<link rel="(icon|apple-touch-icon)"[^>]*>' dist/index.html
rg -o '<h1[^>]*>[^<]*</h1>|覆盖 8 个市场、6 个品牌|href="/markets/[a-z]+/"|href="/#(emails|dashboard|report)"|"@type":"[^"]+"' dist/index.html
rg '<title>|rel="canonical"|<h1|持续收录中|href="/#emails/' dist/markets/*/index.html
rg '<loc>|<lastmod>|<changefreq>' dist/sitemap.xml
```

```html
<meta property="og:image" content="https://edmwatch.com/og-image.jpg" />
<meta property="og:image:width" content="2240" />
<meta property="og:image:height" content="1120" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://edmwatch.com/og-image.jpg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="icon" type="image/png" href="/favicon.png" />
<h1 class="dashboard-title text-[var(--text-heading)]">品牌营销触达趋势看板</h1>
<link rel="canonical" href="https://edmwatch.com/markets/es/" />
<h1 class="dashboard-title">西班牙市场邮件营销分析</h1>
```

`file dist/og-image.jpg dist/*.png` 另确认：分享图实际为 2240×1120 JPEG，favicon.png 为 1600×1600 PNG，favicon-32.png 为 32×32 PNG，apple-touch-icon.png 为 180×180 PNG。

验证记录：

```text
npm test
tests 102 / suites 12 / pass 102 / fail 0 / skipped 0
（原有 87 项全部保留；新增 tests/seo.test.mjs 15 项）

npm run build
tsc -b && vite build
2210 modules transformed
dist/index.html + 8 个市场 HTML + sitemap.xml 均生成
✓ built in 5.47s

node scripts/verify-seo.mjs
SEO dist 自验全部通过

git diff --check
通过，无空白错误
```

测试覆盖市场页数据组装与真实 URL 参数解析、正数/零值/无效值、公开计数请求的过滤和窗口、失败降级、首屏注入及锚点错误、JSON-LD、React 原位替换、市场文档脚本隔离与转义、分享元信息、sitemap 的路径/频率/构建日期。网络均为边界替身，不在测试里读取 `.env` 或访问真实服务。

环境准备时，原 `node_modules` 链接的目标缺失当前 lockfile 已声明的 Lucide/Radix/TanStack 包，导致原有测试失败。已使用与本仓库 `package-lock.json` SHA-256 完全一致的 `../edm-comp-ui/node_modules`，在 `/tmp/edm-seo-node-modules` 建立只读包链接及可写的 Vite 临时目录，再将本工作区链接指向该目录；依赖声明和 lockfile 均未改动。仅从原项目复制已有三个公开客户端配置到本工作区被忽略的 `.env`，未提交配置或在日志中输出 key。环境重建时可按 lockfile 重新安装依赖并配置公开变量。

遗留限制：SEO 生成型文案及落地页 v1 **只做中文**，看板语言切换不翻译这部分；计数及 sitemap 时间在重新构建时更新。当前沙箱无法访问 Supabase，因此实际产物不显示样本数字。Chromium 和 headless shell 均被沙箱的 `setsockopt` / `shutdown: Operation not permitted` 拦截，未完成真实浏览器视觉/闪烁/布局及 HTTP 直访实测；已完成静态结构、样式引用、React 挂载接管测试和 Cloudflare 文件路由兼容性核验。未执行线上部署。

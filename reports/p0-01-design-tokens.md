# P0-01：Design Token 收敛审计

- 日期：2026-10-17。基线：`main` / `e9949a9`。只做样式 Token 迁移，不合并相近色、不改交互或数据口径。
- 未修改 `src/supabase.ts`、`src/email-data.ts`、`src/site-data.tsx`、`src/onepage-report.ts`、`.env`；未操作数据库，未 commit/push。
- 基线扫描覆盖 `src/` 全部文件中的十六进制、`rgb()`、`rgba()` 字面量；以下原位置均为基线行号。

## 汇总

| 指标 | 结果 |
| --- | --- |
| 基线颜色字面量 | 305 处 / 125 种值 |
| 重复颜色 | 48 种；相同值重复出现的冗余位置合计 180 处 |
| TS/TSX 中原有字面量 | 282 → 0：272 处迁移为 Token 引用，10 处未使用的 `PALETTE` 颜色删除 |
| 原 `src/index.css` 中字面量 | 23 → 0 |
| 新单一颜色定义源 | `src/tokens.css`：116 处 / 116 种，无重复字面量；115 种沿用原色，另显式声明原 Tailwind 黑色 |
| 本轮范围净减少字面量 | 305 − 116 = 189 处；不含执行中出现的旁路未跟踪文件 |
| Token 总数 | 207 个 CSS 变量，包含颜色基础值、语义别名及排版/卡片规格 |
| 文字对比度 | 120 组配对通过，最低 4.5280:1 |
| 动态周频热力图 | 23,495 个组合通过，最低 5.1765:1 |

## 改动文件

共修改 19 个已有文件，新增 Token 文件与本报告，共 21 个本轮文件。位置为改动起始行（迁移后）。

| 文件 + 行号 | 用途 |
| --- | --- |
| `src/tokens.css:1` | 全部设计 Token；Tailwind 主题桥接 |
| `src/App.tsx:14` | 原配色/相关样式改为 Token 引用 |
| `src/components/BrandDetailDialog.tsx:153` | 原配色/相关样式改为 Token 引用 |
| `src/components/BrandThemeBreakdown.tsx:126` | 原配色/相关样式改为 Token 引用 |
| `src/components/CalendarView.tsx:20` | 原配色/相关样式改为 Token 引用 |
| `src/components/CampaignOverview.tsx:21` | 原配色/相关样式改为 Token 引用 |
| `src/components/Card.tsx:15` | 原配色/相关样式改为 Token 引用 |
| `src/components/DashboardHeader.tsx:33` | 原配色/相关样式改为 Token 引用 |
| `src/components/ExtendedEmailFilter.tsx:34` | 原配色/相关样式改为 Token 引用 |
| `src/components/ExtendedEmailsState.tsx:19` | 原配色/相关样式改为 Token 引用 |
| `src/components/MarkdownReport.tsx:150` | 原配色/相关样式改为 Token 引用 |
| `src/components/MarketComparison.tsx:259` | 原配色/相关样式改为 Token 引用 |
| `src/components/MarketFilter.tsx:51` | 原配色/相关样式改为 Token 引用 |
| `src/components/SnapshotState.tsx:14` | 原配色/相关样式改为 Token 引用 |
| `src/components/ThemeDistribution.tsx:148` | 原配色/相关样式改为 Token 引用 |
| `src/components/WordCloud.tsx:24` | 原配色/相关样式改为 Token 引用 |
| `src/components/dashboard.ts:0` | 六主题填充/浅底/标签映射；删除未使用 PALETTE 和组件主题变量注入 |
| `src/data.ts:58` | 仅替换五个静态主题 color 字段；数据值与逻辑不变 |
| `src/index.css:2` | 引入 Token；通用背景、标题、卡片、响应式规范 |
| `src/three-week-aggregation.ts:117` | 仅替换主题色与标签色的样式兜底；聚合逻辑不变 |
| `reports/p0-01-design-tokens.md:1` | 完整颜色、Token、对比度及门禁记录 |

## Token 约定

- `--surface-*`：页面、卡片、表格、日历等表面；`--text-*`：主文字、正文、次文字、辅助文字和局部兼容色。近似色不合并。
- `--border-*`、`--divider*`：边框、控件边框和分隔线；`--accent*`：强调填充、可读深色文字和浅底。
- 六主题键为 `price`、`behavior`、`new`、`lifestyle`、`category`、`other`。每组提供填充、`-tint`、`-text`、`-border`、`-label`。`-text` 用于浅底徽标，`-label` 用于实色图表；两者不能混用。
- `other` 的图表中性填充与邮件过滤圆点原本不同，分别保留 `--theme-other` 和 `--theme-other-indicator`。静态快照及词云原色使用独立命名空间保留。
- `--status-{success,warning,error}*`：状态文字/背景/边框；成功、错误等暂无独立着色控件的角色只定义，不新增状态 UI、不强行改色。
- `--control-*`：默认、hover、active、disabled、focus，以及邮件过滤、日历的原有状态变体。disabled 尚无活跃控件，预留配对也达到 4.5:1，不新增 disabled 行为。
- `--type-h1-*`、`--type-h2-*`、`--type-h3-*`、`--type-body-*`、`--type-helper-*`：标题、正文和辅助文字；保留原响应式字号。报告 15px 正文单独保留。
- `--card-*`、`--kpi-*`、`--shadow-*`：圆角、响应式内边距、边框、普通/hover/报告阴影；日历紧凑内边距保持原值。
- 现有 `text-slate-*`、`bg-slate-*`、`border-slate-*`、`text-white` 等仍可使用，它们由同一 `@theme` Token 提供颜色，不再在组件中写字面量。
- 动态 HSL 色阶保留原按样本量计算、`toFixed(1)` 舍入和黑白文字切换的算法，固定 hue/saturation 引用 Token；不改数据到色阶的映射。

### 全量 Token 清单

| Token | 定义值 / 别名 | 定义位置 |
| --- | --- | --- |
| `--font-sans` | `-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif` | `src/tokens.css:2` |
| `--color-white` | `#ffffff` | `src/tokens.css:4` |
| `--color-black` | `#000000` | `src/tokens.css:5` |
| `--color-slate-50` | `#faf6ef` | `src/tokens.css:6` |
| `--color-slate-100` | `#f2eade` | `src/tokens.css:7` |
| `--color-slate-200` | `#e5dbce` | `src/tokens.css:8` |
| `--color-slate-300` | `#d0c2b1` | `src/tokens.css:9` |
| `--color-slate-400` | `#938273` | `src/tokens.css:10` |
| `--color-slate-500` | `#75695e` | `src/tokens.css:11` |
| `--color-slate-600` | `#685d53` | `src/tokens.css:12` |
| `--color-slate-700` | `#51483f` | `src/tokens.css:13` |
| `--color-slate-800` | `#342d27` | `src/tokens.css:14` |
| `--color-slate-900` | `#29231f` | `src/tokens.css:15` |
| `--color-slate-950` | `#1f1c19` | `src/tokens.css:16` |
| `--text-xs` | `var(--type-helper-size)` | `src/tokens.css:20` |
| `--text-xs--line-height` | `var(--type-helper-leading)` | `src/tokens.css:21` |
| `--text-sm` | `var(--type-body-size)` | `src/tokens.css:22` |
| `--text-sm--line-height` | `var(--type-body-leading)` | `src/tokens.css:23` |
| `--text-base` | `var(--type-h3-size)` | `src/tokens.css:24` |
| `--text-base--line-height` | `var(--type-h3-leading)` | `src/tokens.css:25` |
| `--radius-2xl` | `var(--card-radius)` | `src/tokens.css:26` |
| `--surface-page` | `#f7f1e8` | `src/tokens.css:30` |
| `--surface-card` | `#fffdf9` | `src/tokens.css:31` |
| `--surface-subtle` | `var(--color-slate-50)` | `src/tokens.css:32` |
| `--surface-raised` | `#fffaf3` | `src/tokens.css:33` |
| `--surface-table-stripe` | `#f8f2e9` | `src/tokens.css:34` |
| `--surface-table-hover` | `#fff1e9` | `src/tokens.css:35` |
| `--surface-table-header` | `#28231f` | `src/tokens.css:36` |
| `--surface-calendar` | `#fffaf1` | `src/tokens.css:37` |
| `--surface-calendar-tabs` | `#f7eee2` | `src/tokens.css:38` |
| `--surface-calendar-hover` | `#fff3e4` | `src/tokens.css:39` |
| `--surface-calendar-outside` | `#f7f1e9` | `src/tokens.css:40` |
| `--surface-calendar-detail` | `#fff6e9` | `src/tokens.css:41` |
| `--surface-calendar-item` | `#fffdf8` | `src/tokens.css:42` |
| `--surface-wordcloud-hover` | `#f1e5d8` | `src/tokens.css:43` |
| `--surface-page-glow-accent` | `rgb(229 95 71 / 0.05)` | `src/tokens.css:44` |
| `--surface-page-glow-warm` | `rgb(195 138 36 / 0.06)` | `src/tokens.css:45` |
| `--selection-bg` | `#f3c5b5` | `src/tokens.css:46` |
| `--text-primary` | `var(--color-slate-900)` | `src/tokens.css:48` |
| `--text-body` | `var(--color-slate-800)` | `src/tokens.css:49` |
| `--text-secondary` | `var(--color-slate-600)` | `src/tokens.css:50` |
| `--text-muted` | `var(--color-slate-500)` | `src/tokens.css:51` |
| `--text-heading` | `var(--color-slate-950)` | `src/tokens.css:52` |
| `--text-inverse` | `var(--color-white)` | `src/tokens.css:53` |
| `--text-control` | `#292521` | `src/tokens.css:54` |
| `--text-label` | `#6f665c` | `src/tokens.css:55` |
| `--text-description` | `#6f655b` | `src/tokens.css:56` |
| `--text-caption` | `#746a60` | `src/tokens.css:57` |
| `--text-detail` | `#5f574f` | `src/tokens.css:58` |
| `--text-email-intro` | `#302c28` | `src/tokens.css:59` |
| `--text-email-table` | `#312d29` | `src/tokens.css:60` |
| `--text-email-brand` | `#211e1b` | `src/tokens.css:61` |
| `--text-table-inverse` | `var(--surface-table-stripe)` | `src/tokens.css:62` |
| `--text-calendar-heading` | `#1c1917` | `src/tokens.css:63` |
| `--text-calendar-secondary` | `#6f655e` | `src/tokens.css:64` |
| `--text-calendar-muted` | `#7f7167` | `src/tokens.css:65` |
| `--text-calendar-outside` | `#776b63` | `src/tokens.css:66` |
| `--text-calendar-label` | `#514943` | `src/tokens.css:67` |
| `--text-notice` | `#9b4b3c` | `src/tokens.css:68` |
| `--border-default` | `var(--color-slate-200)` | `src/tokens.css:70` |
| `--border-hover` | `var(--color-slate-300)` | `src/tokens.css:71` |
| `--border-strong` | `#d9d0c3` | `src/tokens.css:72` |
| `--border-control` | `#d4cabd` | `src/tokens.css:73` |
| `--border-control-hover` | `#9f9487` | `src/tokens.css:74` |
| `--border-calendar` | `#e7dccd` | `src/tokens.css:75` |
| `--border-calendar-control` | `#dfd2c2` | `src/tokens.css:76` |
| `--border-calendar-hover` | `#d98262` | `src/tokens.css:77` |
| `--border-calendar-legend` | `#e4d8c9` | `src/tokens.css:78` |
| `--border-calendar-outside` | `#eee5da` | `src/tokens.css:79` |
| `--border-calendar-detail` | `#e3d4c2` | `src/tokens.css:80` |
| `--border-calendar-item` | `#eadfd1` | `src/tokens.css:81` |
| `--border-calendar-input` | `#d9cbbb` | `src/tokens.css:82` |
| `--border-wordcloud` | `#ded2c3` | `src/tokens.css:83` |
| `--border-wordcloud-control` | `#cfc1b1` | `src/tokens.css:84` |
| `--divider` | `var(--border-default)` | `src/tokens.css:85` |
| `--divider-table` | `#efe9e0` | `src/tokens.css:86` |
| `--divider-email` | `#e5ddd2` | `src/tokens.css:87` |
| `--divider-calendar` | `#eee3d6` | `src/tokens.css:88` |
| `--divider-wordcloud` | `#e2d7ca` | `src/tokens.css:89` |
| `--chart-empty` | `#e5ddd3` | `src/tokens.css:90` |
| `--accent` | `var(--theme-price)` | `src/tokens.css:92` |
| `--accent-ink` | `#a13f2d` | `src/tokens.css:93` |
| `--accent-tint` | `#fff0e9` | `src/tokens.css:94` |
| `--accent-wordcloud` | `#b94330` | `src/tokens.css:95` |
| `--theme-price` | `#e55f47` | `src/tokens.css:97` |
| `--theme-price-tint` | `#fff0eb` | `src/tokens.css:98` |
| `--theme-price-text` | `#8f2f20` | `src/tokens.css:99` |
| `--theme-price-border` | `#f0a08f` | `src/tokens.css:100` |
| `--theme-behavior` | `#c38a24` | `src/tokens.css:101` |
| `--theme-behavior-tint` | `#fff7e2` | `src/tokens.css:102` |
| `--theme-behavior-text` | `#75500d` | `src/tokens.css:103` |
| `--theme-behavior-border` | `#d9b36c` | `src/tokens.css:104` |
| `--theme-new` | `#568d72` | `src/tokens.css:105` |
| `--theme-new-tint` | `#edf7f1` | `src/tokens.css:106` |
| `--theme-new-text` | `#285d47` | `src/tokens.css:107` |
| `--theme-new-border` | `#8bb39e` | `src/tokens.css:108` |
| `--theme-lifestyle` | `#8069a3` | `src/tokens.css:109` |
| `--theme-lifestyle-tint` | `#f4f0f9` | `src/tokens.css:110` |
| `--theme-lifestyle-text` | `#594576` | `src/tokens.css:111` |
| `--theme-lifestyle-border` | `#aa9ac4` | `src/tokens.css:112` |
| `--theme-category` | `#558b97` | `src/tokens.css:113` |
| `--theme-category-tint` | `#edf6f7` | `src/tokens.css:114` |
| `--theme-category-text` | `#315f69` | `src/tokens.css:115` |
| `--theme-category-border` | `#84aeb8` | `src/tokens.css:116` |
| `--theme-other` | `#9a8f85` | `src/tokens.css:117` |
| `--theme-other-indicator` | `#a39a8d` | `src/tokens.css:118` |
| `--theme-other-tint` | `#f4f0e9` | `src/tokens.css:119` |
| `--theme-other-text` | `#655e55` | `src/tokens.css:120` |
| `--theme-other-border` | `#c9c1b6` | `src/tokens.css:121` |
| `--theme-label-dark` | `#171411` | `src/tokens.css:122` |
| `--theme-price-label` | `var(--theme-label-dark)` | `src/tokens.css:123` |
| `--theme-behavior-label` | `var(--theme-label-dark)` | `src/tokens.css:124` |
| `--theme-new-label` | `var(--theme-label-dark)` | `src/tokens.css:125` |
| `--theme-lifestyle-label` | `var(--text-inverse)` | `src/tokens.css:126` |
| `--theme-category-label` | `var(--theme-label-dark)` | `src/tokens.css:127` |
| `--theme-other-label` | `var(--theme-label-dark)` | `src/tokens.css:128` |
| `--theme-snapshot-price` | `#e85d7a` | `src/tokens.css:130` |
| `--theme-snapshot-behavior` | `#f0a030` | `src/tokens.css:131` |
| `--theme-snapshot-new` | `#3fa66a` | `src/tokens.css:132` |
| `--theme-snapshot-lifestyle` | `#8e7cc3` | `src/tokens.css:133` |
| `--theme-snapshot-category` | `#5b9bd5` | `src/tokens.css:134` |
| `--word-category` | `#d95d45` | `src/tokens.css:135` |
| `--word-promotion` | `#c77b18` | `src/tokens.css:136` |
| `--word-style` | `#e28a57` | `src/tokens.css:137` |
| `--word-audience` | `#c9573f` | `src/tokens.css:138` |
| `--word-other` | `#b87912` | `src/tokens.css:139` |
| `--status-success` | `var(--theme-new-text)` | `src/tokens.css:141` |
| `--status-success-bg` | `var(--theme-new-tint)` | `src/tokens.css:142` |
| `--status-success-border` | `var(--theme-new-border)` | `src/tokens.css:143` |
| `--status-warning` | `var(--theme-behavior-text)` | `src/tokens.css:144` |
| `--status-warning-bg` | `var(--theme-behavior-tint)` | `src/tokens.css:145` |
| `--status-warning-border` | `#e8c87a` | `src/tokens.css:146` |
| `--status-error` | `var(--theme-price-text)` | `src/tokens.css:147` |
| `--status-error-bg` | `var(--theme-price-tint)` | `src/tokens.css:148` |
| `--status-error-border` | `var(--theme-price-border)` | `src/tokens.css:149` |
| `--control-bg` | `var(--surface-card)` | `src/tokens.css:151` |
| `--control-text` | `var(--text-secondary)` | `src/tokens.css:152` |
| `--control-border` | `var(--border-default)` | `src/tokens.css:153` |
| `--control-hover-bg` | `var(--color-slate-100)` | `src/tokens.css:154` |
| `--control-hover-text` | `var(--text-heading)` | `src/tokens.css:155` |
| `--control-hover-border` | `var(--border-hover)` | `src/tokens.css:156` |
| `--control-active-bg` | `var(--color-slate-900)` | `src/tokens.css:157` |
| `--control-active-text` | `var(--text-inverse)` | `src/tokens.css:158` |
| `--control-active-border` | `var(--control-active-bg)` | `src/tokens.css:159` |
| `--control-disabled-bg` | `var(--color-slate-100)` | `src/tokens.css:160` |
| `--control-disabled-text` | `var(--text-secondary)` | `src/tokens.css:161` |
| `--control-disabled-border` | `var(--border-default)` | `src/tokens.css:162` |
| `--control-focus` | `var(--accent-ink)` | `src/tokens.css:163` |
| `--control-focus-offset` | `var(--surface-page)` | `src/tokens.css:164` |
| `--control-filter-bg` | `var(--surface-raised)` | `src/tokens.css:165` |
| `--control-filter-text` | `var(--text-control)` | `src/tokens.css:166` |
| `--control-filter-border` | `var(--border-control)` | `src/tokens.css:167` |
| `--control-filter-hover-bg` | `var(--color-white)` | `src/tokens.css:168` |
| `--control-filter-hover-border` | `var(--border-control-hover)` | `src/tokens.css:169` |
| `--control-filter-active-bg` | `var(--text-heading)` | `src/tokens.css:170` |
| `--control-filter-active-text` | `var(--text-inverse)` | `src/tokens.css:171` |
| `--control-filter-focus` | `var(--text-heading)` | `src/tokens.css:172` |
| `--control-calendar-focus` | `#d5674e` | `src/tokens.css:173` |
| `--control-calendar-focus-soft` | `var(--selection-bg)` | `src/tokens.css:174` |
| `--calendar-heat-empty` | `#f2eadf` | `src/tokens.css:176` |
| `--calendar-heat-1` | `#f8ddb2` | `src/tokens.css:177` |
| `--calendar-heat-2` | `#f3bc7c` | `src/tokens.css:178` |
| `--calendar-heat-3` | `#e99061` | `src/tokens.css:179` |
| `--calendar-heat-4` | `#b65343` | `src/tokens.css:180` |
| `--calendar-heat-5` | `#7d342f` | `src/tokens.css:181` |
| `--heatmap-high-hue` | `14` | `src/tokens.css:182` |
| `--heatmap-high-saturation` | `65%` | `src/tokens.css:183` |
| `--heatmap-low-saturation` | `80%` | `src/tokens.css:184` |
| `--type-h1-size` | `1.5rem` | `src/tokens.css:186` |
| `--type-h1-size-sm` | `1.875rem` | `src/tokens.css:187` |
| `--type-h1-size-lg` | `2.25rem` | `src/tokens.css:188` |
| `--type-h1-leading` | `1.375` | `src/tokens.css:189` |
| `--type-h1-weight` | `800` | `src/tokens.css:190` |
| `--type-h2-size` | `1.125rem` | `src/tokens.css:191` |
| `--type-h2-size-sm` | `1.25rem` | `src/tokens.css:192` |
| `--type-h2-leading` | `1.75rem` | `src/tokens.css:193` |
| `--type-h2-weight` | `700` | `src/tokens.css:194` |
| `--type-h3-size` | `1rem` | `src/tokens.css:195` |
| `--type-h3-leading` | `1.5` | `src/tokens.css:196` |
| `--type-h3-weight` | `700` | `src/tokens.css:197` |
| `--type-body-size` | `0.875rem` | `src/tokens.css:198` |
| `--type-body-leading` | `calc(1.25 / 0.875)` | `src/tokens.css:199` |
| `--type-body-weight` | `400` | `src/tokens.css:200` |
| `--type-body-report-size` | `15px` | `src/tokens.css:201` |
| `--type-helper-size` | `0.75rem` | `src/tokens.css:202` |
| `--type-helper-leading` | `calc(1 / 0.75)` | `src/tokens.css:203` |
| `--type-helper-weight` | `400` | `src/tokens.css:204` |
| `--type-heading-tracking` | `-0.025em` | `src/tokens.css:205` |
| `--card-radius` | `1rem` | `src/tokens.css:207` |
| `--card-padding` | `1rem` | `src/tokens.css:208` |
| `--card-padding-sm` | `1.25rem` | `src/tokens.css:209` |
| `--card-border` | `var(--border-default)` | `src/tokens.css:210` |
| `--card-border-hover` | `var(--border-hover)` | `src/tokens.css:211` |
| `--shadow-color-soft` | `rgb(52 45 39 / 0.04)` | `src/tokens.css:212` |
| `--card-shadow` | `0 4px 18px var(--shadow-color-soft)` | `src/tokens.css:213` |
| `--card-shadow-hover` | `0 6px 22px rgb(52 45 39 / 0.06)` | `src/tokens.css:214` |
| `--card-report-shadow` | `0 6px 24px rgb(52 45 39 / 0.05)` | `src/tokens.css:215` |
| `--card-calendar-padding` | `0.75rem` | `src/tokens.css:216` |
| `--card-calendar-padding-sm` | `1rem` | `src/tokens.css:217` |
| `--kpi-padding` | `0.875rem` | `src/tokens.css:218` |
| `--kpi-padding-sm` | `1.25rem 1.5rem` | `src/tokens.css:219` |
| `--shadow-switcher` | `0 2px 6px var(--shadow-color-soft)` | `src/tokens.css:220` |
| `--shadow-filter-active` | `0 8px 20px -14px rgba(31, 28, 25, 0.9)` | `src/tokens.css:221` |
| `--shadow-filter-accent-active` | `0 8px 20px -14px rgba(180, 55, 35, 0.9)` | `src/tokens.css:222` |
| `--shadow-table-header` | `0 1px 0 rgba(255, 255, 255, 0.12)` | `src/tokens.css:223` |
| `--shadow-calendar-panel` | `inset 0 1px 0 rgba(255, 255, 255, 0.8)` | `src/tokens.css:224` |
| `--filter-chart-hover` | `drop-shadow(0 4px 8px rgb(0 0 0 / 0.15))` | `src/tokens.css:225` |

## 基线颜色审计

先列重复项，再列只出现一次的值；同一行出现多次时位置也重复保留，保证可核对次数。

| 字面量 | 次数 | 基线位置 |
| --- | ---: | --- |
| `#292521` | 21 | `src/components/ExtendedEmailFilter.tsx:155`、`src/components/ExtendedEmailFilter.tsx:174`、`src/components/ExtendedEmailFilter.tsx:206`、`src/components/ExtendedEmailFilter.tsx:225`、`src/components/ExtendedEmailFilter.tsx:246`、`src/components/ExtendedEmailFilter.tsx:321`、`src/components/ExtendedEmailFilter.tsx:331`、`src/components/ExtendedEmailFilter.tsx:331`、`src/components/ExtendedEmailsState.tsx:28`、`src/components/MarketComparison.tsx:275`、`src/components/MarketComparison.tsx:281`、`src/components/MarketComparison.tsx:489`、`src/components/MarketFilter.tsx:69`、`src/components/SnapshotState.tsx:23`、`src/components/WordCloud.tsx:154`、`src/components/WordCloud.tsx:172`、`src/components/WordCloud.tsx:175`、`src/components/WordCloud.tsx:177`、`src/components/WordCloud.tsx:193`、`src/components/WordCloud.tsx:200`、`src/components/WordCloud.tsx:225` |
| `#1c1917` | 17 | `src/components/CalendarView.tsx:258`、`src/components/CalendarView.tsx:277`、`src/components/CalendarView.tsx:297`、`src/components/CalendarView.tsx:297`、`src/components/CalendarView.tsx:298`、`src/components/CalendarView.tsx:327`、`src/components/CalendarView.tsx:328`、`src/components/CalendarView.tsx:339`、`src/components/CalendarView.tsx:433`、`src/components/CalendarView.tsx:434`、`src/components/CalendarView.tsx:436`、`src/components/CalendarView.tsx:460`、`src/components/CalendarView.tsx:466`、`src/components/CalendarView.tsx:503`、`src/components/CalendarView.tsx:516`、`src/components/CalendarView.tsx:535`、`src/components/WordCloud.tsx:248` |
| `#6f655e` | 12 | `src/components/CalendarView.tsx:261`、`src/components/CalendarView.tsx:280`、`src/components/CalendarView.tsx:328`、`src/components/CalendarView.tsx:340`、`src/components/CalendarView.tsx:350`、`src/components/CalendarView.tsx:466`、`src/components/CalendarView.tsx:496`、`src/components/CalendarView.tsx:506`、`src/components/CalendarView.tsx:532`、`src/components/CalendarView.tsx:536`、`src/components/CalendarView.tsx:537`、`src/components/CalendarView.tsx:543` |
| `#1f1c19` | 11 | `src/components/ExtendedEmailFilter.tsx:124`、`src/components/ExtendedEmailFilter.tsx:152`、`src/components/ExtendedEmailFilter.tsx:154`、`src/components/ExtendedEmailFilter.tsx:154`、`src/components/ExtendedEmailFilter.tsx:171`、`src/components/ExtendedEmailFilter.tsx:203`、`src/components/ExtendedEmailFilter.tsx:205`、`src/components/ExtendedEmailFilter.tsx:205`、`src/components/ExtendedEmailFilter.tsx:222`、`src/components/MarketFilter.tsx:69`、`src/index.css:16` |
| `#d9d0c3` | 11 | `src/components/ExtendedEmailFilter.tsx:113`、`src/components/ExtendedEmailFilter.tsx:115`、`src/components/ExtendedEmailFilter.tsx:243`、`src/components/ExtendedEmailFilter.tsx:254`、`src/components/ExtendedEmailsState.tsx:19`、`src/components/MarketComparison.tsx:302`、`src/components/MarketComparison.tsx:348`、`src/components/MarketComparison.tsx:374`、`src/components/MarketComparison.tsx:428`、`src/components/MarketComparison.tsx:459`、`src/components/SnapshotState.tsx:14` |
| `#f7f1e8` | 10 | `src/components/ExtendedEmailFilter.tsx:113`、`src/components/ExtendedEmailFilter.tsx:152`、`src/components/ExtendedEmailFilter.tsx:171`、`src/components/ExtendedEmailFilter.tsx:203`、`src/components/ExtendedEmailFilter.tsx:222`、`src/components/ExtendedEmailFilter.tsx:319`、`src/components/ExtendedEmailFilter.tsx:331`、`src/components/WordCloud.tsx:153`、`src/components/WordCloud.tsx:172`、`src/index.css:20` |
| `#fffaf3` | 10 | `src/components/ExtendedEmailFilter.tsx:155`、`src/components/ExtendedEmailFilter.tsx:174`、`src/components/ExtendedEmailFilter.tsx:206`、`src/components/ExtendedEmailFilter.tsx:225`、`src/components/ExtendedEmailsState.tsx:19`、`src/components/MarketFilter.tsx:69`、`src/components/SnapshotState.tsx:14`、`src/components/WordCloud.tsx:152`、`src/components/WordCloud.tsx:158`、`src/components/WordCloud.tsx:175` |
| `#7f7167` | 8 | `src/components/CalendarView.tsx:365`、`src/components/CalendarView.tsx:387`、`src/components/CalendarView.tsx:479`、`src/components/CalendarView.tsx:481`、`src/components/CalendarView.tsx:483`、`src/components/CalendarView.tsx:485`、`src/components/CalendarView.tsx:487`、`src/components/CalendarView.tsx:516` |
| `#29231f` | 7 | `src/components/CalendarView.tsx:480`、`src/components/CalendarView.tsx:482`、`src/components/CalendarView.tsx:484`、`src/components/CalendarView.tsx:486`、`src/components/CalendarView.tsx:488`、`src/components/CampaignOverview.tsx:30`、`src/index.css:15` |
| `#fffaf1` | 7 | `src/components/CalendarView.tsx:297`、`src/components/CalendarView.tsx:298`、`src/components/CalendarView.tsx:327`、`src/components/CalendarView.tsx:328`、`src/components/CalendarView.tsx:375`、`src/components/CalendarView.tsx:433`、`src/components/CalendarView.tsx:436` |
| `#171411` | 6 | `src/components/BrandThemeBreakdown.tsx:126`、`src/components/dashboard.ts:32`、`src/components/dashboard.ts:33`、`src/components/dashboard.ts:34`、`src/components/dashboard.ts:36`、`src/three-week-aggregation.ts:123` |
| `#6f655b` | 6 | `src/components/ExtendedEmailFilter.tsx:138`、`src/components/ExtendedEmailFilter.tsx:189`、`src/components/ExtendedEmailFilter.tsx:247`、`src/components/MarketFilter.tsx:83`、`src/components/WordCloud.tsx:194`、`src/components/WordCloud.tsx:205` |
| `#6f665c` | 6 | `src/components/ExtendedEmailFilter.tsx:135`、`src/components/ExtendedEmailFilter.tsx:186`、`src/components/ExtendedEmailFilter.tsx:278`、`src/components/MarketComparison.tsx:268`、`src/components/MarketFilter.tsx:51`、`src/components/WordCloud.tsx:177` |
| `#e5ddd2` | 6 | `src/components/ExtendedEmailFilter.tsx:278`、`src/components/ExtendedEmailFilter.tsx:281`、`src/components/ExtendedEmailFilter.tsx:284`、`src/components/ExtendedEmailFilter.tsx:287`、`src/components/ExtendedEmailFilter.tsx:294`、`src/components/ExtendedEmailFilter.tsx:299` |
| `#5f574f` | 5 | `src/components/ExtendedEmailFilter.tsx:284`、`src/components/ExtendedEmailFilter.tsx:294`、`src/components/ExtendedEmailsState.tsx:19`、`src/components/MarketComparison.tsx:259`、`src/components/SnapshotState.tsx:14` |
| `#d4cabd` | 5 | `src/components/ExtendedEmailFilter.tsx:155`、`src/components/ExtendedEmailFilter.tsx:174`、`src/components/ExtendedEmailFilter.tsx:206`、`src/components/ExtendedEmailFilter.tsx:225`、`src/components/MarketFilter.tsx:69` |
| `#9f9487` | 4 | `src/components/ExtendedEmailFilter.tsx:155`、`src/components/ExtendedEmailFilter.tsx:174`、`src/components/ExtendedEmailFilter.tsx:206`、`src/components/ExtendedEmailFilter.tsx:225` |
| `#c38a24` | 4 | `src/components/ExtendedEmailFilter.tsx:44`、`src/components/MarkdownReport.tsx:150`、`src/components/MarkdownReport.tsx:166`、`src/components/dashboard.ts:19` |
| `#d5674e` | 4 | `src/components/CalendarView.tsx:295`、`src/components/CalendarView.tsx:325`、`src/components/CalendarView.tsx:466`、`src/components/CalendarView.tsx:516` |
| `#e7dccd` | 4 | `src/components/CalendarView.tsx:308`、`src/components/CalendarView.tsx:375`、`src/components/CalendarView.tsx:502`、`src/components/CalendarView.tsx:526` |
| `#fff0eb` | 4 | `src/components/ExtendedEmailFilter.tsx:34`、`src/components/MarketComparison.tsx:331`、`src/components/MarketComparison.tsx:407`、`src/components/dashboard.ts:25` |
| `#fffdf9` | 4 | `src/components/ExtendedEmailFilter.tsx:243`、`src/components/ExtendedEmailFilter.tsx:254`、`src/components/ExtendedEmailFilter.tsx:276`、`src/index.css:21` |
| `#e55f47` | 3 | `src/components/ExtendedEmailFilter.tsx:43`、`src/components/dashboard.ts:18`、`src/index.css:22` |
| `#efe9e0` | 3 | `src/components/MarketComparison.tsx:320`、`src/components/MarketComparison.tsx:395`、`src/components/MarketComparison.tsx:470` |
| `#fff7e2` | 3 | `src/components/ExtendedEmailFilter.tsx:35`、`src/components/MarketComparison.tsx:259`、`src/components/dashboard.ts:26` |
| `#fffdf8` | 3 | `src/components/CalendarView.tsx:476`、`src/components/CalendarView.tsx:516`、`src/components/CalendarView.tsx:526` |
| `#315f69` | 2 | `src/components/BrandDetailDialog.tsx:207`、`src/components/ExtendedEmailFilter.tsx:38` |
| `#514943` | 2 | `src/components/CalendarView.tsx:298`、`src/components/CalendarView.tsx:523` |
| `#558b97` | 2 | `src/components/ExtendedEmailFilter.tsx:47`、`src/components/dashboard.ts:22` |
| `#568d72` | 2 | `src/components/ExtendedEmailFilter.tsx:45`、`src/components/dashboard.ts:20` |
| `#746a60` | 2 | `src/components/ExtendedEmailFilter.tsx:320`、`src/components/WordCloud.tsx:234` |
| `#8069a3` | 2 | `src/components/ExtendedEmailFilter.tsx:46`、`src/components/dashboard.ts:21` |
| `#9b4b3c` | 2 | `src/components/CalendarView.tsx:344`、`src/components/ExtendedEmailFilter.tsx:336` |
| `#d9cbbb` | 2 | `src/components/CalendarView.tsx:516`、`src/components/CalendarView.tsx:543` |
| `#ded2c3` | 2 | `src/components/WordCloud.tsx:152`、`src/components/WordCloud.tsx:153` |
| `#edf6f7` | 2 | `src/components/ExtendedEmailFilter.tsx:38`、`src/components/dashboard.ts:29` |
| `#edf7f1` | 2 | `src/components/ExtendedEmailFilter.tsx:36`、`src/components/dashboard.ts:27` |
| `#f3c5b5` | 2 | `src/components/CalendarView.tsx:516`、`src/index.css:174` |
| `#f4f0e9` | 2 | `src/components/BrandDetailDialog.tsx:153`、`src/components/ExtendedEmailFilter.tsx:39` |
| `#f4f0f9` | 2 | `src/components/ExtendedEmailFilter.tsx:37`、`src/components/dashboard.ts:28` |
| `#f7eee2` | 2 | `src/components/CalendarView.tsx:308`、`src/components/CalendarView.tsx:325` |
| `#f8ddb2` | 2 | `src/components/CalendarView.tsx:21`、`src/components/CampaignOverview.tsx:121` |
| `#f8f2e9` | 2 | `src/components/ExtendedEmailFilter.tsx:262`、`src/components/ExtendedEmailFilter.tsx:276` |
| `#fff6e9` | 2 | `src/components/CalendarView.tsx:458`、`src/components/CalendarView.tsx:543` |
| `#ffffff` | 2 | `src/components/CampaignOverview.tsx:22`、`src/components/dashboard.ts:35` |
| `rgb(52 45 39 / 0.04)` | 2 | `src/index.css:63`、`src/index.css:90` |
| `rgba(180,55,35,0.9)` | 2 | `src/components/ExtendedEmailFilter.tsx:173`、`src/components/ExtendedEmailFilter.tsx:224` |
| `rgba(31,28,25,0.9)` | 2 | `src/components/ExtendedEmailFilter.tsx:154`、`src/components/ExtendedEmailFilter.tsx:205` |
| `#211e1b` | 1 | `src/components/ExtendedEmailFilter.tsx:282` |
| `#258b55` | 1 | `src/components/dashboard.ts:13` |
| `#28231f` | 1 | `src/components/ExtendedEmailFilter.tsx:262` |
| `#285d47` | 1 | `src/components/ExtendedEmailFilter.tsx:36` |
| `#302c28` | 1 | `src/components/ExtendedEmailFilter.tsx:120` |
| `#312d29` | 1 | `src/components/ExtendedEmailFilter.tsx:258` |
| `#342d27` | 1 | `src/index.css:14` |
| `#368ac8` | 1 | `src/components/dashboard.ts:15` |
| `#39a96b` | 1 | `src/components/dashboard.ts:8` |
| `#3fa66a` | 1 | `src/data.ts:60` |
| `#51483f` | 1 | `src/index.css:13` |
| `#55a6e8` | 1 | `src/components/dashboard.ts:10` |
| `#594576` | 1 | `src/components/ExtendedEmailFilter.tsx:37` |
| `#5b9bd5` | 1 | `src/data.ts:62` |
| `#655e55` | 1 | `src/components/ExtendedEmailFilter.tsx:39` |
| `#685d53` | 1 | `src/index.css:12` |
| `#7152bb` | 1 | `src/components/dashboard.ts:14` |
| `#75500d` | 1 | `src/components/ExtendedEmailFilter.tsx:35` |
| `#75695e` | 1 | `src/index.css:11` |
| `#776b63` | 1 | `src/components/CalendarView.tsx:411` |
| `#7d342f` | 1 | `src/components/CalendarView.tsx:21` |
| `#84aeb8` | 1 | `src/components/ExtendedEmailFilter.tsx:38` |
| `#8b6bd6` | 1 | `src/components/dashboard.ts:9` |
| `#8bb39e` | 1 | `src/components/ExtendedEmailFilter.tsx:36` |
| `#8e7cc3` | 1 | `src/data.ts:61` |
| `#8f2f20` | 1 | `src/components/ExtendedEmailFilter.tsx:34` |
| `#938273` | 1 | `src/index.css:10` |
| `#9a8f85` | 1 | `src/three-week-aggregation.ts:117` |
| `#a13f2d` | 1 | `src/index.css:23` |
| `#a39a8d` | 1 | `src/components/ExtendedEmailFilter.tsx:48` |
| `#aa9ac4` | 1 | `src/components/ExtendedEmailFilter.tsx:37` |
| `#b65343` | 1 | `src/components/CalendarView.tsx:21` |
| `#b87912` | 1 | `src/components/WordCloud.tsx:28` |
| `#b94330` | 1 | `src/components/WordCloud.tsx:176` |
| `#c77b18` | 1 | `src/components/WordCloud.tsx:25` |
| `#c9573f` | 1 | `src/components/WordCloud.tsx:27` |
| `#c9c1b6` | 1 | `src/components/ExtendedEmailFilter.tsx:39` |
| `#cf4965` | 1 | `src/components/dashboard.ts:11` |
| `#cfc1b1` | 1 | `src/components/WordCloud.tsx:158` |
| `#d0c2b1` | 1 | `src/index.css:9` |
| `#d95d45` | 1 | `src/components/WordCloud.tsx:24` |
| `#d98262` | 1 | `src/components/CalendarView.tsx:298` |
| `#d98d20` | 1 | `src/components/dashboard.ts:12` |
| `#d9b36c` | 1 | `src/components/ExtendedEmailFilter.tsx:35` |
| `#dfd2c2` | 1 | `src/components/CalendarView.tsx:298` |
| `#e28a57` | 1 | `src/components/WordCloud.tsx:26` |
| `#e2d7ca` | 1 | `src/components/WordCloud.tsx:212` |
| `#e3d4c2` | 1 | `src/components/CalendarView.tsx:458` |
| `#e4d8c9` | 1 | `src/components/CalendarView.tsx:355` |
| `#e5dbce` | 1 | `src/index.css:8` |
| `#e5ddd3` | 1 | `src/components/MarketComparison.tsx:489` |
| `#e85d75` | 1 | `src/components/dashboard.ts:6` |
| `#e85d7a` | 1 | `src/data.ts:58` |
| `#e8c87a` | 1 | `src/components/MarketComparison.tsx:259` |
| `#e99061` | 1 | `src/components/CalendarView.tsx:21` |
| `#eadfd1` | 1 | `src/components/CalendarView.tsx:476` |
| `#eee3d6` | 1 | `src/components/CalendarView.tsx:526` |
| `#eee5da` | 1 | `src/components/CalendarView.tsx:411` |
| `#f0a030` | 1 | `src/data.ts:59` |
| `#f0a08f` | 1 | `src/components/ExtendedEmailFilter.tsx:34` |
| `#f1e5d8` | 1 | `src/components/WordCloud.tsx:177` |
| `#f2a93b` | 1 | `src/components/dashboard.ts:7` |
| `#f2eade` | 1 | `src/index.css:7` |
| `#f2eadf` | 1 | `src/components/CalendarView.tsx:20` |
| `#f3bc7c` | 1 | `src/components/CalendarView.tsx:21` |
| `#f7f1e9` | 1 | `src/components/CalendarView.tsx:411` |
| `#faf6ef` | 1 | `src/index.css:6` |
| `#fff0e9` | 1 | `src/index.css:24` |
| `#fff1e9` | 1 | `src/components/ExtendedEmailFilter.tsx:276` |
| `#fff3e4` | 1 | `src/components/CalendarView.tsx:298` |
| `rgb(0 0 0 / 0.15)` | 1 | `src/components/ThemeDistribution.tsx:148` |
| `rgb(195 138 36 / 0.06)` | 1 | `src/index.css:46` |
| `rgb(229 95 71 / 0.05)` | 1 | `src/index.css:45` |
| `rgb(52 45 39 / 0.05)` | 1 | `src/index.css:163` |
| `rgb(52 45 39 / 0.06)` | 1 | `src/index.css:113` |
| `rgba(255,255,255,0.12)` | 1 | `src/components/ExtendedEmailFilter.tsx:262` |
| `rgba(255,255,255,0.8)` | 1 | `src/components/CalendarView.tsx:375` |

### 基线按文件计数

| 文件 | 字面量数 |
| --- | ---: |
| `src/components/BrandDetailDialog.tsx` | 2 |
| `src/components/BrandThemeBreakdown.tsx` | 1 |
| `src/components/CalendarView.tsx` | 86 |
| `src/components/CampaignOverview.tsx` | 3 |
| `src/components/dashboard.ts` | 25 |
| `src/components/ExtendedEmailFilter.tsx` | 95 |
| `src/components/ExtendedEmailsState.tsx` | 4 |
| `src/components/MarkdownReport.tsx` | 2 |
| `src/components/MarketComparison.tsx` | 18 |
| `src/components/MarketFilter.tsx` | 6 |
| `src/components/SnapshotState.tsx` | 4 |
| `src/components/ThemeDistribution.tsx` | 1 |
| `src/components/WordCloud.tsx` | 28 |
| `src/data.ts` | 5 |
| `src/index.css` | 23 |
| `src/three-week-aggregation.ts` | 2 |

## 对比度与样式等价

- 采用 sRGB 相对亮度及 `(L亮 + 0.05) / (L暗 + 0.05)`；计算未提前舍入。没有使用实色填充 Token 代替徽标文字 Token。
- 配对覆盖六主题徽标、实色图表、30% 淡化图表、主题浅底正文/辅助字、常见表面、表格表头、日历、控件各状态、三类状态色；另计入词云 70% hover 透明度和日历 95% hover brightness 对文字及背景的共同影响。
- 全部 120 组固定/混合配对 ≥ 4.5:1；最弱为日历辅助字 `--text-calendar-muted` / `--surface-calendar`，4.5280:1。
- 周频热力图枚举最小周量 0–15、最大周量至 60 及各 count，共 23,495 个组合，最弱 5.1765:1；更大最大周量只继续覆盖同一色阶区间。
- CSS 值展开等价：37 个原通用样式规则、112 项声明保持等价；449 个未变 Tailwind 规则与 127 个可匹配迁移规则对比通过。
- 对 18 个已修改 TS/TSX 文件进行 AST 比较：排除 className/style、样式专用删除项、新增 other 样式映射，并展开 Token 后，其余结构一致；数据口径/业务逻辑未变。
- 沙箱禁止本地套接字，Vite dev server 及 Chromium 无法启动；未进行浏览器截图或逐像素截图断言。这里的视觉不变依据为颜色值、样式声明及编译结果等价，不能冒称截图回归通过。

### 六主题关键配对

| 主题 | 徽标文字 / 浅底 | 图表文字 / 填充 |
| --- | ---: | ---: |
| `price` | 7.2882:1 | 5.2940:1 |
| `behavior` | 6.7549:1 | 6.0994:1 |
| `new` | 6.9806:1 | 4.7603:1 |
| `lifestyle` | 7.3607:1 | 4.7008:1 |
| `category` | 6.4367:1 | 4.8281:1 |
| `other` | 5.6268:1 | 5.8027:1 |

## 门禁结果

| 命令 / 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | PASS |
| `npm run build`（含 `tsc -b` 与 Vite） | PASS |
| `git diff --check` | PASS |
| 颜色/样式等价检查、对比度计算 | PASS；临时检查脚本与中间产物仅存放 `/tmp/`，未引入测试框架或依赖 |
| 受保护文件 diff / HEAD | 无修改；仍为 `main` / `e9949a9` |

## 未改的遗留与旁路文件

- 原有活跃组件、静态主题颜色字段、主题色兜底和 `src/index.css` 的十六进制/RGB/RGBA 字面量：0 处。
- `src/tokens.css` 内 116 处字面量为刻意集中保留的单源定义，不属于迁移遗漏。
- 执行过程中发现以下初始干净工作区之外新增的未跟踪文件；本轮未创建、未修改、未删除，也未接入入口。为遵守“只做 P0-01”，不改这些旁路功能。它们不在本轮 305 处基线及改动文件列表内：
  - `src/components/EmptyState.tsx`
  - `src/components/PageNav.tsx`
  - `src/export.ts`
  - `src/favorites.ts`
  - `src/url-state.ts`
- 其中 `EmptyState.tsx`、`PageNav.tsx` 额外含 17 处硬编码颜色，均未被现有活跃入口引用。最终扫描 `src/` 时需与本轮迁移范围区分，不能声称整个工作区字面量为零。

| 旁路遗留颜色 | 次数 | 当前所在位置 |
| --- | ---: | --- |
| `#e5dbce` | 3 | `src/components/EmptyState.tsx:18`、`src/components/EmptyState.tsx:22`、`src/components/PageNav.tsx:85` |
| `#fffdf9` | 2 | `src/components/EmptyState.tsx:18`、`src/components/PageNav.tsx:85` |
| `#faf6ef` | 1 | `src/components/EmptyState.tsx:22` |
| `#938273` | 1 | `src/components/EmptyState.tsx:22` |
| `#1f1c19` | 1 | `src/components/EmptyState.tsx:40` |
| `#685d53` | 2 | `src/components/EmptyState.tsx:45`、`src/components/PageNav.tsx:105` |
| `#29231f` | 3 | `src/components/EmptyState.tsx:54`、`src/components/PageNav.tsx:104`、`src/components/PageNav.tsx:105` |
| `#342d27` | 1 | `src/components/EmptyState.tsx:54` |
| `#a13f2d` | 2 | `src/components/EmptyState.tsx:54`、`src/components/PageNav.tsx:102` |
| `#f2eade` | 1 | `src/components/PageNav.tsx:105` |

# 白天 / 夜晚模式实现结果

日期：2026-10-22。工作分支：`theme-toggle`；基线：`main` / `49f1fea`。

## 行为

- `html[data-theme="dark"]` 启用暖色深色配色，`data-theme="light"` 使用浅色配色；同步设置 CSS `color-scheme`，使原生表单控件也跟随主题。
- `index.html` 的同步内联脚本在应用和样式加载前执行：有效的 `localStorage["edm-theme"]` → `prefers-color-scheme: dark` → `light`。无效存储按无记录处理；存储或媒体查询不可用时逐级回退。已检查构建产物中的执行顺序，初始化脚本位于样式和应用入口之前。
- 页眉语言按钮旁新增站内 `Button` 的 `outline` / `sm` 按钮，使用 Lucide Sun / Moon；可见文字与 `aria-label` 均描述下一步操作。切换立即更新根元素并持久化；存储被禁用时仍可切换当前页面。
- 挂载沿用首屏已应用的主题，避免再次读取系统偏好造成首屏主题与按钮状态不一致。
- 中英文各新增 `appearanceSwitchLight` / `appearanceSwitchDark` 两个键；两份语言文件均为 **532 个键**，键集合一致。

## 深色变量覆盖

`src/tokens.css` 新增 Tailwind 4 的 `@custom-variant dark`，绑定 `[data-theme="dark"]`。深色块显式覆盖 **146 个语义变量**，包括所有 `--surface-*`、`--text-*`：

| 变量组 | 覆盖数量 | 覆盖范围 |
| --- | ---: | --- |
| `--surface-*` | 19 | 页面、卡片、表格、日历、词云、tooltip、遮罩、骨架、两种页面 glow |
| `--text-*` | 21 | 主次文字、标题、控件、邮件表格、日历、提示、反色文字 |
| `--border-*` / `--divider*` | 15 / 5 | 默认、hover、控件及各图表边框、分隔线 |
| `--chart-*` | 2 | 空图背景、淡化图形上的文字 |
| `--accent*` | 4 | 原品牌 accent 填充不变，文字及底色适配深色 |
| `--theme-*-tint/text/border` | 18 | 六个数据分类各自的背景、文字、边框 |
| `--word-*` | 5 | 词云分类指示色 |
| `--status-*` | 9 | 成功、警告、错误的背景、文字、边框 |
| `--control-*` | 25 | 默认、hover、active、disabled、focus、筛选器与日历控件 |
| `--calendar-heat-*` | 9 | 空档及五级热力背景、空档/低档/高档标签文字 |
| `--card-*` / `--shadow-*` / `--filter-chart-hover` | 5 / 6 / 1 | 卡片边框、阴影、报告阴影、切换器阴影、图形 hover |
| `--selection-bg` / `--scrollbar-thumb` | 1 / 1 | 选区、滚动条 |

`--theme-price/behavior/new/lifestyle/category/other`、快照数据色及图形实色标签配对保持原有语义；深色底上的分类徽标使用各自的 `-tint/-text` 配对。深色控件使用浅暖色底与深色文字，tooltip 仍使用深底白字，两者分别消费对应语义变量。

## 硬编码颜色处理清单

| 位置 | 检查与处理 |
| --- | --- |
| `BrandDetailDialog`、`BrandThemeBreakdown`、`CampaignOverview` | 原始 slate 文字、背景、边框、hover、遮罩全部迁移到语义变量；组件不再直接依赖 slate 工具类。 |
| `WordCloud` | 基线已使用 `--word-*`、`--text-calendar-heading` 与表面变量，未发现 JS 颜色字面量；新增深色值，空状态按钮改用成对的控件变量。 |
| `CalendarView`、`CampaignOverview` 热力图 | 基线背景已使用变量；补齐暗色六档背景与标签文字 token，消除低档热力图仍用固定深字导致的对比度问题。分档算法和数值窗口不变。 |
| `ThemeDistribution`、`BrandThemeBreakdown` | 淡化扇区和条形图的标签改用 `--chart-dimmed-label`，随背景切换；实色分类数据及其标签保留配对。 |
| `MarketComparison` | 已逐项检查：条形底色 `--chart-empty`、轴线 `--border-default`、文字 `--text-heading/secondary`、条形 `--control-active-bg` / `--accent-ink` / 分类变量均直接引用 CSS 变量，无需修改组件或聚合层。 |
| Button、Badge、语言/市场/邮件筛选、重试与空状态 | 修正原有“标题色作背景 + 固定白字”的配对，改用 `--control-active-bg/text` 和专用 hover 背景。 |
| Tooltip、Skeleton、EmptyState、滚动条 | 从基础 slate 变量迁移到 `--surface-tooltip`、`--surface-skeleton`、`--text-muted`、`--scrollbar-thumb`。 |
| `ContentAnalysis` | 进度条与选中标签使用控件变量；已有 amber / rose 状态的 `dark:` 变体现在由根元素属性控制。两种固定深色状态按钮的白字配对保留。 |

TS/TSX 中未发现需要新增 `getComputedStyle` 读取或主题订阅的 canvas / 图表缓存色。现有 DOM / SVG 内联样式保留 `var(...)`，根属性改变后由浏览器重新求值。

## 改动文件

新增 5 个文件：

- `src/theme.ts`：初始化决策、读取已应用主题、应用与持久化。
- `src/components/ThemeToggle.tsx`：切换按钮。
- `tests/theme.test.mjs`：14 项初始化、挂载、持久化与翻译测试。
- `tests/theme-contrast.test.mjs`：2 项变量覆盖及对比度测试。
- `reports/theme-toggle-result.md`：本结果文件。

修改 26 个文件：

- 初始化与配色：`index.html`、`src/tokens.css`、`src/index.css`。
- 页眉与语言：`src/components/DashboardHeader.tsx`、`src/i18n/LanguageToggle.tsx`、`src/i18n/locales/zh.json`、`src/i18n/locales/en.json`。
- 图表和视图：`src/components/BrandDetailDialog.tsx`、`src/components/BrandThemeBreakdown.tsx`、`src/components/CalendarView.tsx`、`src/components/CampaignOverview.tsx`、`src/components/ContentAnalysis.tsx`、`src/components/ThemeDistribution.tsx`、`src/components/WordCloud.tsx`、`src/components/KpiGrid.tsx`、`src/components/MarkdownReport.tsx`。
- 筛选与状态：`src/components/MarketFilter.tsx`、`src/components/ExtendedEmailFilter.tsx`、`src/components/EmptyState.tsx`、`src/components/ExtendedEmailsState.tsx`、`src/components/SnapshotState.tsx`。
- UI 基件：`src/components/Tooltip.tsx`、`src/components/ui/button.tsx`、`src/components/ui/badge.tsx`、`src/components/ui/skeleton.tsx`、`src/components/ui/tooltip.tsx`。

## 验证

| 检查 | 结果 |
| --- | --- |
| 基线 `npm test` | **87 / 87 通过** |
| 完成后 `npm test` | **103 / 103 通过**，9 suites，0 fail / skip；新增 16 项，既有 87 项全部保留通过 |
| `npm run build` | **通过**（`tsc -b` + Vite 生产构建） |
| `git diff --check` | **通过** |
| 深色对比度 | 被测主次文字、词云、分类标签、状态、控件、tooltip、六档热力标签 ≥ **4.5:1**；被测分类数据色、对比条形与底色 ≥ **3:1** |
| Tailwind 构建结果 | 包含属性控制的 `dark:` 选择器及深色覆盖；无按系统深色媒体查询自动启用的 `dark:` 规则 |
| 首屏优先级测试 | 执行真实内联脚本并与运行时决策逐项对照，覆盖 storage 两种优先值、媒体两种结果、无效记录、API 缺失或抛错、默认值 |
| 挂载测试 | 使用现有宿主与真实 React / Button / Lucide / i18n；覆盖 StrictMode、双向切换、存储写入、刷新重挂载及存储禁用 |

环境处理：原 `node_modules` 链接目标缺少 Lucide / Radix 等声明依赖；相邻 `edm-comp-ui` 的完整依赖经基线测试验证后复制至本工作区，解决依赖目标只读导致 Vite 无法写入临时配置的问题。`package.json` 和锁文件均未修改。

视觉验证限制：尝试启动 Chromium 时被沙箱以 `sandbox_host_linux.cc: shutdown: Operation not permitted` 拒绝，未完成真实浏览器截图或布局验收。挂载宿主不模拟 CSS 布局；对比度测试验证 token 数值配对。

`src/analytics.ts` 及 Umami 初始化、脚本加载和事件调用未修改。数据层、Supabase、URL 状态、市场聚合、数据窗口与统计口径未修改。本轮未提交或推送。

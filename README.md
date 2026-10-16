# 品牌营销触达趋势看板

基于 Milled 美国市场邮件数据的竞品 EDM 调研看板，用于查看品牌营销触达节奏与主题分布。

技术栈：React + Vite + TypeScript + Tailwind CSS。

## 功能

- **数据看板（`#dashboard`）**：KPI、品牌 / 主题 / 活动图表及关键洞察。
- **词云**：支持三周（默认）与三个月窗口切换。
- **日历热力图**：按月展示，使用覆盖整个三个月窗口的全局色阶，支持品牌筛选与关键词搜索。
- **邮件视图（`#emails`）**：独立页面，支持品牌 + 主题组合筛选；点击看板主题分布环形图可跳转，并预选对应主题。
- **OnePage 报告（`#report`）**：独立报告页面。

## 数据说明

数据来源为 **Milled**，覆盖**美国市场**的 **EDM**，共 6 个品牌：Zara、lululemon、ALO Yoga、Halara、Temu、SHEIN。

| 窗口 | 日期范围 | 邮件样本数 |
| --- | --- | --- |
| 三周（默认） | 2026-09-24–2026-10-15 | 196 封 |
| 三个月 | 2026-07-16–2026-10-15 | 770 封 |

数据看板的 KPI 与品牌 / 主题 / 活动图表使用三周口径；词云可切换窗口，日历热力图和邮件视图使用三个月数据。

计数为 Milled 品牌页在对应窗口内可见的收录邮件数，**不是品牌全量发送量**。每封邮件只归一个主题；词频按“含该词的邮件数”统计，同一封邮件内同词重复只计一次。

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

产物在 `dist/`。

## 更新数据

三周汇总维护在 `src/data.ts` 的 `DATA` 中；三个月逐封记录位于 `data-collection/`，由 `src/data.ts` 的 `EXTENDED_3MONTH` 引入并筛选。更新时需核对时间窗口、样本数与统计口径。

## 部署到 Cloudflare Pages

线上地址：[https://edm-dashboard.pages.dev](https://edm-dashboard.pages.dev)。

- 构建命令：`npm run build`
- 构建输出目录：`dist`

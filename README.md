# EDM 竞品调研看板

基于 Milled（美国市场）邮件数据的竞品 EDM 调研看板：品牌 × 周 × Campaign 主题表、内容结构分布、各品牌内容结构、主题行高频词云、关键洞察。

当前数据：2026-09-24 至 2026-10-15（美东时间），6 个品牌（Halara、ALO Yoga、SHEIN、Temu、lululemon、Zara），196 封邮件样本。

技术栈：React + Vite + TypeScript + Tailwind CSS。

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

只改 `src/data.ts`：品牌周封数、主题分布、词频、洞察。页面其余部分自动渲染。

数据口径：计数为 Milled 品牌页在窗口内可见的收录邮件数，非品牌向全量收件人的发送量；每封邮件只归一个主题；词频按“含该词的邮件数”统计，同一词在同一主题出现多次只计 1 次。本页不引用任何竞品原始文案。

## 部署到 Cloudflare Pages

1. 打开 Cloudflare Dashboard → Pages → Create application → Pages → Connect to Git。
2. 选择这个仓库，Framework preset 选 Vite。
3. Build command：`npm run build`，Build output directory：`dist`。
4. 保存并部署，分配的 `*.pages.dev` 域名即可访问。

后续更新数据：改 `src/data.ts` 后 push，Cloudflare Pages 自动重新部署。

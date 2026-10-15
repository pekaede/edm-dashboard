# EDM 竞品调研看板

基于 Milled（美国市场）邮件数据的竞品 EDM 调研看板：品牌 × 周 × Campaign 主题表、内容结构分布、各品牌内容结构、主题行高频词云、关键洞察。

当前数据：2026-09-24 至 2026-10-15（美东时间），6 个品牌（Halara、ALO Yoga、SHEIN、Temu、lululemon、Zara），196 封邮件样本。

## 本地运行

纯静态页面，无构建步骤。任选一种：

```bash
# Python
python3 -m http.server 8080
# 然后打开 http://localhost:8080

# 或 Node
npx serve .
```

也可以直接双击打开 `index.html`。

## 更新数据

只改 `data.js`：品牌周封数、主题分布、词频、洞察。页面其余部分自动渲染。

数据口径：计数为 Milled 品牌页在窗口内可见的收录邮件数，非品牌向全量收件人的发送量；每封邮件只归一个主题；词频按“含该词的邮件数”统计，同一词在同一主题出现多次只计 1 次。本页不引用任何竞品原始文案。

## 推送到 GitHub

```bash
cd edm-competitor-dashboard
git init
git add -A
git commit -m "Initial commit: EDM competitor dashboard"
gh repo create edm-competitor-dashboard --public --source=. --push
# 没有 gh CLI 时：先在 GitHub 上新建空仓库，再执行
# git remote add origin git@github.com:<你的用户名>/edm-competitor-dashboard.git
# git branch -M main && git push -u origin main
```

## 部署到 Cloudflare Pages

1. 打开 Cloudflare Dashboard → Pages → Create application → Pages → Connect to Git。
2. 选择这个仓库，Framework preset 选 None。
3. Build command 留空，Build output directory 填 `/`。
4. 保存并部署，分配的 `*.pages.dev` 域名即可访问。

后续更新数据：改 `data.js` 后 push，Cloudflare Pages 自动重新部署。

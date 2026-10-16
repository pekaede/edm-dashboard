import { DATA } from "./data";

const TOTAL = DATA.meta.total;
const DAYS = 22;
const PALETTE = ["#111827", "#e85d7a", "#2563eb", "#3fa66a", "#8e7cc3", "#f0a030"];

function pct(n: number) {
  return ((n / TOTAL) * 100).toFixed(1);
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5 md:p-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Donut() {
  const C = 2 * Math.PI * 80;
  let acc = 0;
  const segments = DATA.themes.map((t) => {
    const len = (t.count / TOTAL) * C;
    const el = (
      <circle
        key={t.key}
        cx="120"
        cy="120"
        r="80"
        fill="none"
        stroke={t.color}
        strokeWidth="44"
        strokeDasharray={`${len.toFixed(1)} ${(C - len).toFixed(1)}`}
        strokeDashoffset={(-acc).toFixed(1)}
        transform="rotate(-90 120 120)"
      />
    );
    acc += len;
    return el;
  });
  return (
    <svg
      viewBox="0 0 240 240"
      className="h-52 w-52 shrink-0"
      role="img"
      aria-label="内容结构分布"
    >
      {segments}
      <text x="120" y="114" textAnchor="middle" className="fill-slate-900 text-2xl font-bold">
        {TOTAL}
      </text>
      <text x="120" y="138" textAnchor="middle" className="fill-slate-500 text-xs">
        封邮件
      </text>
    </svg>
  );
}

export default function App() {
  const maxWeekly = Math.max(...DATA.brands.flatMap((b) => b.weekly));
  const maxWord = Math.max(...DATA.words.map((w) => w.count));
  const weekTotals = DATA.weeks.map((_, i) =>
    DATA.brands.reduce((s, b) => s + b.weekly[i], 0),
  );
  const kpis = [
    { num: String(TOTAL), label: "邮件总数（样本）" },
    { num: String(DATA.meta.brandCount), label: "品牌" },
    { num: String(DATA.meta.weekCount), label: "周" },
    { num: (TOTAL / DAYS).toFixed(1), label: "日均邮件（6 品牌合计）" },
  ];

  return (
    <div className="min-h-screen font-sans text-slate-800 antialiased">
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-5 py-8 md:py-10">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {DATA.meta.title}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {DATA.meta.range} · {DATA.meta.rangeLabel} · {DATA.meta.market} ·
            数据来源 {DATA.meta.source}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["美国市场", "Milled", "196 封样本", "6 品牌 × 3 周"].map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-100 ring-1 ring-white/15"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-5 py-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5"
            >
              <div className="text-3xl font-bold tracking-tight text-slate-900">
                {k.num}
              </div>
              <div className="mt-1 text-sm text-slate-500">{k.label}</div>
            </div>
          ))}
        </div>

        <Card
          title="品牌 × 周 × Campaign 主题"
          hint="单元格数字为该品牌当周邮件封数，颜色越深封数越多。"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-2.5 font-semibold">Brand</th>
                  {DATA.weeks.map((w) => (
                    <th key={w.id} className="px-3 py-2.5 text-center font-semibold">
                      {w.label}
                      <span className="block text-xs font-normal text-slate-500">
                        {w.range}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-semibold">合计</th>
                  <th className="px-3 py-2.5 text-center font-semibold">日均</th>
                  <th className="px-3 py-2.5 font-semibold">主要策略</th>
                </tr>
              </thead>
              <tbody>
                {DATA.brands.map((b) => (
                  <tr key={b.name} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 font-semibold">{b.name}</td>
                    {b.weekly.map((n, i) => {
                      const alpha = 0.08 + 0.72 * (n / maxWeekly);
                      return (
                        <td
                          key={i}
                          className="px-3 py-2.5 text-center font-bold"
                          style={{
                            background: `rgba(37, 99, 235, ${alpha.toFixed(2)})`,
                          }}
                        >
                          {n}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center font-bold">{b.total}</td>
                    <td className="px-3 py-2.5 text-center">{b.perDay.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-slate-600">{b.strategy}</td>
                  </tr>
                ))}
                <tr className="border-b border-slate-100 font-semibold">
                  <td className="px-3 py-2.5">合计</td>
                  {weekTotals.map((n, i) => (
                    <td key={i} className="bg-slate-900/5 px-3 py-2.5 text-center">
                      {n}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center">{TOTAL}</td>
                  <td className="px-3 py-2.5 text-center">{(TOTAL / DAYS).toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-slate-400">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-900">
              各品牌每周主要 Campaign 主题
            </summary>
            <div className="mt-3 space-y-3">
              {DATA.brands.map((b) => (
                <div key={b.name}>
                  <b className="mr-2 inline-block min-w-28">{b.name}</b>
                  {b.campaigns.map((c, i) => (
                    <div key={i} className="text-slate-600">
                      <b className="font-medium text-slate-800">
                        {DATA.weeks[i].label}：
                      </b>
                      {c}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="内容结构分布" hint="196 封邮件，每封只归一类。">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <Donut />
              <ul className="space-y-2 text-sm">
                {DATA.themes.map((t) => (
                  <li key={t.key} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-[4px]"
                      style={{ background: t.color }}
                    />
                    {t.labelZh} {t.label} · {t.count} 封 · {pct(t.count)}%
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card title="各品牌内容结构" hint="每行 = 该品牌 3 周邮件的主题占比。">
            <div>
              {DATA.brands.map((b) => {
                const segs = DATA.themes.filter((t) => (b.themes[t.key] || 0) > 0);
                return (
                  <div key={b.name} className="mb-4">
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-semibold">{b.name}</span>
                      <span className="text-slate-500">{b.total} 封</span>
                    </div>
                    <div className="flex h-4 overflow-hidden rounded-md bg-slate-100">
                      {segs.map((t) => (
                        <div
                          key={t.key}
                          style={{
                            width: `${((b.themes[t.key] / b.total) * 100).toFixed(1)}%`,
                            background: t.color,
                          }}
                          title={`${t.labelZh} ${b.themes[t.key]} 封`}
                        />
                      ))}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {segs.map((t) => `${t.labelZh} ${b.themes[t.key]}`).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <Card
          title="主题行高频词云"
          hint="统计口径：含该词的邮件数，同一词在同一主题出现多次只计 1 次；字号越大，出现邮件越多。"
        >
          <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2 rounded-xl bg-slate-50 px-4 py-5">
            {DATA.words.map((w, i) => (
              <span
                key={w.text}
                title={`${w.text} · ${w.count} 封邮件`}
                style={{
                  fontSize: `${Math.round(13 + (w.count / maxWord) * 31)}px`,
                  color: PALETTE[i % PALETTE.length],
                }}
                className="font-semibold leading-snug whitespace-nowrap"
              >
                {w.text}
              </span>
            ))}
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-900">
              Top 词频明细
            </summary>
            <ol className="mt-3 columns-1 gap-6 sm:columns-2">
              {DATA.words.map((w) => (
                <li key={w.text} className="mb-1">
                  {w.text} · {w.count} 封
                </li>
              ))}
            </ol>
          </details>
        </Card>

        <Card title="关键洞察">
          <ul className="space-y-3 text-sm leading-relaxed">
            {DATA.insights.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>

        <footer className="text-xs leading-relaxed text-slate-500">
          <p>
            数据来源：Milled（美国市场）· 2026-09-24 至 2026-10-15（美东时间）·
            样本 196 封
          </p>
          <p>
            口径说明：计数为 Milled 品牌页在窗口内可见的收录邮件数，非品牌向全量收件人的发送量；主题分类为按主题行 +
            正文主推内容判定，每封只归一类；本页不引用任何竞品原始文案。
          </p>
        </footer>
      </main>
    </div>
  );
}

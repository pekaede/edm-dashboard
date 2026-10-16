import { DATA } from "../data";
import { Card } from "./Card";
import { PALETTE } from "./dashboard";

export function WordCloud() {
  const maxWord = Math.max(...DATA.words.map((w) => w.count));

  return (
    <Card
      title="主题行高频词云"
      hint="统计口径：含该词的邮件数，同一词在同一主题出现多次只计 1 次；字号越大，出现邮件越多。"
    >
      <div className="flex min-h-52 flex-wrap items-center justify-center gap-x-5 gap-y-3 rounded-2xl border border-slate-200/70 bg-[linear-gradient(145deg,#f8fafc_0%,#f6f7ff_100%)] px-5 py-8 sm:px-8">
        {DATA.words.map((w, i) => (
          <span
            key={w.text}
            title={`${w.text} · ${w.count} 封邮件`}
            style={{
              fontSize: `${Math.round(13 + (w.count / maxWord) * 25)}px`,
              color: PALETTE[i % PALETTE.length],
              opacity: 0.72 + (w.count / maxWord) * 0.28,
            }}
            className="font-semibold leading-none tracking-[-0.025em] whitespace-nowrap transition duration-200 hover:scale-105 hover:!opacity-100"
          >
            {w.text}
          </span>
        ))}
      </div>
      <details className="group mt-5 rounded-xl border border-slate-200/80 bg-slate-50/50 text-sm open:bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 font-semibold text-slate-800 transition-colors hover:text-indigo-700 [&::-webkit-details-marker]:hidden">
          <span>Top 词频明细</span>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-normal text-slate-500 transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <ol className="columns-1 gap-8 border-t border-slate-200/80 px-5 py-4 sm:columns-2 lg:columns-3">
          {DATA.words.map((w) => (
            <li key={w.text} className="mb-2 break-inside-avoid text-slate-600">
              <span className="font-medium text-slate-800">{w.text}</span> ·{" "}
              <span className="font-mono text-xs tabular-nums">{w.count} 封</span>
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}

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
        <summary className="cursor-pointer font-semibold text-slate-900">Top 词频明细</summary>
        <ol className="mt-3 columns-1 gap-6 sm:columns-2">
          {DATA.words.map((w) => (
            <li key={w.text} className="mb-1">
              {w.text} · {w.count} 封
            </li>
          ))}
        </ol>
      </details>
    </Card>
  );
}

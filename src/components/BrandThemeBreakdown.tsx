import { DATA } from "../data";
import { Card } from "./Card";
import { THEME_COLORS } from "./dashboard";

export function BrandThemeBreakdown() {
  return (
    <Card title="各品牌内容结构" hint="每行 = 该品牌 3 周邮件的主题占比。">
      <div className="space-y-5">
        {DATA.brands.map((b) => {
          const segs = DATA.themes.filter((t) => (b.themes[t.key] || 0) > 0);
          return (
            <div key={b.name}>
              <div className="mb-2.5 flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-slate-900">{b.name}</span>
                <span className="font-mono text-xs text-slate-500 tabular-nums">{b.total} 封</span>
              </div>
              <div className="flex h-3.5 overflow-hidden rounded-full bg-slate-100 shadow-inner shadow-slate-200/60">
                {segs.map((t) => (
                  <div
                    key={t.key}
                    className="border-r border-white/60 last:border-r-0"
                    style={{
                      width: `${((b.themes[t.key] / b.total) * 100).toFixed(1)}%`,
                      background: THEME_COLORS[t.key],
                    }}
                    title={`${t.labelZh} ${b.themes[t.key]} 封`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                {segs.map((t) => (
                  <span key={t.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: THEME_COLORS[t.key] }} />
                    {t.labelZh} <span className="font-mono tabular-nums">{b.themes[t.key]}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

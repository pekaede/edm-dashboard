import { DATA } from "../data";
import { Card } from "./Card";

export function BrandThemeBreakdown() {
  return (
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
  );
}

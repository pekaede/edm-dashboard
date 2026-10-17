import { useEffect, useRef } from "react";
import type { Brand } from "../data";
import { DATA } from "../data";
import { themeColor } from "../three-week-aggregation";
import { THEME_TINTS } from "./dashboard";

interface BrandDetailDialogProps {
  brand: Brand;
  onClose: () => void;
}

export function BrandDetailDialog({ brand, onClose }: BrandDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const maxWeekly = Math.max(...brand.weekly, 1);
  // 周标签（m1）：优先用实时聚合 weeks（buildAggregatedBrand 传入），缺失时回落静态 DATA.weeks。
  const weeks = brand.weeks ?? DATA.weeks;
  // 主题列表（m1）：静态主题 + 窗口内出现的未知主题（如 other），不要丢计数；
  // 未知主题标签回落为 "其他"（other）或原 key，颜色用 themeColor 的中性回落。
  const themeEntries = [
    ...DATA.themes.map((theme) => ({
      key: theme.key,
      labelZh: theme.labelZh,
      count: brand.themes[theme.key] ?? 0,
    })),
    ...Object.keys(brand.themes)
      .filter((key) => !DATA.themes.some((theme) => theme.key === key))
      .map((key) => ({
        key,
        labelZh: key === "other" ? "其他" : key,
        count: brand.themes[key] ?? 0,
      })),
  ];
  const closeDialog = () => dialogRef.current?.close();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="brand-detail-title"
      aria-describedby="brand-detail-description"
      className="brand-dialog m-auto overflow-y-auto rounded-2xl border border-slate-200 bg-[var(--surface-card)] p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      onClose={onClose}
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-[var(--surface-card)] px-5 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
            品牌明细
          </p>
          <h2 id="brand-detail-title" className="mt-1 truncate text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            {brand.name}
          </h2>
          <p id="brand-detail-description" className="mt-1 text-sm text-slate-600">
            发送频率、主题结构与近期活动摘要
          </p>
        </div>
        <button
          type="button"
          aria-label="关闭品牌明细"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-[var(--surface-card)] text-slate-600 transition duration-200 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-ink)]"
          onClick={closeDialog}
          autoFocus
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="space-y-7 px-5 py-6 sm:px-6 sm:py-7">
        <section aria-labelledby="brand-overview-title">
          <h3 id="brand-overview-title" className="dialog-section-title">
            概览
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <p className="text-sm font-medium text-slate-600">总封数</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950">
                {brand.total}
                <span className="ml-1 text-sm font-medium text-slate-500">封</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <p className="text-sm font-medium text-slate-600">日均</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950">
                {brand.perDay.toFixed(1)}
                <span className="ml-1 text-sm font-medium text-slate-500">封 / 天</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 sm:p-5">
              <p className="text-sm font-medium text-slate-600">主要策略</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                {brand.strategy}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="brand-weekly-title">
          <h3 id="brand-weekly-title" className="dialog-section-title">
            每周趋势
          </h3>
          <div className="mt-4 space-y-4">
            {brand.weekly.map((count, index) => (
              <div key={weeks[index].id} className="brand-week-row">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{weeks[index].label}</p>
                  <p className="text-xs text-slate-600">{weeks[index].range}</p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${(count / maxWeekly) * 100}%`,
                      backgroundColor: themeColor("category"),
                    }}
                  />
                </div>
                <span className="text-right font-mono text-sm font-bold tabular-nums text-slate-900">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="brand-themes-title">
          <h3 id="brand-themes-title" className="dialog-section-title">
            主题结构
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {themeEntries.map((theme) => {
              const count = theme.count;
              const percentage = brand.total > 0 ? Math.round((count / brand.total) * 100) : 0;
              const color = themeColor(theme.key);
              const tint = THEME_TINTS[theme.key] ?? "#f4f0e9";

              return (
                <div
                  key={theme.key}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: color,
                    backgroundColor: tint,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      {theme.labelZh}
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-slate-950">
                      {count} 封
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/80" aria-hidden="true">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="w-9 text-right font-mono text-xs font-semibold tabular-nums text-slate-600">
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="brand-campaigns-title">
          <h3 id="brand-campaigns-title" className="dialog-section-title">
            每周活动摘要
          </h3>
          <ol className="mt-4 space-y-3">
            {brand.campaigns.slice(0, 3).map((campaign, index) => (
              <li key={weeks[index].id} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:gap-4">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                  style={{
                    color: "#315f69",
                    backgroundColor: THEME_TINTS.category,
                  }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-slate-900">
                    {weeks[index].label}
                    <span className="text-xs font-normal text-slate-600">
                      {weeks[index].range}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{campaign}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </dialog>
  );
}

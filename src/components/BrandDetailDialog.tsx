import { useEffect, useRef } from "react";
import type { Brand } from "../data";
import { DATA } from "../data";
import { THEME_COLORS, THEME_TINTS } from "./dashboard";

interface BrandDetailDialogProps {
  brand: Brand;
  onClose: () => void;
}

export function BrandDetailDialog({ brand, onClose }: BrandDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const maxWeekly = Math.max(...brand.weekly);
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
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/45"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
      onClose={onClose}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            品牌明细
          </p>
          <h2 id="brand-detail-title" className="mt-1 text-2xl font-bold text-slate-950">
            {brand.name}
          </h2>
        </div>
        <button
          type="button"
          aria-label="关闭品牌明细"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          onClick={closeDialog}
        >
          ×
        </button>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
        <section aria-labelledby="brand-overview-title">
          <h3 id="brand-overview-title" className="text-base font-bold text-slate-950">
            概览
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">总封数</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950">
                {brand.total}
                <span className="ml-1 text-sm font-medium text-slate-500">封</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">日均</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-950">
                {brand.perDay.toFixed(1)}
                <span className="ml-1 text-sm font-medium text-slate-500">封 / 天</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs text-slate-500">主要策略</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                {brand.strategy}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="brand-weekly-title">
          <h3 id="brand-weekly-title" className="text-base font-bold text-slate-950">
            每周趋势
          </h3>
          <div className="mt-3 space-y-3">
            {brand.weekly.map((count, index) => (
              <div key={DATA.weeks[index].id} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{DATA.weeks[index].label}</p>
                  <p className="text-xs text-slate-400">{DATA.weeks[index].range}</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / maxWeekly) * 100}%`,
                      backgroundColor: THEME_COLORS.category,
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
          <h3 id="brand-themes-title" className="text-base font-bold text-slate-950">
            主题结构
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DATA.themes.map((theme) => {
              const count = brand.themes[theme.key] ?? 0;
              const percentage = Math.round((count / brand.total) * 100);

              return (
                <div
                  key={theme.key}
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: THEME_COLORS[theme.key],
                    backgroundColor: THEME_TINTS[theme.key],
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: THEME_COLORS[theme.key] }}
                      />
                      {theme.labelZh}
                    </span>
                    <span className="font-mono text-sm font-bold tabular-nums text-slate-950">
                      {count} 封
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/75">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: THEME_COLORS[theme.key],
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
          <h3 id="brand-campaigns-title" className="text-base font-bold text-slate-950">
            每周活动摘要
          </h3>
          <ol className="mt-3 space-y-3">
            {brand.campaigns.slice(0, 3).map((campaign, index) => (
              <li key={DATA.weeks[index].id} className="flex gap-3 rounded-xl border border-slate-200 p-4">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                  style={{
                    color: THEME_COLORS.category,
                    backgroundColor: THEME_TINTS.category,
                  }}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {DATA.weeks[index].label}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {DATA.weeks[index].range}
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

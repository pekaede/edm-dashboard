import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BRAND_ORDER,
  EmailRecord,
  getEmailMarket,
  matchesMarket,
} from "../email-data";
import { downloadFile, EmailExportRow, emailsToCSV } from "../export";
import {
  createFavoriteKey,
  loadFavorites,
  subscribeFavorites,
  toggleFavorite,
} from "../favorites";
import { useSiteEmails, useSiteSelection } from "../site-data";
import {
  buildHash,
  notifyUrlChanged,
  parseHash,
  URL_SYNC_EVENT,
} from "../url-state";
import { useUrlSync } from "../use-url-sync";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { ExtendedEmailsState } from "./ExtendedEmailsState";
import { getMarketLabel } from "./MarketFilter";

const PAGE_SIZE = 50;
const EMAIL_LIST_SCROLL_KEY = "edm-emails-list-scroll";
const EMAIL_WINDOW_SCROLL_KEY = "edm-emails-window-scroll";
const EMAIL_VISIBLE_COUNT_KEY = "edm-emails-visible-count";

const FILTER_THEMES = [
  { key: "price", label: "价格促销" },
  { key: "behavior", label: "行为触发" },
  { key: "new", label: "上新" },
  { key: "lifestyle", label: "生活方式" },
  { key: "category", label: "品类聚焦" },
  { key: "other", label: "其他" },
] as const;

const FILTER_BRANDS = BRAND_ORDER;

type FilterTheme = (typeof FILTER_THEMES)[number]["key"];
type FilterBrand = (typeof FILTER_BRANDS)[number];

const THEME_LABELS: Record<string, string> = {
  price: "价格促销",
  behavior: "行为触发",
  new: "上新",
  lifestyle: "生活方式",
  category: "品类聚焦",
  other: "其他",
};

const THEME_BADGE_STYLES: Record<string, string> = {
  price: "border-[var(--theme-price-border)] bg-[var(--theme-price-tint)] text-[var(--theme-price-text)]",
  behavior: "border-[var(--theme-behavior-border)] bg-[var(--theme-behavior-tint)] text-[var(--theme-behavior-text)]",
  new: "border-[var(--theme-new-border)] bg-[var(--theme-new-tint)] text-[var(--theme-new-text)]",
  lifestyle: "border-[var(--theme-lifestyle-border)] bg-[var(--theme-lifestyle-tint)] text-[var(--theme-lifestyle-text)]",
  category: "border-[var(--theme-category-border)] bg-[var(--theme-category-tint)] text-[var(--theme-category-text)]",
  other: "border-[var(--theme-other-border)] bg-[var(--theme-other-tint)] text-[var(--theme-other-text)]",
};

const FILTER_DOT_STYLES: Record<FilterTheme, string> = {
  price: "bg-[var(--theme-price)]",
  behavior: "bg-[var(--theme-behavior)]",
  new: "bg-[var(--theme-new)]",
  lifestyle: "bg-[var(--theme-lifestyle)]",
  category: "bg-[var(--theme-category)]",
  other: "bg-[var(--theme-other-indicator)]",
};

/**
 * Text renderer that highlights matching substring from query with accessible styling.
 */
function HighlightText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim();
  if (!trimmed || !text) {
    return <>{text}</>;
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={index}
            className="rounded-xs bg-[var(--selection-bg)] px-0.5 font-semibold text-[var(--text-heading)]"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ExpandableKeywords({
  email,
  isExpanded,
  onToggle,
  searchQuery,
}: {
  email: EmailRecord;
  isExpanded: boolean;
  onToggle: () => void;
  searchQuery: string;
}) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  // A row can remount while already expanded (pagination / filter /
  // sort unmounts the row, expandedRowKeys survives). The only way to
  // reach expanded is via the overflow button, so a remount with
  // isExpanded already true must start with the button visible —
  // otherwise the row could never be collapsed again. Measuring is
  // impossible while expanded (no clamp), so seed from the prop; the
  // collapse path re-measures for real.
  const [isOverflowing, setIsOverflowing] = useState(isExpanded);
  const keywordsKey = email.keywords.join(" · ");

  // Measured overflow, not a keyword-count heuristic: the span is clamped
  // to 2 lines when collapsed, so scrollHeight > clientHeight means the
  // content is actually truncated. While expanded there is no clamp, so
  // keep the last measured value (the button was shown to get here).
  const measureOverflow = useCallback(() => {
    const el = spanRef.current;
    if (!el || isExpanded) return;
    setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [isExpanded]);

  useLayoutEffect(() => {
    measureOverflow();
    // Highlighting (font-semibold + padding on matches) can change line
    // wrapping without changing the span's box size, so re-measure when
    // the query changes too — ResizeObserver alone would miss it.
  }, [measureOverflow, keywordsKey, searchQuery]);

  useEffect(() => {
    const el = spanRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureOverflow());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureOverflow]);

  // Font swaps can change line wrapping (scrollHeight) without changing
  // the span's box size, which ResizeObserver would not report.
  // Re-measure once webfonts settle; no-op when expanded or on the server.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) measureOverflow();
    });
    return () => {
      cancelled = true;
    };
  }, [measureOverflow]);

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        ref={spanRef}
        className={`transition-all ${
          isExpanded ? "line-clamp-none" : "line-clamp-2"
        }`}
      >
        {email.keywords.map((kw, i) => (
          <span key={i}>
            {i > 0 && (
              <span className="text-[var(--text-muted)]" aria-hidden="true">
                {" "}
                ·{" "}
              </span>
            )}
            <HighlightText text={kw} query={searchQuery} />
          </span>
        ))}
      </span>
      {/* Always offer 收起 while expanded: bulk “展开全部内容” can
          expand a row that measured as fitting (isOverflowing false),
          and overflow cannot be measured while unclamped. Collapsing
          such a row is a no-op visually, but the row must stay
          collapsible per-row. In the collapsed state the button still
          appears only on measured overflow, which is the original fix. */}
      {isOverflowing || isExpanded ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={`${
            isExpanded ? "收起" : "展开"
          } ${email.brand} ${email.date} 的全部关键词`}
          className="inline-flex rounded-xs text-xs font-semibold text-[var(--accent-ink)] underline underline-offset-2 hover:underline-offset-4 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)]"
        >
          {isExpanded ? "收起" : "展开全部"}
        </button>
      ) : null}
    </div>
  );
}

type DatePresetKey = "all" | "7d" | "3w" | "30d";

const DATE_PRESETS: { key: DatePresetKey; label: string; days: number | null }[] = [
  { key: "all", label: "全部日期", days: null },
  { key: "7d", label: "最近 7 天", days: 7 },
  { key: "3w", label: "最近三周", days: 21 },
  { key: "30d", label: "最近一个月", days: 30 },
];

/** ISO 日期平移（UTC 计算，避免时区跨日）。 */
function shiftISODate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

export function ExtendedEmailFilter({
  initialTheme,
}: {
  initialTheme?: string | null;
}) {
  const emailData = useSiteEmails();
  const { market: selectedMarket, setMarket } = useSiteSelection();
  const { emails, meta, status } = emailData;

  useUrlSync({
    isReady: () => status === "ready",
  });

  const [selectedTheme, setSelectedTheme] = useState<FilterTheme | null>(() =>
    FILTER_THEMES.some((theme) => theme.key === initialTheme)
      ? (initialTheme as FilterTheme)
      : null,
  );
  const [selectedBrand, setSelectedBrand] = useState<FilterBrand | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    setVisibleCount(PAGE_SIZE);
  };
  const handleDateToChange = (value: string) => {
    setDateTo(value);
    setVisibleCount(PAGE_SIZE);
  };

  // 快捷范围以数据窗口末日（最新数据日）为锚点，而非今天
  const applyDatePreset = (days: number | null) => {
    if (days === null) {
      setDateFrom("");
      setDateTo("");
    } else {
      setDateTo(meta.windowEnd);
      setDateFrom(shiftISODate(meta.windowEnd, -(days - 1)));
    }
    setVisibleCount(PAGE_SIZE);
  };
  const activeDatePreset: DatePresetKey | null =
    !dateFrom && !dateTo
      ? "all"
      : (DATE_PRESETS.find(
          (preset) =>
            preset.days !== null &&
            dateTo === meta.windowEnd &&
            dateFrom === shiftISODate(meta.windowEnd, -(preset.days - 1)),
        )?.key ?? null);

  // Restore visibleCount from storage so returning to list does not reset to PAGE_SIZE and lose position
  const [visibleCount, setVisibleCount] = useState<number>(() => {
    if (typeof window === "undefined") return PAGE_SIZE;
    try {
      const saved = sessionStorage.getItem(EMAIL_VISIBLE_COUNT_KEY);
      if (saved !== null) {
        const count = Number(saved);
        if (Number.isFinite(count) && count >= PAGE_SIZE) {
          return count;
        }
      }
    } catch {
      // Fallback on security error
    }
    return PAGE_SIZE;
  });

  const visibleCountRef = useRef(visibleCount);
  visibleCountRef.current = visibleCount;

  // Persist visibleCount whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(EMAIL_VISIBLE_COUNT_KEY, String(visibleCount));
    } catch {
      // SecurityError protection
    }
  }, [visibleCount]);

  // Search state initialized from URL hash query
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return parseHash(window.location.hash).query || "";
  });

  // Favorites state from localStorage with cross-tab/event sync
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(
    () => new Set(loadFavorites()),
  );
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Content expansion state for truncated keyword cells
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const listId = useId();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const lastWindowScrollRef = useRef<number>(0);
  const restoredRef = useRef(false);
  const exhaustedRef = useRef(false);
  const restoringRef = useRef(false);
  const userInteractedRef = useRef(false);
  const restoreGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  // Helper to format consistent favorite key
  const getEmailKey = useCallback((email: EmailRecord): string => {
    return createFavoriteKey({
      market: getEmailMarket(email),
      brand: email.brand,
      sent_date: email.date,
      source_index: email.source_index,
      day_seq: email.day_seq,
    });
  }, []);

  // Track container scroll position actively
  const handleContainerScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!restoringRef.current) {
        userInteractedRef.current = true;
      }
      const top = e.currentTarget.scrollTop;
      lastScrollTopRef.current = top;
      if (!restoringRef.current) {
        try {
          sessionStorage.setItem(EMAIL_LIST_SCROLL_KEY, String(top));
        } catch {
          // SecurityError protection
        }
      }
    },
    [],
  );

  // Track window scroll position actively
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWindowScroll = () => {
      if (!restoringRef.current) {
        userInteractedRef.current = true;
      }
      lastWindowScrollRef.current = window.scrollY;
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, []);

  // Subscribe to favorites changes
  useEffect(() => {
    return subscribeFavorites(() => {
      setFavoriteKeys(new Set(loadFavorites()));
    });
  }, []);

  // Proactively save reading position before unmount / visibility change / page unload / view transition
  const saveReadingPosition = useCallback(() => {
    // StrictMode effect replay safety: only save when restore has completed
    // or user has interacted/scrolled; otherwise do not overwrite stored position with 0
    if (!restoredRef.current && !userInteractedRef.current) {
      return;
    }

    // Always use tracked ref value rather than reading live window.scrollY at unmount/save time,
    // protecting against window scroll collapse during SPA view transitions
    const windowTop = lastWindowScrollRef.current;
    const containerTop =
      listContainerRef.current && listContainerRef.current.scrollTop > 0
        ? listContainerRef.current.scrollTop
        : lastScrollTopRef.current;

    try {
      sessionStorage.setItem(EMAIL_LIST_SCROLL_KEY, String(containerTop));
      sessionStorage.setItem(EMAIL_WINDOW_SCROLL_KEY, String(windowTop));
      sessionStorage.setItem(
        EMAIL_VISIBLE_COUNT_KEY,
        String(visibleCountRef.current),
      );
    } catch {
      // SecurityError protection
    }
  }, []);

  // Listen to external hash changes to sync search query and proactively save position on leaving emails view
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleUrlOrViewChange = () => {
      const parsed = parseHash(window.location.hash);
      // Synchronously save reading position when switching away from emails view
      if (parsed.view !== "emails") {
        saveReadingPosition();
      }
      setSearchQuery(parsed.query || "");
    };

    const handleDocumentClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      if (
        target.getAttribute("target") === "_blank" ||
        target.target === "_blank"
      ) {
        return;
      }

      const href = target.getAttribute("href");
      if (!href || !href.startsWith("#")) return;

      const currentHash = window.location.hash || "#";
      const normalizedHref = href.startsWith("#") ? href : `#${href}`;
      if (normalizedHref === currentHash) return;

      const parsed = parseHash(href);
      if (parsed.view !== "emails") {
        saveReadingPosition();
      }
    };

    window.addEventListener("hashchange", handleUrlOrViewChange);
    window.addEventListener("popstate", handleUrlOrViewChange);
    window.addEventListener(URL_SYNC_EVENT, handleUrlOrViewChange);
    document.addEventListener("click", handleDocumentClick, { capture: true });

    return () => {
      window.removeEventListener("hashchange", handleUrlOrViewChange);
      window.removeEventListener("popstate", handleUrlOrViewChange);
      window.removeEventListener(URL_SYNC_EVENT, handleUrlOrViewChange);
      document.removeEventListener("click", handleDocumentClick, { capture: true });
    };
  }, [saveReadingPosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveReadingPosition();
      }
    };

    window.addEventListener("beforeunload", saveReadingPosition);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      saveReadingPosition();
      window.removeEventListener("beforeunload", saveReadingPosition);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [saveReadingPosition]);

  // Restore reading position when data is ready and table is rendered (retries with rAF)
  useEffect(() => {
    mountedRef.current = true;
    if (status !== "ready" || typeof window === "undefined") {
      return () => {
        mountedRef.current = false;
      };
    }
    if (restoredRef.current) {
      return () => {
        mountedRef.current = false;
      };
    }

    restoreGenerationRef.current += 1;
    const currentGeneration = restoreGenerationRef.current;
    // 恢复启动时把组件的 userInteractedRef 重置为 false，并重置 exhaustedRef
    userInteractedRef.current = false;
    exhaustedRef.current = false;

    let savedContainerScroll: string | null = null;
    let savedWindowScroll: string | null = null;
    try {
      savedContainerScroll = sessionStorage.getItem(EMAIL_LIST_SCROLL_KEY);
      savedWindowScroll = sessionStorage.getItem(EMAIL_WINDOW_SCROLL_KEY);
    } catch {
      // SecurityError protection
    }

    if (savedContainerScroll === null && savedWindowScroll === null) {
      restoredRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }

    let rafId: number | null = null;
    let resetRestoringRaf: number | null = null;
    let attempts = 0;
    const maxAttempts = 15;

    const scheduleResetRestoring = () => {
      if (resetRestoringRaf !== null) {
        cancelAnimationFrame(resetRestoringRaf);
      }
      resetRestoringRaf = requestAnimationFrame(() => {
        resetRestoringRaf = requestAnimationFrame(() => {
          restoringRef.current = false;
          resetRestoringRaf = null;
        });
      });
    };

    const tryRestore = () => {
      // 代数仍为本次 setup 的代数且组件仍 mounted 且当前视图仍为目标视图，否则终止
      if (
        !mountedRef.current ||
        restoreGenerationRef.current !== currentGeneration ||
        parseHash(window.location.hash).view !== "emails"
      ) {
        restoringRef.current = false;
        return;
      }

      if (userInteractedRef.current) {
        restoringRef.current = false;
        return;
      }

      // 自身恢复执行 scrollTo 前置 true
      restoringRef.current = true;
      try {
        const container = listContainerRef.current;
        if (savedContainerScroll !== null) {
          const top = Number(savedContainerScroll);
          if (Number.isFinite(top) && container) {
            container.scrollTop = top;
          }
        }

        if (savedWindowScroll !== null) {
          const top = Number(savedWindowScroll);
          if (Number.isFinite(top)) {
            window.scrollTo({ top, behavior: "instant" });
          }
        }

        // 下一帧校验实际位置
        rafId = requestAnimationFrame(() => {
          if (
            !mountedRef.current ||
            restoreGenerationRef.current !== currentGeneration ||
            parseHash(window.location.hash).view !== "emails"
          ) {
            restoringRef.current = false;
            return;
          }

          if (userInteractedRef.current) {
            restoringRef.current = false;
            return;
          }

          try {
            let restoredContainer = false;
            let restoredWindow = false;

            const curContainer = listContainerRef.current;
            if (savedContainerScroll !== null) {
              const top = Number(savedContainerScroll);
              if (Number.isFinite(top)) {
                if (curContainer) {
                  const actual = curContainer.scrollTop;
                  const max = Math.max(
                    0,
                    curContainer.scrollHeight - curContainer.clientHeight,
                  );
                  if (
                    Math.abs(actual - top) <= 2 ||
                    (max > 0 && actual >= max - 2 && top >= max)
                  ) {
                    restoredContainer = true;
                    lastScrollTopRef.current = actual;
                  }
                }
              } else {
                restoredContainer = true;
              }
            } else {
              restoredContainer = true;
            }

            if (savedWindowScroll !== null) {
              const top = Number(savedWindowScroll);
              if (Number.isFinite(top)) {
                const actual = window.scrollY;
                const max = Math.max(
                  0,
                  document.documentElement.scrollHeight - window.innerHeight,
                );
                if (
                  Math.abs(actual - top) <= 2 ||
                  (max > 0 && actual >= max - 2 && top >= max)
                ) {
                  restoredWindow = true;
                  lastWindowScrollRef.current = actual;
                }
              } else {
                restoredWindow = true;
              }
            } else {
              restoredWindow = true;
            }

            // restoredRef 仅在实际位置校验通过时置 true
            if (restoredContainer && restoredWindow) {
              restoredRef.current = true;
              return;
            }

            // 耗尽时只置 exhaustedRef，不置 restoredRef
            attempts++;
            if (attempts >= maxAttempts) {
              exhaustedRef.current = true;
              return;
            }

            // 未成功继续重试
            rafId = requestAnimationFrame(tryRestore);
          } catch {
            // Protection against scroll errors
          } finally {
            scheduleResetRestoring();
          }
        });
      } catch {
        // Protection against scroll errors
      } finally {
        scheduleResetRestoring();
      }
    };

    rafId = requestAnimationFrame(tryRestore);
    return () => {
      mountedRef.current = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (resetRestoringRaf !== null) {
        cancelAnimationFrame(resetRestoringRaf);
      }
      restoringRef.current = false;
    };
  }, [status]);

  // Update URL hash when search query changes and notify hook synchronously
  const updateQueryInUrl = useCallback((query: string) => {
    if (typeof window === "undefined") return;
    const current = parseHash(window.location.hash);
    if (current.query === query) return;
    // 打字搜索只改 query，但重建 hash 会物化市场：当前 URL 未写市场段时
    // （如旧链接 #emails/price），用当前站点补齐并标记显式指定，避免把市场
    // 写成 "all" 而误切全局站点到全部市场；显式 /all 时 market 已为 null、
    // marketSpecified 已为 true，保持全部市场。
    const nextState = {
      ...current,
      query,
      market: current.market ?? selectedMarket,
      marketSpecified: true,
    };
    const nextHash = buildHash(nextState);
    window.history.replaceState(null, "", nextHash);
    notifyUrlChanged();
  }, [selectedMarket]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setVisibleCount(PAGE_SIZE);
    updateQueryInUrl(val);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setVisibleCount(PAGE_SIZE);
    updateQueryInUrl("");
  };

  const handleToggleFavorite = (email: EmailRecord) => {
    const key = getEmailKey(email);
    toggleFavorite(key);
  };

  const toggleRowExpand = (key: string) => {
    setExpandedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Filter emails: market, brand, theme, favorites, and search query
  const filteredEmails = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return emails.filter((email) => {
      if (!matchesMarket(email, selectedMarket)) return false;
      if (selectedBrand && email.brand !== selectedBrand) return false;
      if (selectedTheme && email.theme !== selectedTheme) return false;
      if (dateFrom && email.date < dateFrom) return false;
      if (dateTo && email.date > dateTo) return false;
      if (showOnlyFavorites) {
        const key = getEmailKey(email);
        if (!favoriteKeys.has(key)) return false;
      }
      if (q) {
        const matchesBrand = email.brand.toLowerCase().includes(q);
        const matchesDate = email.date.toLowerCase().includes(q);
        const matchesTheme = (THEME_LABELS[email.theme] ?? email.theme)
          .toLowerCase()
          .includes(q);
        const matchesKeywords = email.keywords.some((kw) =>
          kw.toLowerCase().includes(q),
        );
        if (!matchesBrand && !matchesDate && !matchesTheme && !matchesKeywords) {
          return false;
        }
      }
      return true;
    });
  }, [
    emails,
    selectedMarket,
    selectedBrand,
    selectedTheme,
    dateFrom,
    dateTo,
    showOnlyFavorites,
    favoriteKeys,
    searchQuery,
    getEmailKey,
  ]);

  const visibleEmails = filteredEmails.slice(0, visibleCount);

  // Content expansion semantics: allExpanded is derived, collapsing all clears set, per-row toggle works anytime
  const allExpanded = useMemo(() => {
    if (visibleEmails.length === 0) return false;
    return visibleEmails.every((email) =>
      expandedRowKeys.has(getEmailKey(email)),
    );
  }, [visibleEmails, expandedRowKeys, getEmailKey]);

  const handleToggleAllExpand = () => {
    if (allExpanded) {
      setExpandedRowKeys(new Set());
    } else {
      setExpandedRowKeys(new Set(visibleEmails.map((e) => getEmailKey(e))));
    }
  };
  const selectedThemeLabel = selectedTheme ? THEME_LABELS[selectedTheme] : "全部";
  const selectedBrandLabel = selectedBrand ?? "全部";
  const selectedMarketLabel = getMarketLabel(selectedMarket);
  const dateRangeLabel =
    dateFrom || dateTo ? `${dateFrom || "不限"} 至 ${dateTo || "不限"}` : "全部日期";
  const filterSummary = `市场：${selectedMarketLabel}，品牌：${selectedBrandLabel}，主题：${selectedThemeLabel}${
    dateFrom || dateTo ? `，日期：${dateRangeLabel}` : ""
  }${showOnlyFavorites ? "，仅看收藏" : ""}${searchQuery.trim() ? `，搜索：“${searchQuery.trim()}”` : ""}`;
  const hasMore = visibleEmails.length < filteredEmails.length;

  // Load more without layout jump / scroll position loss
  const handleLoadMore = useCallback(() => {
    const container = listContainerRef.current;
    const prevContainerTop = container ? container.scrollTop : 0;
    const prevWindowY = lastWindowScrollRef.current;

    setVisibleCount((count) => count + PAGE_SIZE);

    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = prevContainerTop;
      }
      window.scrollTo({ top: prevWindowY, behavior: "instant" });
    });
  }, []);

  // Export full filtered dataset (not just visible subset) to RFC4180 CSV
  const handleExportCSV = useCallback(() => {
    if (filteredEmails.length === 0) return;
    const rows: EmailExportRow[] = filteredEmails.map((email) => ({
      market: getEmailMarket(email),
      brand: email.brand,
      sent_date: email.date,
      theme: email.theme,
      keywords: email.keywords,
      original_url: email.url ?? "",
    }));
    const csv = emailsToCSV(rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadFile(`edm-emails-${dateStr}.csv`, csv, "text/csv;charset=utf-8;");
  }, [filteredEmails]);

  const selectBrand = (brand: FilterBrand | null) => {
    setSelectedBrand((currentBrand) =>
      brand !== null && currentBrand === brand ? null : brand,
    );
    setVisibleCount(PAGE_SIZE);
  };

  const selectTheme = (theme: FilterTheme | null) => {
    setSelectedTheme((currentTheme) =>
      theme !== null && currentTheme === theme ? null : theme,
    );
    setVisibleCount(PAGE_SIZE);
  };

  const hint = `${meta.range} · ${meta.market} · 逐封记录按日期倒序`;

  if (status !== "ready") {
    return (
      <Card title="3 个月邮件筛选" hint={hint}>
        <ExtendedEmailsState {...emailData} />
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card title="3 个月邮件筛选" hint={hint}>
        <div className="py-6">
          <EmptyState
            title={`${selectedMarketLabel}暂无收录邮件`}
            description={`该市场在当前统计窗口（${meta.range}）内暂无公开邮件收录记录。看板统计总量均为 Milled 公开收录样本，非品牌私域全量投递。`}
            actionLabel={selectedMarket ? "切换至全部市场" : "重新拉取"}
            onAction={selectedMarket ? () => setMarket(null) : emailData.retry}
          />
        </div>
      </Card>
    );
  }

  const favoriteCount = favoriteKeys.size;

  return (
    <Card title="3 个月邮件筛选" hint={hint}>
      <div className="overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-page)]">
        <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          {/* Header summary banner */}
          <div className="flex flex-col gap-4 border-b border-[var(--border-strong)] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-ink)]">
                Editorial email index
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-email-intro)] sm:text-base">
                从品牌与主题切入三个月邮件触达（含服务/法务通知），支持关键词高亮搜索、收藏标记与结果全量导出。
              </p>
            </div>
            <div className="flex shrink-0 items-baseline gap-2 text-[var(--text-heading)]">
              <strong className="text-3xl font-extrabold leading-none tracking-tight tabular-nums sm:text-4xl">
                {filteredEmails.length}
              </strong>
              <span className="pb-1 text-sm font-semibold">封邮件</span>
            </div>
          </div>

          {/* Filter options (Brand & Theme) */}
          <div className="space-y-5">
            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
                  按品牌筛选
                </p>
                <p className="text-xs text-[var(--text-description)]">
                  当前：{selectedBrandLabel}
                </p>
              </div>

              <div
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7"
                role="group"
                aria-label="按邮件品牌筛选"
              >
                <button
                  type="button"
                  onClick={() => selectBrand(null)}
                  aria-pressed={selectedBrand === null}
                  className={`min-h-12 rounded-full border px-4 py-2.5 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                    selectedBrand === null
                      ? "border-[var(--text-heading)] bg-[var(--text-heading)] text-white shadow-[var(--shadow-filter-active)]"
                      : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
                  }`}
                >
                  全部
                </button>

                {FILTER_BRANDS.map((brand) => {
                  const isSelected = selectedBrand === brand;

                  return (
                    <button
                      type="button"
                      key={brand}
                      onClick={() => selectBrand(brand)}
                      aria-pressed={isSelected}
                      aria-label={`${brand}品牌${isSelected ? "，当前已选中，再次点击清除筛选" : ""}`}
                      className={`flex min-h-12 items-center justify-center rounded-full border px-3 py-2.5 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                        isSelected
                          ? "border-[var(--accent-ink)] bg-[var(--accent-ink)] text-white shadow-[var(--shadow-filter-accent-active)]"
                          : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
                      }`}
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
                  按主题筛选
                </p>
                <p
                  className="text-xs text-[var(--text-description)]"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  当前：{selectedThemeLabel}
                </p>
              </div>

              <div
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6"
                role="group"
                aria-label="按邮件主题筛选"
              >
                <button
                  type="button"
                  onClick={() => selectTheme(null)}
                  aria-pressed={selectedTheme === null}
                  className={`min-h-12 rounded-full border px-4 py-2.5 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                    selectedTheme === null
                      ? "border-[var(--text-heading)] bg-[var(--text-heading)] text-white shadow-[var(--shadow-filter-active)]"
                      : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
                  }`}
                >
                  全部
                </button>

                {FILTER_THEMES.map((theme) => {
                  const isSelected = selectedTheme === theme.key;

                  return (
                    <button
                      type="button"
                      key={theme.key}
                      onClick={() => selectTheme(theme.key)}
                      aria-pressed={isSelected}
                      aria-label={`${theme.label}主题${isSelected ? "，当前已选中，再次点击清除筛选" : ""}`}
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-full border px-3 py-2.5 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                        isSelected
                          ? "border-[var(--accent-ink)] bg-[var(--accent-ink)] text-white shadow-[var(--shadow-filter-accent-active)]"
                          : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${isSelected ? "bg-white/80" : FILTER_DOT_STYLES[theme.key]}`}
                        aria-hidden="true"
                      />
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-label)]">
                  按日期筛选
                </p>
                <p
                  className="text-xs text-[var(--text-description)]"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  当前：{dateRangeLabel}
                </p>
              </div>
              <div
                className="mb-3 flex flex-wrap gap-2.5"
                role="group"
                aria-label="日期快捷范围"
              >
                {DATE_PRESETS.map((preset) => {
                  const isActive = activeDatePreset === preset.key;
                  return (
                    <button
                      type="button"
                      key={preset.key}
                      onClick={() => applyDatePreset(preset.days)}
                      aria-pressed={isActive}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)] ${
                        isActive
                          ? "border-[var(--text-heading)] bg-[var(--text-heading)] text-white shadow-[var(--shadow-filter-active)]"
                          : "border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] text-[var(--text-control)] hover:-translate-y-0.5 hover:border-[var(--control-filter-hover-border)] hover:bg-[var(--control-filter-hover-bg)]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                <label className="flex items-center gap-2 text-base font-semibold text-[var(--text-description)]">
                  起始
                  <input
                    type="date"
                    value={dateFrom}
                    min={meta.windowStart}
                    max={dateTo || meta.windowEnd}
                    onChange={(e) => handleDateFromChange(e.target.value)}
                    className="min-w-44 rounded-lg border border-[var(--border-control)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-base text-[var(--text-primary)] transition-colors focus-visible:border-[var(--control-focus)] focus-visible:bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
                  />
                </label>
                <span aria-hidden="true" className="text-[var(--text-muted)]">
                  —
                </span>
                <label className="flex items-center gap-2 text-base font-semibold text-[var(--text-description)]">
                  结束
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || meta.windowStart}
                    max={meta.windowEnd}
                    onChange={(e) => handleDateToChange(e.target.value)}
                    className="min-w-44 rounded-lg border border-[var(--border-control)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-base text-[var(--text-primary)] transition-colors focus-visible:border-[var(--control-focus)] focus-visible:bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
                  />
                </label>
                {dateFrom || dateTo ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setVisibleCount(PAGE_SIZE);
                    }}
                    className="rounded-full border border-[var(--control-filter-border)] bg-[var(--control-filter-bg)] px-4 py-2 text-sm font-bold text-[var(--text-control)] transition hover:bg-[var(--control-filter-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-heading)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
                  >
                    清除日期
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Interactive Toolbar: Search, Favorites filter, Expand all, Export CSV */}
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-3.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <label htmlFor={`${listId}-search`} className="sr-only">
                搜索邮件关键词、品牌或主题
              </label>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-muted)]">
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                id={`${listId}-search`}
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="搜索邮件关键词、品牌、主题或日期..."
                className="w-full rounded-lg border border-[var(--border-control)] bg-[var(--surface-subtle)] py-2 pr-9 pl-9 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus-visible:border-[var(--control-focus)] focus-visible:bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="清空搜索内容"
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[var(--text-muted)] hover:text-[var(--text-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-1 rounded-sm"
                >
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ) : null}
            </div>

            {/* Actions group: Favorites toggle, Expand toggle, Export button */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowOnlyFavorites((prev) => !prev);
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-pressed={showOnlyFavorites}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] sm:text-sm ${
                  showOnlyFavorites
                    ? "border-[var(--theme-behavior-border)] bg-[var(--theme-behavior-tint)] text-[var(--theme-behavior-text)] shadow-xs"
                    : "border-[var(--control-border)] bg-[var(--control-bg)] text-[var(--control-text)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)]"
                }`}
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill={showOnlyFavorites ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>仅看收藏 ({favoriteCount})</span>
              </button>

              <button
                type="button"
                onClick={handleToggleAllExpand}
                aria-pressed={allExpanded}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--control-border)] bg-[var(--control-bg)] px-3 py-2 text-xs font-semibold text-[var(--control-text)] transition hover:bg-[var(--control-hover-bg)] hover:text-[var(--control-hover-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] sm:text-sm"
              >
                <span>{allExpanded ? "收起所有内容" : "展开全部内容"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredEmails.length === 0}
                aria-label={`导出当前全部筛选结果为 CSV，共 ${filteredEmails.length} 封邮件`}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] sm:text-sm ${
                  filteredEmails.length > 0
                    ? "border-[var(--text-heading)] bg-[var(--text-heading)] text-[var(--text-inverse)] hover:bg-[var(--accent-ink)] hover:border-[var(--accent-ink)]"
                    : "cursor-not-allowed border-[var(--control-disabled-border)] bg-[var(--control-disabled-bg)] text-[var(--control-disabled-text)] opacity-60"
                }`}
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>导出 CSV ({filteredEmails.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Empty state when filters or search yield 0 results */}
        {filteredEmails.length === 0 ? (
          <div className="border-y border-[var(--border-strong)] bg-[var(--surface-card)] p-4 sm:p-6">
            <EmptyState
              title="无符合当前条件的邮件"
              description={`${filterSummary}。当前暂无符合该组合条件的公开邮件样本。你可以重置条件或清空搜索词。`}
              actionLabel="重置筛选与搜索"
              onAction={() => {
                setSelectedBrand(null);
                setSelectedTheme(null);
                setDateFrom("");
                setDateTo("");
                setShowOnlyFavorites(false);
                handleClearSearch();
                setVisibleCount(PAGE_SIZE);
              }}
            />
          </div>
        ) : (
          /* Scrollable email table */
          <div
            id={listId}
            ref={listContainerRef}
            onScroll={handleContainerScroll}
            className="max-h-[min(42rem,65dvh)] overflow-auto border-y border-[var(--border-strong)] bg-[var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-ink)]"
            tabIndex={0}
            aria-label={`${filterSummary}的邮件列表，可横向滚动`}
          >
            <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-left text-sm text-[var(--text-email-table)]">
              <caption className="sr-only">
                {filterSummary}的 3 个月邮件记录，按日期从新到旧排列
              </caption>
              <thead className="sticky top-0 z-10 bg-[var(--surface-table-header)] text-xs font-bold uppercase tracking-[0.08em] text-[var(--surface-table-stripe)] shadow-[var(--shadow-table-header)]">
                <tr>
                  <th scope="col" className="w-16 px-4 py-4 text-center">
                    收藏
                  </th>
                  <th scope="col" className="w-32 px-5 py-4">
                    日期
                  </th>
                  <th scope="col" className="w-40 px-5 py-4">
                    品牌
                  </th>
                  {selectedMarket === null && (
                    <th scope="col" className="w-24 px-5 py-4">
                      市场
                    </th>
                  )}
                  <th scope="col" className="w-36 px-5 py-4">
                    主题
                  </th>
                  <th scope="col" className="min-w-56 px-5 py-4">
                    标题
                  </th>
                  <th scope="col" className="min-w-56 px-5 py-4">
                    副标题
                  </th>
                  <th scope="col" className="px-5 py-4">
                    关键词
                  </th>
                  <th scope="col" className="w-24 whitespace-nowrap px-5 py-4">
                    原文
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleEmails.map((email, index) => {
                  const emailKey = getEmailKey(email);
                  const isFav = favoriteKeys.has(emailKey);
                  const isExpanded = expandedRowKeys.has(emailKey);
                  const hasKeywords = email.keywords.length > 0;

                  return (
                    <tr
                      key={emailKey}
                      className={`transition-colors hover:bg-[var(--surface-table-hover)] ${
                        index % 2 === 0
                          ? "bg-[var(--surface-card)]"
                          : "bg-[var(--surface-table-stripe)]"
                      }`}
                    >
                      {/* Favorite toggle cell */}
                      <td className="w-16 border-b border-[var(--divider-email)] px-4 py-4 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(email)}
                          aria-label={`${isFav ? "取消收藏" : "收藏"} ${email.brand} ${email.date} 的邮件`}
                          aria-pressed={isFav}
                          className={`inline-flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)] ${
                            isFav
                              ? "text-[var(--theme-behavior-text)] underline underline-offset-2 hover:underline-offset-4 hover:decoration-2 hover:bg-[var(--control-hover-bg)]"
                              : "text-[var(--text-muted)] hover:bg-[var(--control-hover-bg)] hover:text-[var(--text-heading)]"
                          }`}
                        >
                          <svg
                            className="size-5"
                            viewBox="0 0 24 24"
                            fill={isFav ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                      </td>

                      {/* Date cell */}
                      <td className="border-b border-[var(--divider-email)] px-5 py-4 font-mono text-xs font-medium tabular-nums text-[var(--text-label)]">
                        <HighlightText
                          text={email.date}
                          query={searchQuery}
                        />
                      </td>

                      {/* Brand cell */}
                      <td className="border-b border-[var(--divider-email)] px-5 py-4 align-middle">
                        <span className="font-bold tracking-[-0.01em] text-[var(--text-email-brand)]">
                          <HighlightText
                            text={email.brand}
                            query={searchQuery}
                          />
                        </span>
                      </td>

                      {/* Market cell: shown only in all-markets mode, redundant when a single site is selected */}
                      {selectedMarket === null && (
                        <td className="border-b border-[var(--divider-email)] px-5 py-4 align-middle text-[var(--text-detail)]">
                          {getMarketLabel(getEmailMarket(email))}
                        </td>
                      )}

                      {/* Theme cell */}
                      <td className="border-b border-[var(--divider-email)] px-5 py-4 align-middle">
                        <span
                          className={`inline-flex min-w-24 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-bold ${
                            THEME_BADGE_STYLES[email.theme] ??
                            THEME_BADGE_STYLES.other
                          }`}
                        >
                          <HighlightText
                            text={
                              THEME_LABELS[email.theme] ?? email.theme
                            }
                            query={searchQuery}
                          />
                        </span>
                      </td>

                      {/* Subject cell */}
                      <td className="max-w-md border-b border-[var(--divider-email)] px-5 py-4 align-middle leading-6 text-[var(--text-detail)]">
                        {email.subject ? (
                          <span className="line-clamp-2" title={email.subject}>
                            {email.subject}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Preheader cell */}
                      <td className="max-w-md border-b border-[var(--divider-email)] px-5 py-4 align-middle leading-6 text-[var(--text-detail)]">
                        {email.preheader ? (
                          <span className="line-clamp-2" title={email.preheader}>
                            {email.preheader}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Keywords cell with highlight and expandable truncation */}
                      <td className="max-w-xl border-b border-[var(--divider-email)] px-5 py-4 leading-6 text-[var(--text-detail)]">
                        {hasKeywords ? (
                          <ExpandableKeywords
                            email={email}
                            isExpanded={isExpanded}
                            onToggle={() => toggleRowExpand(emailKey)}
                            searchQuery={searchQuery}
                          />
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Original URL cell */}
                      <td className="whitespace-nowrap border-b border-[var(--divider-email)] px-5 py-4 align-middle">
                        {email.url ? (
                          <a
                            href={email.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`查看 ${email.brand} ${email.date} 的邮件原文（新窗口打开）`}
                            className="rounded-xs font-semibold text-[var(--accent-ink)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
                          >
                            原文
                          </a>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer: Pagination / Load more and record count */}
        {filteredEmails.length > 0 ? (
          <div className="flex flex-col gap-4 bg-[var(--surface-page)] px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p
              className="text-xs leading-5 text-[var(--text-caption)]"
              aria-live="polite"
            >
              已显示{" "}
              <strong className="text-[var(--text-control)]">
                {visibleEmails.length}
              </strong>{" "}
              / {filteredEmails.length} 封
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              按日期倒序
            </p>

            {hasMore ? (
              <button
                type="button"
                onClick={handleLoadMore}
                aria-controls={listId}
                className="min-h-11 rounded-full border border-[var(--text-control)] bg-[var(--text-control)] px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:border-[var(--accent-ink)] hover:bg-[var(--accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--control-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-page)]"
              >
                加载更多（剩余 {filteredEmails.length - visibleEmails.length} 封）
              </button>
            ) : (
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-notice)]">
                已加载全部
              </p>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

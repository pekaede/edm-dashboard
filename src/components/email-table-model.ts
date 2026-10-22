import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
} from "@tanstack/react-table";
import { getEmailMarket, matchesMarket, type EmailRecord } from "../email-data";
import { createFavoriteKey } from "../favorites";
import { translateIn } from "../i18n";
import { themeLabelKeyOf } from "./dashboard";

// 仅注册邮件列表使用的功能；URL、日期和收藏仍由原有入口提供受控状态。
export const emailTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

export interface EmailTableFilters {
  market: string | null;
  brand: string | null;
  theme: string | null;
  dateFrom: string;
  dateTo: string;
  favoritesOnly: boolean;
  favoriteKeys: ReadonlySet<string>;
  query: string;
}

export function getEmailRowKey(email: EmailRecord): string {
  return createFavoriteKey({
    market: getEmailMarket(email),
    brand: email.brand,
    sent_date: email.date,
    source_index: email.source_index,
    day_seq: email.day_seq,
  });
}

function matchesEmail(email: EmailRecord, filters: EmailTableFilters): boolean {
  if (!matchesMarket(email, filters.market)) return false;
  if (filters.brand && email.brand !== filters.brand) return false;
  if (filters.theme && email.theme !== filters.theme) return false;
  if (filters.dateFrom && email.date < filters.dateFrom) return false;
  if (filters.dateTo && email.date > filters.dateTo) return false;
  if (filters.favoritesOnly && !filters.favoriteKeys.has(getEmailRowKey(email))) return false;
  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  const themeKey = themeLabelKeyOf(email.theme);
  const matchesTheme = themeKey
    ? translateIn("zh", themeKey).toLowerCase().includes(q) || translateIn("en", themeKey).toLowerCase().includes(q)
    : email.theme.toLowerCase().includes(q);
  return email.brand.toLowerCase().includes(q) ||
    email.date.toLowerCase().includes(q) ||
    matchesTheme || email.keywords.some((keyword) => keyword.toLowerCase().includes(q));
}

export const emailTableColumns: ColumnDef<typeof emailTableFeatures, EmailRecord>[] = [
  {
    id: "email",
    accessorFn: (email) => email,
    filterFn: (row, _columnId, value: EmailTableFilters) => matchesEmail(row.original, value),
    enableSorting: false,
  },
  {
    id: "date",
    accessorKey: "date",
    sortFn: (left, right) => left.original.date.localeCompare(right.original.date),
    enableColumnFilter: false,
  },
];

export interface EmailExportRow {
  market: string;
  brand: string;
  sent_date: string;
  theme: string;
  keywords: string[] | string;
  original_url: string;
}

function escapeCSVField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts email rows to RFC4180-compliant CSV string with standard header.
 */
export function emailsToCSV(rows: EmailExportRow[]): string {
  const header = "market,brand,sent_date,theme,keywords,original_url";
  const lines: string[] = [header];

  for (const row of rows) {
    const kw = Array.isArray(row.keywords) ? row.keywords.join(";") : (row.keywords ?? "");
    const line = [
      escapeCSVField(row.market),
      escapeCSVField(row.brand),
      escapeCSVField(row.sent_date),
      escapeCSVField(row.theme),
      escapeCSVField(kw),
      escapeCSVField(row.original_url),
    ].join(",");
    lines.push(line);
  }

  return lines.join("\r\n");
}

/**
 * Initiates browser file download via Blob and <a download>.
 * Safely guards against non-browser environments without throwing errors.
 */
export function downloadFile(
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8;"
): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch {
    // Fail silently in environments where Blob / URL / click are unsupported
  }
}

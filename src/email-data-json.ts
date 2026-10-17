import { BRAND_ORDER, EXTENDED_EMAIL_META, type EmailRecord } from "./email-data";

interface JsonCollection {
  brand: string;
  market?: string;
  emails: {
    date: string;
    theme: string;
    keywords: string[];
    url?: string;
  }[];
}

const collections = import.meta.glob<JsonCollection>([
  "../data-collection/zara-2026-07-16-to-2026-10-15.json",
  "../data-collection/lululemon-2026-07-16-to-2026-10-15.json",
  "../data-collection/aloyoga-2026-07-16-to-2026-10-15.json",
  "../data-collection/halara-2026-07-16-to-2026-10-15.json",
  "../data-collection/temu-2026-07-16-to-2026-10-15.json",
  "../data-collection/shein-2026-07-16-to-2026-10-15.json",
], { import: "default" });

const collectionNames = ["zara", "lululemon", "aloyoga", "halara", "temu", "shein"] as const;

export async function loadJsonEmailDataset(): Promise<{ emails: EmailRecord[]; expectedTotal: number }> {
  const brands = await Promise.all(BRAND_ORDER.map(async (brand, brandIndex) => {
    const loadCollection = collections[`../data-collection/${collectionNames[brandIndex]}-2026-07-16-to-2026-10-15.json`];
    const collection = await loadCollection();
    if (collection.brand !== brand || (collection.market !== undefined && collection.market !== "US") ||
      !Array.isArray(collection.emails) || !collection.emails.every((email) =>
        typeof email.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(email.date) &&
        email.date >= EXTENDED_EMAIL_META.windowStart && email.date <= EXTENDED_EMAIL_META.windowEnd &&
        typeof email.theme === "string" && Array.isArray(email.keywords) &&
        email.keywords.every((keyword) => typeof keyword === "string") &&
        (email.url === undefined || typeof email.url === "string"),
      )) {
      throw new Error(`历史 US 回滚文件 ${brand} 格式或窗口无效。`);
    }
    const emails = brand === "Temu"
      ? collection.emails.filter((email) => email.theme !== "other")
      : collection.emails;
    const dailyCounts = new Map<string, number>();

    const records = emails.map((email, sourceIndex) => {
      const daySequence = dailyCounts.get(email.date) ?? 0;
      dailyCounts.set(email.date, daySequence + 1);
      return {
        brand,
        date: email.date,
        theme: email.theme,
        keywords: [...email.keywords],
        url: email.url,
        day_seq: daySequence,
        source_index: sourceIndex,
        market: "US",
      };
    });
    return { records, expectedTotal: collection.emails.reduce((count, email) => count + Number(brand !== "Temu" || email.theme !== "other"), 0) };
  }));

  return { emails: brands.flatMap((brand) => brand.records), expectedTotal: brands.reduce((sum, brand) => sum + brand.expectedTotal, 0) };
}

export async function jsonAdapter(): Promise<EmailRecord[]> {
  return (await loadJsonEmailDataset()).emails;
}

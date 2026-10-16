import { BRAND_ORDER, type EmailRecord } from "./email-data";

interface JsonCollection {
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

export async function jsonAdapter(): Promise<EmailRecord[]> {
  const brands = await Promise.all(BRAND_ORDER.map(async (brand, brandIndex) => {
    const loadCollection = collections[`../data-collection/${collectionNames[brandIndex]}-2026-07-16-to-2026-10-15.json`];
    const collection = await loadCollection();
    const emails = brand === "Temu"
      ? collection.emails.filter((email) => email.theme !== "other")
      : collection.emails;
    const dailyCounts = new Map<string, number>();

    return emails.map((email, sourceIndex) => {
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
      };
    });
  }));

  return brands.flat();
}

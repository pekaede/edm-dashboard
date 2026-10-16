#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(SCRIPT_DIR, "..", "data-collection");
const DAY_MS = 24 * 60 * 60 * 1000;
const TARGET_BRANDS = new Set(["Zara", "lululemon", "ALO Yoga", "Halara", "Temu", "SHEIN"]);

const RECONCILIATION_NOTES = [
  "重叠窗口 2026-09-24 至 2026-10-15：Zara 新收 8 封 vs data.ts 7 封；不覆盖现有总数。",
  "重叠窗口 2026-09-24 至 2026-10-15：ALO Yoga 新收 28 封 vs data.ts 27 封；不覆盖现有总数。",
  "重叠窗口 2026-09-24 至 2026-10-15：lululemon 新收 13 封，与 data.ts 一致。",
  "重叠窗口 2026-09-24 至 2026-10-15：Halara 新收 44 封 vs data.ts 43 封；不覆盖现有总数。",
  "重叠窗口 2026-09-24 至 2026-10-15：Temu 新收 44 封，与 data.ts 一致。",
  "重叠窗口 2026-09-24 至 2026-10-15：SHEIN 新收 65 封 vs data.ts 62 封；不覆盖现有总数。",
  "Temu 原始收录 93 封，其中 8 封 other 为商家侧 listing 邮件，不属于消费者 EDM；聚合时排除，消费者邮件计 85 封。",
  "Halara 3 个月主题按标题主钩（lead-hook）分类，与 data.ts 旧 3 周主题口径不同；保留原始分类，不强行调和。",
];

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseWindow(windowText, fileName) {
  const match = /^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})$/.exec(windowText);
  assert(match, `${fileName}: invalid window ${JSON.stringify(windowText)}`);
  return { start: match[1], end: match[2] };
}

function resolveWindow(collection) {
  if (typeof collection.window === "string") {
    return parseWindow(collection.window, collection.fileName);
  }

  const match = /-(\d{4}-\d{2}-\d{2})-to-(\d{4}-\d{2}-\d{2})\.json$/.exec(collection.fileName);
  assert(match, `${collection.fileName}: missing window and file name has no date range`);
  return { start: match[1], end: match[2] };
}

function enumerateDates(start, end) {
  const dates = [];
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  assert(Number.isFinite(startTime) && Number.isFinite(endTime) && startTime <= endTime, "Invalid date window");

  for (let time = startTime; time <= endTime; time += DAY_MS) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }

  return dates;
}

function sortedCountObject(counts) {
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => compareText(left, right)));
}

function increment(counts, key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

async function loadCollections() {
  const fileNames = (await readdir(DATA_DIR))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort(compareText);

  assert(fileNames.length > 0, `No JSON files found in ${DATA_DIR}`);

  const collections = await Promise.all(
    fileNames.map(async (fileName) => {
      const raw = JSON.parse(await readFile(join(DATA_DIR, fileName), "utf8"));
      assert(typeof raw.brand === "string" && raw.brand.length > 0, `${fileName}: missing brand`);
      assert(Array.isArray(raw.emails), `${fileName}: missing emails array`);

      for (const [index, email] of raw.emails.entries()) {
        assert(typeof email.date === "string", `${fileName}: emails[${index}] missing date`);
        assert(typeof email.theme === "string", `${fileName}: emails[${index}] missing theme`);
        assert(Array.isArray(email.keywords), `${fileName}: emails[${index}] missing keywords`);
      }

      return { fileName, ...raw };
    }),
  );

  const targetCollections = collections.filter((collection) => TARGET_BRANDS.has(collection.brand));
  const foundBrands = new Set(targetCollections.map((collection) => collection.brand));
  for (const brand of TARGET_BRANDS) {
    assert(foundBrands.has(brand), `Missing collection for ${brand}`);
  }

  return targetCollections;
}

function aggregateBrand(collection, dates) {
  const dailyCounts = new Map(dates.map((date) => [date, 0]));
  const themeCounts = new Map();
  const keywordCounts = new Map();
  const emails = collection.brand === "Temu"
    ? collection.emails.filter((email) => email.theme !== "other")
    : collection.emails;

  for (const email of emails) {
    assert(dailyCounts.has(email.date), `${collection.fileName}: email date ${email.date} is outside the declared window`);
    increment(dailyCounts, email.date);
    increment(themeCounts, email.theme);

    for (const keyword of new Set(email.keywords)) {
      assert(typeof keyword === "string", `${collection.fileName}: keyword must be a string`);
      increment(keywordCounts, keyword);
    }
  }

  return {
    total: emails.length,
    daily: dates.map((date) => ({ date, count: dailyCounts.get(date) })),
    themes: sortedCountObject(themeCounts),
    keywords: sortedCountObject(keywordCounts),
    ...(typeof collection.brandPage === "string" ? { brandPage: collection.brandPage } : {}),
  };
}

async function main() {
  const collections = await loadCollections();
  const windows = collections.map(resolveWindow);
  const [{ start, end }] = windows;

  for (const window of windows) {
    assert(window.start === start && window.end === end, "All collections must use the same date window");
  }

  const dates = enumerateDates(start, end);
  const brands = {};

  for (const collection of [...collections].sort((left, right) => compareText(left.brand, right.brand))) {
    assert(!(collection.brand in brands), `Duplicate brand ${collection.brand}`);
    brands[collection.brand] = aggregateBrand(collection, dates);
  }

  const combinedDaily = dates.map((date, index) => ({
    date,
    count: Object.values(brands).reduce((total, brand) => total + brand.daily[index].count, 0),
  }));

  const result = {
    window: { start, end },
    brands,
    combinedDaily,
    reconciliationNotes: RECONCILIATION_NOTES,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

await main();

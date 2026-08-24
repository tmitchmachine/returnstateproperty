// Live metro market stats from Redfin's free Data Center bulk download.
// https://www.redfin.com/news/data-center/
//
// Streams the gzipped metro tracker TSV and keeps only our scan metros —
// never loads the full ~100MB file into a string. Results are cached for a
// week (Redfin refreshes weekly). Falls back to the committed snapshot JSON
// when the download fails.

import { createGunzip } from "zlib";
import { createInterface } from "readline";
import { Readable } from "stream";
import { unstable_cache } from "next/cache";
import { METRO_CONFIGS } from "../metros";
import snapshot from "../data/redfin-metro-snapshot.json";

const REDFIN_METRO_TSV_URL =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/redfin_metro_market_tracker.tsv000.gz";

export interface RedfinMetroRow {
  region: string;
  medianPpsf: number;
  ppsfYoY: number;
  medianDaysOnMarket: number;
  homesSold: number;
  medianSalePrice: number | null;
  periodBegin: string;
}

function stripQuotes(value: string | undefined): string {
  if (!value) return "";
  const t = value.trim();
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

function parseNum(value: string | undefined): number | null {
  const v = stripQuotes(value);
  if (!v || v === "NA") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Parse one TSV line into a field map given the header. */
function parseRow(line: string, headers: string[]): Record<string, string> {
  const cols = line.split("\t");
  const row: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    row[headers[i]] = cols[i] ?? "";
  }
  return row;
}

async function streamLatestMetroRows(): Promise<Record<string, RedfinMetroRow>> {
  const regionToId = Object.fromEntries(
    METRO_CONFIGS.map((m) => [m.redfinRegion, m.id]),
  );
  const wanted = new Set(Object.keys(regionToId));

  const res = await fetch(REDFIN_METRO_TSV_URL, {
    // Cache the raw download at the HTTP layer for a week as well.
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Redfin download failed: HTTP ${res.status}`);
  }

  // Node streams from the Web ReadableStream (Next/Node runtime).
  const nodeBody = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
  const rl = createInterface({ input: nodeBody.pipe(createGunzip()) });

  let headers: string[] | null = null;
  const best: Record<string, RedfinMetroRow & { _begin: string }> = {};

  for await (const line of rl) {
    if (!headers) {
      headers = line.split("\t").map(stripQuotes);
      continue;
    }
    // Cheap pre-filter before full parse: skip lines that can't match a target.
    let hits = false;
    for (const region of wanted) {
      if (line.includes(region)) {
        hits = true;
        break;
      }
    }
    if (!hits) continue;

    const row = parseRow(line, headers);
    const region = stripQuotes(row.REGION);
    if (!wanted.has(region)) continue;
    if (stripQuotes(row.PROPERTY_TYPE) !== "All Residential") continue;
    if (stripQuotes(row.IS_SEASONALLY_ADJUSTED) === "true") continue;

    const begin = stripQuotes(row.PERIOD_BEGIN);
    const prev = best[region];
    if (prev && begin <= prev._begin) continue;

    const medianPpsf = parseNum(row.MEDIAN_PPSF);
    const ppsfYoY = parseNum(row.MEDIAN_PPSF_YOY);
    const dom = parseNum(row.MEDIAN_DOM);
    const sold = parseNum(row.HOMES_SOLD);
    if (medianPpsf == null || ppsfYoY == null) continue;

    best[region] = {
      region,
      medianPpsf,
      ppsfYoY,
      medianDaysOnMarket: Math.round(dom ?? 30),
      homesSold: Math.round(sold ?? 0),
      medianSalePrice: parseNum(row.MEDIAN_SALE_PRICE),
      periodBegin: begin,
      _begin: begin,
    };
  }

  const out: Record<string, RedfinMetroRow> = {};
  for (const [region, row] of Object.entries(best)) {
    const id = regionToId[region];
    if (!id) continue;
    const { _begin: _, ...rest } = row;
    out[id] = rest;
  }

  if (Object.keys(out).length === 0) {
    throw new Error("Redfin stream produced no matching metro rows");
  }
  return out;
}

function snapshotAsRows(): Record<string, RedfinMetroRow> {
  const out: Record<string, RedfinMetroRow> = {};
  for (const [id, m] of Object.entries(snapshot.metros)) {
    out[id] = {
      region: m.region,
      medianPpsf: m.medianPpsf,
      ppsfYoY: m.ppsfYoY,
      medianDaysOnMarket: m.medianDaysOnMarket,
      homesSold: m.homesSold,
      medianSalePrice: m.medianSalePrice ?? null,
      periodBegin: m.periodBegin ?? snapshot.periodBegin,
    };
  }
  return out;
}

const getCachedLiveRows = unstable_cache(
  async () => streamLatestMetroRows(),
  ["redfin-metro-market-tracker"],
  { revalidate: 60 * 60 * 24 * 7, tags: ["redfin-markets"] },
);

/**
 * Latest All-Residential metro stats for our scan markets.
 * Prefers a live Redfin Data Center pull; falls back to the committed snapshot.
 */
export async function fetchRedfinMetroStats(): Promise<{
  rows: Record<string, RedfinMetroRow>;
  live: boolean;
  periodBegin: string;
}> {
  try {
    const rows = await getCachedLiveRows();
    const periodBegin =
      Object.values(rows)[0]?.periodBegin ?? snapshot.periodBegin;
    return { rows, live: true, periodBegin };
  } catch (err) {
    console.warn(
      "[redfin] live metro tracker failed, using snapshot:",
      err instanceof Error ? err.message : err,
    );
    const rows = snapshotAsRows();
    return { rows, live: false, periodBegin: snapshot.periodBegin };
  }
}

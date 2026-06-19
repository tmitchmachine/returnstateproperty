# ReturnState Property — opportunity scanner

Scans real-estate listings, forms an **independent opinion of value, rent, and
risk**, and ranks them by buy-side opportunity. Built on Next.js 16.

```bash
npm run dev   # http://localhost:3000
npm run build # production build (prerenders every property page)
```

## How it works

The pipeline is intentionally source-agnostic — every source maps to one
`Listing` shape, and the analysis is computed, never handed in.

```
Listing (observable facts) ──┐
                             ├─► valuation.ts ─► value, rent, rehab, ARV (+confidence)
MarketStats ($/sqft, YoY) ───┘
                                      │
                                      ▼
                              scoring.ts
                              ├─ 4 weighted criteria → deal score + grade
                              ├─ deal analysis → max offer, 5yr return, flip math
                              └─ risk flags
                                      │
                                      ▼
                                  UI (cards, detail)
```

| File | Responsibility |
| --- | --- |
| `app/lib/types.ts` | Domain types. `Listing` holds only observable facts. |
| `app/lib/markets.ts` | Per-metro stats (median $/sqft, YoY, rent $/sqft, tax/insurance). |
| `app/lib/valuation.ts` | The AVM — value/rent/rehab/ARV with a confidence range. |
| `app/lib/scoring.ts` | Criteria scoring, deal analysis, risk flags. |
| `app/lib/data.ts` | Mock listings + `getListings()` seam. |

### Scoring criteria (weights)

- **Below market (30%)** — list price vs. our independent value, shrunk toward
  neutral when comp confidence is low (so a thin-comp guess can't fake a deal).
- **Cash flow (30%)** — cap rate + monthly cash flow on a real mortgage/NOI model.
- **Seller motivation (20%)** — days-on-market vs. local median, price cuts, distress.
- **Appreciation (20%)** — market YoY trend, adjusted for property age.

## Going live: replacing mock data

Everything runs on mock data today. To scan real listings, replace the body of
`getListings()` in `app/lib/data.ts` to return `Listing[]` from a real source —
nothing else changes. The valuation engine only needs market-level `$/sqft`,
which is available **free**:

| Need | Free / cheap source |
| --- | --- |
| Market $/sqft, YoY, days-on-market (feeds `markets.ts`) | [Redfin Data Center](https://www.redfin.com/news/data-center/) — free bulk downloads by metro/ZIP |
| Per-listing facts (price, beds, sqft, condition) | A managed scraper ([Apify](https://apify.com), BrightData) ~$20–50/mo, or a licensed feed |
| Rent estimates / per-home AVM (optional, to validate ours) | [RentCast](https://www.rentcast.io/api) free tier (~50 req/mo) |
| Demographics / trend context | US Census & [FRED](https://fred.stlouisfed.org) APIs — free |

Put API keys in `.env.local` (e.g. `RENTCAST_API_KEY=…`) and read them inside
the adapter — they stay server-side since `getListings()` runs in a Server
Component.

> Note: Zillow/Redfin have no open public API and their ToS prohibits direct
> scraping. Use their *published* market data (free) plus a licensed listing
> feed or a managed scraper for the listing-level records.

## Disclaimer

Scores are estimates from a heuristic model — not investment advice.

// Market-level statistics by metro.
//
// These are the kind of figures published free at the market level (e.g. Redfin
// Data Center: median $/sqft, YoY change, days-on-market) plus typical
// tax/insurance rates. The valuation engine turns them into per-property value
// and rent opinions. Numbers here are representative, hand-set for the demo.

import type { MarketStats } from "./types";

export const MARKETS: Record<string, MarketStats> = {
  "cleveland-oh": {
    id: "cleveland-oh",
    metro: "Cleveland",
    state: "OH",
    medianPpsf: 118,
    ppsfYoY: 0.062,
    ppsfDispersion: 0.16,
    compSampleSize: 42,
    rentPpsfMonthly: 1.18,
    medianDaysOnMarket: 28,
    propertyTaxRate: 0.019,
    insuranceRate: 0.006,
  },
  "indianapolis-in": {
    id: "indianapolis-in",
    metro: "Indianapolis",
    state: "IN",
    medianPpsf: 138,
    ppsfYoY: 0.071,
    ppsfDispersion: 0.12,
    compSampleSize: 65,
    rentPpsfMonthly: 1.05,
    medianDaysOnMarket: 25,
    propertyTaxRate: 0.011,
    insuranceRate: 0.006,
  },
  "memphis-tn": {
    id: "memphis-tn",
    metro: "Memphis",
    state: "TN",
    medianPpsf: 109,
    ppsfYoY: 0.041,
    ppsfDispersion: 0.21,
    compSampleSize: 18,
    rentPpsfMonthly: 1.04,
    medianDaysOnMarket: 31,
    propertyTaxRate: 0.012,
    insuranceRate: 0.008,
  },
  "tampa-fl": {
    id: "tampa-fl",
    metro: "Tampa",
    state: "FL",
    medianPpsf: 286,
    ppsfYoY: 0.018,
    ppsfDispersion: 0.14,
    compSampleSize: 58,
    rentPpsfMonthly: 1.55,
    medianDaysOnMarket: 33,
    propertyTaxRate: 0.011,
    insuranceRate: 0.019,
  },
  "austin-tx": {
    id: "austin-tx",
    metro: "Austin",
    state: "TX",
    medianPpsf: 312,
    ppsfYoY: -0.014,
    ppsfDispersion: 0.13,
    compSampleSize: 71,
    rentPpsfMonthly: 1.62,
    medianDaysOnMarket: 44,
    propertyTaxRate: 0.018,
    insuranceRate: 0.007,
  },
};

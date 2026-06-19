// The opportunity scanner.
//
// Given a normalized `Listing`, we score it on four independent axes and
// combine them into a single 0–100 "deal score" plus a letter grade. Every
// sub-score is 0–100 and self-documenting via a `reason` string so the UI can
// explain *why* a property scored the way it did.
//
// The financial assumptions live in `ASSUMPTIONS` so they're easy to tune
// (and, later, expose to the user as adjustable inputs).

import type { Listing } from "./types";

export const ASSUMPTIONS = {
  downPaymentRate: 0.2, // 20% down
  mortgageRate: 0.07, // 7% APR
  loanTermYears: 30,
  /** Annual maintenance/repairs as a fraction of property value. */
  maintenanceRate: 0.01,
  /** Vacancy allowance as a fraction of gross rent. */
  vacancyRate: 0.05,
  /** Property management as a fraction of gross rent. */
  managementRate: 0.08,
} as const;

/** Weights for combining the four sub-scores into the overall deal score. */
export const WEIGHTS = {
  belowMarket: 0.3,
  cashFlow: 0.3,
  motivation: 0.2,
  appreciation: 0.2,
} as const;

export type CriterionKey =
  | "belowMarket"
  | "cashFlow"
  | "motivation"
  | "appreciation";

export interface CriterionScore {
  key: CriterionKey;
  label: string;
  /** 0–100. */
  score: number;
  weight: number;
  /** Human-readable explanation of the score. */
  reason: string;
}

export interface Financials {
  /** Monthly principal + interest. */
  mortgagePayment: number;
  /** Net operating income per year (before debt service). */
  noiAnnual: number;
  /** NOI / price. */
  capRate: number;
  /** Estimated monthly cash flow after all expenses incl. mortgage. */
  monthlyCashFlow: number;
  /** Annual pre-tax cash-on-cash return on the cash invested. */
  cashOnCash: number;
  /** Total upfront cash (down payment + ~3% closing). */
  cashInvested: number;
  /** Gross rent / price (annualized). */
  grossYield: number;
}

export interface ScoredListing {
  listing: Listing;
  financials: Financials;
  criteria: Record<CriterionKey, CriterionScore>;
  /** 0–100 weighted overall deal score. */
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/** Map a value within [lo, hi] linearly onto [0, 100], clamped. */
function scale(value: number, lo: number, hi: number): number {
  if (hi === lo) return 0;
  return clamp(((value - lo) / (hi - lo)) * 100);
}

/** Standard amortized monthly mortgage payment. */
export function monthlyMortgage(
  principal: number,
  annualRate: number,
  years: number,
): number {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

// ---------------------------------------------------------------------------
// Financial model
// ---------------------------------------------------------------------------

export function computeFinancials(listing: Listing): Financials {
  const { listPrice, estimatedRent, hoaMonthly, propertyTaxAnnual, insuranceAnnual } =
    listing;
  const A = ASSUMPTIONS;

  const loanAmount = listPrice * (1 - A.downPaymentRate);
  const mortgagePayment = monthlyMortgage(loanAmount, A.mortgageRate, A.loanTermYears);

  const grossRentAnnual = estimatedRent * 12;

  // Operating expenses (exclude mortgage — that's debt service, not opex).
  const vacancy = grossRentAnnual * A.vacancyRate;
  const management = grossRentAnnual * A.managementRate;
  const maintenance = listing.estimatedValue * A.maintenanceRate;
  const opexAnnual =
    vacancy +
    management +
    maintenance +
    propertyTaxAnnual +
    insuranceAnnual +
    hoaMonthly * 12;

  const noiAnnual = grossRentAnnual - opexAnnual;
  const capRate = noiAnnual / listPrice;

  const monthlyCashFlow = noiAnnual / 12 - mortgagePayment;

  const cashInvested = listPrice * (A.downPaymentRate + 0.03); // down + ~3% closing
  const cashOnCash = (monthlyCashFlow * 12) / cashInvested;
  const grossYield = grossRentAnnual / listPrice;

  return {
    mortgagePayment,
    noiAnnual,
    capRate,
    monthlyCashFlow,
    cashOnCash,
    cashInvested,
    grossYield,
  };
}

// ---------------------------------------------------------------------------
// Individual criteria
// ---------------------------------------------------------------------------

function scoreBelowMarket(listing: Listing): CriterionScore {
  const discount = (listing.estimatedValue - listing.listPrice) / listing.estimatedValue;
  // 0% discount -> 50 (priced at value). +15% under -> 100. -10% over -> 0.
  const score = clamp(50 + discount * (50 / 0.15));
  const pct = (discount * 100).toFixed(1);
  const reason =
    discount > 0
      ? `Listed ${pct}% below estimated value of $${listing.estimatedValue.toLocaleString()}.`
      : `Listed ${Math.abs(Number(pct))}% above estimated value — priced rich.`;
  return { key: "belowMarket", label: "Below Market", score, weight: WEIGHTS.belowMarket, reason };
}

function scoreCashFlow(listing: Listing, fin: Financials): CriterionScore {
  // Blend cap rate and monthly cash flow. Cap rate 4%->low, 9%+->great.
  const capComponent = scale(fin.capRate, 0.03, 0.09);
  // Cash flow -$200 -> 0, +$600/mo -> 100.
  const cfComponent = scale(fin.monthlyCashFlow, -200, 600);
  const score = clamp(capComponent * 0.5 + cfComponent * 0.5);
  const cf = Math.round(fin.monthlyCashFlow);
  const reason = `${(fin.capRate * 100).toFixed(1)}% cap rate, ${
    cf >= 0 ? "+" : "−"
  }$${Math.abs(cf).toLocaleString()}/mo cash flow (20% down, 7% rate).`;
  return { key: "cashFlow", label: "Cash Flow", score, weight: WEIGHTS.cashFlow, reason };
}

function scoreMotivation(listing: Listing): CriterionScore {
  // Distress flags, price drops, and time-on-market all hint at a motivated seller.
  let score = 0;
  const reasons: string[] = [];

  // Days on market relative to the local median.
  const domRatio = listing.daysOnMarket / Math.max(1, listing.marketMedianDaysOnMarket);
  const domScore = scale(domRatio, 0.5, 3); // at/below median -> low; 3x median -> high
  score += domScore * 0.4;
  if (domRatio > 1.3) {
    reasons.push(`${listing.daysOnMarket} days on market (${domRatio.toFixed(1)}× local median)`);
  }

  // Price reductions.
  const drops = priceDrops(listing);
  const dropScore = scale(drops.totalPct, 0, 0.15); // 15%+ total cuts -> max
  score += dropScore * 0.35;
  if (drops.count > 0) {
    reasons.push(`${drops.count} price cut${drops.count > 1 ? "s" : ""} totaling ${(drops.totalPct * 100).toFixed(1)}%`);
  }

  // Distress flags.
  const flagScore = clamp(listing.distressFlags.length * 35);
  score += (flagScore / 100) * 25; // up to 25 points from flags
  if (listing.distressFlags.length > 0) {
    reasons.push(listing.distressFlags.join(", "));
  }

  score = clamp(score);
  const reason = reasons.length ? reasons.join("; ") + "." : "No strong motivation signals.";
  return { key: "motivation", label: "Seller Motivation", score, weight: WEIGHTS.motivation, reason };
}

function scoreAppreciation(listing: Listing): CriterionScore {
  // Local YoY appreciation is the primary driver, nudged by property age.
  const trendScore = scale(listing.marketAppreciationYoY, 0, 0.1); // 0%->0, 10%+->100
  // Newer builds need less capex to ride appreciation; tiny bonus for < 25 yrs old.
  const age = new Date().getFullYear() - listing.yearBuilt;
  const ageBonus = age < 25 ? 8 : age > 70 ? -8 : 0;
  const score = clamp(trendScore + ageBonus);
  const reason = `Local market ${(listing.marketAppreciationYoY * 100).toFixed(1)}% YoY; built ${listing.yearBuilt}.`;
  return { key: "appreciation", label: "Appreciation", score, weight: WEIGHTS.appreciation, reason };
}

function priceDrops(listing: Listing): { count: number; totalPct: number } {
  const h = listing.priceHistory;
  if (h.length < 2) return { count: 0, totalPct: 0 };
  let count = 0;
  for (let i = 1; i < h.length; i++) {
    if (h[i].price < h[i - 1].price) count++;
  }
  const first = h[0].price;
  const last = h[h.length - 1].price;
  const totalPct = first > 0 ? Math.max(0, (first - last) / first) : 0;
  return { count, totalPct };
}

// ---------------------------------------------------------------------------
// Top-level scan
// ---------------------------------------------------------------------------

function toGrade(score: number): ScoredListing["grade"] {
  if (score >= 80) return "A";
  if (score >= 68) return "B";
  if (score >= 55) return "C";
  if (score >= 42) return "D";
  return "F";
}

export function scoreListing(listing: Listing): ScoredListing {
  const financials = computeFinancials(listing);

  const belowMarket = scoreBelowMarket(listing);
  const cashFlow = scoreCashFlow(listing, financials);
  const motivation = scoreMotivation(listing);
  const appreciation = scoreAppreciation(listing);

  const criteria = { belowMarket, cashFlow, motivation, appreciation };

  const overallScore = Math.round(
    belowMarket.score * WEIGHTS.belowMarket +
      cashFlow.score * WEIGHTS.cashFlow +
      motivation.score * WEIGHTS.motivation +
      appreciation.score * WEIGHTS.appreciation,
  );

  return {
    listing,
    financials,
    criteria,
    overallScore,
    grade: toGrade(overallScore),
  };
}

/** Score and rank a whole set of listings, best opportunities first. */
export function scanListings(listings: Listing[]): ScoredListing[] {
  return listings.map(scoreListing).sort((a, b) => b.overallScore - a.overallScore);
}

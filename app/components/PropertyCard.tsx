import Link from "next/link";
import type { ScoredListing } from "../lib/scoring";
import { ScoreDial } from "./ScoreDial";
import { usd, pct, signedUsd, scoreColor } from "../lib/format";

export function PropertyCard({ scored }: { scored: ScoredListing }) {
  const { listing, market, valuation, financials, deal, risks, overallScore, grade, criteria } = scored;
  const cf = Math.round(financials.monthlyCashFlow);
  const highRisks = risks.filter((r) => r.level === "high").length;

  return (
    <Link
      href={`/property/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="relative h-32" style={{ backgroundColor: listing.imageColor }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {deal.discountToValue > 0.05 && (
            <span className="rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {pct(deal.discountToValue, 0)} under value
            </span>
          )}
          {listing.distressFlags.slice(0, 1).map((f) => (
            <span key={f} className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              {f.replace("-", " ")}
            </span>
          ))}
        </div>
        <span className="absolute bottom-2 right-3 text-xs font-medium text-white/90">
          {market.metro}, {market.state}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{usd(listing.listPrice)}</div>
            <div className="text-sm text-zinc-500">{listing.address}</div>
            <div className="mt-0.5 text-xs text-zinc-400">
              Our value {usd(valuation.value)} · {Math.round(valuation.confidence * 100)}% conf.
            </div>
          </div>
          <ScoreDial score={overallScore} grade={grade} size={56} />
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span>{listing.beds} bd</span>
          <span>{listing.baths} ba</span>
          <span>{listing.sqft.toLocaleString()} sqft</span>
          <span className="capitalize">{listing.condition}</span>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 text-center dark:border-zinc-800">
          <Stat label="cap rate" value={pct(financials.capRate)} good={financials.capRate >= 0.06} />
          <Stat label="cash flow" value={signedUsd(cf)} good={cf >= 0} />
          <Stat label="5yr/yr" value={pct(deal.projectedAnnualizedReturn)} good={deal.projectedAnnualizedReturn >= 0.1} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <MiniBars criteria={criteria} />
          {highRisks > 0 && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
              {highRisks} risk{highRisks > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div>
      <div className={`text-sm font-semibold ${good ? "text-emerald-600" : "text-zinc-500"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</div>
    </div>
  );
}

function MiniBars({ criteria }: { criteria: ScoredListing["criteria"] }) {
  return (
    <div className="flex flex-1 gap-1">
      {Object.values(criteria).map((c) => {
        const colors = scoreColor(c.score);
        return (
          <div key={c.key} className="flex-1" title={`${c.label}: ${Math.round(c.score)}`}>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className={`h-full ${colors.bar}`} style={{ width: `${c.score}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

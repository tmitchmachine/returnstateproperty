import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing, MOCK_LISTINGS } from "../../lib/data";
import { scoreListing } from "../../lib/scoring";
import { ScoreDial } from "../../components/ScoreDial";
import { usd, pct, signedUsd, scoreColor } from "../../lib/format";

export async function generateStaticParams() {
  return MOCK_LISTINGS.map((l) => ({ id: l.id }));
}

export default async function PropertyPage({ params }: PageProps<"/property/[id]">) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const { financials: fin, criteria, overallScore, grade } = scoreListing(listing);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm text-emerald-600 hover:underline">
        ← Back to scan
      </Link>

      {/* Hero */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="relative h-40" style={{ backgroundColor: listing.imageColor }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-3 left-4 text-white">
            <div className="text-2xl font-bold">{usd(listing.listPrice)}</div>
            <div className="text-sm text-white/85">
              {listing.address}, {listing.city}, {listing.state} {listing.zip}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 p-5">
          <ScoreDial score={overallScore} grade={grade} size={88} />
          <div className="flex flex-wrap gap-6 text-sm">
            <Spec label="Beds" value={listing.beds} />
            <Spec label="Baths" value={listing.baths} />
            <Spec label="Sqft" value={listing.sqft.toLocaleString()} />
            <Spec label="Built" value={listing.yearBuilt} />
            <Spec label="Type" value={listing.propertyType.replace("-", " ")} />
            <Spec label="Days on mkt" value={listing.daysOnMarket} />
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Why it scored {overallScore}
        </h2>
        <div className="flex flex-col gap-3">
          {Object.values(criteria).map((c) => {
            const colors = scoreColor(c.score);
            return (
              <div key={c.key} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-800 dark:text-zinc-100">{c.label}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`font-semibold ${colors.text}`}>{c.score}</span>
                    <span className="text-zinc-400">· weight {pct(c.weight, 0)}</span>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className={`h-full ${colors.bar}`} style={{ width: `${c.score}%` }} />
                </div>
                <p className="mt-2 text-sm text-zinc-500">{c.reason}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Financials */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Investment math
        </h2>
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2">
          <Money label="Estimated value" value={usd(listing.estimatedValue)} />
          <Money label="List vs. value" value={pct((listing.estimatedValue - listing.listPrice) / listing.estimatedValue)} good={listing.listPrice < listing.estimatedValue} />
          <Money label="Estimated rent / mo" value={usd(listing.estimatedRent)} />
          <Money label="Gross yield" value={pct(fin.grossYield)} />
          <Money label="Cap rate" value={pct(fin.capRate)} good={fin.capRate >= 0.06} />
          <Money label="Mortgage / mo" value={usd(fin.mortgagePayment)} />
          <Money label="Monthly cash flow" value={signedUsd(Math.round(fin.monthlyCashFlow))} good={fin.monthlyCashFlow >= 0} />
          <Money label="Cash-on-cash" value={pct(fin.cashOnCash)} good={fin.cashOnCash >= 0} />
          <Money label="Cash to close (est.)" value={usd(fin.cashInvested)} />
          <Money label="NOI / yr" value={usd(fin.noiAnnual)} />
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Assumes 20% down, 7% / 30-yr financing, 5% vacancy, 8% management, 1% annual
          maintenance, plus the listing&apos;s taxes, insurance, and HOA.
        </p>
      </section>

      {/* Price history */}
      {listing.priceHistory.length > 1 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Price history</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            {listing.priceHistory.map((h, i) => {
              const prev = listing.priceHistory[i - 1];
              const delta = prev ? h.price - prev.price : 0;
              return (
                <div key={h.date} className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm last:border-0 dark:border-zinc-800">
                  <span className="text-zinc-500">{h.date}</span>
                  <span className="font-medium">{usd(h.price)}</span>
                  <span className={delta < 0 ? "text-emerald-600" : delta > 0 ? "text-red-500" : "text-zinc-400"}>
                    {delta === 0 ? "listed" : signedUsd(delta)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function Spec({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-semibold capitalize text-zinc-900 dark:text-zinc-50">{value}</div>
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
    </div>
  );
}

function Money({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={`text-sm font-semibold ${good === undefined ? "text-zinc-800 dark:text-zinc-100" : good ? "text-emerald-600" : "text-orange-500"}`}>
        {value}
      </span>
    </div>
  );
}

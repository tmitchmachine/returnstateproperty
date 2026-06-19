import { getListings } from "./lib/data";
import { MARKETS } from "./lib/markets";
import { scanListings } from "./lib/scoring";
import { Dashboard } from "./components/Dashboard";

export default async function Home() {
  const listings = await getListings();
  const scored = scanListings(listings, MARKETS);

  const deals = scored.filter((s) => s.overallScore >= 68).length;
  const avg = Math.round(scored.reduce((a, s) => a + s.overallScore, 0) / scored.length);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          ReturnState Property — opportunity scanner
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Scanned {scored.length} listings across {Object.keys(MARKETS).length} markets
        </h1>
        <p className="mt-1 text-zinc-500">
          Each home is independently valued, then scored 0–100 on below-market price, cash
          flow, seller motivation, and appreciation. {deals} graded B or better · average
          score {avg}.
        </p>
      </header>

      <Dashboard scored={scored} />

      <footer className="mt-10 text-xs text-zinc-400">
        Scores are estimates from a heuristic model on mock data — not investment advice.
        Plug a licensed data source into <code>app/lib/data.ts</code> to scan live listings.
      </footer>
    </main>
  );
}

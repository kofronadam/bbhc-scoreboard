import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getArchive } from "@/lib/scoreboard.functions";
import { LeaderboardColumn } from "@/components/leaderboard-column";

const archiveQuery = () =>
  queryOptions({
    queryKey: ["archive"],
    queryFn: () => getArchive(),
  });

export const Route = createFileRoute("/archiv")({
  loader: ({ context }) => context.queryClient.ensureQueryData(archiveQuery()),
  head: () => ({
    meta: [
      { title: "Archiv sezón — FRAG.TABLE" },
      {
        name: "description",
        content:
          "Výsledky minulých měsíců žebříčku FRAG.TABLE. Tabulky se resetují každý měsíc, ale historie zůstává.",
      },
      { property: "og:title", content: "Archiv sezón — FRAG.TABLE" },
      {
        property: "og:description",
        content:
          "Výsledky minulých měsíců žebříčku FRAG.TABLE. Tabulky se resetují každý měsíc, ale historie zůstává.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const { data: seasons } = useSuspenseQuery(archiveQuery());

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-12">
        <div className="season-pill mb-4">Síň slávy</div>
        <h1 className="font-display text-5xl font-bold uppercase tracking-tight md:text-6xl">
          Archiv <span className="text-muted-foreground">sezón</span>
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Tabulky resetujeme každý měsíc, aby bylo pořád o co hrát — ale výsledky minulých
          sezón tu zůstávají navždy.
        </p>
      </div>

      {seasons.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <p className="text-muted-foreground">
            Zatím tu nic není — první sezóna právě běží. Historie se začne psát po prvním
            resetu.
          </p>
          <Link to="/" className="btn-brand mt-6">
            Aktuální žebříček
          </Link>
        </div>
      ) : (
        <div className="space-y-20">
          {seasons.map((season) => (
            <section key={season.season}>
              <h2 className="font-display mb-8 border-b border-border pb-4 text-3xl font-bold uppercase tracking-tight">
                {season.label}
              </h2>
              <div className="grid gap-8 lg:grid-cols-3">
                <LeaderboardColumn category="damage" entries={season.damage} limit={3} />
                <LeaderboardColumn category="spot" entries={season.spot} limit={3} />
                <LeaderboardColumn category="kills" entries={season.kills} limit={3} />
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/scoreboard.functions";
import { formatCountdown, msUntilReset } from "@/lib/season";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/config";
import { LeaderboardColumn } from "@/components/leaderboard-column";
import clipExplosion from "@/assets/clip-explosion.jpg";
import clipMuzzle from "@/assets/clip-muzzle.jpg";
import clipAerial from "@/assets/clip-aerial.jpg";
import clipBridge from "@/assets/clip-bridge.jpg";

const leaderboardQuery = () =>
  queryOptions({
    queryKey: ["leaderboard", "current"],
    queryFn: () => getLeaderboard({ data: {} }),
  });

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(leaderboardQuery()),
  head: () => ({
    meta: [
      { title: "Měsíční scoreboard" },
      {
        name: "description",
        content:
          "Komunitní scoreboard: top damage, top spot a top kills. Zaregistruj se, přidej výsledek z bitvy a pošli klip na Instagram.",
      },
      { property: "og:title", content: "Měsíční scoreboard" },
      {
        property: "og:description",
        content:
          "Komunitní scoreboard: top damage, top spot a top kills. Zaregistruj se, přidej výsledek z bitvy a pošli klip na Instagram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function ResetCountdown() {
  const [ms, setMs] = useState(() => msUntilReset());
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilReset()), 30_000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-foreground">{formatCountdown(ms)}</span>;
}

const GALLERY = [
  { src: clipExplosion, title: "Noční přestřelka", author: INSTAGRAM_HANDLE },
  { src: clipMuzzle, title: "První rána", author: INSTAGRAM_HANDLE },
  { src: clipAerial, title: "Taktický obklíčení", author: INSTAGRAM_HANDLE },
  { src: clipBridge, title: "Skok přes most", author: INSTAGRAM_HANDLE },
];

function Index() {
  const { data } = useSuspenseQuery(leaderboardQuery());
  const topDamage = data.damage[0]?.value;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      {/* Hero / Status */}
      <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <div>
          <div className="season-pill mb-4">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Sezóna aktivní — {data.label}
          </div>
          <h1 className="font-display mb-4 text-5xl font-bold uppercase tracking-tight md:text-7xl">
            Měsíční <span className="text-muted-foreground">grind</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Měsíční žebříček pro nejlepší bojovníky. Přihlas screen z bitvy a vstup do
            síně slávy. Reset za <ResetCountdown />.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="card-surface p-6">
            <div className="mb-1 text-xs font-bold uppercase tracking-tighter text-muted-foreground">
              Výsledků této sezóny
            </div>
            <div className="font-display text-3xl font-bold">{data.total}</div>
          </div>
          <div className="card-surface p-6">
            <div className="mb-1 text-xs font-bold uppercase tracking-tighter text-muted-foreground">
              Nejvyšší damage
            </div>
            <div className="font-display text-3xl font-bold text-damage">
              {topDamage ? topDamage.toLocaleString("cs-CZ") : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Žebříčky */}
      <div className="grid gap-8 lg:grid-cols-3">
        <LeaderboardColumn category="damage" entries={data.damage} />
        <LeaderboardColumn category="spot" entries={data.spot} />
        <LeaderboardColumn category="kills" entries={data.kills} />
      </div>

      {/* Battle archives */}
      <div className="mt-24 border-t border-border pt-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight">
              Battle archives
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ukázky z komunitních klipů — celé sestřihy házíme na{" "}
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-primary transition-colors hover:text-foreground"
              >
                Instagram
              </a>
            </p>
          </div>
          <Link to="/klipy" className="btn-ghost">
            Poslat klip
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {GALLERY.map((clip) => (
            <div key={clip.title} className="group space-y-3">
              <img
                src={clip.src}
                alt={clip.title}
                loading="lazy"
                width={1280}
                height={720}
                className="aspect-video w-full rounded-xl object-cover outline-1 -outline-offset-1 outline-border transition-all group-hover:outline-primary/50"
              />
              <div className="flex items-start justify-between px-1">
                <div>
                  <h3 className="text-sm font-bold">{clip.title}</h3>
                  <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    {clip.author}
                  </a>
                </div>
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase italic text-primary">
                  IG Ready
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-24 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-8 text-center">
        <h2 className="font-display mb-4 text-4xl font-bold uppercase">
          Měl jsi crazy bitvu?
        </h2>
        <p className="mx-auto mb-8 max-w-lg text-muted-foreground">
          Nahraj screenshot a zařaď se do žebříčku, nebo pošli záznam do dalšího
          instagramového sestřihu. Pro ověření je potřeba účet.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            to="/prilozit"
            className="rounded-xl bg-foreground px-8 py-4 font-bold uppercase tracking-tight text-background transition-colors hover:bg-foreground/85"
          >
            Přidat výsledek
          </Link>
          <Link
            to="/klipy"
            className="rounded-xl border border-border px-8 py-4 font-bold uppercase tracking-tight transition-colors hover:bg-accent"
          >
            Poslat záznam
          </Link>
        </div>
      </div>
    </main>
  );
}

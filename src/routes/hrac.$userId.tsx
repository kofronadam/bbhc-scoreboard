import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  getPlayerProfile,
  type MyEntry,
  type ClipItem,
} from "@/lib/scoreboard.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const playerQuery = (userId: string) =>
  queryOptions({
    queryKey: ["player-profile", userId],
    queryFn: () => getPlayerProfile({ data: { userId } }),
  });

export const Route = createFileRoute("/hrac/$userId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(playerQuery(params.userId)),
  head: () => ({
    meta: [
      { title: "Profil hráče" },
      { name: "description", content: "Výsledky a klipy hráče na FRAG.TABLE." },
      { property: "og:title", content: "Profil hráče" },
      { property: "og:description", content: "Výsledky a klipy hráče na FRAG.TABLE." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="font-display mb-4 text-4xl font-bold uppercase tracking-tight">
        Hráč <span className="text-primary">nenalezen</span>
      </h1>
      <p className="mb-8 text-muted-foreground">{error.message}</p>
      <Link to="/" className="btn-brand">
        Zpět na žebříček
      </Link>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center text-muted-foreground">
      Hráč neexistuje.
    </main>
  ),
  component: PlayerProfilePage,
});

const ENTRY_STATUS: Record<MyEntry["status"], { label: string; cls: string }> = {
  pending: { label: "Čeká na schválení", cls: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" },
  approved: { label: "Schválené", cls: "border-spot/40 bg-spot/10 text-spot" },
  rejected: { label: "Zamítnuté", cls: "border-damage/40 bg-damage/10 text-damage" },
};

const CLIP_STATUS: Record<ClipItem["status"], { label: string; cls: string }> = {
  pending: { label: "Čeká na sestřih", cls: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" },
  processing: { label: "Stříhá se", cls: "border-kill/40 bg-kill/10 text-kill" },
  published: { label: "Na Instagramu", cls: "border-spot/40 bg-spot/10 text-spot" },
};

const CATEGORY_LABEL: Record<string, string> = {
  damage: "Top Damage",
  spot: "Top Spot",
  kills: "Top Kills",
};

type Filter = "all" | "approved" | "pending" | "rejected";

const FILTER_OPTIONS: { id: Filter; label: string }[] = [
  { id: "all", label: "Všechny" },
  { id: "approved", label: "Schválené" },
  { id: "pending", label: "Čeká na schválení" },
  { id: "rejected", label: "Zamítnuté" },
];

function StatusBadge({ label, cls }: { label: string; cls: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}

function PlayerProfilePage() {
  const { userId } = Route.useParams();
  const { data: player } = useSuspenseQuery(playerQuery(userId));
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = player.entries.filter((e) => filter === "all" || e.status === filter);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Profil hráče</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{player.username}</h1>
      <p className="mt-3 text-muted-foreground">
        Na FRAG.TABLE od {new Date(player.created_at).toLocaleDateString("cs-CZ")} ·{" "}
        {player.entries.length} výsledků · {player.clips.length} klipů
      </p>

      {/* Výsledky */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Výsledky</h2>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filtr stavu" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 space-y-3">
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              {filter === "all"
                ? "Tenhle hráč zatím neodeslal žádný výsledek."
                : "V tomto stavu nemá žádné výsledky."}
            </p>
          ) : (
            filtered.map((e) => {
              const st = ENTRY_STATUS[e.status];
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-4">
                    {e.proofSignedUrl ? (
                      <a href={e.proofSignedUrl} target="_blank" rel="noreferrer" className="shrink-0">
                        <img
                          src={e.proofSignedUrl}
                          alt="Screenshot z bitvy"
                          className="h-14 w-20 rounded-lg border border-border object-cover transition-transform hover:scale-105"
                        />
                      </a>
                    ) : (
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[10px] uppercase text-muted-foreground">
                        Bez screenu
                      </div>
                    )}
                    <div>
                      <div className="font-display text-lg font-bold">
                        {CATEGORY_LABEL[e.category] ?? e.category} — {e.value.toLocaleString("cs-CZ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.vehicle ? `${e.vehicle} · ` : ""}
                        {new Date(e.created_at).toLocaleDateString("cs-CZ")}
                      </div>
                    </div>
                  </div>
                  <StatusBadge label={st.label} cls={st.cls} />
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Klipy */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">Klipy</h2>
        <div className="mt-6 space-y-3">
          {player.clips.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Tenhle hráč zatím neposlal žádný klip.
            </p>
          ) : (
            player.clips.map((c) => {
              const st = CLIP_STATUS[c.status];
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <div>
                    <div className="font-display text-lg font-bold">{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("cs-CZ")} ·{" "}
                      <a
                        href={c.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        odkaz na záznam
                      </a>
                    </div>
                  </div>
                  <StatusBadge label={st.label} cls={st.cls} />
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}

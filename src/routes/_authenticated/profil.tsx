import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyClips, getMyEntries, type MyEntry, type ClipItem } from "@/lib/scoreboard.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Můj profil" },
      { name: "description", content: "Přehled tvých odeslaných výsledků a klipů na FRAG.TABLE." },
      { property: "og:title", content: "Můj profil" },
      { property: "og:description", content: "Přehled tvých odeslaných výsledků a klipů na FRAG.TABLE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
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
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: username } = useQuery({
    queryKey: ["profile-username", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      return data?.username ?? null;
    },
  });

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ["my-entries"],
    queryFn: () => getMyEntries(),
  });

  const { data: clips, isLoading: clipsLoading } = useQuery({
    queryKey: ["my-clips"],
    queryFn: () => getMyClips(),
  });

  const filtered = (entries ?? []).filter((e) => filter === "all" || e.status === filter);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Můj profil</p>
      <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{username ?? user.email}</h1>
      <p className="mt-3 text-muted-foreground">
        Přehled všech tvých odeslaných výsledků a klipů a jejich stavu.
      </p>

      {/* Výsledky */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Moje výsledky</h2>
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
          {entriesLoading ? (
            <p className="text-sm text-muted-foreground">Načítám…</p>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              {filter === "all"
                ? "Zatím jsi neodeslal žádný výsledek."
                : "V tomto stavu nemáš žádné výsledky."}
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
        <h2 className="font-display text-2xl font-bold">Moje klipy</h2>
        <div className="mt-6 space-y-3">
          {clipsLoading ? (
            <p className="text-sm text-muted-foreground">Načítám…</p>
          ) : (clips ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Zatím jsi neposlal žádný klip.
            </p>
          ) : (
            (clips ?? []).map((c) => {
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

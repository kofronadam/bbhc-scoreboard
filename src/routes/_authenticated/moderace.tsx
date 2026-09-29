import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteEntry,
  getApprovedEntries,
  getClipQueue,
  getModerationQueue,
  getMyRoles,
  reviewEntry,
  setClipStatus,
  deleteClip,
  type ClipItem,
  type ModerationItem,
} from "@/lib/scoreboard.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/moderace")({
  head: () => ({
    meta: [
      { title: "Moderace" },
      { name: "description", content: "Fronta výsledků čekajících na schválení." },
      { property: "og:title", content: "Moderace" },
      { property: "og:description", content: "Fronta výsledků čekajících na schválení." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModerationPage,
});

const CATEGORY_LABEL: Record<string, string> = {
  damage: "Top Damage",
  spot: "Top Spot",
  kills: "Top Kills",
};

function ModerationPage() {
  const queryClient = useQueryClient();
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["my-roles"],
    retry: false,
    queryFn: () => getMyRoles().catch(() => [] as string[]),
  });
  const isModerator = Boolean(roles?.includes("moderator") || roles?.includes("admin"));

  const { data: queue, isLoading: queueLoading } = useQuery({
    queryKey: ["moderation-queue"],
    queryFn: () => getModerationQueue(),
    enabled: isModerator,
  });

  const { data: approved, isLoading: approvedLoading } = useQuery({
    queryKey: ["approved-entries"],
    queryFn: () => getApprovedEntries(),
    enabled: isModerator,
  });

  const { data: clips, isLoading: clipsLoading } = useQuery({
    queryKey: ["clip-queue"],
    queryFn: () => getClipQueue(),
    enabled: isModerator,
  });

  if (rolesLoading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-muted-foreground">Načítám…</main>
    );
  }

  if (!isModerator) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display mb-4 text-4xl font-bold uppercase tracking-tight">
          Sem ne<span className="text-primary">patříš</span>
        </h1>
        <p className="mb-8 text-muted-foreground">
          Moderátorská fronta je jen pro správce žebříčku.
        </p>
        <Link to="/" className="btn-brand">Zpět na žebříček</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="season-pill mb-4">Moderátorská fronta</div>
      <h1 className="font-display mb-2 text-4xl font-bold uppercase tracking-tight">
        Ke schválení <span className="text-primary">({queue?.length ?? 0})</span>
      </h1>
      <p className="mb-10 text-muted-foreground">
        Zkontroluj screenshot proti zadaným hodnotám. Schválené výsledky se hned objeví v
        žebříčku, zamítnuté zmizí z fronty.
      </p>

      {queueLoading ? (
        <p className="text-muted-foreground">Načítám frontu…</p>
      ) : !queue || queue.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-12 text-center text-muted-foreground">
          Fronta je prázdná — všechno je zkontrolované. GG.
        </div>
      ) : (
        <div className="space-y-6">
          {queue.map((item) => (
            <ModerationCard
              key={item.id}
              item={item}
              onDone={() => queryClient.invalidateQueries({ queryKey: ["moderation-queue"] })}
            />
          ))}
        </div>
      )}

      <h2 className="font-display mb-2 mt-16 text-3xl font-bold uppercase tracking-tight">
        Schválené výsledky <span className="text-primary">({approved?.length ?? 0})</span>
      </h2>
      <p className="mb-8 text-muted-foreground">
        Tyhle výsledky jsou právě vidět v žebříčku. Když je potřeba nějaký odebrat, smaž ho —
        zmizí z žebříčku i ze screenshotů.
      </p>

      {approvedLoading ? (
        <p className="text-muted-foreground">Načítám schválené výsledky…</p>
      ) : !approved || approved.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-12 text-center text-muted-foreground">
          Zatím tu nic neschválené není.
        </div>
      ) : (
        <div className="space-y-4">
          {approved.map((item) => (
            <ApprovedCard
              key={item.id}
              item={item}
              onDone={() => {
                queryClient.invalidateQueries({ queryKey: ["approved-entries"] });
                queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
              }}
            />
          ))}
        </div>
      )}

      <h2 className="font-display mb-2 mt-16 text-3xl font-bold uppercase tracking-tight">
        Odeslané klipy <span className="text-primary">({clips?.length ?? 0})</span>
      </h2>
      <p className="mb-8 text-muted-foreground">
        Záznamy, které hráči poslali k sestříhání. Otevři odkaz, sestříhej video a přepni stav —
        u „Na Instagramu" se klip ukáže veřejně na stránce Klipy.
      </p>

      {clipsLoading ? (
        <p className="text-muted-foreground">Načítám klipy…</p>
      ) : !clips || clips.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-12 text-center text-muted-foreground">
          Zatím žádné odeslané klipy.
        </div>
      ) : (
        <div className="space-y-4">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onDone={() => {
                queryClient.invalidateQueries({ queryKey: ["clip-queue"] });
                queryClient.invalidateQueries({ queryKey: ["clips"] });
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

const CLIP_STATUS: { value: ClipItem["status"]; label: string }[] = [
  { value: "pending", label: "Čeká na sestřih" },
  { value: "processing", label: "Stříhá se" },
  { value: "published", label: "Na Instagramu" },
];

function ClipCard({ clip, onDone }: { clip: ClipItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function setStatus(status: ClipItem["status"]) {
    setBusy(true);
    try {
      await setClipStatus({ data: { id: clip.id, status } });
      toast.success(
        status === "published"
          ? "Klip je označený jako zveřejněný."
          : status === "processing"
            ? "Klip se stříhá."
            : "Klip je zpátky ve frontě.",
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Změna stavu se nepovedla");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Opravdu smazat klip „${clip.title}"? Zmizí i ze stránky Klipy.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteClip({ data: { id: clip.id } });
      toast.success("Klip smazán.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání se nepovedlo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card/40 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display font-bold">{clip.title}</span>
          <span className="text-xs text-muted-foreground">
            od @{clip.username ?? "Neznámý hráč"} ·{" "}
            {new Date(clip.created_at).toLocaleDateString("cs-CZ")}
          </span>
        </div>
        {clip.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{clip.description}</p>
        )}
        <a
          href={clip.video_url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block max-w-full truncate text-xs font-bold text-primary transition-colors hover:text-foreground"
        >
          {clip.video_url}
        </a>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={clip.status}
          onValueChange={(value) => setStatus(value as ClipItem["status"])}
          disabled={busy}
        >
          <SelectTrigger className="w-48 text-xs font-bold uppercase" aria-label="Stav klipu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLIP_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-md border border-destructive/50 px-3 py-2 text-xs font-bold uppercase text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Smazat
        </button>
      </div>
    </div>
  );
}

function ApprovedCard({ item, onDone }: { item: ModerationItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Opravdu smazat výsledek hráče ${item.username}? Zmizí ze žebříčku.`)) {
      return;
    }
    setBusy(true);
    try {
      await deleteEntry({ data: { id: item.id } });
      toast.success("Výsledek smazán.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smazání se nepovedlo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card/40 p-4">
      {item.proofSignedUrl ? (
        <a href={item.proofSignedUrl} target="_blank" rel="noreferrer" className="shrink-0">
          <img
            src={item.proofSignedUrl}
            alt={`Důkaz — ${item.username}`}
            className="h-16 w-24 rounded-lg border border-border object-cover"
          />
        </a>
      ) : (
        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-border text-[10px] uppercase text-muted-foreground">
          Bez screenu
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-display font-bold">{item.username}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleDateString("cs-CZ")} · sezóna {item.season}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">
            {CATEGORY_LABEL[item.category] ?? item.category}:{" "}
          </span>
          <strong className="font-display text-primary">
            {item.value.toLocaleString("cs-CZ")}
          </strong>
          {item.vehicle && <span className="text-muted-foreground"> · {item.vehicle}</span>}
        </div>
      </div>

      <button
        onClick={remove}
        disabled={busy}
        className="rounded-md border border-damage/50 px-4 py-2 text-xs font-bold uppercase text-damage transition-colors hover:bg-damage/10 disabled:opacity-50"
      >
        {busy ? "Mažu…" : "Smazat"}
      </button>
    </div>
  );
}

function ModerationCard({ item, onDone }: { item: ModerationItem; onDone: () => void }) {
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    try {
      await reviewEntry({ data: { id: item.id, decision } });
      toast.success(
        decision === "approved" ? "Výsledek schválen — je v žebříčku." : "Výsledek zamítnut.",
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Akce se nepovedla");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 rounded-2xl border border-border bg-card/40 p-6 md:grid-cols-[280px_1fr]">
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        {item.proofSignedUrl ? (
          <a href={item.proofSignedUrl} target="_blank" rel="noreferrer">
            <img
              src={item.proofSignedUrl}
              alt={`Důkaz — ${item.username}`}
              className="h-full w-full object-cover transition-transform hover:scale-105"
            />
          </a>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Bez screenshotu
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-baseline gap-3">
            <span className="font-display text-xl font-bold">{item.username}</span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {new Date(item.created_at).toLocaleString("cs-CZ")}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span className="text-muted-foreground">Kategorie: </span>
              <strong>{CATEGORY_LABEL[item.category] ?? item.category}</strong>
            </span>
            <span>
              <span className="text-muted-foreground">Hodnota: </span>
              <strong className="font-display text-lg text-primary">
                {item.value.toLocaleString("cs-CZ")}
              </strong>
            </span>
            {item.vehicle && (
              <span>
                <span className="text-muted-foreground">Stroj: </span>
                <strong>{item.vehicle}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => decide("approved")}
            disabled={busy !== null}
            className="btn-brand flex-1 py-3 uppercase disabled:opacity-50"
          >
            {busy === "approved" ? "Schvaluji…" : "Schválit"}
          </button>
          <button
            onClick={() => decide("rejected")}
            disabled={busy !== null}
            className="flex-1 rounded-md border border-damage/50 py-3 text-sm font-bold uppercase text-damage transition-colors hover:bg-damage/10 disabled:opacity-50"
          >
            {busy === "rejected" ? "Zamítám…" : "Zamítnout"}
          </button>
        </div>
      </div>
    </div>
  );
}

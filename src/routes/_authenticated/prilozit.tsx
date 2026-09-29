import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  extractStatsFromProof,
  submitEntry,
  type LeaderboardCategory,
} from "@/lib/scoreboard.functions";

export const Route = createFileRoute("/_authenticated/prilozit")({
  head: () => ({
    meta: [
      { title: "Přidat výsledek" },
      {
        name: "description",
        content: "Přihlas svůj výsledek z bitvy do měsíčního žebříčku FRAG.TABLE.",
      },
      { property: "og:title", content: "Přidat výsledek" },
      {
        property: "og:description",
        content: "Přihlas svůj výsledek z bitvy do měsíčního žebříčku FRAG.TABLE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubmitPage,
});

const CATEGORIES: { id: LeaderboardCategory; label: string; hint: string; active: string }[] = [
  { id: "damage", label: "Top Damage", hint: "celkové poškození", active: "border-damage bg-damage/10 text-damage" },
  { id: "spot", label: "Top Spot", hint: "poškození po tvém nasvícení", active: "border-spot bg-spot/10 text-spot" },
  { id: "kills", label: "Top Kills", hint: "počet zničených nepřátel", active: "border-kill bg-kill/10 text-kill" },
];

type AiState = "idle" | "uploading" | "analyzing" | "done" | "failed";

function SubmitPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [category, setCategory] = useState<LeaderboardCategory>("damage");
  const [value, setValue] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function analyze(path: string, cat: LeaderboardCategory) {
    setAiState("analyzing");
    setAiNote(null);
    try {
      const stats = await extractStatsFromProof({
        data: { proofPath: path, category: cat },
      });
      if (stats.value !== null) setValue(String(stats.value));
      if (stats.vehicle) setVehicle(stats.vehicle);
      setAiState("done");
      setAiNote(
        stats.value !== null
          ? "AI přečetlo statistiky ze screenshotu — zkontroluj je a případně uprav."
          : "AI screenshot přečetlo, ale hodnotu pro tuto kategorii nerozpoznalo — doplň ji ručně.",
      );
    } catch (err) {
      setAiState("failed");
      setAiNote(
        err instanceof Error
          ? err.message
          : "AI analýza se nepovedla — vyplň formulář ručně.",
      );
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setProofPath(null);
    setAiNote(null);
    if (!picked) {
      setAiState("idle");
      return;
    }
    if (picked.size > 10 * 1024 * 1024) {
      setAiState("failed");
      setAiNote("Screenshot je větší než 10 MB.");
      return;
    }

    setAiState("uploading");
    try {
      const ext = picked.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("proofs")
        .upload(path, picked, { contentType: picked.type });
      if (uploadError) throw new Error("Nahrání screenshotu selhalo: " + uploadError.message);
      setProofPath(path);
      await analyze(path, category);
    } catch (err) {
      setAiState("failed");
      setAiNote(
        err instanceof Error
          ? err.message
          : "AI analýza se nepovedla — vyplň formulář ručně.",
      );
    }
  }

  function handleCategoryChange(cat: LeaderboardCategory) {
    setCategory(cat);
    if (proofPath && aiState !== "uploading") {
      void analyze(proofPath, cat);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 0) {
      toast.error("Zadej platnou hodnotu (celé číslo).");
      return;
    }
    setBusy(true);
    try {
      await submitEntry({
        data: {
          category,
          value: numeric,
          vehicle: vehicle.trim() || undefined,
          proofPath: proofPath ?? undefined,
        },
      });
      toast.success("Výsledek odeslán ke schválení. Moderátor ho brzy zkontroluje.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Odeslání se nepovedlo");
    } finally {
      setBusy(false);
    }
  }

  const aiBusy = aiState === "uploading" || aiState === "analyzing";

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="season-pill mb-4">Nový záznam</div>
      <h1 className="font-display mb-2 text-4xl font-bold uppercase tracking-tight">
        Přidat výsledek
      </h1>
      <p className="mb-10 text-muted-foreground">
        Nahraj screenshot z konce bitvy — AI z něj přečte statistiky a předvyplní formulář.
        Výsledek pak zkontroluje moderátor a teprve po schválení se objeví v žebříčku.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Screenshot z konce bitvy (důkaz)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="field-input file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-bold file:text-primary-foreground"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Max 10 MB, formáty JPG/PNG. Důkaz uvidí jen přihlášení hráči a moderátoři.
          </p>
          {aiState === "uploading" && (
            <p className="mt-3 text-sm text-muted-foreground">Nahrávám screenshot…</p>
          )}
          {aiState === "analyzing" && (
            <p className="mt-3 text-sm text-primary">AI čte statistiky ze screenshotu…</p>
          )}
          {aiState === "done" && aiNote && (
            <p className="mt-3 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
              {aiNote}
            </p>
          )}
          {aiState === "failed" && aiNote && (
            <p className="mt-3 rounded-lg border border-damage/40 bg-damage/10 p-3 text-sm text-damage">
              {aiNote}
            </p>
          )}
        </div>

        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Kategorie
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  category === cat.id
                    ? cat.active
                    : "border-border bg-card/40 text-muted-foreground hover:border-input"
                }`}
              >
                <div className="font-display text-sm font-bold uppercase">{cat.label}</div>
                <div className="mt-1 text-xs opacity-70">{cat.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Hodnota
            </label>
            <input
              className="field-input"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={category === "kills" ? "např. 11" : "např. 8420"}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Stroj (nepovinné)
            </label>
            <input
              className="field-input"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="např. Leopard 2A7"
              maxLength={60}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || aiBusy}
          className="btn-brand w-full py-4 text-base uppercase disabled:opacity-50"
        >
          {busy ? "Odesílám…" : aiBusy ? "Čekám na AI…" : "Odeslat ke schválení"}
        </button>
      </form>
    </main>
  );
}

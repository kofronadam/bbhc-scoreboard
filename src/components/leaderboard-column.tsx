import { Link } from "@tanstack/react-router";
import type { LeaderboardCategory, LeaderboardEntry } from "@/lib/scoreboard.functions";

const META: Record<
  LeaderboardCategory,
  { title: string; tag: string; text: string; border: string; bar: string; hover: string }
> = {
  damage: {
    title: "Top Damage",
    tag: "DPM HEAVY",
    text: "text-damage",
    border: "border-damage/30",
    bar: "bg-damage",
    hover: "hover:border-damage/50",
  },
  spot: {
    title: "Top Spot",
    tag: "RECON SOULS",
    text: "text-spot",
    border: "border-spot/30",
    bar: "bg-spot",
    hover: "hover:border-spot/50",
  },
  kills: {
    title: "Top Kills",
    tag: "FRAG LORDS",
    text: "text-kill",
    border: "border-kill/30",
    bar: "bg-kill",
    hover: "hover:border-kill/50",
  },
};

export function LeaderboardColumn({
  category,
  entries,
  limit = 10,
}: {
  category: LeaderboardCategory;
  entries: LeaderboardEntry[];
  limit?: number;
}) {
  const meta = META[category];
  const rows = entries.slice(0, limit);

  return (
    <div className="space-y-6">
      <div className={`flex items-center justify-between border-b ${meta.border} pb-4`}>
        <h2 className="font-display flex items-center gap-2 text-xl font-bold uppercase tracking-wide">
          <span className={`h-6 w-2 ${meta.bar}`} />
          {meta.title}
        </h2>
        <span className={`font-mono text-xs ${meta.text}`}>{meta.tag}</span>
      </div>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">Zatím žádné výsledky.</p>
            <Link
              to="/prilozit"
              className={`mt-2 inline-block text-sm font-bold ${meta.text} underline underline-offset-4`}
            >
              Buď první →
            </Link>
          </div>
        ) : (
          rows.map((entry, i) => (
            <div
              key={entry.id}
              className={`group flex items-center justify-between rounded-xl border border-border bg-card/40 p-4 transition-colors ${meta.hover}`}
            >
              <div className="flex items-center gap-4">
                <span className="font-display text-2xl font-bold text-rank italic">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="font-bold">{entry.username}</div>
                  <div className="text-xs text-muted-foreground">
                    {entry.vehicle ?? "Neznámý stroj"}
                  </div>
                </div>
              </div>
              <div className={`font-display text-xl font-bold ${meta.text}`}>
                {entry.value.toLocaleString("cs-CZ")}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

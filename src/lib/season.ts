/** Měsíční sezóny žebříčku — počítáno v časové zóně Europe/Prague. */

export function currentSeason(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

export function seasonLabel(season: string): string {
  const [year = "1970", month = "1"] = season.split("-");
  const label = new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Milisekundy do konce aktuálního měsíce (reset žebříčku). */
export function msUntilReset(now: Date = new Date()): number {
  const pragueNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Prague" }),
  );
  const end = new Date(pragueNow.getFullYear(), pragueNow.getMonth() + 1, 1);
  return Math.max(0, end.getTime() - pragueNow.getTime());
}

export function formatCountdown(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getMyClips, getPublishedClips, submitClip } from "@/lib/scoreboard.functions";
import { useSession } from "@/hooks/use-session";
import { INSTAGRAM_URL } from "@/lib/config";

const publishedClipsQuery = () =>
  queryOptions({
    queryKey: ["clips", "published"],
    queryFn: () => getPublishedClips(),
  });

export const Route = createFileRoute("/klipy")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publishedClipsQuery()),
  head: () => ({
    meta: [
      { title: "Klipy — FRAG.TABLE" },
      {
        name: "description",
        content:
          "Pošli záznam ze své crazy bitvy — sestříháme ho do krátkého videa a hodíme na Instagram.",
      },
      { property: "og:title", content: "Klipy — FRAG.TABLE" },
      {
        property: "og:description",
        content:
          "Pošli záznam ze své crazy bitvy — sestříháme ho do krátkého videa a hodíme na Instagram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClipsPage,
});

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "Čeká na sestřih", className: "bg-accent text-muted-foreground" },
  processing: { label: "Stříhá se", className: "bg-kill/20 text-kill" },
  published: { label: "Na Instagramu", className: "bg-primary/20 text-primary" },
};

function ClipSubmitForm() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submitClip({
        data: {
          title: title.trim(),
          video_url: videoUrl.trim(),
          description: description.trim() || undefined,
        },
      });
      toast.success("Klip je odeslaný! Do 2–3 dnů se ho ujmeme.");
      setTitle("");
      setVideoUrl("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["clips"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Odeslání se nepovedlo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-surface space-y-4 p-6">
      <h3 className="font-display text-lg font-bold uppercase">Poslat záznam</h3>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Název klipu
        </label>
        <input
          className="field-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="např. 3-kill blind shot"
          required
          maxLength={80}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Odkaz na záznam
        </label>
        <input
          type="url"
          className="field-input"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://… (YouTube, Drive, Streamable…)"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Popis (nepovinné)
        </label>
        <textarea
          className="field-input min-h-20"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Co se v bitvě stalo?"
          maxLength={500}
        />
      </div>
      <button type="submit" disabled={busy} className="btn-brand w-full disabled:opacity-50">
        {busy ? "Odesílám…" : "Odeslat klip"}
      </button>
    </form>
  );
}

function ClipsPage() {
  const { data: published } = useSuspenseQuery(publishedClipsQuery());
  const { user } = useSession();
  const { data: mine } = useQuery({
    queryKey: ["clips", "mine"],
    enabled: Boolean(user),
    queryFn: () => getMyClips(),
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-12">
        <div className="season-pill mb-4">Battle archives</div>
        <h1 className="font-display text-5xl font-bold uppercase tracking-tight md:text-6xl">
          Tvůj klip <span className="text-muted-foreground">na IG</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Měl jsi crazy bitvu a chceš z ní krátké video? Pošli nám záznam a do 2–3 dnů ho
          sestříháme a hodíme na Instagram. Férově: času není nekonečně, takže se předem
          omlouváme, když řekneme, že zrovna není čas nebo je málo materiálu na video.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="space-y-12">
          {/* Jak to funguje */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { step: "01", title: "Nahraj záznam", text: "Záznam bitvy hoď na YouTube, Drive nebo Streamable." },
              { step: "02", title: "Pošli odkaz", text: "Vlož odkaz do formuláře — musíš být přihlášený." },
              { step: "03", title: "Sleduj Instagram", text: "Do 2–3 dnů sestřih vyjde na našem Instagramu.", link: true },
            ].map((item) => (
              <div key={item.step} className="card-surface p-5">
                <div className="font-display text-2xl font-bold text-primary italic">{item.step}</div>
                <div className="mt-2 text-sm font-bold">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.link ? (
                    <>
                      Do 2–3 dnů sestřih vyjde na našem{" "}
                      <a
                        href={INSTAGRAM_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-primary transition-colors hover:text-foreground"
                      >
                        Instagramu
                      </a>
                      .
                    </>
                  ) : (
                    item.text
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Zveřejněné klipy */}
          <section>
            <h2 className="font-display mb-6 text-2xl font-bold uppercase tracking-tight">
              Zveřejněné klipy
            </h2>
            {published.length === 0 ? (
              <div className="card-surface p-8 text-center text-sm text-muted-foreground">
                Zatím žádné zveřejněné klipy — pošli první záznam!
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {published.map((clip) => (
                  <a
                    key={clip.id}
                    href={clip.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="card-surface group p-5 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold group-hover:text-primary">{clip.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          od @{clip.username}
                        </p>
                      </div>
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase italic text-primary">
                        IG
                      </span>
                    </div>
                    {clip.description && (
                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                        {clip.description}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* Moje klipy */}
          {user && mine && mine.length > 0 && (
            <section>
              <h2 className="font-display mb-6 text-2xl font-bold uppercase tracking-tight">
                Moje klipy
              </h2>
              <div className="space-y-3">
                {mine.map((clip) => {
                  const status = STATUS_LABEL[clip.status] ?? STATUS_LABEL["pending"]!;
                  return (
                    <div
                      key={clip.id}
                      className="card-surface flex items-center justify-between p-4"
                    >
                      <div>
                        <div className="text-sm font-bold">{clip.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(clip.created_at).toLocaleDateString("cs-CZ")}
                        </div>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase italic ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar: formulář nebo CTA */}
        <aside>
          {user ? (
            <ClipSubmitForm />
          ) : (
            <div className="card-surface border-primary/20 bg-primary/5 p-6">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">
                Nutná registrace
              </h3>
              <p className="mt-4 text-sm text-muted-foreground">
                Pro odeslání klipu nebo výsledku do žebříčku musíš mít účet. Registrace je
                rychlá a zdarma.
              </p>
              <Link to="/auth" className="btn-brand mt-6 w-full">
                Vytvořit účet
              </Link>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

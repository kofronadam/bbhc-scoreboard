import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useSession } from "@/hooks/use-session";

type AuthSearch = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search): AuthSearch => ({
    redirect:
      typeof search["redirect"] === "string" && search["redirect"].startsWith("/")
        ? search["redirect"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Přihlášení a registrace" },
      {
        name: "description",
        content:
          "Zaregistruj se nebo přihlas do FRAG.TABLE a přidávej své výsledky do měsíčního žebříčku.",
      },
      { property: "og:title", content: "Přihlášení a registrace" },
      {
        property: "og:description",
        content:
          "Zaregistruj se nebo přihlas do FRAG.TABLE a přidávej své výsledky do měsíčního žebříčku.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const target =
    redirect === "/prilozit" ||
    redirect === "/klipy" ||
    redirect === "/archiv" ||
    redirect === "/moderace"
      ? redirect
      : "/";

  useEffect(() => {
    if (!loading && user) navigate({ to: target, replace: true });
  }, [loading, user, navigate, target]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setRegistered(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: target });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se nepovedlo");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Přihlášení přes Google se nepovedlo");
      return;
    }
    if (result.redirected) return;
    navigate({ to: target });
  }

  if (registered) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <div className="card-surface w-full p-8">
          <h1 className="font-display text-2xl font-bold uppercase">Zkontroluj e-mail</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Poslali jsme ti potvrzovací odkaz na <strong className="text-foreground">{email}</strong>.
            Klikni na něj a pak se přihlas — tvoje přezdívka{" "}
            <strong className="text-primary">{username}</strong> už na tebe čeká v žebříčku.
          </p>
          <button
            onClick={() => {
              setRegistered(false);
              setMode("login");
            }}
            className="btn-brand mt-8 w-full"
          >
            Přejít na přihlášení
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-6 py-24">
      <div className="card-surface w-full p-8">
        <h1 className="font-display text-center text-3xl font-bold uppercase tracking-tight">
          {mode === "login" ? "Zpátky v akci" : "Vstup do bitvy"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === "login"
            ? "Přihlas se a přidej svůj výsledek do žebříčku."
            : "Účet je zdarma — bez něj nejde přidávat výsledky ani klipy."}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-lg border border-border p-1">
          <button
            onClick={() => setMode("login")}
            className={`rounded-md py-2 text-sm font-bold uppercase transition-colors ${
              mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Přihlášení
          </button>
          <button
            onClick={() => setMode("register")}
            className={`rounded-md py-2 text-sm font-bold uppercase transition-colors ${
              mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Registrace
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Přezdívka
              </label>
              <input
                className="field-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Viper_Strike"
                required
                minLength={2}
                maxLength={30}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              E-mail
            </label>
            <input
              type="email"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ty@example.cz"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Heslo
            </label>
            <input
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <button type="submit" disabled={busy} className="btn-brand w-full disabled:opacity-50">
            {busy ? "Pracuji…" : mode === "login" ? "Přihlásit se" : "Zaregistrovat se"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          nebo
          <div className="h-px flex-1 bg-border" />
        </div>

        <button onClick={handleGoogle} className="btn-ghost w-full">
          Pokračovat přes Google
        </button>
      </div>
    </main>
  );
}

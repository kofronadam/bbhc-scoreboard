import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Instagram } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { getMyRoles } from "@/lib/scoreboard.functions";
import { INSTAGRAM_URL } from "@/lib/config";

function useUsername(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile-username", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId!)
        .maybeSingle();
      return data?.username ?? null;
    },
  });
}

export function SiteShell({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const { data: username } = useUsername(user?.id);
  const { data: roles } = useQuery({
    queryKey: ["my-roles"],
    enabled: !loading && Boolean(user),
    retry: false,
    queryFn: () => getMyRoles().catch(() => [] as string[]),
  });
  const isModerator = Boolean(roles?.includes("moderator") || roles?.includes("admin"));
  const isAdmin = Boolean(roles?.includes("admin"));
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="font-display text-xl font-bold tracking-tighter text-primary italic underline decoration-2 underline-offset-4"
            >
              FRAG.TABLE
            </Link>
            <div className="hidden gap-6 text-sm font-medium text-muted-foreground md:flex">
              <Link to="/" className="transition-colors hover:text-foreground">
                Žebříček
              </Link>
              <Link to="/archiv" className="transition-colors hover:text-foreground">
                Archiv
              </Link>
              <Link to="/klipy" className="transition-colors hover:text-foreground">
                Klipy
              </Link>
              {isModerator && (
                <Link to="/moderace" className="text-primary transition-colors hover:text-foreground">
                  Moderace
                </Link>
              )}
              {isAdmin && (
                <Link to="/sprava-roli" className="text-primary transition-colors hover:text-foreground">
                  Správa rolí
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {loading ? null : user ? (
              <>
                <Link to="/prilozit" className="btn-ghost hidden sm:inline-flex">
                  Přidat výsledek
                </Link>
                <span className="hidden text-sm font-bold text-foreground md:inline">
                  {username ?? user.email}
                </span>
                <button onClick={handleSignOut} className="btn-ghost">
                  Odhlásit
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Přihlásit se
                </Link>
                <Link to="/auth" className="btn-brand">
                  Registrovat
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {children}

      <footer className="mt-32 border-t border-border py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            © 2026 FRAG.TABLE — komunitní herní žebříček
          </div>
          <div className="flex gap-8">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground italic transition-colors hover:text-foreground"
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </a>
            <Link
              to="/klipy"
              className="text-xs uppercase tracking-widest text-muted-foreground italic transition-colors hover:text-foreground"
            >
              Poslat klip
            </Link>
            <Link
              to="/archiv"
              className="text-xs uppercase tracking-widest text-muted-foreground italic transition-colors hover:text-foreground"
            >
              Archiv
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

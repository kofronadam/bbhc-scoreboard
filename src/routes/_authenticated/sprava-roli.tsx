import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteUserAccount,
  getMyRoles,
  getUsersWithRoles,
  setUserBan,
  setUserRole,
  type ManagedUser,
} from "@/lib/scoreboard.functions";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/sprava-roli")({
  head: () => ({
    meta: [
      { title: "Správa rolí — FRAG.TABLE" },
      { name: "description", content: "Přiřazování rolí moderátor a admin." },
      { property: "og:title", content: "Správa rolí — FRAG.TABLE" },
      { property: "og:description", content: "Přiřazování rolí moderátor a admin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoleAdminPage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  moderator: "Moderátor",
  user: "Hráč",
};

function RoleAdminPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["my-roles"],
    retry: false,
    enabled: Boolean(user),
    queryFn: () => getMyRoles().catch(() => [] as string[]),
  });
  const isAdmin = Boolean(roles?.includes("admin"));

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: () => getUsersWithRoles(),
    enabled: isAdmin,
  });

  if (rolesLoading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16 text-muted-foreground">Načítám…</main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="font-display mb-4 text-4xl font-bold uppercase tracking-tight">
          Sem ne<span className="text-primary">patříš</span>
        </h1>
        <p className="mb-8 text-muted-foreground">
          Správa rolí je jen pro administrátory.
        </p>
        <Link to="/" className="btn-brand">Zpět na žebříček</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="season-pill mb-4">Administrace</div>
      <h1 className="font-display mb-2 text-4xl font-bold uppercase tracking-tight">
        Správa <span className="text-primary">rolí</span>
      </h1>
      <p className="mb-10 text-muted-foreground">
        Moderátor schvaluje výsledky ve frontě. Admin navíc spravuje role ostatních.
      </p>

      {usersLoading ? (
        <p className="text-muted-foreground">Načítám uživatele…</p>
      ) : !users || users.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/40 p-12 text-center text-muted-foreground">
          Zatím tu nikdo není.
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((u) => (
            <UserRoleCard
              key={u.id}
              user={u}
              isSelf={u.id === user?.id}
              onDone={() =>
                queryClient.invalidateQueries({ queryKey: ["users-with-roles"] })
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}

function UserRoleCard({
  user,
  isSelf,
  onDone,
}: {
  user: ManagedUser;
  isSelf: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function toggle(role: "moderator" | "admin") {
    const has = user.roles.includes(role);
    setBusy(role);
    try {
      await setUserRole({
        data: { userId: user.id, role, action: has ? "revoke" : "grant" },
      });
      toast.success(
        has
          ? `Role ${ROLE_LABEL[role]} odebrána.`
          : `Role ${ROLE_LABEL[role]} přiřazena.`,
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Akce se nepovedla");
    } finally {
      setBusy(null);
    }
  }

  async function toggleBan() {
    setBusy("ban");
    try {
      await setUserBan({
        data: { userId: user.id, action: user.banned ? "unban" : "ban" },
      });
      toast.success(user.banned ? "Ban zrušen." : "Uživatel zabanován.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Akce se nepovedla");
    } finally {
      setBusy(null);
    }
  }

  async function removeAccount() {
    setBusy("delete");
    try {
      await deleteUserAccount({ data: { userId: user.id } });
      toast.success("Účet byl zrušen.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Akce se nepovedla");
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  const isModerator = user.roles.includes("moderator");
  const isAdmin = user.roles.includes("admin");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/40 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-lg font-bold">
            {user.username}
            {isSelf && <span className="text-primary"> (ty)</span>}
          </span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            od {new Date(user.created_at).toLocaleDateString("cs-CZ")}
          </span>
        </div>
        <div className="mt-1 flex gap-2 text-xs uppercase tracking-widest">
          {user.roles.length === 0 ? (
            <span className="text-muted-foreground">Hráč</span>
          ) : (
            user.roles.map((r) => (
              <span key={r} className="text-primary">
                {ROLE_LABEL[r] ?? r}
              </span>
            ))
          )}
          {user.banned && (
            <span className="font-bold text-damage">Zabanován</span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => toggle("moderator")}
          disabled={busy !== null}
          className={
            isModerator
              ? "rounded-md border border-damage/50 px-4 py-2 text-xs font-bold uppercase text-damage transition-colors hover:bg-damage/10 disabled:opacity-50"
              : "btn-ghost px-4 py-2 text-xs uppercase disabled:opacity-50"
          }
        >
          {busy === "moderator"
            ? "…"
            : isModerator
              ? "Odebrat moderátora"
              : "Udělat moderátorem"}
        </button>
        <button
          onClick={() => toggle("admin")}
          disabled={busy !== null || (isSelf && isAdmin)}
          className={
            isAdmin
              ? "rounded-md border border-damage/50 px-4 py-2 text-xs font-bold uppercase text-damage transition-colors hover:bg-damage/10 disabled:opacity-50"
              : "btn-ghost px-4 py-2 text-xs uppercase disabled:opacity-50"
          }
        >
          {busy === "admin" ? "…" : isAdmin ? "Odebrat admina" : "Udělat adminem"}
        </button>
        {!isSelf && !isAdmin && (
          <>
            <button
              onClick={toggleBan}
              disabled={busy !== null}
              className={
                user.banned
                  ? "btn-ghost px-4 py-2 text-xs uppercase disabled:opacity-50"
                  : "rounded-md border border-damage/50 px-4 py-2 text-xs font-bold uppercase text-damage transition-colors hover:bg-damage/10 disabled:opacity-50"
              }
            >
              {busy === "ban" ? "…" : user.banned ? "Odbanovat" : "Zabanovat"}
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-2">
                <button
                  onClick={removeAccount}
                  disabled={busy !== null}
                  className="rounded-md bg-damage px-4 py-2 text-xs font-bold uppercase text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "delete" ? "…" : "Potvrdit zrušení"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy !== null}
                  className="btn-ghost px-3 py-2 text-xs uppercase disabled:opacity-50"
                >
                  Zpět
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={busy !== null}
                className="rounded-md border border-damage/50 px-4 py-2 text-xs font-bold uppercase text-damage transition-colors hover:bg-damage/10 disabled:opacity-50"
              >
                Zrušit účet
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

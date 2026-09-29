import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currentSeason, seasonLabel } from "@/lib/season";

export type LeaderboardEntry = {
  id: string;
  username: string;
  value: number;
  vehicle: string | null;
  hasProof: boolean;
};

export type LeaderboardCategory = "damage" | "spot" | "kills";

export type LeaderboardData = {
  season: string;
  label: string;
  total: number;
  damage: LeaderboardEntry[];
  spot: LeaderboardEntry[];
  kills: LeaderboardEntry[];
};

export type ArchiveSeason = {
  season: string;
  label: string;
  damage: LeaderboardEntry[];
  spot: LeaderboardEntry[];
  kills: LeaderboardEntry[];
};

export type ClipItem = {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  status: "pending" | "processing" | "published";
  created_at: string;
  username?: string;
};

/** Veřejný read-only klient (publishable klíč, bez session). */
function createPublicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

type EntryRow = {
  id: string;
  user_id: string;
  category: string;
  value: number;
  vehicle: string | null;
  proof_url: string | null;
  season?: string;
};

/** Přezdívky načítá jen server (profily jsou RLS zamčené na vlastníka). */
async function loadUsernames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, username")
    .in("id", userIds);
  return new Map((data ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));
}

function mapRow(
  r: EntryRow,
  names: Map<string, string>,
): LeaderboardEntry {
  return {
    id: r.id,
    username: names.get(r.user_id) ?? "Neznámý hráč",
    value: r.value,
    vehicle: r.vehicle,
    hasProof: Boolean(r.proof_url),
  };
}

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ season: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<LeaderboardData> => {
    const season = data.season ?? currentSeason();
    const sb = createPublicClient();
    const { data: rows, error } = await sb
      .from("entries")
      .select("id, user_id, category, value, vehicle, proof_url")
      .eq("season", season)
      .eq("status", "approved")
      .order("value", { ascending: false });
    if (error) throw new Error(error.message);

    const entries = (rows ?? []) as EntryRow[];
    const names = await loadUsernames(Array.from(new Set(entries.map((r) => r.user_id))));
    const byCat = (cat: LeaderboardCategory) =>
      entries.filter((r) => r.category === cat).slice(0, 10).map((r) => mapRow(r, names));

    return {
      season,
      label: seasonLabel(season),
      total: entries.length,
      damage: byCat("damage"),
      spot: byCat("spot"),
      kills: byCat("kills"),
    };
  });

export const getArchive = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArchiveSeason[]> => {
    const sb = createPublicClient();
    const { data: rows, error } = await sb
      .from("entries")
      .select("id, user_id, category, value, vehicle, proof_url, season")
      .eq("status", "approved")
      .order("value", { ascending: false });
    if (error) throw new Error(error.message);

    const entries = (rows ?? []) as EntryRow[];
    const names = await loadUsernames(Array.from(new Set(entries.map((r) => r.user_id))));

    const current = currentSeason();
    const seasons = Array.from(
      new Set(entries.map((r) => r.season!).filter((s) => s && s !== current)),
    ).sort((a, b) => (a < b ? 1 : -1));

    return seasons.map((season) => {
      const inSeason = entries.filter((r) => r.season === season);
      const byCat = (cat: LeaderboardCategory) =>
        inSeason
          .filter((r) => r.category === cat)
          .slice(0, 3)
          .map((r) => mapRow(r, names));
      return {
        season,
        label: seasonLabel(season),
        damage: byCat("damage"),
        spot: byCat("spot"),
        kills: byCat("kills"),
      };
    });
  },
);

export const getPublishedClips = createServerFn({ method: "GET" }).handler(
  async (): Promise<ClipItem[]> => {
    const sb = createPublicClient();
    const { data: rows, error } = await sb
      .from("clips")
      .select("id, title, description, video_url, status, created_at, user_id")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const clips = (rows ?? []) as (ClipItem & { user_id: string })[];
    const names = await loadUsernames(Array.from(new Set(clips.map((c) => c.user_id))));
    return clips.map(({ user_id, ...clip }) => ({
      ...clip,
      username: names.get(user_id) ?? "Neznámý hráč",
    }));
  },
);

const entrySchema = z.object({
  category: z.enum(["damage", "spot", "kills"]),
  value: z.number().int().min(0).max(1000000),
  vehicle: z.string().trim().max(60).optional(),
  proofPath: z.string().trim().max(300).optional(),
});

export const submitEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => entrySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("entries").insert({
      user_id: context.userId,
      category: data.category,
      value: data.value,
      vehicle: data.vehicle || null,
      proof_url: data.proofPath || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const clipSchema = z.object({
  title: z.string().trim().min(2, "Název musí mít aspoň 2 znaky").max(80),
  description: z.string().trim().max(500).optional(),
  video_url: z.string().trim().url("Zadej platný odkaz na záznam").max(500),
});

export const submitClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clipSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clips").insert({
      user_id: context.userId,
      title: data.title,
      description: data.description || null,
      video_url: data.video_url,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyClips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClipItem[]> => {
    const { data, error } = await context.supabase
      .from("clips")
      .select("id, title, description, video_url, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ClipItem[];
  });

// ---------- Klipová fronta (moderátoři/admini) ----------

export const getClipQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClipItem[]> => {
    await assertModerator(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("clips")
      .select("id, title, description, video_url, status, created_at, user_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const clips = (rows ?? []) as (ClipItem & { user_id: string })[];
    const names = await loadUsernames(Array.from(new Set(clips.map((c) => c.user_id))));
    return clips.map(({ user_id, ...clip }) => ({
      ...clip,
      username: names.get(user_id) ?? "Neznámý hráč",
    }));
  });

export const setClipStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "processing", "published"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertModerator(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("clips")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertModerator(context.supabase, context.userId);
    const { error } = await context.supabase.from("clips").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- AI rozpoznání screenshotu ----------

export const extractStatsFromProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        proofPath: z.string().trim().min(1).max(300),
        category: z.enum(["damage", "spot", "kills"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!data.proofPath.startsWith(`${context.userId}/`)) {
      throw new Error("Cizí screenshot nemůžeš analyzovat.");
    }
    const { data: blob, error } = await context.supabase.storage
      .from("proofs")
      .download(data.proofPath);
    if (error || !blob) throw new Error("Screenshot se nepodařilo načíst.");

    const buffer = Buffer.from(await blob.arrayBuffer());
    const mime = blob.type || "image/png";
    const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

    const { extractStatsFromImage } = await import("@/lib/ai.server");
    return extractStatsFromImage(dataUrl, data.category);
  });

// ---------- Moderace ----------

async function assertModerator(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: isMod } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "moderator",
  });
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isMod && !isAdmin) throw new Error("Forbidden");
}

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: { role: string }) => r.role);
  });

export type ModerationItem = {
  id: string;
  username: string;
  category: string;
  value: number;
  vehicle: string | null;
  proof_url: string | null;
  proofSignedUrl: string | null;
  season: string;
  created_at: string;
};

export const getModerationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ModerationItem[]> => {
    await assertModerator(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("entries")
      .select("id, user_id, category, value, vehicle, proof_url, season, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const entries = (rows ?? []) as (EntryRow & { season: string; created_at: string })[];
    const names = await loadUsernames(Array.from(new Set(entries.map((r) => r.user_id))));

    return Promise.all(
      entries.map(async (r) => {
        let proofSignedUrl: string | null = null;
        if (r.proof_url) {
          const { data: signed } = await context.supabase.storage
            .from("proofs")
            .createSignedUrl(r.proof_url, 3600);
          proofSignedUrl = signed?.signedUrl ?? null;
        }
        return {
          id: r.id,
          username: names.get(r.user_id) ?? "Neznámý hráč",
          category: r.category,
          value: r.value,
          vehicle: r.vehicle,
          proof_url: r.proof_url,
          proofSignedUrl,
          season: r.season,
          created_at: r.created_at,
        };
      }),
    );
  });

export const reviewEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertModerator(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("entries")
      .update({
        status: data.decision,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getApprovedEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ModerationItem[]> => {
    await assertModerator(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("entries")
      .select("id, user_id, category, value, vehicle, proof_url, season, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const entries = (rows ?? []) as (EntryRow & { season: string; created_at: string })[];
    const names = await loadUsernames(Array.from(new Set(entries.map((r) => r.user_id))));

    return Promise.all(
      entries.map(async (r) => {
        let proofSignedUrl: string | null = null;
        if (r.proof_url) {
          const { data: signed } = await context.supabase.storage
            .from("proofs")
            .createSignedUrl(r.proof_url, 3600);
          proofSignedUrl = signed?.signedUrl ?? null;
        }
        return {
          id: r.id,
          username: names.get(r.user_id) ?? "Neznámý hráč",
          category: r.category,
          value: r.value,
          vehicle: r.vehicle,
          proof_url: r.proof_url,
          proofSignedUrl,
          season: r.season,
          created_at: r.created_at,
        };
      }),
    );
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertModerator(context.supabase, context.userId);
    const { data: entry, error: readErr } = await context.supabase
      .from("entries")
      .select("id, proof_url")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!entry) throw new Error("Výsledek neexistuje.");

    const { error } = await context.supabase.from("entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    // Uklidit i screenshot z úložiště (service role, bucket je soukromý)
    if (entry.proof_url) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("proofs").remove([entry.proof_url]);
    }
    return { ok: true };
  });

// ---------- Správa rolí (admin) ----------

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export type ManagedUser = {
  id: string;
  username: string;
  created_at: string;
  roles: string[];
  banned: boolean;
};

export const getUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, username, created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);
    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    // Stavy banů z Auth Admin API (banned_until v budoucnosti = zabanovaný)
    const bannedIds = new Set<string>();
    let page = 1;
    for (;;) {
      const { data: authPage, error: aErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (aErr) throw new Error(aErr.message);
      for (const u of authPage.users) {
        const until = (u as { banned_until?: string }).banned_until;
        if (until && new Date(until).getTime() > Date.now()) bannedIds.add(u.id);
      }
      if (authPage.users.length < 200) break;
      page += 1;
    }

    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r.role);
      byUser.set(r.user_id, list);
    }
    return (profiles ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      created_at: p.created_at,
      roles: byUser.get(p.id) ?? [],
      banned: bannedIds.has(p.id),
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["moderator", "admin"]),
        action: z.enum(["grant", "revoke"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.action === "revoke" && data.userId === context.userId && data.role === "admin") {
      throw new Error("Sám sobě roli admin odebrat nemůžeš.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.action === "grant") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- Ban / zrušení účtu (admin) ----------

async function assertNotSelfOrAdmin(
  supabase: SupabaseClient<Database>,
  callerId: string,
  targetId: string,
) {
  if (targetId === callerId) {
    throw new Error("Sám sobě tohle udělat nemůžeš.");
  }
  const { data: targetIsAdmin } = await supabase.rpc("has_role", {
    _user_id: targetId,
    _role: "admin",
  });
  if (targetIsAdmin) {
    throw new Error("Jinému adminovi tohle udělat nemůžeš.");
  }
}

export const setUserBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["ban", "unban"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertNotSelfOrAdmin(context.supabase, context.userId, data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      // ~100 let = trvalý ban; "none" ban zruší
      ban_duration: data.action === "ban" ? "876000h" : "none",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertNotSelfOrAdmin(context.supabase, context.userId, data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Úklid dat uživatele (screenshoty, výsledky, klipy, role, profil)
    try {
      const { data: files } = await supabaseAdmin.storage
        .from("proofs")
        .list(data.userId);
      if (files && files.length > 0) {
        await supabaseAdmin.storage
          .from("proofs")
          .remove(files.map((f) => `${data.userId}/${f.name}`));
      }
    } catch {
      // storage úklid je best-effort, neblokuje smazání účtu
    }
    await supabaseAdmin.from("entries").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("clips").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

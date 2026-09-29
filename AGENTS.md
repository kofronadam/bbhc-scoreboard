<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

## Architecture decisions

- **Stack**: TanStack Start v1 + Lovable Cloud (Supabase). Server logic in `createServerFn` (`src/lib/scoreboard.functions.ts`); no Edge Functions.
- **Seasons are derived, not scheduled**: `entries.season` is a `YYYY-MM` text (Europe/Prague) with a DB default; monthly "reset" happens automatically when the month rolls over. Archive = distinct past seasons from `entries`. No cron.
- **Leaderboard reads are public**: anon SELECT policies on `entries`/`profiles`; public server fns use a publishable-key client with the `apikey` fetch shim (opaque `sb_` keys).
- **Proof screenshots**: private storage bucket `proofs`, path pattern `<user_id>/<uuid>.<ext>`; storage RLS scopes writes to the owner's folder, reads to authenticated users only (bucket cannot be public — platform blocks public buckets).
- **Auth**: email/password (email confirmation ON — signup shows a "check your email" state) + managed Google OAuth via `@/integrations/lovable`. Profile auto-created by `handle_new_user` trigger from `raw_user_meta_data->>'username'`.
- **Protected routes** live under `src/routes/_authenticated/` (managed gate, `ssr: false`). Bearer token attached via `attachSupabaseAuth` in `src/start.ts`.
- **Design system**: "Neon Kinetic" — dark-only theme, tokens in `src/styles.css` (oklch). Category colors: `--damage` (rose), `--spot` (emerald), `--kill` (blue), brand `--primary` (violet). Fonts: Space Grotesk (display) + Inter (body), loaded via `<link>` in `__root.tsx`. UI language: Czech.

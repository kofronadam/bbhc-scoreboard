DROP FUNCTION IF EXISTS public.get_public_usernames(uuid[]);

CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT p.id, p.username FROM public.profiles p;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT SELECT ON public.public_profiles TO service_role;
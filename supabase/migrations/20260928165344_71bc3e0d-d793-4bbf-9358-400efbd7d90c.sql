-- 1) Profily: vlastník čte jen svůj profil; přezdívky pro žebříček přes security definer funkci
DROP POLICY "Profiles are publicly readable" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.get_public_usernames(_ids uuid[])
RETURNS TABLE(id uuid, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username FROM public.profiles p WHERE p.id = ANY(_ids)
$$;

GRANT EXECUTE ON FUNCTION public.get_public_usernames(uuid[]) TO anon, authenticated;

-- 2) Úložiště proofs: čtení jen vlastník nebo moderátor/admin
DROP POLICY "Authenticated users read proofs" ON storage.objects;
DROP POLICY "Signed-in users can view proofs" ON storage.objects;
CREATE POLICY "Owners and moderators read proofs" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'proofs'::text
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

ALTER TABLE public.entries
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at TIMESTAMPTZ;

DROP POLICY "Entries are publicly readable" ON public.entries;
CREATE POLICY "Approved entries are publicly readable" ON public.entries FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY "Users read own entries" ON public.entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Moderators read all entries" ON public.entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY "Users insert own entries" ON public.entries;
CREATE POLICY "Users insert own pending entries" ON public.entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY "Users update own entries" ON public.entries;
CREATE POLICY "Users update own pending entries" ON public.entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Moderators review entries" ON public.entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_entries_status ON public.entries (status, created_at DESC);
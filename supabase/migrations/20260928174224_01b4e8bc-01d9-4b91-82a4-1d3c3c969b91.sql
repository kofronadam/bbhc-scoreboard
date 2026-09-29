CREATE POLICY "Moderators delete clips"
ON public.clips
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));
INSERT INTO public.user_roles (user_id, role)
VALUES ('d75ae3ec-ba07-4ac0-b73c-59f3164b9205', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
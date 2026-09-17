-- TEST ONLY: fixed non-human identities for Migration Lab validation.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'migration-lab-admin@example.test', 'test-only-no-login', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'migration-lab-archivist@example.test', 'test-only-no-login', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'migration-lab-user@example.test', 'test-only-no-login', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'migration-lab-blocked@example.test', 'test-only-no-login', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

update public.app_profiles
set role = case user_id
  when '00000000-0000-0000-0000-000000000101'::uuid then 'admin'::public.app_role
  when '00000000-0000-0000-0000-000000000102'::uuid then 'archivist'::public.app_role
  else 'user'::public.app_role
end,
access_status = case user_id
  when '00000000-0000-0000-0000-000000000104'::uuid then 'blocked'::public.access_status
  else 'approved'::public.access_status
end
where user_id in (
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000102'::uuid,
  '00000000-0000-0000-0000-000000000103'::uuid,
  '00000000-0000-0000-0000-000000000104'::uuid
);

select user_id, role, access_status
from public.app_profiles
where email like 'migration-lab-%@example.test'
order by user_id
limit 10;

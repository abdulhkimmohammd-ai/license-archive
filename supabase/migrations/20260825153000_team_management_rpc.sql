-- License Archive – Supabase Development only.
-- Team management RPCs; no Production, DNS, Cloudflare, Storage, or data copy.

create or replace function public.list_team_members()
returns table (user_id uuid, display_name text, email text, role public.app_role, access_status public.access_status, created_at timestamptz)
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
begin
  perform private.assert_approved_role(array['admin']::public.app_role[]);
  return query
    select p.user_id, p.display_name, p.email, p.role, p.access_status, p.created_at
    from public.app_profiles p
    order by p.created_at asc, p.user_id asc;
end;
$$;

create or replace function public.set_team_role(p_user_id uuid, p_role public.app_role)
returns public.app_profiles
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
  v_profile public.app_profiles;
  v_previous public.app_role;
begin
  if p_user_id is null or p_role is null then
    raise exception 'User and role are required' using errcode = '22023';
  end if;
  select * into v_profile from public.app_profiles where user_id = p_user_id for update;
  if not found then raise exception 'User profile not found' using errcode = 'P0002'; end if;
  v_previous := v_profile.role;
  if p_user_id = v_actor and p_role <> 'admin' and (select count(*) from public.app_profiles where role = 'admin' and access_status = 'approved') <= 1 then
    raise exception 'The last approved administrator cannot be demoted' using errcode = '23514';
  end if;
  update public.app_profiles set role = p_role, updated_at = now() where user_id = p_user_id returning * into v_profile;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'SET_TEAM_ROLE', 'app_profile', p_user_id, jsonb_build_object('previous_role', v_previous, 'role', p_role));
  return v_profile;
end;
$$;

create or replace function public.set_team_access_status(p_user_id uuid, p_access_status public.access_status)
returns public.app_profiles
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
  v_profile public.app_profiles;
  v_previous public.access_status;
begin
  if p_user_id is null or p_access_status is null then
    raise exception 'User and access status are required' using errcode = '22023';
  end if;
  select * into v_profile from public.app_profiles where user_id = p_user_id for update;
  if not found then raise exception 'User profile not found' using errcode = 'P0002'; end if;
  v_previous := v_profile.access_status;
  if p_user_id = v_actor and p_access_status <> 'approved' and v_profile.role = 'admin' and (select count(*) from public.app_profiles where role = 'admin' and access_status = 'approved') <= 1 then
    raise exception 'The last approved administrator cannot be blocked' using errcode = '23514';
  end if;
  update public.app_profiles set access_status = p_access_status, updated_at = now() where user_id = p_user_id returning * into v_profile;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'SET_TEAM_ACCESS_STATUS', 'app_profile', p_user_id, jsonb_build_object('previous_status', v_previous, 'access_status', p_access_status));
  return v_profile;
end;
$$;

grant execute on function public.list_team_members() to authenticated;
grant execute on function public.set_team_role(uuid, public.app_role) to authenticated;
grant execute on function public.set_team_access_status(uuid, public.access_status) to authenticated;
revoke all on function public.list_team_members() from anon, public;
revoke all on function public.set_team_role(uuid, public.app_role) from anon, public;
revoke all on function public.set_team_access_status(uuid, public.access_status) from anon, public;

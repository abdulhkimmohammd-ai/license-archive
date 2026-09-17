-- License Archive – Supabase Development only.
-- Invitation tokens are never stored in plaintext and no email provider is called here.

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  invited_email text not null check (char_length(trim(invited_email)) between 5 and 320),
  invited_role public.app_role not null check (invited_role in ('user', 'archivist')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired', 'revoked')),
  invited_by uuid not null references public.app_profiles(user_id),
  accepted_by uuid null references public.app_profiles(user_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at),
  accepted_at timestamptz null,
  rejected_at timestamptz null,
  revoked_at timestamptz null
);

create unique index if not exists team_invitations_pending_email_idx
  on public.team_invitations (lower(trim(invited_email)))
  where status = 'pending';
create index if not exists team_invitations_status_created_idx
  on public.team_invitations (status, created_at desc);

alter table public.team_invitations enable row level security;
revoke all on public.team_invitations from anon, authenticated;

create or replace function public.create_team_invitation(
  p_invited_email text,
  p_invited_role public.app_role,
  p_token_hash text,
  p_expires_at timestamptz
)
returns table (invitation_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
  v_email text := lower(trim(coalesce(p_invited_email, '')));
  v_invitation public.team_invitations;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid invitation email is required' using errcode = '22023';
  end if;
  if p_invited_role not in ('user', 'archivist') then
    raise exception 'Invitations cannot grant administrator role' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation token hash is invalid' using errcode = '22023';
  end if;
  if p_expires_at is null or p_expires_at <= now() + interval '15 minutes' or p_expires_at > now() + interval '7 days' then
    raise exception 'Invitation expiry must be between 15 minutes and 7 days' using errcode = '22023';
  end if;
  if exists (select 1 from public.team_invitations where lower(trim(invited_email)) = v_email and status = 'pending' and expires_at > now()) then
    raise exception 'A pending invitation already exists for this email' using errcode = '23505';
  end if;
  update public.team_invitations set status = 'expired' where lower(trim(invited_email)) = v_email and status = 'pending' and expires_at <= now();
  insert into public.team_invitations (invited_email, invited_role, token_hash, invited_by, expires_at)
  values (v_email, p_invited_role, p_token_hash, v_actor, p_expires_at)
  returning * into v_invitation;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'CREATE_TEAM_INVITATION', 'team_invitation', v_invitation.id, jsonb_build_object('invited_email', v_email, 'role', p_invited_role, 'expires_at', p_expires_at));
  return query select v_invitation.id, v_invitation.expires_at;
end;
$$;

create or replace function public.list_team_invitations()
returns table (id uuid, invited_email text, invited_role public.app_role, status text, created_at timestamptz, expires_at timestamptz, invited_by uuid)
language plpgsql
security definer
stable
set search_path = private, public, pg_catalog
as $$
begin
  perform private.assert_approved_role(array['admin']::public.app_role[]);
  return query
    select i.id, i.invited_email, i.invited_role, case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
           i.created_at, i.expires_at, i.invited_by
    from public.team_invitations i
    order by i.created_at desc, i.id desc;
end;
$$;

create or replace function public.accept_team_invitation(p_invitation_id uuid, p_token_hash text)
returns public.app_profiles
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_invitation public.team_invitations;
  v_profile public.app_profiles;
  v_email text;
begin
  if v_actor is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invitation token is invalid' using errcode = '22023'; end if;
  select lower(coalesce(email, '')) into v_email from auth.users where id = v_actor;
  select * into v_invitation from public.team_invitations where id = p_invitation_id for update;
  if not found then raise exception 'Invitation not found' using errcode = 'P0002'; end if;
  if v_invitation.status <> 'pending' then raise exception 'Invitation is no longer pending' using errcode = '55000'; end if;
  if v_invitation.expires_at <= now() then update public.team_invitations set status = 'expired' where id = v_invitation.id; raise exception 'Invitation has expired' using errcode = '22023'; end if;
  if v_invitation.token_hash <> p_token_hash or lower(trim(v_invitation.invited_email)) <> v_email then raise exception 'Invitation does not match this account' using errcode = '42501'; end if;
  update public.team_invitations
    set status = 'accepted', accepted_by = v_actor, accepted_at = now()
    where id = v_invitation.id;
  update public.app_profiles
    set role = v_invitation.invited_role, access_status = 'approved', updated_at = now()
    where user_id = v_actor
    returning * into v_profile;
  if not found then raise exception 'User profile not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'ACCEPT_TEAM_INVITATION', 'team_invitation', v_invitation.id, jsonb_build_object('role', v_invitation.invited_role));
  return v_profile;
end;
$$;

create or replace function public.reject_team_invitation(p_invitation_id uuid, p_token_hash text)
returns void
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_invitation public.team_invitations;
  v_email text;
begin
  if v_actor is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invitation token is invalid' using errcode = '22023'; end if;
  select lower(coalesce(email, '')) into v_email from auth.users where id = v_actor;
  select * into v_invitation from public.team_invitations where id = p_invitation_id for update;
  if not found then raise exception 'Invitation not found' using errcode = 'P0002'; end if;
  if v_invitation.status <> 'pending' then raise exception 'Invitation is no longer pending' using errcode = '55000'; end if;
  if v_invitation.expires_at <= now() then update public.team_invitations set status = 'expired' where id = v_invitation.id; raise exception 'Invitation has expired' using errcode = '22023'; end if;
  if v_invitation.token_hash <> p_token_hash or lower(trim(v_invitation.invited_email)) <> v_email then raise exception 'Invitation does not match this account' using errcode = '42501'; end if;
  update public.team_invitations set status = 'rejected', rejected_at = now() where id = v_invitation.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'REJECT_TEAM_INVITATION', 'team_invitation', v_invitation.id, null);
end;
$$;

create or replace function public.revoke_team_invitation(p_invitation_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
  v_reason text := trim(coalesce(p_reason, ''));
  v_status text;
begin
  if char_length(v_reason) < 5 then raise exception 'Revocation reason must contain at least five characters' using errcode = '22023'; end if;
  update public.team_invitations set status = 'revoked', revoked_at = now() where id = p_invitation_id and status = 'pending' returning status into v_status;
  if not found then raise exception 'Pending invitation not found' using errcode = 'P0002'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'REVOKE_TEAM_INVITATION', 'team_invitation', p_invitation_id, jsonb_build_object('reason', v_reason));
end;
$$;

grant execute on function public.create_team_invitation(text, public.app_role, text, timestamptz) to authenticated;
grant execute on function public.list_team_invitations() to authenticated;
grant execute on function public.accept_team_invitation(uuid, text) to authenticated;
grant execute on function public.reject_team_invitation(uuid, text) to authenticated;
grant execute on function public.revoke_team_invitation(uuid, text) to authenticated;
revoke all on function public.create_team_invitation(text, public.app_role, text, timestamptz) from anon, public;
revoke all on function public.list_team_invitations() from anon, public;
revoke all on function public.accept_team_invitation(uuid, text) from anon, public;
revoke all on function public.reject_team_invitation(uuid, text) from anon, public;
revoke all on function public.revoke_team_invitation(uuid, text) from anon, public;

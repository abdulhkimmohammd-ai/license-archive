-- License Archive – Migration Lab (Supabase Development only)
-- No Production data, file storage, documents table, domains, or DNS configuration.

create schema if not exists private;

create type public.app_role as enum ('user', 'archivist', 'admin');
create type public.access_status as enum ('pending', 'approved', 'blocked');
create type public.facility_type as enum ('pharmacy', 'warehouse');
create type public.license_status as enum ('active', 'expired', 'suspended', 'archived');

create table public.app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  role public.app_role not null default 'user',
  access_status public.access_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  license_no text not null unique,
  facility_name text not null,
  facility_type public.facility_type not null,
  holder_name text not null,
  holder_national_id text not null,
  holder_phone text,
  governorate text not null,
  address text,
  street text,
  area text,
  district text,
  property_owner_name text,
  qualification text,
  qualification_level text check (qualification_level in ('diploma', 'bachelor')),
  graduation_country text,
  graduation_institute text,
  professional_license_no text,
  professional_license_issue_date date,
  previous_license_no text,
  previous_license_issued_by text,
  previous_license_issue_date date,
  national_id_issued_by text,
  national_id_issue_governorate text,
  national_id_issue_date date,
  birth_place text,
  birth_governorate text,
  birth_date date,
  site_inspection_form_no text,
  site_inspection_form_date date,
  committee_minutes_no text,
  committee_minutes_date date,
  fee_receipt_no text,
  fee_receipt_date date,
  archive_number text not null unique check (archive_number ~ '^[0-9]{4}-[0-9]{4}[صم]$'),
  archive_date date,
  archive_officer_name text,
  issue_date date not null,
  expiry_date date not null,
  health_office_issue_date date,
  health_office_director_name text,
  health_office_director_governorate text,
  license_delivery_date date,
  status public.license_status not null default 'active',
  notes text,
  archive_reason text,
  archived_by uuid references public.app_profiles(user_id),
  archived_at timestamptz,
  created_by uuid not null references public.app_profiles(user_id),
  updated_by uuid references public.app_profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index licenses_status_idx on public.licenses(status);
create index licenses_facility_type_idx on public.licenses(facility_type);
create index licenses_governorate_idx on public.licenses(governorate);
create index licenses_expiry_date_idx on public.licenses(expiry_date);
create index licenses_created_at_idx on public.licenses(created_at desc);

create table private.archive_sequences (
  facility_type public.facility_type primary key,
  current_value integer not null default 0 check (current_value >= 0),
  updated_at timestamptz not null default now()
);

create table public.archive_number_history (
  id uuid primary key default gen_random_uuid(),
  archive_number text not null unique check (archive_number ~ '^[0-9]{4}-[0-9]{4}[صم]$'),
  license_id uuid not null references public.licenses(id) on delete restrict,
  facility_type public.facility_type not null,
  sequence integer not null check (sequence > 0),
  assigned_by uuid not null references public.app_profiles(user_id),
  change_reason text not null check (char_length(trim(change_reason)) >= 5),
  assigned_at timestamptz not null default now()
);
create index archive_number_history_license_idx on public.archive_number_history(license_id, assigned_at desc);

create table private.idempotency_requests (
  idempotency_key uuid primary key,
  actor_id uuid not null references public.app_profiles(user_id),
  request_hash text not null,
  license_id uuid not null references public.licenses(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.license_events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete restrict,
  event_type text not null check (event_type in ('issued', 'renewed', 'archive_number_changed', 'archived')),
  note text,
  performed_by uuid not null references public.app_profiles(user_id),
  created_at timestamptz not null default now()
);
create index license_events_license_idx on public.license_events(license_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.app_profiles(user_id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_profiles_updated_at before update on public.app_profiles
for each row execute function private.set_updated_at();
create trigger licenses_updated_at before update on public.licenses
for each row execute function private.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  insert into public.app_profiles (user_id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger auth_user_profile_trigger
after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function private.assert_approved_role(p_roles public.app_role[])
returns uuid language plpgsql security definer stable set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.app_profiles
    where user_id = v_actor
      and access_status = 'approved'
      and role = any(p_roles)
  ) then
    raise exception 'Insufficient approved role' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function private.is_approved_role(p_roles public.app_role[])
returns boolean language sql security definer stable set search_path = private, public, pg_catalog as $$
  select exists (
    select 1 from public.app_profiles
    where user_id = auth.uid()
      and access_status = 'approved'
      and role = any(p_roles)
  );
$$;

create or replace function private.prevent_immutable_mutation()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  raise exception 'This append-only record cannot be changed' using errcode = '55000';
end;
$$;
create trigger archive_number_history_immutable
before update or delete on public.archive_number_history
for each row execute function private.prevent_immutable_mutation();
create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function private.prevent_immutable_mutation();

create or replace function public.create_license_idempotent(
  p_license_no text,
  p_facility_name text,
  p_facility_type public.facility_type,
  p_holder_name text,
  p_holder_national_id text,
  p_governorate text,
  p_issue_date date,
  p_expiry_date date,
  p_idempotency_key uuid,
  p_request_hash text
)
returns table (license_id uuid, archive_number text, idempotent boolean)
language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin', 'archivist']::public.app_role[]);
  v_existing private.idempotency_requests%rowtype;
  v_sequence integer;
  v_last_four text;
  v_suffix text;
  v_archive_number text;
  v_license_id uuid;
begin
  if p_idempotency_key is null or p_request_hash is null or char_length(trim(p_request_hash)) < 16 then
    raise exception 'A valid idempotency key and request hash are required' using errcode = '22023';
  end if;
  select * into v_existing from private.idempotency_requests where idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.actor_id <> v_actor or v_existing.request_hash <> p_request_hash then
      raise exception 'Idempotency key conflicts with a different request' using errcode = '23505';
    end if;
    return query select v_existing.license_id, l.archive_number, true from public.licenses l where l.id = v_existing.license_id;
    return;
  end if;
  v_last_four := substring(trim(p_license_no) from '([0-9]{4})$');
  if v_last_four is null or char_length(trim(p_facility_name)) = 0 or char_length(trim(p_holder_name)) = 0 or char_length(trim(p_holder_national_id)) = 0 or char_length(trim(p_governorate)) = 0 then
    raise exception 'License number and required fields are invalid' using errcode = '22023';
  end if;
  insert into private.archive_sequences as s (facility_type, current_value)
  values (p_facility_type, 1)
  on conflict (facility_type) do update set current_value = s.current_value + 1, updated_at = now()
  returning current_value into v_sequence;
  v_suffix := case when p_facility_type = 'pharmacy' then 'ص' else 'م' end;
  v_archive_number := v_last_four || '-' || lpad(v_sequence::text, 4, '0') || v_suffix;
  insert into public.licenses (
    license_no, facility_name, facility_type, holder_name, holder_national_id,
    governorate, issue_date, expiry_date, archive_number, archive_date, created_by
  ) values (
    trim(p_license_no), trim(p_facility_name), p_facility_type, trim(p_holder_name), trim(p_holder_national_id),
    trim(p_governorate), p_issue_date, p_expiry_date, v_archive_number, current_date, v_actor
  ) returning id into v_license_id;
  insert into public.archive_number_history (archive_number, license_id, facility_type, sequence, assigned_by, change_reason)
  values (v_archive_number, v_license_id, p_facility_type, v_sequence, v_actor, 'تخصيص تلقائي عند الإنشاء');
  insert into public.license_events (license_id, event_type, note, performed_by)
  values (v_license_id, 'issued', 'إنشاء ترخيص وتخصيص رقم أرشفة تلقائي', v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'CREATE_LICENSE', 'license', v_license_id, jsonb_build_object('archive_number', v_archive_number));
  insert into private.idempotency_requests (idempotency_key, actor_id, request_hash, license_id)
  values (p_idempotency_key, v_actor, p_request_hash, v_license_id);
  return query select v_license_id, v_archive_number, false;
end;
$$;

create or replace function public.change_archive_number(
  p_license_id uuid,
  p_new_archive_number text,
  p_reason text
)
returns table (license_id uuid, archive_number text)
language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
  v_license public.licenses%rowtype;
  v_last_four text;
  v_sequence integer;
  v_suffix text;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Archive-number change reason must contain at least five characters' using errcode = '22023';
  end if;
  select * into v_license from public.licenses where id = p_license_id for update;
  if not found then raise exception 'License not found' using errcode = 'P0002'; end if;
  v_last_four := substring(v_license.license_no from '([0-9]{4})$');
  v_suffix := case when v_license.facility_type = 'pharmacy' then 'ص' else 'م' end;
  if p_new_archive_number !~ '^[0-9]{4}-[0-9]{4}[صم]$'
     or split_part(p_new_archive_number, '-', 1) <> v_last_four
     or right(p_new_archive_number, 1) <> v_suffix then
    raise exception 'Archive number does not match this license and facility type' using errcode = '22023';
  end if;
  if p_new_archive_number = v_license.archive_number or exists (select 1 from public.archive_number_history where archive_number = p_new_archive_number) then
    raise exception 'Archive number is current or has been used previously' using errcode = '23505';
  end if;
  v_sequence := substring(p_new_archive_number from '-([0-9]{4})[صم]$')::integer;
  insert into private.archive_sequences as s (facility_type, current_value)
  values (v_license.facility_type, v_sequence)
  on conflict (facility_type) do update set current_value = greatest(s.current_value, excluded.current_value), updated_at = now();
  update public.licenses set archive_number = p_new_archive_number, updated_by = v_actor where id = p_license_id;
  insert into public.archive_number_history (archive_number, license_id, facility_type, sequence, assigned_by, change_reason)
  values (p_new_archive_number, p_license_id, v_license.facility_type, v_sequence, v_actor, trim(p_reason));
  insert into public.license_events (license_id, event_type, note, performed_by)
  values (p_license_id, 'archive_number_changed', trim(p_reason), v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'CHANGE_ARCHIVE_NUMBER', 'license', p_license_id, jsonb_build_object('before', v_license.archive_number, 'after', p_new_archive_number, 'reason', trim(p_reason)));
  return query select p_license_id, p_new_archive_number;
end;
$$;

create or replace function public.renew_license(
  p_license_id uuid,
  p_issue_date date,
  p_expiry_date date,
  p_reason text
)
returns table (license_id uuid, archive_number text)
language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
  v_archive_number text;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 or p_expiry_date <= p_issue_date then
    raise exception 'A valid renewal reason and date range are required' using errcode = '22023';
  end if;
  update public.licenses set issue_date = p_issue_date, expiry_date = p_expiry_date, status = 'active', updated_by = v_actor
  where id = p_license_id returning archive_number into v_archive_number;
  if not found then raise exception 'License not found' using errcode = 'P0002'; end if;
  insert into public.license_events (license_id, event_type, note, performed_by) values (p_license_id, 'renewed', trim(p_reason), v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (v_actor, 'RENEW_LICENSE', 'license', p_license_id, jsonb_build_object('issue_date', p_issue_date, 'expiry_date', p_expiry_date, 'reason', trim(p_reason)));
  return query select p_license_id, v_archive_number;
end;
$$;

create or replace function public.archive_license(p_license_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Archive reason must contain at least five characters' using errcode = '22023'; end if;
  update public.licenses set status = 'archived', archive_reason = trim(p_reason), archived_by = v_actor, archived_at = now(), updated_by = v_actor
  where id = p_license_id;
  if not found then raise exception 'License not found' using errcode = 'P0002'; end if;
  insert into public.license_events (license_id, event_type, note, performed_by) values (p_license_id, 'archived', trim(p_reason), v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (v_actor, 'ARCHIVE_LICENSE', 'license', p_license_id, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

alter table public.app_profiles enable row level security;
alter table public.licenses enable row level security;
alter table public.archive_number_history enable row level security;
alter table public.license_events enable row level security;
alter table public.audit_logs enable row level security;

create policy app_profiles_self_or_admin_read on public.app_profiles for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_approved_role(array['admin']::public.app_role[])));
create policy licenses_approved_staff_read on public.licenses for select to authenticated
using ((select private.is_approved_role(array['admin', 'archivist']::public.app_role[])));
create policy archive_history_admin_read on public.archive_number_history for select to authenticated
using ((select private.is_approved_role(array['admin']::public.app_role[])));
create policy license_events_admin_read on public.license_events for select to authenticated
using ((select private.is_approved_role(array['admin']::public.app_role[])));
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
using ((select private.is_approved_role(array['admin']::public.app_role[])));

revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all sequences in schema private from anon, authenticated;
grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant select on public.app_profiles, public.licenses, public.archive_number_history, public.license_events, public.audit_logs to authenticated;
grant execute on function private.is_approved_role(public.app_role[]) to authenticated;
grant execute on function public.create_license_idempotent(text, text, public.facility_type, text, text, text, date, date, uuid, text) to authenticated;
grant execute on function public.change_archive_number(uuid, text, text) to authenticated;
grant execute on function public.renew_license(uuid, date, date, text) to authenticated;
grant execute on function public.archive_license(uuid, text) to authenticated;
revoke all on function public.create_license_idempotent(text, text, public.facility_type, text, text, text, date, date, uuid, text) from anon, public;
revoke all on function public.change_archive_number(uuid, text, text) from anon, public;
revoke all on function public.renew_license(uuid, date, date, text) from anon, public;
revoke all on function public.archive_license(uuid, text) from anon, public;

alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

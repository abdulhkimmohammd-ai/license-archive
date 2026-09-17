-- Supabase Development only: complete safe CRUD workflow for the migration lab.
-- This migration does not create Storage, documents, DNS, domains, or Production data paths.

alter table public.licenses
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.app_profiles(user_id),
  add column if not exists delete_reason text;

create index if not exists licenses_deleted_at_idx on public.licenses(deleted_at) where deleted_at is not null;

alter table public.license_events drop constraint if exists license_events_event_type_check;
alter table public.license_events add constraint license_events_event_type_check
  check (event_type in ('issued', 'renewed', 'archive_number_changed', 'archived', 'updated', 'moved_to_trash', 'restored'));

drop policy if exists licenses_approved_staff_read on public.licenses;
create policy licenses_approved_staff_read on public.licenses for select to authenticated
  using (
    (
      deleted_at is null
      and (select private.is_approved_role(array['admin', 'archivist']::public.app_role[]))
    )
    or (
      deleted_at is not null
      and (select private.is_approved_role(array['admin']::public.app_role[]))
    )
  );

create or replace function public.update_license_details(
  p_license_id uuid,
  p_payload jsonb
)
returns table (license_id uuid, archive_number text)
language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
  v_license public.licenses%rowtype;
  v_status public.license_status;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'A JSON object is required for license update' using errcode = '22023';
  end if;
  if p_payload ?| array['archive_number', 'license_no', 'facility_type', 'created_by', 'updated_by', 'deleted_at', 'deleted_by', 'delete_reason'] then
    raise exception 'Archive identity and ownership fields cannot be changed by this procedure' using errcode = '22023';
  end if;

  select * into v_license from public.licenses where id = p_license_id for update;
  if not found then raise exception 'License not found' using errcode = 'P0002'; end if;
  if v_license.deleted_at is not null then raise exception 'Deleted licenses must be restored before update' using errcode = '23505'; end if;
  if v_license.status = 'archived' then raise exception 'Archived licenses cannot be updated' using errcode = '23505'; end if;

  if (p_payload ? 'facility_name' and char_length(trim(coalesce(p_payload->>'facility_name', ''))) = 0)
     or (p_payload ? 'holder_name' and char_length(trim(coalesce(p_payload->>'holder_name', ''))) = 0)
     or (p_payload ? 'holder_national_id' and char_length(trim(coalesce(p_payload->>'holder_national_id', ''))) = 0)
     or (p_payload ? 'governorate' and char_length(trim(coalesce(p_payload->>'governorate', ''))) = 0) then
    raise exception 'Required license fields cannot be empty' using errcode = '22023';
  end if;
  if p_payload ? 'status' and (p_payload->>'status')::public.license_status = 'archived' then
    raise exception 'Use archive_license to archive a license' using errcode = '22023';
  end if;

  update public.licenses as l set
    facility_name = case when p_payload ? 'facility_name' then trim(p_payload->>'facility_name') else l.facility_name end,
    holder_name = case when p_payload ? 'holder_name' then trim(p_payload->>'holder_name') else l.holder_name end,
    holder_national_id = case when p_payload ? 'holder_national_id' then trim(p_payload->>'holder_national_id') else l.holder_national_id end,
    holder_phone = case when p_payload ? 'holder_phone' then nullif(trim(p_payload->>'holder_phone'), '') else l.holder_phone end,
    governorate = case when p_payload ? 'governorate' then trim(p_payload->>'governorate') else l.governorate end,
    address = case when p_payload ? 'address' then nullif(trim(p_payload->>'address'), '') else l.address end,
    street = case when p_payload ? 'street' then nullif(trim(p_payload->>'street'), '') else l.street end,
    area = case when p_payload ? 'area' then nullif(trim(p_payload->>'area'), '') else l.area end,
    district = case when p_payload ? 'district' then nullif(trim(p_payload->>'district'), '') else l.district end,
    property_owner_name = case when p_payload ? 'property_owner_name' then nullif(trim(p_payload->>'property_owner_name'), '') else l.property_owner_name end,
    qualification = case when p_payload ? 'qualification' then nullif(trim(p_payload->>'qualification'), '') else l.qualification end,
    qualification_level = case when p_payload ? 'qualification_level' then nullif(trim(p_payload->>'qualification_level'), '') else l.qualification_level end,
    graduation_country = case when p_payload ? 'graduation_country' then nullif(trim(p_payload->>'graduation_country'), '') else l.graduation_country end,
    graduation_institute = case when p_payload ? 'graduation_institute' then nullif(trim(p_payload->>'graduation_institute'), '') else l.graduation_institute end,
    professional_license_no = case when p_payload ? 'professional_license_no' then nullif(trim(p_payload->>'professional_license_no'), '') else l.professional_license_no end,
    professional_license_issue_date = case when p_payload ? 'professional_license_issue_date' then nullif(p_payload->>'professional_license_issue_date', '')::date else l.professional_license_issue_date end,
    issue_date = case when p_payload ? 'issue_date' then (p_payload->>'issue_date')::date else l.issue_date end,
    expiry_date = case when p_payload ? 'expiry_date' then (p_payload->>'expiry_date')::date else l.expiry_date end,
    archive_date = case when p_payload ? 'archive_date' then nullif(p_payload->>'archive_date', '')::date else l.archive_date end,
    archive_officer_name = case when p_payload ? 'archive_officer_name' then nullif(trim(p_payload->>'archive_officer_name'), '') else l.archive_officer_name end,
    notes = case when p_payload ? 'notes' then nullif(trim(p_payload->>'notes'), '') else l.notes end,
    status = case when p_payload ? 'status' then (p_payload->>'status')::public.license_status else l.status end,
    updated_by = v_actor
  where l.id = p_license_id
  returning l.status into v_status;

  if v_status <> 'active' and v_status <> 'expired' and v_status <> 'suspended' then
    raise exception 'Unsupported editable license status' using errcode = '22023';
  end if;
  if exists (select 1 from public.licenses where id = p_license_id and expiry_date <= issue_date) then
    raise exception 'Expiry date must be after issue date' using errcode = '22023';
  end if;

  insert into public.license_events (license_id, event_type, note, performed_by)
  values (p_license_id, 'updated', 'تعديل بيانات الترخيص عبر إجراء إداري موثق', v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'UPDATE_LICENSE',
    'license',
    p_license_id,
    jsonb_build_object('updated_fields', (select jsonb_agg(key) from jsonb_object_keys(p_payload) as key))
  );
  return query select p_license_id, v_license.archive_number;
end;
$$;

create or replace function public.move_license_to_trash(p_license_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A deletion reason of at least five characters is required' using errcode = '22023';
  end if;
  update public.licenses set deleted_at = now(), deleted_by = v_actor, delete_reason = trim(p_reason), updated_by = v_actor
  where id = p_license_id and deleted_at is null;
  if not found then raise exception 'License is missing or already in trash' using errcode = '23505'; end if;
  insert into public.license_events (license_id, event_type, note, performed_by)
  values (p_license_id, 'moved_to_trash', trim(p_reason), v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'MOVE_LICENSE_TO_TRASH', 'license', p_license_id, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

create or replace function public.restore_license_from_trash(p_license_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
begin
  if char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A restoration reason of at least five characters is required' using errcode = '22023';
  end if;
  update public.licenses set deleted_at = null, deleted_by = null, delete_reason = null, updated_by = v_actor
  where id = p_license_id and deleted_at is not null;
  if not found then raise exception 'License is not in trash' using errcode = '23505'; end if;
  insert into public.license_events (license_id, event_type, note, performed_by)
  values (p_license_id, 'restored', trim(p_reason), v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'RESTORE_LICENSE_FROM_TRASH', 'license', p_license_id, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

grant execute on function public.update_license_details(uuid, jsonb) to authenticated;
grant execute on function public.move_license_to_trash(uuid, text) to authenticated;
grant execute on function public.restore_license_from_trash(uuid, text) to authenticated;
revoke all on function public.update_license_details(uuid, jsonb) from anon, public;
revoke all on function public.move_license_to_trash(uuid, text) from anon, public;
revoke all on function public.restore_license_from_trash(uuid, text) from anon, public;

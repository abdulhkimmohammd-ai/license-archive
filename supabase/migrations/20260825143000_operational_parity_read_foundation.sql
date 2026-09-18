-- License Archive – Supabase Development only.
-- Adds schema parity and server-side operational read contracts.
-- It never changes MySQL, Production, DNS, domains, Storage, or documents.

alter table public.licenses
  add column if not exists graduation_place text,
  add column if not exists graduation_institution_type text,
  add column if not exists graduation_date date,
  add column if not exists license_delivery_recipient_name text,
  add column if not exists license_delivery_signature text,
  add column if not exists license_delivery_fingerprint text;

alter table public.licenses
  drop constraint if exists licenses_graduation_institution_type_check;
alter table public.licenses
  add constraint licenses_graduation_institution_type_check
  check (graduation_institution_type is null or graduation_institution_type in ('institute', 'university'));

alter table public.licenses
  drop constraint if exists licenses_valid_date_range_check;
alter table public.licenses
  add constraint licenses_valid_date_range_check check (expiry_date > issue_date);

alter table public.license_events
  drop constraint if exists license_events_event_type_check;
alter table public.license_events
  add constraint license_events_event_type_check
  check (event_type in ('issued', 'renewed', 'archive_number_changed', 'archived', 'updated', 'status_changed', 'moved_to_trash', 'restored'));

create index if not exists licenses_active_created_at_idx
  on public.licenses(created_at desc)
  where deleted_at is null;

create index if not exists licenses_active_filter_list_idx
  on public.licenses(facility_type, status, governorate, created_at desc)
  where deleted_at is null;

create index if not exists licenses_active_issue_date_idx
  on public.licenses(issue_date desc, created_at desc)
  where deleted_at is null;

create index if not exists licenses_active_archive_date_idx
  on public.licenses(archive_date desc, created_at desc)
  where deleted_at is null;

create or replace function public.create_operational_license_idempotent(
  p_payload jsonb,
  p_idempotency_key uuid,
  p_request_hash text
)
returns table (license_id uuid, archive_number text, idempotent boolean)
language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin', 'archivist']::public.app_role[]);
  v_existing private.idempotency_requests%rowtype;
  v_license_no text := trim(coalesce(p_payload->>'license_no', ''));
  v_facility_type public.facility_type;
  v_sequence integer;
  v_last_four text;
  v_suffix text;
  v_archive_number text;
  v_license_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_idempotency_key is null
     or char_length(trim(coalesce(p_request_hash, ''))) < 16 then
    raise exception 'A valid payload, idempotency key, and request hash are required' using errcode = '22023';
  end if;

  if coalesce(p_payload->>'facility_type', '') not in ('pharmacy', 'warehouse')
     or v_license_no = ''
     or char_length(trim(coalesce(p_payload->>'facility_name', ''))) = 0
     or char_length(trim(coalesce(p_payload->>'holder_name', ''))) = 0
     or char_length(trim(coalesce(p_payload->>'holder_national_id', ''))) = 0
     or char_length(trim(coalesce(p_payload->>'governorate', ''))) = 0
     or nullif(p_payload->>'issue_date', '') is null
     or nullif(p_payload->>'expiry_date', '') is null then
    raise exception 'License number and required operational fields are invalid' using errcode = '22023';
  end if;

  if nullif(p_payload->>'qualification_level', '') is not null
     and p_payload->>'qualification_level' not in ('diploma', 'bachelor') then
    raise exception 'Qualification level is invalid' using errcode = '22023';
  end if;

  if nullif(p_payload->>'graduation_institution_type', '') is not null
     and p_payload->>'graduation_institution_type' not in ('institute', 'university') then
    raise exception 'Graduation institution type is invalid' using errcode = '22023';
  end if;

  if (nullif(p_payload->>'expiry_date', ''))::date <= (nullif(p_payload->>'issue_date', ''))::date then
    raise exception 'Expiry date must be after issue date' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existing from private.idempotency_requests where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.actor_id <> v_actor or v_existing.request_hash <> p_request_hash then
      raise exception 'Idempotency key conflicts with a different request' using errcode = '23505';
    end if;
    return query
      select v_existing.license_id, l.archive_number, true
      from public.licenses l
      where l.id = v_existing.license_id;
    return;
  end if;

  v_last_four := substring(v_license_no from '([0-9]{4})$');
  if v_last_four is null then
    raise exception 'The license number must end with four digits for archive numbering' using errcode = '22023';
  end if;
  v_facility_type := (p_payload->>'facility_type')::public.facility_type;

  insert into private.archive_sequences as s (facility_type, current_value)
  values (v_facility_type, 1)
  on conflict (facility_type) do update set current_value = s.current_value + 1, updated_at = now()
  returning current_value into v_sequence;

  v_suffix := case when v_facility_type = 'pharmacy' then 'ص' else 'م' end;
  v_archive_number := v_last_four || '-' || lpad(v_sequence::text, 4, '0') || v_suffix;

  insert into public.licenses (
    license_no, facility_name, facility_type, holder_name, holder_national_id, holder_phone,
    national_id_issued_by, national_id_issue_governorate, national_id_issue_date,
    birth_place, birth_governorate, birth_date,
    qualification, qualification_level, graduation_place, graduation_country, graduation_institute, graduation_institution_type, graduation_date,
    professional_license_no, professional_license_issue_date,
    previous_license_no, previous_license_issued_by, previous_license_issue_date,
    site_inspection_form_no, site_inspection_form_date, committee_minutes_no, committee_minutes_date, fee_receipt_no, fee_receipt_date,
    governorate, address, street, area, district, property_owner_name,
    archive_number, archive_date, archive_officer_name,
    issue_date, expiry_date, health_office_issue_date, health_office_director_name, health_office_director_governorate,
    license_delivery_date, license_delivery_recipient_name, license_delivery_signature, license_delivery_fingerprint,
    status, notes, created_by
  ) values (
    v_license_no, trim(p_payload->>'facility_name'), v_facility_type, trim(p_payload->>'holder_name'), trim(p_payload->>'holder_national_id'), nullif(trim(p_payload->>'holder_phone'), ''),
    nullif(trim(p_payload->>'national_id_issued_by'), ''), nullif(trim(p_payload->>'national_id_issue_governorate'), ''), nullif(p_payload->>'national_id_issue_date', '')::date,
    nullif(trim(p_payload->>'birth_place'), ''), nullif(trim(p_payload->>'birth_governorate'), ''), nullif(p_payload->>'birth_date', '')::date,
    nullif(trim(p_payload->>'qualification'), ''), nullif(trim(p_payload->>'qualification_level'), ''), nullif(trim(p_payload->>'graduation_place'), ''), nullif(trim(p_payload->>'graduation_country'), ''), nullif(trim(p_payload->>'graduation_institute'), ''), nullif(trim(p_payload->>'graduation_institution_type'), ''), nullif(p_payload->>'graduation_date', '')::date,
    nullif(trim(p_payload->>'professional_license_no'), ''), nullif(p_payload->>'professional_license_issue_date', '')::date,
    nullif(trim(p_payload->>'previous_license_no'), ''), nullif(trim(p_payload->>'previous_license_issued_by'), ''), nullif(p_payload->>'previous_license_issue_date', '')::date,
    nullif(trim(p_payload->>'site_inspection_form_no'), ''), nullif(p_payload->>'site_inspection_form_date', '')::date, nullif(trim(p_payload->>'committee_minutes_no'), ''), nullif(p_payload->>'committee_minutes_date', '')::date, nullif(trim(p_payload->>'fee_receipt_no'), ''), nullif(p_payload->>'fee_receipt_date', '')::date,
    trim(p_payload->>'governorate'), nullif(trim(p_payload->>'address'), ''), nullif(trim(p_payload->>'street'), ''), nullif(trim(p_payload->>'area'), ''), nullif(trim(p_payload->>'district'), ''), nullif(trim(p_payload->>'property_owner_name'), ''),
    v_archive_number, coalesce(nullif(p_payload->>'archive_date', '')::date, current_date), nullif(trim(p_payload->>'archive_officer_name'), ''),
    (p_payload->>'issue_date')::date, (p_payload->>'expiry_date')::date, nullif(p_payload->>'health_office_issue_date', '')::date, nullif(trim(p_payload->>'health_office_director_name'), ''), nullif(trim(p_payload->>'health_office_director_governorate'), ''),
    nullif(p_payload->>'license_delivery_date', '')::date, nullif(trim(p_payload->>'license_delivery_recipient_name'), ''), nullif(trim(p_payload->>'license_delivery_signature'), ''), nullif(trim(p_payload->>'license_delivery_fingerprint'), ''),
    coalesce(nullif(p_payload->>'status', '')::public.license_status, 'active'::public.license_status), nullif(trim(p_payload->>'notes'), ''), v_actor
  ) returning id into v_license_id;

  insert into public.archive_number_history (archive_number, license_id, facility_type, sequence, assigned_by, change_reason)
  values (v_archive_number, v_license_id, v_facility_type, v_sequence, v_actor, 'تخصيص تلقائي عند الإنشاء');
  insert into public.license_events (license_id, event_type, note, performed_by)
  values (v_license_id, 'issued', 'إنشاء ترخيص وتخصيص رقم أرشفة تلقائي', v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'CREATE_LICENSE', 'license', v_license_id, jsonb_build_object('archive_number', v_archive_number));
  insert into private.idempotency_requests (idempotency_key, actor_id, request_hash, license_id)
  values (p_idempotency_key, v_actor, p_request_hash, v_license_id);

  return query select v_license_id, v_archive_number, false;
end;
$$;

create or replace function public.update_license_details(
  p_license_id uuid,
  p_payload jsonb
)
returns table (license_id uuid, archive_number text)
language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin']::public.app_role[]);
  v_license public.licenses%rowtype;
  v_new_status public.license_status;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'A JSON object is required for license update' using errcode = '22023';
  end if;
  if p_payload ?| array['archive_number', 'license_no', 'facility_type', 'created_by', 'updated_by', 'deleted_at', 'deleted_by', 'delete_reason'] then
    raise exception 'Archive identity and ownership fields cannot be changed by this procedure' using errcode = '22023';
  end if;
  if p_payload ? 'qualification_level' and nullif(p_payload->>'qualification_level', '') is not null and p_payload->>'qualification_level' not in ('diploma', 'bachelor') then
    raise exception 'Qualification level is invalid' using errcode = '22023';
  end if;
  if p_payload ? 'graduation_institution_type' and nullif(p_payload->>'graduation_institution_type', '') is not null and p_payload->>'graduation_institution_type' not in ('institute', 'university') then
    raise exception 'Graduation institution type is invalid' using errcode = '22023';
  end if;

  select * into v_license from public.licenses where id = p_license_id for update;
  if not found then raise exception 'License not found' using errcode = 'P0002'; end if;
  if v_license.deleted_at is not null then raise exception 'Deleted licenses must be restored before update' using errcode = '23505'; end if;
  if v_license.status = 'archived' then raise exception 'Archived licenses cannot be updated' using errcode = '23505'; end if;
  if (p_payload ? 'facility_name' and char_length(trim(coalesce(p_payload->>'facility_name', ''))) = 0)
     or (p_payload ? 'holder_name' and char_length(trim(coalesce(p_payload->>'holder_name', ''))) = 0)
     or (p_payload ? 'holder_national_id' and char_length(trim(coalesce(p_payload->>'holder_national_id', ''))) = 0)
     or (p_payload ? 'governorate' and char_length(trim(coalesce(p_payload->>'governorate', ''))) = 0)
     or (p_payload ? 'status' and p_payload->>'status' = 'archived') then
    raise exception 'Required license fields are invalid or archival must use its protected procedure' using errcode = '22023';
  end if;

  update public.licenses as l set
    facility_name = case when p_payload ? 'facility_name' then trim(p_payload->>'facility_name') else l.facility_name end,
    holder_name = case when p_payload ? 'holder_name' then trim(p_payload->>'holder_name') else l.holder_name end,
    holder_national_id = case when p_payload ? 'holder_national_id' then trim(p_payload->>'holder_national_id') else l.holder_national_id end,
    holder_phone = case when p_payload ? 'holder_phone' then nullif(trim(p_payload->>'holder_phone'), '') else l.holder_phone end,
    national_id_issued_by = case when p_payload ? 'national_id_issued_by' then nullif(trim(p_payload->>'national_id_issued_by'), '') else l.national_id_issued_by end,
    national_id_issue_governorate = case when p_payload ? 'national_id_issue_governorate' then nullif(trim(p_payload->>'national_id_issue_governorate'), '') else l.national_id_issue_governorate end,
    national_id_issue_date = case when p_payload ? 'national_id_issue_date' then nullif(p_payload->>'national_id_issue_date', '')::date else l.national_id_issue_date end,
    birth_place = case when p_payload ? 'birth_place' then nullif(trim(p_payload->>'birth_place'), '') else l.birth_place end,
    birth_governorate = case when p_payload ? 'birth_governorate' then nullif(trim(p_payload->>'birth_governorate'), '') else l.birth_governorate end,
    birth_date = case when p_payload ? 'birth_date' then nullif(p_payload->>'birth_date', '')::date else l.birth_date end,
    governorate = case when p_payload ? 'governorate' then trim(p_payload->>'governorate') else l.governorate end,
    address = case when p_payload ? 'address' then nullif(trim(p_payload->>'address'), '') else l.address end,
    street = case when p_payload ? 'street' then nullif(trim(p_payload->>'street'), '') else l.street end,
    area = case when p_payload ? 'area' then nullif(trim(p_payload->>'area'), '') else l.area end,
    district = case when p_payload ? 'district' then nullif(trim(p_payload->>'district'), '') else l.district end,
    property_owner_name = case when p_payload ? 'property_owner_name' then nullif(trim(p_payload->>'property_owner_name'), '') else l.property_owner_name end,
    qualification = case when p_payload ? 'qualification' then nullif(trim(p_payload->>'qualification'), '') else l.qualification end,
    qualification_level = case when p_payload ? 'qualification_level' then nullif(trim(p_payload->>'qualification_level'), '') else l.qualification_level end,
    graduation_place = case when p_payload ? 'graduation_place' then nullif(trim(p_payload->>'graduation_place'), '') else l.graduation_place end,
    graduation_country = case when p_payload ? 'graduation_country' then nullif(trim(p_payload->>'graduation_country'), '') else l.graduation_country end,
    graduation_institute = case when p_payload ? 'graduation_institute' then nullif(trim(p_payload->>'graduation_institute'), '') else l.graduation_institute end,
    graduation_institution_type = case when p_payload ? 'graduation_institution_type' then nullif(trim(p_payload->>'graduation_institution_type'), '') else l.graduation_institution_type end,
    graduation_date = case when p_payload ? 'graduation_date' then nullif(p_payload->>'graduation_date', '')::date else l.graduation_date end,
    professional_license_no = case when p_payload ? 'professional_license_no' then nullif(trim(p_payload->>'professional_license_no'), '') else l.professional_license_no end,
    professional_license_issue_date = case when p_payload ? 'professional_license_issue_date' then nullif(p_payload->>'professional_license_issue_date', '')::date else l.professional_license_issue_date end,
    previous_license_no = case when p_payload ? 'previous_license_no' then nullif(trim(p_payload->>'previous_license_no'), '') else l.previous_license_no end,
    previous_license_issued_by = case when p_payload ? 'previous_license_issued_by' then nullif(trim(p_payload->>'previous_license_issued_by'), '') else l.previous_license_issued_by end,
    previous_license_issue_date = case when p_payload ? 'previous_license_issue_date' then nullif(p_payload->>'previous_license_issue_date', '')::date else l.previous_license_issue_date end,
    site_inspection_form_no = case when p_payload ? 'site_inspection_form_no' then nullif(trim(p_payload->>'site_inspection_form_no'), '') else l.site_inspection_form_no end,
    site_inspection_form_date = case when p_payload ? 'site_inspection_form_date' then nullif(p_payload->>'site_inspection_form_date', '')::date else l.site_inspection_form_date end,
    committee_minutes_no = case when p_payload ? 'committee_minutes_no' then nullif(trim(p_payload->>'committee_minutes_no'), '') else l.committee_minutes_no end,
    committee_minutes_date = case when p_payload ? 'committee_minutes_date' then nullif(p_payload->>'committee_minutes_date', '')::date else l.committee_minutes_date end,
    fee_receipt_no = case when p_payload ? 'fee_receipt_no' then nullif(trim(p_payload->>'fee_receipt_no'), '') else l.fee_receipt_no end,
    fee_receipt_date = case when p_payload ? 'fee_receipt_date' then nullif(p_payload->>'fee_receipt_date', '')::date else l.fee_receipt_date end,
    archive_date = case when p_payload ? 'archive_date' then nullif(p_payload->>'archive_date', '')::date else l.archive_date end,
    archive_officer_name = case when p_payload ? 'archive_officer_name' then nullif(trim(p_payload->>'archive_officer_name'), '') else l.archive_officer_name end,
    issue_date = case when p_payload ? 'issue_date' then (p_payload->>'issue_date')::date else l.issue_date end,
    expiry_date = case when p_payload ? 'expiry_date' then (p_payload->>'expiry_date')::date else l.expiry_date end,
    health_office_issue_date = case when p_payload ? 'health_office_issue_date' then nullif(p_payload->>'health_office_issue_date', '')::date else l.health_office_issue_date end,
    health_office_director_name = case when p_payload ? 'health_office_director_name' then nullif(trim(p_payload->>'health_office_director_name'), '') else l.health_office_director_name end,
    health_office_director_governorate = case when p_payload ? 'health_office_director_governorate' then nullif(trim(p_payload->>'health_office_director_governorate'), '') else l.health_office_director_governorate end,
    license_delivery_date = case when p_payload ? 'license_delivery_date' then nullif(p_payload->>'license_delivery_date', '')::date else l.license_delivery_date end,
    license_delivery_recipient_name = case when p_payload ? 'license_delivery_recipient_name' then nullif(trim(p_payload->>'license_delivery_recipient_name'), '') else l.license_delivery_recipient_name end,
    license_delivery_signature = case when p_payload ? 'license_delivery_signature' then nullif(trim(p_payload->>'license_delivery_signature'), '') else l.license_delivery_signature end,
    license_delivery_fingerprint = case when p_payload ? 'license_delivery_fingerprint' then nullif(trim(p_payload->>'license_delivery_fingerprint'), '') else l.license_delivery_fingerprint end,
    notes = case when p_payload ? 'notes' then nullif(trim(p_payload->>'notes'), '') else l.notes end,
    status = case when p_payload ? 'status' then (p_payload->>'status')::public.license_status else l.status end,
    updated_by = v_actor
  where l.id = p_license_id
  returning l.status into v_new_status;

  insert into public.license_events (license_id, event_type, note, performed_by)
  values (p_license_id, case when v_new_status is distinct from v_license.status then 'status_changed' else 'updated' end, 'تعديل بيانات الترخيص عبر إجراء إداري موثق', v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'UPDATE_LICENSE', 'license', p_license_id, jsonb_build_object('updated_fields', (select jsonb_agg(key) from jsonb_object_keys(p_payload) as key)));
  return query select p_license_id, v_license.archive_number;
end;
$$;

create or replace function public.list_operational_licenses(
  p_search text default null,
  p_search_scope text default 'all',
  p_facility_type public.facility_type default null,
  p_status text default null,
  p_governorate text default null,
  p_issue_date_from date default null,
  p_issue_date_to date default null,
  p_sort_by text default 'created_at',
  p_sort_direction text default 'desc',
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  id uuid, license_no text, archive_number text, facility_name text, facility_type public.facility_type,
  holder_name text, governorate text, archive_date date, issue_date date, expiry_date date,
  status public.license_status, created_at timestamptz, total_count bigint
)
language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
begin
  perform private.assert_approved_role(array['admin', 'archivist']::public.app_role[]);
  if p_search_scope not in ('all', 'facility', 'owner')
     or p_sort_by not in ('created_at', 'license_no', 'facility_name', 'issue_date', 'expiry_date')
     or p_sort_direction not in ('asc', 'desc')
     or p_status not in ('active', 'expired', 'suspended', 'archived') and p_status is not null then
    raise exception 'Invalid operational list filter or sort parameter' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select l.*
    from public.licenses l
    where l.deleted_at is null
      and (p_facility_type is null or l.facility_type = p_facility_type)
      and (p_governorate is null or l.governorate = p_governorate)
      and (p_issue_date_from is null or l.issue_date >= p_issue_date_from)
      and (p_issue_date_to is null or l.issue_date < p_issue_date_to + 1)
      and (
        p_status is null
        or (p_status = 'active' and l.status = 'active' and l.expiry_date >= current_date)
        or (p_status = 'expired' and (l.expiry_date < current_date or l.status in ('suspended', 'archived')))
        or (p_status = 'suspended' and l.status = 'suspended')
        or (p_status = 'archived' and l.status = 'archived')
      )
      and (
        v_search is null
        or (p_search_scope = 'facility' and lower(l.facility_name) like '%' || v_search || '%')
        or (p_search_scope = 'owner' and lower(l.holder_name) like '%' || v_search || '%')
        or (p_search_scope = 'all' and (
          lower(l.license_no) like '%' || v_search || '%'
          or lower(l.archive_number) like '%' || v_search || '%'
          or lower(l.facility_name) like '%' || v_search || '%'
          or lower(l.holder_name) like '%' || v_search || '%'
        ))
      )
  )
  select
    f.id, f.license_no, f.archive_number, f.facility_name, f.facility_type,
    f.holder_name, f.governorate, f.archive_date, f.issue_date, f.expiry_date,
    f.status, f.created_at, count(*) over() as total_count
  from filtered f
  order by
    case when p_sort_by = 'created_at' and p_sort_direction = 'asc' then f.created_at end asc,
    case when p_sort_by = 'created_at' and p_sort_direction = 'desc' then f.created_at end desc,
    case when p_sort_by = 'license_no' and p_sort_direction = 'asc' then f.license_no end asc,
    case when p_sort_by = 'license_no' and p_sort_direction = 'desc' then f.license_no end desc,
    case when p_sort_by = 'facility_name' and p_sort_direction = 'asc' then f.facility_name end asc,
    case when p_sort_by = 'facility_name' and p_sort_direction = 'desc' then f.facility_name end desc,
    case when p_sort_by = 'issue_date' and p_sort_direction = 'asc' then f.issue_date end asc,
    case when p_sort_by = 'issue_date' and p_sort_direction = 'desc' then f.issue_date end desc,
    case when p_sort_by = 'expiry_date' and p_sort_direction = 'asc' then f.expiry_date end asc,
    case when p_sort_by = 'expiry_date' and p_sort_direction = 'desc' then f.expiry_date end desc,
    f.id desc
  limit v_page_size offset (v_page - 1) * v_page_size;
end;
$$;

grant execute on function public.create_operational_license_idempotent(jsonb, uuid, text) to authenticated;
grant execute on function public.list_operational_licenses(text, text, public.facility_type, text, text, date, date, text, text, integer, integer) to authenticated;
revoke all on function public.create_operational_license_idempotent(jsonb, uuid, text) from anon, public;
revoke all on function public.list_operational_licenses(text, text, public.facility_type, text, text, date, date, text, text, integer, integer) from anon, public;

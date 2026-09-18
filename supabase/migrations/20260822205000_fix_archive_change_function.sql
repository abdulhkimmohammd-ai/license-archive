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
  if p_new_archive_number = v_license.archive_number
     or exists (select 1 from public.archive_number_history as h where h.archive_number = p_new_archive_number) then
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

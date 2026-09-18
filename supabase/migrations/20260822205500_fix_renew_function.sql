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
  update public.licenses as l
  set issue_date = p_issue_date, expiry_date = p_expiry_date, status = 'active', updated_by = v_actor
  where l.id = p_license_id
  returning l.archive_number into v_archive_number;
  if not found then raise exception 'License not found' using errcode = 'P0002'; end if;
  insert into public.license_events (license_id, event_type, note, performed_by)
  values (p_license_id, 'renewed', trim(p_reason), v_actor);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'RENEW_LICENSE', 'license', p_license_id, jsonb_build_object('issue_date', p_issue_date, 'expiry_date', p_expiry_date, 'reason', trim(p_reason)));
  return query select p_license_id, v_archive_number;
end;
$$;

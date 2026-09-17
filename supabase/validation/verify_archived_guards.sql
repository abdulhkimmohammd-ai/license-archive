-- TEST ONLY: verifies the archived-record guards using existing synthetic data.
-- This transaction rolls back; it does not create, modify, or delete records.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

do $$
declare
  v_archived_license uuid;
begin
  select id into v_archived_license
  from public.licenses
  where license_no = 'WAREHOUSE-SECOND-8765' and status = 'archived';
  if v_archived_license is null then
    raise exception 'Expected archived synthetic warehouse record is missing';
  end if;

  begin
    perform public.archive_license(v_archived_license, 'إعادة أرشفة اختبارية يجب رفضها');
    raise exception 'Expected repeated-archive rejection was not raised';
  exception when unique_violation then null;
  end;

  begin
    perform public.renew_license(v_archived_license, date '2026-09-01', date '2028-09-01', 'تجديد سجل مؤرشف يجب رفضه');
    raise exception 'Expected archived-renewal rejection was not raised';
  exception when unique_violation then null;
  end;
end;
$$;

rollback;

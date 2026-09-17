-- TEST ONLY: validates the empty Supabase Development project.
-- It creates four test licenses ending in 6543/8765 and exercises protected RPC and RLS.

begin;
set local role authenticated;

do $$
declare
  v_admin constant uuid := '00000000-0000-0000-0000-000000000101';
  v_archivist constant uuid := '00000000-0000-0000-0000-000000000102';
  v_user constant uuid := '00000000-0000-0000-0000-000000000103';
  v_blocked constant uuid := '00000000-0000-0000-0000-000000000104';
  v_pharmacy_one uuid;
  v_pharmacy_two uuid;
  v_warehouse_one uuid;
  v_warehouse_two uuid;
  v_result record;
  v_archive_number text;
begin
  -- Archivist creates the required four test records; the server assigns numbers.
  perform set_config('request.jwt.claim.sub', v_archivist::text, true);
  select * into v_result from public.create_license_idempotent(
    'PHARMACY-TEST-6543', 'صيدلية اختبار 6543', 'pharmacy', 'حامل اختبار', 'TEST-NID-6543', 'صنعاء',
    date '2026-08-22', date '2028-08-22', '10000000-0000-0000-0000-000000000001', 'hash-pharmacy-6543-create-test'
  );
  v_pharmacy_one := v_result.license_id;
  if v_result.archive_number <> '6543-0001ص' or v_result.idempotent then raise exception 'First pharmacy archive number mismatch'; end if;

  select * into v_result from public.create_license_idempotent(
    'PHARMACY-SECOND-6543', 'صيدلية اختبار ثانية 6543', 'pharmacy', 'حامل اختبار', 'TEST-NID-6543-2', 'صنعاء',
    date '2026-08-22', date '2028-08-22', '10000000-0000-0000-0000-000000000002', 'hash-pharmacy-6543-second-test'
  );
  v_pharmacy_two := v_result.license_id;
  if v_result.archive_number <> '6543-0002ص' or v_result.idempotent then raise exception 'Second pharmacy archive number mismatch'; end if;

  select * into v_result from public.create_license_idempotent(
    'WAREHOUSE-TEST-8765', 'مخزن اختبار 8765', 'warehouse', 'حامل اختبار', 'TEST-NID-8765', 'صنعاء',
    date '2026-08-22', date '2028-08-22', '10000000-0000-0000-0000-000000000003', 'hash-warehouse-8765-create-test'
  );
  v_warehouse_one := v_result.license_id;
  if v_result.archive_number <> '8765-0001م' or v_result.idempotent then raise exception 'First warehouse archive number mismatch'; end if;

  select * into v_result from public.create_license_idempotent(
    'WAREHOUSE-SECOND-8765', 'مخزن اختبار ثان 8765', 'warehouse', 'حامل اختبار', 'TEST-NID-8765-2', 'صنعاء',
    date '2026-08-22', date '2028-08-22', '10000000-0000-0000-0000-000000000004', 'hash-warehouse-8765-second-test'
  );
  v_warehouse_two := v_result.license_id;
  if v_result.archive_number <> '8765-0002م' or v_result.idempotent then raise exception 'Second warehouse archive number mismatch'; end if;

  -- Replay after an assumed lost response: same key and hash must return the same record only.
  select * into v_result from public.create_license_idempotent(
    'PHARMACY-TEST-6543', 'صيدلية اختبار 6543', 'pharmacy', 'حامل اختبار', 'TEST-NID-6543', 'صنعاء',
    date '2026-08-22', date '2028-08-22', '10000000-0000-0000-0000-000000000001', 'hash-pharmacy-6543-create-test'
  );
  if v_result.license_id <> v_pharmacy_one or not v_result.idempotent then raise exception 'Idempotency replay failed'; end if;

  -- Reuse of the same idempotency key for a different request must conflict.
  begin
    perform public.create_license_idempotent(
      'CONFLICT-TEST-6543', 'تعارض اختبار', 'pharmacy', 'حامل اختبار', 'TEST-CONFLICT', 'صنعاء',
      date '2026-08-22', date '2028-08-22', '10000000-0000-0000-0000-000000000001', 'different-hash-for-the-same-key'
    );
    raise exception 'Expected idempotency conflict was not raised';
  exception when unique_violation then null;
  end;

  -- Normal and blocked users cannot use creation RPC or change an archive number.
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  begin
    perform public.change_archive_number(v_pharmacy_one, '6543-0003ص', 'محاولة مستخدم عادي');
    raise exception 'Expected normal-user rejection was not raised';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', v_blocked::text, true);
  begin
    perform public.create_license_idempotent(
      'BLOCKED-TEST-6543', 'محاولة محظورة', 'pharmacy', 'حامل اختبار', 'TEST-BLOCKED', 'صنعاء',
      date '2026-08-22', date '2028-08-22', '10000000-0000-0000-0000-000000000005', 'hash-blocked-user-test'
    );
    raise exception 'Expected blocked-user rejection was not raised';
  exception when insufficient_privilege then null;
  end;

  -- Direct client table writes are prohibited even for approved staff.
  perform set_config('request.jwt.claim.sub', v_archivist::text, true);
  begin
    insert into public.licenses (license_no, facility_name, facility_type, holder_name, holder_national_id, governorate, issue_date, expiry_date, archive_number, created_by)
    values ('DIRECT-WRITE-6543', 'كتابة مباشرة ممنوعة', 'pharmacy', 'اختبار', 'DIRECT-TEST', 'صنعاء', current_date, current_date + 1, '6543-9999ص', v_archivist);
    raise exception 'Expected direct table-write rejection was not raised';
  exception when insufficient_privilege then null;
  end;

  -- The administrator changes one archive number and writes the immutable trail.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  select * into v_result from public.change_archive_number(v_pharmacy_two, '6543-0003ص', 'تصحيح إداري موثق لاختبار الأرشفة');
  if v_result.archive_number <> '6543-0003ص' then raise exception 'Administrator archive-number change failed'; end if;
  if not exists (select 1 from public.audit_logs where entity_id = v_pharmacy_two and action = 'CHANGE_ARCHIVE_NUMBER') then raise exception 'Change audit log missing'; end if;
  if not exists (select 1 from public.archive_number_history where license_id = v_pharmacy_two and archive_number = '6543-0003ص') then raise exception 'Archive history missing'; end if;

  -- Historical numbers cannot be reused by any later record.
  begin
    perform public.change_archive_number(v_pharmacy_two, '6543-0002ص', 'محاولة إعادة استخدام رقم تاريخي');
    raise exception 'Expected historical-number conflict was not raised';
  exception when unique_violation then null;
  end;

  -- Renewal preserves the original archive number; archiving records an event and audit entry.
  select archive_number into v_archive_number from public.licenses where id = v_pharmacy_one;
  select * into v_result from public.renew_license(v_pharmacy_one, date '2026-09-01', date '2028-09-01', 'تجديد اختبار يحافظ على الرقم');
  if v_result.archive_number <> v_archive_number then raise exception 'Renewal changed the archive number'; end if;
  perform public.archive_license(v_warehouse_two, 'أرشفة اختبار إدارية موثقة');
  if not exists (select 1 from public.licenses where id = v_warehouse_two and status = 'archived') then raise exception 'Archiving failed'; end if;
  if not exists (select 1 from public.license_events where license_id = v_warehouse_two and event_type = 'archived') then raise exception 'Archive event missing'; end if;
  if not exists (select 1 from public.audit_logs where entity_id = v_warehouse_two and action = 'ARCHIVE_LICENSE') then raise exception 'Archive audit log missing'; end if;

  -- An archived record cannot be archived again or silently renewed.
  begin
    perform public.archive_license(v_warehouse_two, 'إعادة أرشفة اختبارية يجب رفضها');
    raise exception 'Expected repeated-archive rejection was not raised';
  exception when unique_violation then null;
  end;
  begin
    perform public.renew_license(v_warehouse_two, date '2026-09-01', date '2028-09-01', 'تجديد سجل مؤرشف يجب رفضه');
    raise exception 'Expected archived-renewal rejection was not raised';
  exception when unique_violation then null;
  end;
end;
$$;
commit;

-- Owner-side evidence only; all rows use TEST labels and are not Production data.
select license_no, facility_type, archive_number, status
from public.licenses
where license_no like '%TEST-%'
order by facility_type, license_no
limit 10;

select action, count(*) as audit_count
from public.audit_logs
where entity_type = 'license'
group by action
order by action
limit 10;

-- Actual RLS visibility checks using authenticated role and synthetic JWT subjects.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select count(*) as normal_user_visible_licenses from public.licenses;
select count(*) as normal_user_visible_audit_logs from public.audit_logs;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select count(*) as archivist_visible_licenses from public.licenses;
select count(*) as archivist_visible_audit_logs from public.audit_logs;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select count(*) as admin_visible_licenses from public.licenses;
select count(*) as admin_visible_audit_logs from public.audit_logs;
commit;

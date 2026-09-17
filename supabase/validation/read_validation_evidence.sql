select json_build_object(
  'test_license_count', (select count(*) from public.licenses where license_no in ('PHARMACY-TEST-6543', 'PHARMACY-SECOND-6543', 'WAREHOUSE-TEST-8765', 'WAREHOUSE-SECOND-8765')),
  'test_archives', (select json_agg(x) from (
    select license_no, archive_number, facility_type, status
    from public.licenses where license_no in ('PHARMACY-TEST-6543', 'PHARMACY-SECOND-6543', 'WAREHOUSE-TEST-8765', 'WAREHOUSE-SECOND-8765')
    order by archive_number limit 10
  ) x),
  'archive_history_count', (select count(*) from public.archive_number_history),
  'audit_actions', (select json_object_agg(action, action_count) from (
    select action, count(*) as action_count from public.audit_logs
    group by action order by action limit 10
  ) a),
  'document_table_exists', exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'documents'
  )
) as validation_evidence
limit 1;

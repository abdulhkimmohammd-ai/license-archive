begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select count(*) as visible_licenses, (select count(*) from public.audit_logs) as visible_audit_logs
from public.licenses
limit 1;
commit;


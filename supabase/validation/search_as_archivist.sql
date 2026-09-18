begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select license_no, facility_name, archive_number
from public.licenses
where license_no ilike '%6543%'
   or archive_number = '8765-0001م'
   or facility_name ilike '%مخزن%'
order by archive_number
limit 10;
commit;

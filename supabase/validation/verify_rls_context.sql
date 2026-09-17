begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select count(*) as visible_profile_rows
from public.app_profiles;
commit;

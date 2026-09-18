delete from auth.users
where id = '00000000-0000-0000-0000-000000000105'::uuid;

select count(*) as remaining_http_test_users
from auth.users
where id = '00000000-0000-0000-0000-000000000105'::uuid
limit 1;

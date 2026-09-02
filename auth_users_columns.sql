select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'auth' and table_name = 'users'
order by ordinal_position
limit 50;

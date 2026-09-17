-- License Archive – Supabase Development only.
-- Adds archive-date filters to the operational list contract.

drop function if exists public.list_operational_licenses(text, text, public.facility_type, text, text, date, date, text, text, integer, integer);

create or replace function public.list_operational_licenses(
  p_search text default null,
  p_search_scope text default 'all',
  p_facility_type public.facility_type default null,
  p_status text default null,
  p_governorate text default null,
  p_issue_date_from date default null,
  p_issue_date_to date default null,
  p_archive_date_from date default null,
  p_archive_date_to date default null,
  p_sort_by text default 'created_at',
  p_sort_direction text default 'desc',
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  id uuid, license_no text, archive_number text, facility_name text, facility_type public.facility_type,
  holder_name text, governorate text, archive_date date, issue_date date, expiry_date date,
  status public.license_status, created_at timestamptz, total_count bigint
)
language plpgsql security definer set search_path = private, public, pg_catalog as $$
declare
  v_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
begin
  perform private.assert_approved_role(array['admin', 'archivist']::public.app_role[]);
  if p_search_scope not in ('all', 'facility', 'owner')
     or p_sort_by not in ('created_at', 'license_no', 'facility_name', 'issue_date', 'expiry_date')
     or p_sort_direction not in ('asc', 'desc')
     or (p_status not in ('active', 'expired', 'suspended', 'archived') and p_status is not null)
     or (p_issue_date_from is not null and p_issue_date_to is not null and p_issue_date_to < p_issue_date_from)
     or (p_archive_date_from is not null and p_archive_date_to is not null and p_archive_date_to < p_archive_date_from) then
    raise exception 'Invalid operational list filter or sort parameter' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select l.*
    from public.licenses l
    where l.deleted_at is null
      and (p_facility_type is null or l.facility_type = p_facility_type)
      and (p_governorate is null or l.governorate = p_governorate)
      and (p_issue_date_from is null or l.issue_date >= p_issue_date_from)
      and (p_issue_date_to is null or l.issue_date < p_issue_date_to + 1)
      and (p_archive_date_from is null or l.archive_date >= p_archive_date_from)
      and (p_archive_date_to is null or l.archive_date < p_archive_date_to + 1)
      and (
        p_status is null
        or (p_status = 'active' and l.status = 'active' and l.expiry_date >= current_date)
        or (p_status = 'expired' and (l.expiry_date < current_date or l.status in ('suspended', 'archived')))
        or (p_status = 'suspended' and l.status = 'suspended')
        or (p_status = 'archived' and l.status = 'archived')
      )
      and (
        v_search is null
        or (p_search_scope = 'facility' and lower(l.facility_name) like '%' || v_search || '%')
        or (p_search_scope = 'owner' and lower(l.holder_name) like '%' || v_search || '%')
        or (p_search_scope = 'all' and (
          lower(l.license_no) like '%' || v_search || '%'
          or lower(l.archive_number) like '%' || v_search || '%'
          or lower(l.facility_name) like '%' || v_search || '%'
          or lower(l.holder_name) like '%' || v_search || '%'
        ))
      )
  )
  select f.id, f.license_no, f.archive_number, f.facility_name, f.facility_type,
    f.holder_name, f.governorate, f.archive_date, f.issue_date, f.expiry_date,
    f.status, f.created_at, count(*) over() as total_count
  from filtered f
  order by
    case when p_sort_by = 'created_at' and p_sort_direction = 'asc' then f.created_at end asc,
    case when p_sort_by = 'created_at' and p_sort_direction = 'desc' then f.created_at end desc,
    case when p_sort_by = 'license_no' and p_sort_direction = 'asc' then f.license_no end asc,
    case when p_sort_by = 'license_no' and p_sort_direction = 'desc' then f.license_no end desc,
    case when p_sort_by = 'facility_name' and p_sort_direction = 'asc' then f.facility_name end asc,
    case when p_sort_by = 'facility_name' and p_sort_direction = 'desc' then f.facility_name end desc,
    case when p_sort_by = 'issue_date' and p_sort_direction = 'asc' then f.issue_date end asc,
    case when p_sort_by = 'issue_date' and p_sort_direction = 'desc' then f.issue_date end desc,
    case when p_sort_by = 'expiry_date' and p_sort_direction = 'asc' then f.expiry_date end asc,
    case when p_sort_by = 'expiry_date' and p_sort_direction = 'desc' then f.expiry_date end desc,
    f.id desc
  limit v_page_size offset (v_page - 1) * v_page_size;
end;
$$;

grant execute on function public.list_operational_licenses(text, text, public.facility_type, text, text, date, date, date, date, text, text, integer, integer) to authenticated;
revoke all on function public.list_operational_licenses(text, text, public.facility_type, text, text, date, date, date, date, text, text, integer, integer) from anon, public;

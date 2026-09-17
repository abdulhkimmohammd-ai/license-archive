-- License Archive – Supabase Development only.
-- Dashboard read contract; no Production, MySQL, Cloudflare, DNS, Storage, or data copy.

create or replace function public.dashboard_operational(
  p_year integer default extract(year from current_date)::integer,
  p_month integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  v_actor uuid := private.assert_approved_role(array['admin', 'archivist']::public.app_role[]);
  v_period_start date;
  v_period_end date;
  v_result jsonb;
begin
  if p_year < 2000 or p_year > 2100 or (p_month is not null and (p_month < 1 or p_month > 12)) then
    raise exception 'Dashboard period is invalid' using errcode = '22023';
  end if;

  v_period_start := make_date(p_year, coalesce(p_month, 1), 1);
  v_period_end := case
    when p_month is null then make_date(p_year + 1, 1, 1)
    else (make_date(p_year, p_month, 1) + interval '1 month')::date
  end;

  select jsonb_build_object(
    'total', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.status <> 'archived' and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0),
    'active', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.status = 'active' and l.expiry_date >= current_date and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0),
    'expired', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.status in ('expired', 'suspended') and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0),
    'analytics', jsonb_build_object(
      'period', jsonb_build_object(
        'year', p_year,
        'month', p_month,
        'label', case when p_month is null then p_year::text else p_year::text || ' / ' || lpad(p_month::text, 2, '0') end
      ),
      'availableYears', coalesce((select jsonb_agg(year_value order by year_value) from (select distinct extract(year from l.issue_date)::integer as year_value from public.licenses l where l.deleted_at is null order by year_value) years), '[]'::jsonb),
      'total', jsonb_build_object(
        'total', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0),
        'active', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.status = 'active' and l.expiry_date >= current_date and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0),
        'expired', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.status in ('expired', 'suspended') and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0)
      ),
      'facilities', jsonb_build_object(
        'pharmacy', jsonb_build_object(
          'total', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.facility_type = 'pharmacy' and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0),
          'active', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.facility_type = 'pharmacy' and l.status = 'active' and l.expiry_date >= current_date and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0),
          'expired', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.facility_type = 'pharmacy' and l.status in ('expired', 'suspended') and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0)
        ),
        'warehouse', jsonb_build_object(
          'total', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.facility_type = 'warehouse' and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0),
          'active', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.facility_type = 'warehouse' and l.status = 'active' and l.expiry_date >= current_date and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0),
          'expired', coalesce((select count(*) from public.licenses l where l.deleted_at is null and l.facility_type = 'warehouse' and l.status in ('expired', 'suspended') and l.issue_date >= v_period_start and l.issue_date < v_period_end), 0)
        )
      ),
      'monthlySeries', coalesce((select jsonb_agg(jsonb_build_object('month', m.month_no, 'label', 'شهر ' || m.month_no, 'total', m.total, 'active', m.active, 'expired', m.expired) order by m.month_no) from (
        select months.month_no,
          (select count(*) from public.licenses l where l.deleted_at is null and l.issue_date >= make_date(p_year, months.month_no, 1) and l.issue_date < (make_date(p_year, months.month_no, 1) + interval '1 month')::date) as total,
          (select count(*) from public.licenses l where l.deleted_at is null and l.status = 'active' and l.expiry_date >= current_date and l.issue_date >= make_date(p_year, months.month_no, 1) and l.issue_date < (make_date(p_year, months.month_no, 1) + interval '1 month')::date) as active,
          (select count(*) from public.licenses l where l.deleted_at is null and l.status in ('expired', 'suspended') and l.issue_date >= make_date(p_year, months.month_no, 1) and l.issue_date < (make_date(p_year, months.month_no, 1) + interval '1 month')::date) as expired
        from generate_series(1, 12) as months(month_no)
      ) m), '[]'::jsonb),
      'activity', jsonb_build_object(
        'addedThisMonth', (select count(*) from public.licenses l where l.deleted_at is null and l.created_at >= date_trunc('month', current_date)),
        'addedPreviousMonth', (select count(*) from public.licenses l where l.deleted_at is null and l.created_at >= date_trunc('month', current_date - interval '1 month') and l.created_at < date_trunc('month', current_date)),
        'addedThisYear', (select count(*) from public.licenses l where l.deleted_at is null and l.created_at >= date_trunc('year', current_date)),
        'monthlyChange', (select count(*) from public.licenses l where l.deleted_at is null and l.created_at >= date_trunc('month', current_date)) - (select count(*) from public.licenses l where l.deleted_at is null and l.created_at >= date_trunc('month', current_date - interval '1 month') and l.created_at < date_trunc('month', current_date))
      ),
      'expiryWindows', jsonb_build_object(
        'days30', (select count(*) from public.licenses l where l.deleted_at is null and l.status <> 'archived' and l.expiry_date between current_date and current_date + 30),
        'days60', (select count(*) from public.licenses l where l.deleted_at is null and l.status <> 'archived' and l.expiry_date between current_date and current_date + 60),
        'days90', (select count(*) from public.licenses l where l.deleted_at is null and l.status <> 'archived' and l.expiry_date between current_date and current_date + 90)
      ),
      'governorates', coalesce((select jsonb_agg(jsonb_build_object('name', g.governorate, 'total', g.total) order by g.total desc, g.governorate) from (select l.governorate, count(*)::integer as total from public.licenses l where l.deleted_at is null and l.issue_date >= v_period_start and l.issue_date < v_period_end group by l.governorate) g), '[]'::jsonb)
    ),
    'alerts', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'facilityName', a.facility_name, 'licenseNo', a.license_no, 'facilityType', a.facility_type, 'effectiveStatus', case when a.expiry_date < current_date then 'expired' else 'active' end, 'daysRemaining', (a.expiry_date - current_date), 'expiryDate', a.expiry_date) order by a.expiry_date asc) from public.licenses a where a.deleted_at is null and a.status <> 'archived' and a.expiry_date <= current_date + 90), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.dashboard_operational(integer, integer) from public;
grant execute on function public.dashboard_operational(integer, integer) to authenticated;

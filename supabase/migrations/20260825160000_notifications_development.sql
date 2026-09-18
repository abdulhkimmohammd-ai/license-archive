-- Development-only notifications foundation. No Production, Storage, or external service.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  license_id uuid null references public.licenses(id) on delete set null,
  notification_type text not null check (notification_type in ('license_created','license_renewed','license_archived','archive_number_changed','system')),
  title text not null check (char_length(title) between 1 and 255),
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx on public.notifications(recipient_user_id, created_at desc);
create index if not exists notifications_license_idx on public.notifications(license_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (recipient_user_id = (select auth.uid()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_user_id = (select auth.uid())) with check (recipient_user_id = (select auth.uid()));

create or replace function public.list_my_notifications(p_limit integer default 50)
returns setof public.notifications
language sql stable security invoker
set search_path = public, pg_catalog
as $$
  select n.* from public.notifications n
  where n.recipient_user_id = (select auth.uid())
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.notifications
language plpgsql security invoker
set search_path = public, pg_catalog
as $$
  declare result public.notifications;
  begin
    update public.notifications n
      set read_at = coalesce(n.read_at, now())
      where n.id = p_notification_id and n.recipient_user_id = (select auth.uid())
      returning n.* into result;
    if result.id is null then raise exception 'notification_not_found'; end if;
    return result;
  end;
$$;

grant execute on function public.list_my_notifications(integer) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
revoke all on function public.list_my_notifications(integer) from anon, public;
revoke all on function public.mark_notification_read(uuid) from anon, public;

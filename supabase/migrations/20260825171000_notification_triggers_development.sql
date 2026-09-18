-- License Archive – Supabase Development only.
-- Notifications are in-app only; no email, webhook, Storage, or external AI service is called.

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in ('license_created', 'license_renewed', 'license_archived', 'archive_number_changed', 'team_invitation', 'system'));

create or replace function private.notify_license_event()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  v_title text;
  v_body text;
  v_type text;
  v_license public.licenses;
begin
  if new.event_type = 'issued' then
    v_type := 'license_created';
    v_title := 'تم إنشاء ترخيص جديد';
  elsif new.event_type = 'renewed' then
    v_type := 'license_renewed';
    v_title := 'تم تجديد ترخيص';
  elsif new.event_type = 'archive_number_changed' then
    v_type := 'archive_number_changed';
    v_title := 'تم تعديل رقم الأرشفة';
  elsif new.event_type = 'archived' then
    v_type := 'license_archived';
    v_title := 'تمت أرشفة ترخيص';
  else
    return new;
  end if;

  select * into v_license from public.licenses where id = new.license_id;
  if not found then return new; end if;
  v_body := format('المنشأة: %s — رقم الترخيص: %s — رقم الأرشفة: %s%s', v_license.facility_name, v_license.license_no, v_license.archive_number, case when nullif(trim(coalesce(new.note, '')), '') is null then '' else format(' — السبب: %s', trim(new.note)) end);

  insert into public.notifications (recipient_user_id, license_id, notification_type, title, body)
  select p.user_id, new.license_id, v_type, v_title, v_body
  from public.app_profiles p
  where p.access_status = 'approved';
  return new;
end;
$$;

create or replace function private.notify_team_invitation()
returns trigger
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
begin
  insert into public.notifications (recipient_user_id, notification_type, title, body)
  select p.user_id, 'team_invitation', 'دعوة جديدة إلى أرشيف التراخيص', format('تم إنشاء دعوة لدور %s. استخدم الرابط الآمن الذي سلّمه لك مدير النظام.', case when new.invited_role = 'archivist' then 'موظف الأرشيف' else 'مستخدم' end)
  from public.app_profiles p
  where lower(trim(coalesce(p.email, ''))) = lower(trim(new.invited_email))
    and p.access_status <> 'blocked';
  return new;
end;
$$;

drop trigger if exists license_event_notification_trigger on public.license_events;
create trigger license_event_notification_trigger
after insert on public.license_events
for each row execute function private.notify_license_event();

drop trigger if exists team_invitation_notification_trigger on public.team_invitations;
create trigger team_invitation_notification_trigger
after insert on public.team_invitations
for each row execute function private.notify_team_invitation();

revoke all on function private.notify_license_event() from anon, authenticated;
revoke all on function private.notify_team_invitation() from anon, authenticated;

-- Development-only verification. The outer transaction is always rolled back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

do $$
declare
  v_license_id uuid := '862eaaae-0931-4c92-b905-64d486e1f0a4';
  v_archive_number text;
begin
  select archive_number into v_archive_number from public.licenses where id = v_license_id;
  perform public.update_license_details(
    v_license_id,
    jsonb_build_object('holder_phone', '01000000000', 'notes', 'تحقق CRUD متراجع عنه')
  );
  if not exists (
    select 1 from public.licenses
    where id = v_license_id
      and archive_number = v_archive_number
      and holder_phone = '01000000000'
      and notes = 'تحقق CRUD متراجع عنه'
  ) then
    raise exception 'Development CRUD update did not preserve archive number and update allowed fields';
  end if;

  perform public.move_license_to_trash(v_license_id, 'نقل اختبار CRUD إلى السلة');
  if exists (select 1 from public.licenses where id = v_license_id) then
    raise exception 'Trashed license remained visible through the operational RLS policy';
  end if;
  perform public.restore_license_from_trash(v_license_id, 'استعادة اختبار CRUD من السلة');
  if not exists (select 1 from public.licenses where id = v_license_id and deleted_at is null) then
    raise exception 'Restored license was not visible through the operational RLS policy';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
  begin
    perform public.move_license_to_trash(v_license_id, 'محاولة مستخدم عادي يجب رفضها');
    raise exception 'Expected normal-user rejection was not raised';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

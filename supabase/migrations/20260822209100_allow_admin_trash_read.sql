-- Supabase Development only: administrators need read access to their own trash workflow.
drop policy if exists licenses_approved_staff_read on public.licenses;
create policy licenses_approved_staff_read on public.licenses for select to authenticated
  using (
    (
      deleted_at is null
      and (select private.is_approved_role(array['admin', 'archivist']::public.app_role[]))
    )
    or (
      deleted_at is not null
      and (select private.is_approved_role(array['admin']::public.app_role[]))
    )
  );

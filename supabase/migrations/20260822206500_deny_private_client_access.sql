-- Private state is reachable only from guarded SECURITY DEFINER functions.
create policy private_archive_sequences_no_client_access
on private.archive_sequences
as restrictive
for all to authenticated
using (false)
with check (false);

create policy private_idempotency_requests_no_client_access
on private.idempotency_requests
as restrictive
for all to authenticated
using (false)
with check (false);

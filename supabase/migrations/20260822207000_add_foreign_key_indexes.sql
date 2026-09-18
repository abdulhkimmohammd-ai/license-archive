create index idempotency_requests_actor_id_idx on private.idempotency_requests(actor_id);
create index idempotency_requests_license_id_idx on private.idempotency_requests(license_id);
create index archive_number_history_assigned_by_idx on public.archive_number_history(assigned_by);
create index license_events_performed_by_idx on public.license_events(performed_by);
create index licenses_archived_by_idx on public.licenses(archived_by);
create index licenses_created_by_idx on public.licenses(created_by);
create index licenses_updated_by_idx on public.licenses(updated_by);

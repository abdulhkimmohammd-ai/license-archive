-- Security hardening approved for Supabase Development only.
-- These private tables have no direct client grants; access remains limited to guarded SECURITY DEFINER RPC functions.
alter table private.archive_sequences enable row level security;
alter table private.idempotency_requests enable row level security;

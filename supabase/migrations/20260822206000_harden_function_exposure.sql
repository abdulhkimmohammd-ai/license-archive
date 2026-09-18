-- Auth trigger helper must never be callable through the public RPC API.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

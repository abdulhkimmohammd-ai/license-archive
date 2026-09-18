export interface WorkerEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ALLOWED_ORIGIN?: string;
}

const corsHeaders = (env: WorkerEnv): HeadersInit => ({
  "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});

const json = (env: WorkerEnv, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(env), "Content-Type": "application/json; charset=utf-8" },
});

const routeRpc = (pathname: string) => {
  const match = pathname.match(/^\/api\/licenses\/rpc\/([a-z0-9_]+)$/);
  return match?.[1] ?? null;
};

const allowedRpcs = new Set([
  "list_operational_licenses",
  "dashboard_operational",
  "list_team_members",
  "set_team_role",
  "create_team_invitation",
  "list_team_invitations",
  "accept_team_invitation",
  "reject_team_invitation",
  "revoke_team_invitation",
  "set_team_access_status",
  "list_my_notifications",
  "mark_notification_read",
  "create_operational_license_idempotent",
  "update_license_details",
  "renew_license",
  "change_archive_number",
  "archive_license",
  "move_license_to_trash",
  "restore_license_from_trash",
]);

const MAX_BODY_BYTES = 64 * 1024;

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env) });
    const rpc = routeRpc(new URL(request.url).pathname);
    if (!rpc || !allowedRpcs.has(rpc)) return json(env, { error: "العملية غير متاحة في Worker" }, 404);
    if (request.method !== "POST") return json(env, { error: "يجب استخدام POST" }, 405);
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json(env, { error: "إعداد Supabase Worker غير مكتمل" }, 503);

    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json(env, { error: "جلسة Supabase مطلوبة" }, 401);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) return json(env, { error: "حمولة الطلب أكبر من الحد المسموح" }, 413);
    let payload: unknown;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json(env, { error: "حمولة الطلب أكبر من الحد المسموح" }, 413);
      payload = JSON.parse(raw);
    } catch {
      return json(env, { error: "حمولة JSON غير صالحة" }, 400);
    }

    let upstream: Response;
    try {
      upstream = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        apikey: env.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
        body: JSON.stringify(payload),
      });
    } catch {
      return json(env, { error: "تعذر الاتصال بـ Supabase" }, 502);
    }
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { ...corsHeaders(env), "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  },
};

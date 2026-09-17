import { createClient } from "@supabase/supabase-js";

export const DEVELOPMENT_PROJECT_REF = "qduofealtaikxhhrjxly";

function getDevelopmentConfig() {
  const url = process.env.SUPABASE_DEVELOPMENT_URL;
  const key = process.env.SUPABASE_DEVELOPMENT_KEY;

  if (!url || !key) {
    throw new Error("تعذر تحميل إعدادات Supabase Development");
  }

  const hostname = new URL(url).hostname;
  if (hostname !== `${DEVELOPMENT_PROJECT_REF}.supabase.co`) {
    throw new Error("تم حظر اتصال Supabase غير تابع لمشروع Development المعتمد");
  }

  return { url, key };
}

export function createSupabaseDevelopmentAdminClient() {
  const { url, key } = getDevelopmentConfig();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function createSupabaseDevelopmentUserClient(accessToken: string) {
  const { url, key } = getDevelopmentConfig();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function assertSupabaseDevelopmentTarget() {
  return getDevelopmentConfig().url;
}

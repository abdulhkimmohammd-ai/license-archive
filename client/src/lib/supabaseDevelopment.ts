import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_DEVELOPMENT_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY as string | undefined;

export const supabaseDevelopmentEnabled = Boolean(url && publishableKey);

export const supabaseDevelopment = supabaseDevelopmentEnabled
  ? createClient(url!, publishableKey!, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    })
  : null;

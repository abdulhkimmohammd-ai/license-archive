import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { createSupabaseDevelopmentAdminClient, createSupabaseDevelopmentUserClient, DEVELOPMENT_PROJECT_REF } from "./supabaseDevelopment";

let temporaryUserId: string | undefined;

afterEach(async () => {
  if (!temporaryUserId) return;
  const { error } = await createSupabaseDevelopmentAdminClient().auth.admin.deleteUser(temporaryUserId);
  expect(error).toBeNull();
  temporaryUserId = undefined;
});

describe("Supabase Development safe authentication round trip", () => {
  it("authenticates a disposable synthetic user and applies its RLS identity", async () => {
    const email = `license-archive-development-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa1!`;
    const admin = createSupabaseDevelopmentAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "اختبار آمن مؤقت" },
    });
    expect(createError).toBeNull();
    expect(created.user?.id).toBeTruthy();
    temporaryUserId = created.user?.id;

    const url = process.env.VITE_SUPABASE_DEVELOPMENT_URL!;
    const publishableKey = process.env.VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY!;
    expect(new URL(url).hostname).toBe(`${DEVELOPMENT_PROJECT_REF}.supabase.co`);
    const browserClient = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data: signedIn, error: signInError } = await browserClient.auth.signInWithPassword({ email, password });
    expect(signInError).toBeNull();
    expect(signedIn.session?.access_token).toBeTruthy();

    const userClient = createSupabaseDevelopmentUserClient(signedIn.session!.access_token);
    const { data: profile, error: profileError } = await userClient
      .from("app_profiles")
      .select("user_id, role, access_status")
      .eq("user_id", temporaryUserId!)
      .maybeSingle();

    expect(profileError).toBeNull();
    expect(profile?.user_id).toBe(temporaryUserId);
    expect(profile?.access_status).toBe("pending");
  });
});

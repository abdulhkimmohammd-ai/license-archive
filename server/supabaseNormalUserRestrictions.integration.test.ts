import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createSupabaseDevelopmentAdminClient, createSupabaseDevelopmentUserClient } from "./supabaseDevelopment";

let userIdToBlock: string | undefined;

afterEach(async () => {
  if (!userIdToBlock) return;
  const { error } = await createSupabaseDevelopmentAdminClient().from("app_profiles")
    .update({ access_status: "blocked" })
    .eq("user_id", userIdToBlock);
  expect(error).toBeNull();
  userIdToBlock = undefined;
});

describe("Supabase Development normal-user restrictions", () => {
  it("denies normal users direct table writes and protected archive-number changes", async () => {
    const email = `license-archive-normal-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa1!`;
    const admin = createSupabaseDevelopmentAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(createError).toBeNull();
    userIdToBlock = created.user!.id;
    const { error: approveError } = await admin.from("app_profiles")
      .update({ role: "user", access_status: "approved", display_name: "مستخدم اختبار الحماية" })
      .eq("user_id", userIdToBlock);
    expect(approveError).toBeNull();

    const browserClient = createClient(
      process.env.VITE_SUPABASE_DEVELOPMENT_URL!,
      process.env.VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
    );
    const { data: signedIn, error: signInError } = await browserClient.auth.signInWithPassword({ email, password });
    expect(signInError).toBeNull();
    const accessToken = signedIn.session!.access_token;
    const userClient = createSupabaseDevelopmentUserClient(accessToken);
    const { data: readableRows, error: readError } = await userClient.from("licenses").select("id").limit(1);
    expect(readError).toBeNull();
    expect(readableRows).toEqual([]);

    const { error: insertError } = await userClient.from("licenses").insert({
      license_no: `FORBIDDEN-${randomUUID()}`,
      facility_name: "محاولة غير مصرح بها",
      facility_type: "pharmacy",
      holder_name: "مستخدم عادي",
      holder_national_id: "forbidden",
      governorate: "صنعاء",
      issue_date: "2026-08-01",
      expiry_date: "2028-08-01",
    });
    expect(insertError?.code).toBe("42501");

    const { data: target } = await admin.from("licenses").select("id").limit(1).single();
    const caller = appRouter.createCaller({ user: null, req: {} as never, res: {} as never });
    await expect(caller.supabaseLicenses.operationalCreate({
      accessToken,
      licenseNo: `FORBIDDEN-${randomUUID()}`,
      facilityName: "محاولة إنشاء غير مصرح بها",
      facilityType: "pharmacy",
      holderName: "مستخدم عادي",
      holderNationalId: "forbidden",
      governorate: "صنعاء",
      issueDate: new Date("2026-08-01T00:00:00.000Z"),
      expiryDate: new Date("2028-08-01T00:00:00.000Z"),
      idempotencyKey: randomUUID(),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.supabaseLicenses.operationalList({ accessToken, page: 1, pageSize: 20 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.supabaseLicenses.changeArchiveNumber({
      accessToken,
      id: target!.id,
      archiveNumber: "9999-9999ص",
      reason: "محاولة مستخدم عادي يجب رفضها",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.supabaseTeam.list({ accessToken })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.supabaseTeam.setRole({ accessToken, userId: userIdToBlock, role: "archivist" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  }, 15_000);
});

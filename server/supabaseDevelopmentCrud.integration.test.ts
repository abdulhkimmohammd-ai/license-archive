import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { createSupabaseDevelopmentAdminClient, createSupabaseDevelopmentUserClient } from "./supabaseDevelopment";
import { buildSupabaseQrPayload, parseSupabaseQrPayload } from "../client/src/lib/supabaseQr";

const createdUserIds: string[] = [];

afterEach(async () => {
  const admin = createSupabaseDevelopmentAdminClient();
  for (const userId of createdUserIds.splice(0)) {
    await admin.from("app_profiles").update({ access_status: "blocked" }).eq("user_id", userId);
  }
});

describe("Supabase Development CRUD bridge", () => {
  it("runs a safe admin workflow through JWT, RLS, RPC, audit, archive, and trash handling", async () => {
    const suffix = String(randomInt(1000, 9999));
    const email = `license-archive-crud-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa1!`;
    const admin = createSupabaseDevelopmentAdminClient();
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(createUserError).toBeNull();
    const userId = createdUser.user!.id;
    createdUserIds.push(userId);

    const { error: approveError } = await admin.from("app_profiles")
      .update({ role: "admin", access_status: "approved", display_name: "مدير اختبار CRUD" })
      .eq("user_id", userId);
    expect(approveError).toBeNull();

    const browserClient = createClient(
      process.env.VITE_SUPABASE_DEVELOPMENT_URL!,
      process.env.VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
    );
    const { data: signedIn, error: signInError } = await browserClient.auth.signInWithPassword({ email, password });
    expect(signInError).toBeNull();
    const accessToken = signedIn.session!.access_token;

    const caller = appRouter.createCaller({ user: null, req: {} as never, res: {} as never });
    const queuedCreate = {
      accessToken,
      licenseNo: `LAB-${suffix}`,
      facilityName: `صيدلية اختبار ${suffix}`,
      facilityType: "pharmacy",
      holderName: "مالك اختبار آمن",
      holderNationalId: `ID-${suffix}`,
      governorate: "صنعاء",
      issueDate: new Date("2026-08-01T00:00:00.000Z"),
      expiryDate: new Date("2028-08-01T00:00:00.000Z"),
      idempotencyKey: randomUUID(),
    };
    // Offline simulation: no request is issued while the item is queued locally.
    const created = await caller.supabaseLicenses.operationalCreate({
      ...queuedCreate,
      graduationPlace: "صنعاء",
      graduationInstitutionType: "university",
      graduationDate: new Date("2020-08-01T00:00:00.000Z"),
      licenseDeliveryRecipientName: "مستلم اختبار",
    });
    // Online retry with the identical key/payload must return the original record.
    const retriedCreate = await caller.supabaseLicenses.operationalCreate({
      ...queuedCreate,
      graduationPlace: "صنعاء",
      graduationInstitutionType: "university",
      graduationDate: new Date("2020-08-01T00:00:00.000Z"),
      licenseDeliveryRecipientName: "مستلم اختبار",
    });
    expect(created?.archive_number).toMatch(new RegExp(`^${suffix}-\\d{4}ص$`));
    expect(retriedCreate?.license_id).toBe(created?.license_id);
    const qr = parseSupabaseQrPayload(buildSupabaseQrPayload({ id: created!.license_id, licenseNo: queuedCreate.licenseNo, archiveNumber: created!.archive_number }));
    expect(qr).toEqual({ version: 1, kind: "license", id: created!.license_id, licenseNo: queuedCreate.licenseNo, archiveNumber: created!.archive_number });

    const licenseId = created!.license_id;
    const listed = await caller.supabaseLicenses.list({ accessToken, search: `LAB-${suffix}` });
    expect(listed.some((item) => item.id === licenseId)).toBe(true);

    const operationalList = await caller.supabaseLicenses.operationalList({
      accessToken,
      search: `LAB-${suffix}`,
      searchScope: "all",
      facilityType: "pharmacy",
      status: "active",
      archiveDateFrom: new Date(),
      archiveDateTo: new Date(),
      page: 1,
      pageSize: 20,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
    expect(operationalList.pagination.total).toBeGreaterThanOrEqual(1);
    expect(operationalList.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: licenseId, archiveNumber: created!.archive_number, effectiveStatus: "active" }),
    ]));

    const dashboard = await caller.supabaseLicenses.dashboard({ accessToken, year: 2026, month: null });
    expect(dashboard).toMatchObject({ total: expect.any(Number), active: expect.any(Number), expired: expect.any(Number) });
    expect(dashboard.analytics).toMatchObject({ facilities: expect.any(Object), monthlySeries: expect.any(Array), expiryWindows: expect.any(Object) });
    expect(Array.isArray(dashboard.alerts)).toBe(true);

    await caller.supabaseLicenses.update({ accessToken, id: licenseId, payload: { facilityName: `صيدلية محدثة ${suffix}`, graduationPlace: "عدن" } });
    const updated = await caller.supabaseLicenses.getById({ accessToken, id: licenseId });
    expect(updated.facility_name).toBe(`صيدلية محدثة ${suffix}`);
    expect(updated.graduation_place).toBe("عدن");
    expect(updated.archive_number).toBe(created!.archive_number);
    const events = await caller.supabaseLicenses.events({ accessToken, id: licenseId });
    expect(events.some((event) => event.event_type === "updated")).toBe(true);
    const auditLog = await caller.supabaseLicenses.auditLog({ accessToken, id: licenseId });
    expect(auditLog.some((entry) => entry.action === "UPDATE_LICENSE")).toBe(true);

    await caller.supabaseLicenses.moveToTrash({ accessToken, id: licenseId, reason: "نقل اختبار آمن إلى السلة" });
    const hiddenAfterTrash = await caller.supabaseLicenses.list({ accessToken, search: `LAB-${suffix}` });
    expect(hiddenAfterTrash.some((item) => item.id === licenseId)).toBe(false);
    const trashRows = await caller.supabaseLicenses.trashList({ accessToken });
    expect(trashRows.some((item) => item.id === licenseId)).toBe(true);
    await caller.supabaseLicenses.restoreFromTrash({ accessToken, id: licenseId, reason: "استعادة اختبار آمن من السلة" });
    const visibleAfterRestore = await caller.supabaseLicenses.list({ accessToken, search: `LAB-${suffix}` });
    expect(visibleAfterRestore.some((item) => item.id === licenseId)).toBe(true);

    await caller.supabaseLicenses.archive({ accessToken, id: licenseId, reason: "أرشفة اختبار آمنة موثقة" });
    await expect(caller.supabaseLicenses.renew({
      accessToken,
      id: licenseId,
      issueDate: new Date("2026-09-01T00:00:00.000Z"),
      expiryDate: new Date("2028-09-01T00:00:00.000Z"),
      reason: "تجديد سجل مؤرشف يجب رفضه",
    })).rejects.toMatchObject({ code: "CONFLICT" });

    const userClient = createSupabaseDevelopmentUserClient(accessToken);
    const { data: audits, error: auditError } = await userClient.from("audit_logs").select("action").eq("entity_id", licenseId).limit(10);
    expect(auditError).toBeNull();
    expect(audits?.map((entry) => entry.action)).toEqual(expect.arrayContaining([
      "CREATE_LICENSE", "UPDATE_LICENSE", "MOVE_LICENSE_TO_TRASH", "RESTORE_LICENSE_FROM_TRASH", "ARCHIVE_LICENSE",
    ]));
  }, 20_000);
});

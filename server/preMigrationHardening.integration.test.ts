import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, count, eq, inArray } from "drizzle-orm";
import { archiveNumberHistory, auditLogs, licenseEvents, licenses } from "../drizzle/schema";
import { getDb } from "../server/db";
import { licenseRouter } from "../server/routers/licenses";
import { buildLicenseCreateInput, type LicenseFormValues } from "../client/src/lib/licenseSubmission";
import { getQueuedLicenses, queueLicenseForSync, removeQueuedLicense, setQueuedLicenseError } from "../client/src/lib/offlineLicenses";

const runStamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const adminContext = {
  user: { id: 1, openId: "hardening-integration-admin", name: "مدير اختبار", email: "admin@example.test", loginMethod: "test", role: "admin" as const, accessStatus: "approved" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { headers: {} }, res: {},
} as any;
const userContext = { ...adminContext, user: { ...adminContext.user, id: 2, openId: "hardening-integration-user", role: "user" as const } } as any;

function makeForm(licenseNo: string): LicenseFormValues {
  return {
    licenseNo, facilityName: `منشأة اختبار ${licenseNo}`, facilityType: "pharmacy", issueDate: "2026-08-22", expiryDate: "", healthOfficeIssueDate: "", healthOfficeDirectorName: "", healthOfficeDirectorGovernorate: "",
    holderName: "صاحب بيانات اختبار", holderNationalId: `ID-${licenseNo}`, holderPhone: "", nationalIdIssuedBy: "", nationalIdIssueGovernorate: "", nationalIdIssueDate: "",
    birthPlace: "", birthGovernorate: "", birthDate: "", qualificationLevel: "bachelor", graduationInstitutionType: "university", graduationCountry: "", graduationInstitute: "", graduationDate: "",
    professionalLicenseNo: "", professionalLicenseIssueDate: "", previousLicenseNo: "", previousLicenseIssuedBy: "", previousLicenseIssueDate: "",
    siteInspectionFormNo: "", siteInspectionFormDate: "", committeeMinutesNo: "", committeeMinutesDate: "", feeReceiptNo: "", feeReceiptDate: "",
    governorate: "صنعاء", address: "", street: "", area: "", district: "", propertyOwnerName: "", archiveDate: "", archiveOfficerName: "", licenseDeliveryDate: "", notes: "",
  };
}

describe("PRE-MIGRATION hardening integration", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("يرسل Offline→Online مرة واحدة ثم يصالح انقطاع الرد بإعادة المحاولة بنفس المفتاح", async () => {
    const admin = licenseRouter.createCaller(adminContext);
    const form = makeForm(`OFF-${runStamp}-6543`);
    const queued = queueLicenseForSync(adminContext.user.id, form);
    expect(queued?.queued).toBe(true);
    const restoredAfterReload = getQueuedLicenses(adminContext.user.id);
    expect(restoredAfterReload).toHaveLength(1);
    const first = await admin.create(buildLicenseCreateInput(restoredAfterReload[0]!.form, restoredAfterReload[0]!.idempotencyKey));
    setQueuedLicenseError(adminContext.user.id, queued!.item.id, "انقطع الرد بعد حفظ الخادم");
    const resumedAfterFailure = getQueuedLicenses(adminContext.user.id);
    vi.resetModules();
    const { licenseRouter: reinitializedRouter } = await import("../server/routers/licenses");
    const reinitializedCaller = reinitializedRouter.createCaller({ ...adminContext, req: { headers: {} }, res: {} } as any);
    const replay = await reinitializedCaller.create(buildLicenseCreateInput(resumedAfterFailure[0]!.form, resumedAfterFailure[0]!.idempotencyKey));
    expect(replay).toMatchObject({ id: first.id, idempotent: true });
    await expect(admin.create(buildLicenseCreateInput(makeForm(`CONFLICT-${runStamp}-6543`), queued!.item.idempotencyKey))).rejects.toMatchObject({ code: "CONFLICT" });
    removeQueuedLicense(adminContext.user.id, queued!.item.id);
    expect(getQueuedLicenses(adminContext.user.id)).toEqual([]);
    const db = await getDb();
    const rows = await db!.select({ total: count() }).from(licenses).where(eq(licenses.licenseNo, form.licenseNo));
    expect(Number(rows[0]?.total)).toBe(1);
  });

  it("يؤرشف المدير فقط مع سبب وسجل حدث وسجل تدقيق", async () => {
    const admin = licenseRouter.createCaller(adminContext);
    const user = licenseRouter.createCaller(userContext);
    const form = makeForm(`ARCHIVE-${runStamp}-8765`);
    form.facilityType = "warehouse";
    form.qualificationLevel = "diploma";
    form.graduationInstitutionType = "institute";
    form.expiryDate = "2028-08-22";
    const created = await admin.create(buildLicenseCreateInput(form, `archive-${runStamp}-000000000000000`));
    await expect(user.archive({ id: created.id, reason: "محاولة مستخدم عادي" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.archive({ id: created.id, reason: "قصير" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await admin.archive({ id: created.id, reason: "أرشفة اختبار تكاملي موثقة" });
    const db = await getDb();
    const [license] = await db!.select().from(licenses).where(eq(licenses.id, created.id)).limit(1);
    const [event] = await db!.select().from(licenseEvents).where(and(eq(licenseEvents.licenseId, created.id), eq(licenseEvents.eventType, "archived"))).limit(1);
    const [audit] = await db!.select().from(auditLogs).where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, "ARCHIVE_LICENSE"))).limit(1);
    expect(license?.status).toBe("archived");
    expect(event?.note).toContain("أرشفة اختبار");
    expect(audit).toBeTruthy();
  });

  it("يحجز أرقاماً فريدة تحت طلبات متوازية ويثبت مسار تعديل المدير وسجلاته", async () => {
    const admin = licenseRouter.createCaller(adminContext);
    const user = licenseRouter.createCaller(userContext);
    const created = await Promise.all(Array.from({ length: 8 }, (_, index) => {
      const licenseNo = `CON-${runStamp}-${index}-6543`;
      return admin.create(buildLicenseCreateInput(makeForm(licenseNo), `con-${runStamp}-${index}-000000000000000`));
    }));
    const ids = created.map(item => item.id);
    const db = await getDb();
    const rows = await db!.select({ id: licenses.id, archiveNumber: licenses.archiveNumber }).from(licenses).where(inArray(licenses.id, ids));
    const numbers = rows.map(row => row.archiveNumber);
    expect(numbers).toHaveLength(8);
    expect(new Set(numbers).size).toBe(8);
    expect(numbers.every(number => /^6543-\d{4}ص$/.test(number))).toBe(true);

    const first = rows[0]!;
    const second = rows[1]!;
    const historicalRows = await db!.select({ archiveNumber: archiveNumberHistory.archiveNumber })
      .from(archiveNumberHistory)
      .where(eq(archiveNumberHistory.facilityType, "pharmacy"));
    const usedNumbers = new Set([...numbers, ...historicalRows.map(row => row.archiveNumber)]);
    const customSequence = Array.from({ length: 9999 }, (_, index) => index + 1)
      .find(sequence => !usedNumbers.has(`6543-${sequence.toString().padStart(4, "0")}ص`));
    expect(customSequence).toBeDefined();
    const customArchiveNumber = `6543-${customSequence!.toString().padStart(4, "0")}ص`;
    await expect(user.changeArchiveNumber({ id: first.id, archiveNumber: customArchiveNumber, reason: "محاولة مستخدم عادي" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.changeArchiveNumber({ id: first.id, archiveNumber: customArchiveNumber, reason: "قصير" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await admin.changeArchiveNumber({ id: first.id, archiveNumber: customArchiveNumber, reason: "تصحيح إداري موثق في اختبار التكامل" });
    const [history] = await db!.select().from(archiveNumberHistory).where(and(eq(archiveNumberHistory.licenseId, first.id), eq(archiveNumberHistory.archiveNumber, customArchiveNumber))).limit(1);
    const [audit] = await db!.select().from(auditLogs).where(and(eq(auditLogs.entityId, first.id), eq(auditLogs.action, "CHANGE_ARCHIVE_NUMBER"))).limit(1);
    expect(history?.changeReason).toContain("تصحيح إداري");
    expect(audit).toBeTruthy();
    await expect(admin.changeArchiveNumber({ id: second.id, archiveNumber: first.archiveNumber, reason: "محاولة إعادة استخدام رقم تاريخي" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

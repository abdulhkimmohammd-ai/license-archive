import { and, eq } from "drizzle-orm";
import { archiveNumberHistory, auditLogs, licenses } from "../drizzle/schema";
import { getDb } from "../server/db";
import { licenseRouter } from "../server/routers/licenses";

const timestamp = Date.now().toString(36).toUpperCase();
const adminContext = {
  user: {
    id: 1,
    openId: "migration-lab-admin",
    name: "مدير مختبر النقل",
    email: "migration-lab@example.test",
    loginMethod: "test",
    role: "admin" as const,
    accessStatus: "approved" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { headers: {} },
  res: {},
} as any;

const standardUserContext = {
  ...adminContext,
  user: { ...adminContext.user, id: 2, openId: "migration-lab-user", role: "user" as const },
} as any;

function payload(licenseNo: string, facilityType: "pharmacy" | "warehouse", idempotencyKey: string) {
  return {
    licenseNo,
    facilityName: `منشأة اختبار نقل ${licenseNo}`,
    facilityType,
    holderName: "صاحب بيانات اختبار",
    holderNationalId: `TEST-${licenseNo}`,
    governorate: "صنعاء",
    issueDate: new Date("2026-08-22T00:00:00.000Z"),
    expiryDate: facilityType === "warehouse" ? new Date("2028-08-22T00:00:00.000Z") : undefined,
    idempotencyKey,
  };
}

async function readArchiveNumber(id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات المختبر غير متاحة");
  const rows = await db.select({ archiveNumber: licenses.archiveNumber }).from(licenses).where(eq(licenses.id, id)).limit(1);
  if (!rows[0]) throw new Error("تعذر العثور على سجل الاختبار");
  return rows[0].archiveNumber;
}

async function readArchiveChangeTrace(id: number, archiveNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة بيانات المختبر غير متاحة");
  const [history] = await db.select().from(archiveNumberHistory)
    .where(and(eq(archiveNumberHistory.licenseId, id), eq(archiveNumberHistory.archiveNumber, archiveNumber))).limit(1);
  const [audit] = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "CHANGE_ARCHIVE_NUMBER"))).limit(1);
  return { history: Boolean(history), audit: Boolean(audit) };
}

async function main() {
  const admin = licenseRouter.createCaller(adminContext);
  const user = licenseRouter.createCaller(standardUserContext);

  const [pharmacyA, pharmacyB] = await Promise.all([
    admin.create(payload(`PH-A-${timestamp}-6543`, "pharmacy", `ph-a-${timestamp}-000000000000000000`)),
    admin.create(payload(`PH-B-${timestamp}-6543`, "pharmacy", `ph-b-${timestamp}-000000000000000000`)),
  ]);
  const pharmacyARetry = await admin.create(payload(`PH-A-${timestamp}-6543`, "pharmacy", `ph-a-${timestamp}-000000000000000000`));
  const warehouseA = await admin.create(payload(`WH-A-${timestamp}-8765`, "warehouse", `wh-a-${timestamp}-000000000000000000`));
  const warehouseB = await admin.create(payload(`WH-B-${timestamp}-8765`, "warehouse", `wh-b-${timestamp}-000000000000000000`));
  const concurrentPharmacyArchivesBeforeChange = [await readArchiveNumber(pharmacyA.id), await readArchiveNumber(pharmacyB.id)].sort();
  const warehouseArchivesBeforeChange = [await readArchiveNumber(warehouseA.id), await readArchiveNumber(warehouseB.id)].sort();

  const beforeRenewal = await readArchiveNumber(pharmacyA.id);
  await admin.renew({ id: pharmacyA.id, issueDate: new Date("2026-09-01T00:00:00.000Z"), reason: "تجديد اختبار مختبر النقل" });
  const afterRenewal = await readArchiveNumber(pharmacyA.id);
  if (beforeRenewal !== afterRenewal) throw new Error("التجديد غيّر رقم الأرشفة");
  const archiveSequence = Number(/^\d{4}-(\d{4})ص$/.exec(beforeRenewal)?.[1]);
  const administratorArchiveNumber = `6543-${(archiveSequence + 10).toString().padStart(4, "0")}ص`;

  let normalUserRejected = false;
  try {
    await user.changeArchiveNumber({ id: pharmacyA.id, archiveNumber: "6543-0003ص", reason: "محاولة مستخدم عادي" });
  } catch (error: any) {
    normalUserRejected = error?.code === "FORBIDDEN";
  }
  if (!normalUserRejected) throw new Error("لم يُرفض تعديل رقم الأرشفة للمستخدم العادي");

  await admin.changeArchiveNumber({ id: pharmacyA.id, archiveNumber: administratorArchiveNumber, reason: "اختبار تعديل إداري لرقم الأرشفة" });
  const changedArchiveNumber = await readArchiveNumber(pharmacyA.id);
  if (changedArchiveNumber !== administratorArchiveNumber) throw new Error("لم يكتمل تعديل المدير لرقم الأرشفة");
  const archiveChangeTrace = await readArchiveChangeTrace(pharmacyA.id, administratorArchiveNumber);
  if (!archiveChangeTrace.history || !archiveChangeTrace.audit) throw new Error("لم يكتمل سجل التاريخ أو التدقيق لتعديل رقم الأرشفة");

  let historicalArchiveReuseRejected = false;
  try {
    await admin.changeArchiveNumber({ id: pharmacyB.id, archiveNumber: beforeRenewal, reason: "محاولة إعادة استخدام رقم تاريخي" });
  } catch (error: any) {
    historicalArchiveReuseRejected = error?.code === "CONFLICT";
  }
  if (!historicalArchiveReuseRejected) throw new Error("لم تُرفض إعادة استخدام رقم أرشفة تاريخي");

  const output = {
    testDataOnly: true,
    concurrentPharmacyArchivesBeforeChange,
    warehouseArchivesBeforeChange,
    idempotentRetryReturnedSameId: pharmacyA.id === pharmacyARetry.id && pharmacyARetry.idempotent,
    renewalPreservedArchiveNumber: beforeRenewal === afterRenewal,
    normalUserRejected,
    administratorArchiveChange: changedArchiveNumber,
    administratorArchiveChangeTrace: archiveChangeTrace,
    historicalArchiveReuseRejected,
  };
  console.log(JSON.stringify(output, null, 2));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});

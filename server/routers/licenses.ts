import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, gte, isNotNull, isNull, like, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  archiveNumberHistory,
  archiveSequences,
  auditLogs,
  documentTypeValues,
  documents,
  facilityTypeValues,
  graduationInstitutionTypeValues,
  idempotencyRequests,
  licenses,
  qualificationLevelValues,
  licenseEvents,
  licenseStatusValues,
  notifications,
  users,
} from "../../drizzle/schema";
import { getDb, getLicenseById, getLicenseDocuments, writeAuditLog } from "../db";
import { buildDashboardAnalytics } from "../dashboardAnalytics";
import { getDaysRemaining, getEffectiveStatus, getTwoYearExpiryDate } from "../licenseStatus";
import { canManageLicenses, isSystemAdmin } from "../accessControl";
import { storageGetSignedUrl, storagePut } from "../storage";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getMinistryPdfAssetKey, ministryPdfAssetKeys } from "../../shared/ministryPdfAssets";
import { normalizeLicenseNumber } from "../../shared/licenseNumber";
import {
  archiveTypeSuffix,
  buildArchiveNumber,
  getArchiveSequence,
  isArchiveNumberForLicense,
  lastFourLicenseDigits,
  type ArchiveFacilityType,
} from "../../shared/archiveNumber";

export { archiveTypeSuffix, buildArchiveNumber, getArchiveSequence, lastFourLicenseDigits } from "../../shared/archiveNumber";

const permittedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const archiveSearchScopeValues = ["all", "facility", "owner"] as const;
export type ArchiveSearchScope = (typeof archiveSearchScopeValues)[number];
export const archiveEffectiveStatusValues = ["active", "expired"] as const;
export type ArchiveEffectiveStatus = (typeof archiveEffectiveStatusValues)[number];
export const ARCHIVE_PAGE_SIZE = 12;

export function getArchivePagination(total: number, requestedPage = 1, pageSize = ARCHIVE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  return {
    page,
    pageSize,
    total,
    totalPages,
    offset: (page - 1) * pageSize,
  };
}

export function getArchiveDateRange(archiveDateFrom?: Date, archiveDateTo?: Date) {
  const start = archiveDateFrom ? new Date(Date.UTC(archiveDateFrom.getUTCFullYear(), archiveDateFrom.getUTCMonth(), archiveDateFrom.getUTCDate())) : undefined;
  const endExclusive = archiveDateTo ? new Date(Date.UTC(archiveDateTo.getUTCFullYear(), archiveDateTo.getUTCMonth(), archiveDateTo.getUTCDate() + 1)) : undefined;
  return { start, endExclusive };
}

export function buildLicenseSearchCondition(search: string, scope: ArchiveSearchScope = "all") {
  const query = `%${search}%`;
  if (scope === "facility") return like(licenses.facilityName, query);
  if (scope === "owner") return like(licenses.holderName, query);
  return or(
    like(licenses.licenseNo, query),
    like(licenses.archiveNumber, query),
    like(licenses.facilityName, query),
    like(licenses.holderName, query),
  );
}

const archiveFilterInput = z.object({
  search: z.string().trim().max(100).optional(),
  searchScope: z.enum(archiveSearchScopeValues).optional(),
  facilityType: z.enum(facilityTypeValues).optional(),
  status: z.enum(archiveEffectiveStatusValues).optional(),
  archiveDateFrom: z.coerce.date().optional(),
  archiveDateTo: z.coerce.date().optional(),
}).superRefine((input, context) => {
  if (input.archiveDateFrom && input.archiveDateTo && input.archiveDateFrom > input.archiveDateTo) {
    context.addIssue({ code: "custom", path: ["archiveDateTo"], message: "يجب أن يكون تاريخ النهاية مساوياً أو لاحقاً لتاريخ البداية" });
  }
});

export const licenseListFilterInput = z.object({
  search: z.string().trim().max(100).optional(),
  searchScope: z.enum(archiveSearchScopeValues).optional(),
  facilityType: z.enum(facilityTypeValues).optional(),
  status: z.enum(["active", "expired", "suspended", "archived"]).optional(),
  governorate: z.string().trim().max(120).optional(),
  issueDateFrom: z.coerce.date().optional(),
  issueDateTo: z.coerce.date().optional(),
}).superRefine((input, context) => {
  if (input.issueDateFrom && input.issueDateTo && input.issueDateFrom > input.issueDateTo) {
    context.addIssue({ code: "custom", path: ["issueDateTo"], message: "يجب أن يكون تاريخ نهاية الإصدار مساوياً أو لاحقاً لتاريخ البداية" });
  }
});

export function buildLicenseListFilterConditions(input: z.infer<typeof licenseListFilterInput>) {
  const conditions = [isNull(licenses.deletedAt)] as Parameters<typeof and>;
  if (input.search) conditions.push(buildLicenseSearchCondition(input.search, input.searchScope));
  if (input.facilityType) conditions.push(eq(licenses.facilityType, input.facilityType));
  if (input.governorate) conditions.push(eq(licenses.governorate, input.governorate));
  if (input.status === "active") conditions.push(and(eq(licenses.status, "active"), gte(licenses.expiryDate, new Date())));
  if (input.status === "expired") conditions.push(or(lt(licenses.expiryDate, new Date()), eq(licenses.status, "suspended"), eq(licenses.status, "archived")));
  if (input.status === "suspended" || input.status === "archived") conditions.push(eq(licenses.status, input.status));
  const { start, endExclusive } = getArchiveDateRange(input.issueDateFrom, input.issueDateTo);
  if (start) conditions.push(gte(licenses.issueDate, start));
  if (endExclusive) conditions.push(lt(licenses.issueDate, endExclusive));
  return conditions;
}

export function buildArchiveFilterConditions(input: z.infer<typeof archiveFilterInput>) {
  const conditions = [] as Parameters<typeof and>;
  conditions.push(isNull(licenses.deletedAt));
  if (input.search) conditions.push(buildLicenseSearchCondition(input.search, input.searchScope));
  if (input.facilityType) conditions.push(eq(licenses.facilityType, input.facilityType));
  if (input.status === "active") conditions.push(and(eq(licenses.status, "active"), gte(licenses.expiryDate, new Date())));
  if (input.status === "expired") conditions.push(or(lt(licenses.expiryDate, new Date()), eq(licenses.status, "suspended"), eq(licenses.status, "archived")));
  const { start, endExclusive } = getArchiveDateRange(input.archiveDateFrom, input.archiveDateTo);
  if (start) conditions.push(gte(licenses.archiveDate, start));
  if (endExclusive) conditions.push(lt(licenses.archiveDate, endExclusive));
  return conditions;
}

export function getNextArchiveSequence(archiveNumbers: string[], facilityType: (typeof facilityTypeValues)[number]) {
  return Math.max(0, ...archiveNumbers.map((archiveNumber) => getArchiveSequence(archiveNumber, facilityType))) + 1;
}

function archiveFacilityType(facilityType: (typeof facilityTypeValues)[number]): ArchiveFacilityType {
  return facilityType === "pharmacy" ? "pharmacy" : "warehouse";
}

async function reserveNextArchiveSequence(tx: any, facilityType: ArchiveFacilityType) {
  await tx.insert(archiveSequences).values({ facilityType, currentValue: 1 }).onDuplicateKeyUpdate({
    set: { currentValue: sql`${archiveSequences.currentValue} + 1` },
  });
  const rows = await tx.select({ currentValue: archiveSequences.currentValue }).from(archiveSequences)
    .where(eq(archiveSequences.facilityType, facilityType)).limit(1).for("update");
  const sequence = Number(rows[0]?.currentValue);
  if (!Number.isInteger(sequence) || sequence < 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حجز تسلسل رقم الأرشفة" });
  return sequence;
}

async function raiseArchiveSequenceFloor(tx: any, facilityType: ArchiveFacilityType, sequence: number) {
  await tx.insert(archiveSequences).values({ facilityType, currentValue: sequence }).onDuplicateKeyUpdate({
    set: { currentValue: sql`GREATEST(${archiveSequences.currentValue}, ${sequence})` },
  });
}

function getCreateRequestHash(input: object) {
  const payload = { ...input } as Record<string, unknown>;
  delete payload.archiveNumber;
  delete payload.idempotencyKey;
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function getLicenseCreateErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("licenses_license_no_unique") || message.includes("Duplicate entry")) return "رقم الترخيص مسجل بالفعل. استخدم رقماً مختلفاً أو ابحث عن السجل السابق في سجل التراخيص.";
  if (message.includes("cannot be null") || message.includes("Column") && message.includes("doesn't have a default")) return "تعذر الحفظ لأن إحدى البيانات الإلزامية غير مكتملة. تأكد من رقم الترخيص واسم المنشأة واسم صاحب الترخيص ورقم الهوية والمحافظة وتاريخ السريان.";
  if (message.includes("Data too long")) return "تعذر الحفظ لأن أحد النصوص أطول من الحد المسموح. اختصر النص ثم أعد المحاولة.";
  return "تعذر حفظ الترخيص بسبب خطأ مؤقت في الخادم. تحقق من اتصال الإنترنت ثم أعد المحاولة، وإذا استمرت المشكلة تواصل مع مدير النظام.";
}

function requireOperationalRole(role: string) {
  if (!canManageLicenses(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "هذه العملية متاحة للمستخدمين المخولين فقط" });
  }
}

function requireAdmin(role: string) {
  if (!isSystemAdmin(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "هذه العملية متاحة لمدير النظام فقط" });
  }
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document";
}

export const licenseInput = z.object({
  licenseNo: z.string().trim().min(1).max(100),
  facilityName: z.string().trim().min(2).max(255),
  facilityType: z.enum(facilityTypeValues),
  holderName: z.string().trim().min(2).max(255),
  holderNationalId: z.string().trim().min(3).max(100),
  nationalIdIssuedBy: z.string().trim().max(255).nullable().optional(),
  nationalIdIssueGovernorate: z.string().trim().max(120).nullable().optional(),
  nationalIdIssueDate: z.coerce.date().nullable().optional(),
  birthPlace: z.string().trim().max(255).nullable().optional(),
  birthGovernorate: z.string().trim().max(120).nullable().optional(),
  birthDate: z.coerce.date().nullable().optional(),
  holderPhone: z.string().trim().min(5).max(40).nullable().optional(),
  qualification: z.string().trim().max(255).nullable().optional(),
  qualificationLevel: z.enum(qualificationLevelValues).nullable().optional(),
  graduationPlace: z.string().trim().max(255).nullable().optional(),
  graduationCountry: z.string().trim().max(120).nullable().optional(),
  graduationInstitute: z.string().trim().max(255).nullable().optional(),
  graduationInstitutionType: z.enum(graduationInstitutionTypeValues).nullable().optional(),
  graduationDate: z.coerce.date().nullable().optional(),
  professionalLicenseNo: z.string().trim().max(100).nullable().optional(),
  professionalLicenseIssueDate: z.coerce.date().nullable().optional(),
  previousLicenseNo: z.string().trim().max(100).nullable().optional(),
  previousLicenseIssuedBy: z.string().trim().max(255).nullable().optional(),
  previousLicenseIssueDate: z.coerce.date().nullable().optional(),
  siteInspectionFormNo: z.string().trim().max(100).nullable().optional(),
  siteInspectionFormDate: z.coerce.date().nullable().optional(),
  committeeMinutesNo: z.string().trim().max(100).nullable().optional(),
  committeeMinutesDate: z.coerce.date().nullable().optional(),
  feeReceiptNo: z.string().trim().max(100).nullable().optional(),
  feeReceiptDate: z.coerce.date().nullable().optional(),
  governorate: z.string().trim().min(2).max(120),
  address: z.string().trim().max(2000).nullable().optional(),
  street: z.string().trim().max(255).nullable().optional(),
  area: z.string().trim().max(255).nullable().optional(),
  district: z.string().trim().max(255).nullable().optional(),
  propertyOwnerName: z.string().trim().max(255).nullable().optional(),
  archiveNumber: z.string().trim().max(120).optional().default(""),
  idempotencyKey: z.string().trim().min(16).max(64).optional(),
  archiveDate: z.coerce.date().nullable().optional(),
  archiveOfficerName: z.string().trim().max(255).nullable().optional(),
  issueDate: z.coerce.date(),
  healthOfficeIssueDate: z.coerce.date().nullable().optional(),
  healthOfficeDirectorName: z.string().trim().max(255).nullable().optional(),
  healthOfficeDirectorGovernorate: z.string().trim().max(120).nullable().optional(),
  licenseDeliveryDate: z.coerce.date().nullable().optional(),
  expiryDate: z.coerce.date().optional(),
  status: z.enum(licenseStatusValues).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export function validateQualificationRules(input: Pick<z.infer<typeof licenseInput>, "facilityType" | "qualificationLevel" | "graduationInstitutionType">) {
  if (input.facilityType === "warehouse" && input.qualificationLevel && input.qualificationLevel !== "diploma") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ترخيص المخزن يتطلب مؤهلاً دبلوم" });
  }
  if (input.facilityType === "warehouse" && input.graduationInstitutionType && input.graduationInstitutionType !== "institute") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ترخيص المخزن يتطلب جهة تخرج من معهد" });
  }
  if (input.facilityType === "pharmacy" && input.qualificationLevel && input.qualificationLevel !== "bachelor") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ترخيص الصيدلية يتطلب مؤهلاً بكالوريوس" });
  }
  if (input.facilityType === "pharmacy" && input.graduationInstitutionType && input.graduationInstitutionType !== "university") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ترخيص الصيدلية يتطلب جهة تخرج من جامعة" });
  }
}

export function resolveLicenseExpiryDate(input: Pick<z.infer<typeof licenseInput>, "facilityType" | "issueDate" | "expiryDate">) {
  if (input.facilityType === "pharmacy") return getTwoYearExpiryDate(input.issueDate);
  if (!input.expiryDate) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ انتهاء ترخيص المخزن إلزامي" });
  return input.expiryDate;
}

export function serializeLicense(row: typeof licenses.$inferSelect) {
  return {
    ...row,
    effectiveStatus: getEffectiveStatus(row),
    daysRemaining: getDaysRemaining(row.expiryDate),
  };
}

export const licenseRouter = router({
  dashboard: protectedProcedure.input(z.object({
    year: z.number().int().min(2000).max(2200).optional(),
    month: z.number().int().min(1).max(12).optional(),
  }).optional()).query(async ({ ctx, input }) => {
    requireOperationalRole(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });

    const rows = await db.select().from(licenses).where(isNull(licenses.deletedAt)).orderBy(desc(licenses.createdAt));
    const serialized = rows.map(serializeLicense);
    const count = (status: string) => serialized.filter(item => item.effectiveStatus === status).length;
    const alerts = serialized
      .filter(item => item.effectiveStatus === "expiring" || item.effectiveStatus === "expired")
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 6);
    const analytics = buildDashboardAnalytics(serialized.map((item) => ({
      issueDate: item.issueDate,
      facilityType: item.facilityType,
      effectiveStatus: item.effectiveStatus,
      createdAt: item.createdAt,
      expiryDate: item.expiryDate,
      governorate: item.governorate,
    })), input);

    return {
      total: serialized.length,
      active: count("active"),
      expiring: count("expiring"),
      expired: count("expired"),
      suspended: count("suspended"),
      cancelled: count("cancelled"),
      alerts,
      analytics,
    };
  }),

  list: protectedProcedure
    .input(licenseListFilterInput.safeExtend({
      page: z.number().int().min(1).optional().default(1),
      pageSize: z.number().int().min(10).max(100).optional().default(20),
      sortBy: z.enum(["createdAt", "licenseNo", "facilityName", "issueDate", "expiryDate"]).optional().default("createdAt"),
      sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
    }))
    .query(async ({ ctx, input }) => {
      requireOperationalRole(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });

      const where = and(...buildLicenseListFilterConditions(input));
      const countRows = await db.select({ total: count() }).from(licenses).where(where);
      const pagination = getArchivePagination(Number(countRows[0]?.total ?? 0), input.page, input.pageSize);
      const sortColumn = { createdAt: licenses.createdAt, licenseNo: licenses.licenseNo, facilityName: licenses.facilityName, issueDate: licenses.issueDate, expiryDate: licenses.expiryDate }[input.sortBy];
      const orderBy = input.sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);
      const rows = await db.select({
        id: licenses.id,
        licenseNo: licenses.licenseNo,
        archiveNumber: licenses.archiveNumber,
        facilityName: licenses.facilityName,
        facilityType: licenses.facilityType,
        holderName: licenses.holderName,
        governorate: licenses.governorate,
        archiveDate: licenses.archiveDate,
        issueDate: licenses.issueDate,
        expiryDate: licenses.expiryDate,
        status: licenses.status,
        createdAt: licenses.createdAt,
      }).from(licenses)
        .where(where)
        .orderBy(orderBy)
        .limit(pagination.pageSize)
        .offset(pagination.offset);
      return { items: rows.map((row) => ({ ...row, effectiveStatus: getEffectiveStatus(row), daysRemaining: getDaysRemaining(row.expiryDate) })), pagination };
    }),

  offlineIndex: protectedProcedure.query(async ({ ctx }) => {
    requireOperationalRole(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const rows = await db.select({
      id: licenses.id,
      licenseNo: licenses.licenseNo,
      archiveNumber: licenses.archiveNumber,
      facilityName: licenses.facilityName,
      holderName: licenses.holderName,
      facilityType: licenses.facilityType,
      governorate: licenses.governorate,
      archiveDate: licenses.archiveDate,
      issueDate: licenses.issueDate,
      expiryDate: licenses.expiryDate,
      status: licenses.status,
      createdAt: licenses.createdAt,
    }).from(licenses).where(isNull(licenses.deletedAt)).orderBy(desc(licenses.createdAt));
    return rows.map((row) => ({ ...row, effectiveStatus: getEffectiveStatus(row), daysRemaining: getDaysRemaining(row.expiryDate) }));
  }),

  archiveList: protectedProcedure
    .input(archiveFilterInput.safeExtend({
      page: z.number().int().min(1).optional().default(1),
      pageSize: z.number().int().min(5).max(50).optional().default(ARCHIVE_PAGE_SIZE),
    }))
    .query(async ({ ctx, input }) => {
      requireOperationalRole(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });

      const conditions = buildArchiveFilterConditions(input);
      const where = conditions.length ? and(...conditions) : undefined;
      const countRows = await db.select({ total: count() }).from(licenses).where(where);
      const pagination = getArchivePagination(Number(countRows[0]?.total ?? 0), input.page, input.pageSize);
      const rows = await db.select({
        id: licenses.id,
        licenseNo: licenses.licenseNo,
        archiveNumber: licenses.archiveNumber,
        facilityName: licenses.facilityName,
        facilityType: licenses.facilityType,
        holderName: licenses.holderName,
        archiveDate: licenses.archiveDate,
        issueDate: licenses.issueDate,
        expiryDate: licenses.expiryDate,
        status: licenses.status,
        createdAt: licenses.createdAt,
      }).from(licenses)
        .where(where)
        .orderBy(desc(licenses.createdAt))
        .limit(pagination.pageSize)
        .offset(pagination.offset);

      return {
        items: rows.map((row) => ({ ...row, effectiveStatus: getEffectiveStatus(row), daysRemaining: getDaysRemaining(row.expiryDate) })),
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          totalPages: pagination.totalPages,
        },
      };
    }),

  archiveExport: protectedProcedure
    .input(archiveFilterInput)
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });

      const conditions = buildArchiveFilterConditions(input);
      const rows = (await db.select().from(licenses)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(licenses.createdAt))).map(serializeLicense);
      await writeAuditLog({
        actorId: ctx.user.id,
        action: "EXPORT_ARCHIVE_RESULTS",
        entityType: "license",
        entityId: 0,
        metadata: { count: rows.length, searchScope: input.searchScope || "all", hasSearch: Boolean(input.search), facilityType: input.facilityType || null, status: input.status || null, archiveDateFrom: input.archiveDateFrom?.toISOString() || null, archiveDateTo: input.archiveDateTo?.toISOString() || null },
      });
      return rows;
    }),

  getById: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    requireOperationalRole(ctx.user.role);
    const license = await getLicenseById(input.id);
    if (!license || license.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الترخيص" });
    const linkedDocuments = await getLicenseDocuments(input.id);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const events = await db.select().from(licenseEvents)
      .where(eq(licenseEvents.licenseId, input.id))
      .orderBy(desc(licenseEvents.createdAt));
    await writeAuditLog({
      actorId: ctx.user.id,
      action: "VIEW_LICENSE",
      entityType: "license",
      entityId: input.id,
    });
    return { license: serializeLicense(license), documents: linkedDocuments, events };
  }),

  create: protectedProcedure.input(licenseInput).mutation(async ({ ctx, input }) => {
    requireOperationalRole(ctx.user.role);
    if (input.status === "archived") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "تتم أرشفة الترخيص من الإجراء المخصص مع تسجيل السبب" });
    }
    validateQualificationRules(input);
    const expiryDate = resolveLicenseExpiryDate(input);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    try {
      const outcome = await db.transaction(async tx => {
        const requestHash = input.idempotencyKey ? getCreateRequestHash(input) : null;
        if (input.idempotencyKey && requestHash) {
          await tx.insert(idempotencyRequests).values({
            idempotencyKey: input.idempotencyKey,
            actorId: ctx.user.id,
            requestHash,
          }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${idempotencyRequests.idempotencyKey}` } });
          const existing = await tx.select().from(idempotencyRequests)
            .where(eq(idempotencyRequests.idempotencyKey, input.idempotencyKey)).limit(1);
          const request = existing[0];
          if (!request || request.actorId !== ctx.user.id || request.requestHash !== requestHash) {
            throw new TRPCError({ code: "CONFLICT", message: "مفتاح المزامنة مستخدم لطلب مختلف" });
          }
          if (request.licenseId) return { id: request.licenseId, archiveNumber: null, idempotent: true };
        }

        const facilityType = archiveFacilityType(input.facilityType);
        const sequence = await reserveNextArchiveSequence(tx, facilityType);
        const archiveNumber = buildArchiveNumber(sequence, input.licenseNo, facilityType);
        const { idempotencyKey: _idempotencyKey, archiveNumber: _ignoredArchiveNumber, ...licenseValues } = input;
        const result = await tx.insert(licenses).values({
          ...licenseValues,
          expiryDate,
          archiveNumber,
          archiveDate: input.archiveDate ?? input.issueDate,
          archiveOfficerName: input.archiveOfficerName || null,
          status: input.status ?? "active",
          notes: input.notes || null,
          createdBy: ctx.user.id,
          updatedBy: ctx.user.id,
        });
        const id = Number(result[0].insertId);
        await tx.insert(archiveNumberHistory).values({
          archiveNumber,
          licenseId: id,
          facilityType,
          sequence,
          assignedBy: ctx.user.id,
          changeReason: "SYSTEM_INITIAL_ASSIGNMENT",
        });
        await tx.insert(licenseEvents).values({
          licenseId: id,
          eventType: "issued",
          note: "تم إنشاء سجل الترخيص",
          performedBy: ctx.user.id,
        });
        if (input.idempotencyKey) {
          await tx.update(idempotencyRequests).set({ licenseId: id })
            .where(eq(idempotencyRequests.idempotencyKey, input.idempotencyKey));
        }
        return { id, archiveNumber, idempotent: false };
      });
      if (!outcome.idempotent) {
        await writeAuditLog({
          actorId: ctx.user.id,
          action: "CREATE_LICENSE",
          entityType: "license",
          entityId: outcome.id,
          metadata: { licenseNo: input.licenseNo, archiveNumber: outcome.archiveNumber, idempotencyKey: input.idempotencyKey || null },
        });
      }
      return { id: outcome.id, idempotent: outcome.idempotent };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "CONFLICT", message: getLicenseCreateErrorMessage(error) });
    }
  }),

  update: protectedProcedure.input(licenseInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    if (input.status === "archived") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "تتم أرشفة الترخيص من الإجراء المخصص مع تسجيل السبب" });
    }
    validateQualificationRules(input);
    const expiryDate = resolveLicenseExpiryDate(input);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const { id, ...values } = input;
    const previous = await getLicenseById(id);
    if (!previous) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الترخيص" });
    if (previous.deletedAt || previous.status === "archived") {
      throw new TRPCError({ code: "CONFLICT", message: "لا يمكن تعديل ترخيص مؤرشف؛ استخدم السجل كمرجع أو أنشئ ترخيصاً جديداً" });
    }
    await db.update(licenses).set({
      ...values,
      expiryDate,
      archiveNumber: previous.archiveNumber,
      archiveDate: input.archiveDate ?? previous.archiveDate ?? input.issueDate,
      archiveOfficerName: input.archiveOfficerName || null,
      updatedBy: ctx.user.id,
    }).where(eq(licenses.id, id));
    const statusChanged = previous.status !== values.status;
    await db.insert(licenseEvents).values({
      licenseId: id,
      eventType: statusChanged ? "status_changed" : "updated",
      note: statusChanged ? `تغيير الحالة إلى ${values.status}` : "تعديل بيانات الترخيص",
      performedBy: ctx.user.id,
    });
    await writeAuditLog({ actorId: ctx.user.id, action: "UPDATE_LICENSE", entityType: "license", entityId: id });
    return { success: true };
  }),

  renew: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    issueDate: z.coerce.date(),
    expiryDate: z.coerce.date().optional(),
    reason: z.string().trim().min(5, "سبب التجديد مطلوب").max(1000),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const license = await getLicenseById(input.id);
    if (!license || license.deletedAt || license.status === "archived") throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على ترخيص قابل للتجديد" });
    const expiryDate = license.facilityType === "pharmacy" ? getTwoYearExpiryDate(input.issueDate) : input.expiryDate;
    if (!expiryDate) throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ انتهاء ترخيص المخزن إلزامي عند التجديد" });
    await db.transaction(async tx => {
      await tx.update(licenses).set({ issueDate: input.issueDate, expiryDate, status: "active", updatedBy: ctx.user.id }).where(eq(licenses.id, input.id));
      await tx.insert(licenseEvents).values({ licenseId: input.id, eventType: "updated", note: `تجديد الترخيص: ${input.reason}`, performedBy: ctx.user.id });
    });
    await writeAuditLog({ actorId: ctx.user.id, action: "RENEW_LICENSE", entityType: "license", entityId: input.id, metadata: { reason: input.reason, archiveNumber: license.archiveNumber } });
    return { success: true, archiveNumber: license.archiveNumber };
  }),

  changeArchiveNumber: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    archiveNumber: z.string().trim().min(10).max(120),
    reason: z.string().trim().min(5, "سبب تعديل رقم الأرشفة مطلوب").max(1000),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const license = await getLicenseById(input.id);
    if (!license || license.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الترخيص" });
    const facilityType = archiveFacilityType(license.facilityType);
    if (!isArchiveNumberForLicense(input.archiveNumber, license.licenseNo, facilityType)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة رقم الأرشفة لا تطابق رقم الترخيص ونوع المنشأة" });
    }
    if (input.archiveNumber === license.archiveNumber) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "رقم الأرشفة الجديد مطابق للرقم الحالي" });
    }
    const sequence = getArchiveSequence(input.archiveNumber, facilityType);
    await db.transaction(async tx => {
      const history = await tx.select({ id: archiveNumberHistory.id }).from(archiveNumberHistory)
        .where(eq(archiveNumberHistory.archiveNumber, input.archiveNumber)).limit(1);
      if (history[0]) throw new TRPCError({ code: "CONFLICT", message: "رقم الأرشفة مستخدم سابقاً ولا يمكن إعادة استخدامه" });
      await tx.update(licenses).set({ archiveNumber: input.archiveNumber, updatedBy: ctx.user.id }).where(eq(licenses.id, input.id));
      await raiseArchiveSequenceFloor(tx, facilityType, sequence);
      await tx.insert(archiveNumberHistory).values({
        archiveNumber: input.archiveNumber,
        licenseId: input.id,
        facilityType,
        sequence,
        assignedBy: ctx.user.id,
        changeReason: input.reason,
      });
      await tx.insert(licenseEvents).values({ licenseId: input.id, eventType: "archive_number_changed", note: `تعديل رقم الأرشفة: ${input.reason}`, performedBy: ctx.user.id });
    });
    await writeAuditLog({ actorId: ctx.user.id, action: "CHANGE_ARCHIVE_NUMBER", entityType: "license", entityId: input.id, metadata: { previousArchiveNumber: license.archiveNumber, archiveNumber: input.archiveNumber, reason: input.reason } });
    return { success: true };
  }),

  archive: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    reason: z.string().trim().min(5, "سبب الأرشفة مطلوب").max(1000),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const license = await getLicenseById(input.id);
    if (!license) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الترخيص" });
    if (license.deletedAt) throw new TRPCError({ code: "CONFLICT", message: "هذا الترخيص موجود في سلة المحذوفات" });
    if (license.status === "archived") throw new TRPCError({ code: "CONFLICT", message: "هذا الترخيص مؤرشف بالفعل" });

    const archivedAt = new Date();
    await db.update(licenses).set({
      status: "archived",
      archiveReason: input.reason,
      archivedBy: ctx.user.id,
      archivedAt,
      updatedBy: ctx.user.id,
    }).where(eq(licenses.id, input.id));
    await db.insert(licenseEvents).values({
      licenseId: input.id,
      eventType: "archived",
      note: `أرشفة الترخيص: ${input.reason}`,
      performedBy: ctx.user.id,
    });
    await writeAuditLog({
      actorId: ctx.user.id,
      action: "ARCHIVE_LICENSE",
      entityType: "license",
      entityId: input.id,
      metadata: { licenseNo: license.licenseNo, reason: input.reason },
    });
    return { success: true };
  }),

  moveToTrash: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    confirmation: z.string().trim().min(1),
    acknowledged: z.literal(true),
    reason: z.string().trim().min(5, "سبب النقل إلى سلة المحذوفات مطلوب").max(1000),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const license = await getLicenseById(input.id);
    if (!license) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الترخيص" });
    if (license.deletedAt) throw new TRPCError({ code: "CONFLICT", message: "هذا الترخيص موجود في سلة المحذوفات بالفعل" });
    if (normalizeLicenseNumber(input.confirmation) !== normalizeLicenseNumber(license.licenseNo)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "اكتب رقم الترخيص بدقة لتأكيد النقل إلى سلة المحذوفات" });
    }
    const deletedAt = new Date();
    await db.transaction(async tx => {
      await tx.update(licenses).set({ deletedAt, deletedBy: ctx.user.id, deletionReason: input.reason, updatedBy: ctx.user.id }).where(eq(licenses.id, input.id));
      await tx.insert(licenseEvents).values({ licenseId: input.id, eventType: "deleted", note: `نقل إلى سلة المحذوفات: ${input.reason}`, performedBy: ctx.user.id });
    });
    await writeAuditLog({ actorId: ctx.user.id, action: "MOVE_LICENSE_TO_TRASH", entityType: "license", entityId: input.id, metadata: { licenseNo: license.licenseNo, facilityName: license.facilityName, reason: input.reason } });
    return { success: true };
  }),

  restoreFromTrash: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const license = await getLicenseById(input.id);
    if (!license || !license.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على ترخيص في سلة المحذوفات" });
    await db.transaction(async tx => {
      await tx.update(licenses).set({ deletedAt: null, deletedBy: null, deletionReason: null, updatedBy: ctx.user.id }).where(eq(licenses.id, input.id));
      await tx.insert(licenseEvents).values({ licenseId: input.id, eventType: "restored", note: "استعادة الترخيص من سلة المحذوفات", performedBy: ctx.user.id });
    });
    await writeAuditLog({ actorId: ctx.user.id, action: "RESTORE_LICENSE_FROM_TRASH", entityType: "license", entityId: input.id, metadata: { licenseNo: license.licenseNo, facilityName: license.facilityName } });
    return { success: true };
  }),

  trashList: adminProcedure.input(z.object({ page: z.number().int().min(1).optional().default(1), pageSize: z.number().int().min(5).max(50).optional().default(ARCHIVE_PAGE_SIZE) })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const countRows = await db.select({ total: count() }).from(licenses).where(isNotNull(licenses.deletedAt));
    const pagination = getArchivePagination(Number(countRows[0]?.total ?? 0), input.page, input.pageSize);
    const items = await db.select({ id: licenses.id, licenseNo: licenses.licenseNo, archiveNumber: licenses.archiveNumber, facilityName: licenses.facilityName, facilityType: licenses.facilityType, holderName: licenses.holderName, deletionReason: licenses.deletionReason, deletedAt: licenses.deletedAt }).from(licenses).where(isNotNull(licenses.deletedAt)).orderBy(desc(licenses.deletedAt)).limit(pagination.pageSize).offset(pagination.offset);
    return { items, pagination };
  }),

  deletePermanently: adminProcedure.input(z.object({
    id: z.number().int().positive(),
    confirmation: z.string().trim().min(1),
    acknowledged: z.literal(true),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const license = await getLicenseById(input.id);
    if (!license || !license.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "لا يمكن الحذف النهائي إلا من سلة المحذوفات" });
    if (normalizeLicenseNumber(input.confirmation) !== normalizeLicenseNumber(license.licenseNo)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "اكتب رقم الترخيص بدقة لتأكيد الحذف النهائي" });
    }

    const linkedDocuments = await getLicenseDocuments(input.id);
    await db.transaction(async tx => {
      await tx.delete(notifications).where(eq(notifications.licenseId, input.id));
      await tx.delete(documents).where(eq(documents.licenseId, input.id));
      await tx.delete(licenseEvents).where(eq(licenseEvents.licenseId, input.id));
      await tx.delete(licenses).where(eq(licenses.id, input.id));
    });
    await writeAuditLog({
      actorId: ctx.user.id,
      action: "DELETE_LICENSE_PERMANENTLY",
      entityType: "license",
      entityId: input.id,
      metadata: {
        licenseNo: license.licenseNo,
        facilityName: license.facilityName,
        documentCount: linkedDocuments.length,
      },
    });
    return { success: true };
  }),

  uploadDocument: protectedProcedure.input(z.object({
    licenseId: z.number().int().positive(),
    documentType: z.enum(documentTypeValues),
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.enum(permittedMimeTypes),
    base64: z.string().min(1).max(7_100_000),
  })).mutation(async ({ ctx, input }) => {
    requireOperationalRole(ctx.user.role);
    const license = await getLicenseById(input.licenseId);
    if (!license || license.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الترخيص" });

    const buffer = Buffer.from(input.base64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) {
      throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "حجم الملف يجب ألا يتجاوز 5 ميغابايت" });
    }
    const object = await storagePut(
      `licenses/${input.licenseId}/${input.documentType}/${Date.now()}-${safeFileName(input.originalName)}`,
      buffer,
      input.mimeType,
    );
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    await db.insert(documents).values({
      licenseId: input.licenseId,
      documentType: input.documentType,
      fileKey: object.key,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: buffer.length,
      uploadedBy: ctx.user.id,
    }).onDuplicateKeyUpdate({
      set: {
        fileKey: object.key,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: buffer.length,
        uploadedBy: ctx.user.id,
        uploadedAt: new Date(),
      },
    });
    await db.insert(licenseEvents).values({
      licenseId: input.licenseId,
      eventType: "document_added",
      note: `رفع مستند: ${input.documentType}`,
      performedBy: ctx.user.id,
    });
    await writeAuditLog({
      actorId: ctx.user.id,
      action: "UPLOAD_DOCUMENT",
      entityType: "license",
      entityId: input.licenseId,
      metadata: { documentType: input.documentType, fileName: input.originalName },
    });
    return { success: true };
  }),

  openDocument: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireOperationalRole(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const result = await db.select().from(documents).where(eq(documents.id, input.id)).limit(1);
    const document = result[0];
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على المستند" });
    const license = await getLicenseById(document.licenseId);
    if (!license || license.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على المستند" });
    const url = await storageGetSignedUrl(document.fileKey);
    await writeAuditLog({
      actorId: ctx.user.id,
      action: "VIEW_DOCUMENT",
      entityType: "document",
      entityId: document.id,
      metadata: { licenseId: document.licenseId, documentType: document.documentType },
    });
    return { url };
  }),

  auditLog: protectedProcedure.input(z.object({ licenseId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    return db.select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      actorName: users.name,
      action: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    }).from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(eq(auditLogs.entityType, "license"), eq(auditLogs.entityId, input.licenseId)))
      .orderBy(desc(auditLogs.createdAt));
  }),

  notifications: protectedProcedure.query(async ({ ctx }) => {
    requireOperationalRole(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    return db.select({
      id: notifications.id,
      kind: notifications.kind,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      licenseId: licenses.id,
      licenseNo: licenses.licenseNo,
      facilityName: licenses.facilityName,
      expiryDate: licenses.expiryDate,
    }).from(notifications)
      .innerJoin(licenses, eq(notifications.licenseId, licenses.id))
      .where(isNull(licenses.deletedAt))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
  }),

  markNotificationRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    requireOperationalRole(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, input.id));
    return { success: true };
  }),

  printPayload: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const license = await getLicenseById(input.id);
    if (!license || license.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الترخيص" });
    await writeAuditLog({
      actorId: ctx.user.id,
      action: "PRINT_LICENSE",
      entityType: "license",
      entityId: input.id,
      metadata: { licenseNo: license.licenseNo },
    });
    return { license: serializeLicense(license) };
  }),

  ministryTemplateImage: adminProcedure.input(z.object({ template: z.enum(["pharmacy", "warehouse"]), side: z.enum(["front", "back"]) })).query(async ({ input }) => {
    const key = getMinistryPdfAssetKey(input.template, input.side);
    if (!Object.values(ministryPdfAssetKeys[input.template]).includes(key)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "صورة نموذج الوزارة غير معتمدة" });
    }
    const response = await fetch(await storageGetSignedUrl(key));
    if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر تجهيز صورة نموذج الوزارة للتصدير" });
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
    return { dataUrl: `data:${contentType};base64,${base64}` };
  }),

  exportRows: protectedProcedure.input(licenseListFilterInput).query(async ({ ctx, input }) => {
    requireAdmin(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الوصول إلى قاعدة البيانات" });
    const rows = (await db.select().from(licenses).where(and(...buildLicenseListFilterConditions(input))).orderBy(desc(licenses.createdAt))).map(serializeLicense);
    await writeAuditLog({ actorId: ctx.user.id, action: "EXPORT_LICENSES", entityType: "license", entityId: 0, metadata: { count: rows.length, filters: input } });
    return rows;
  }),
});

import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDaysRemaining } from "../licenseStatus";
import { createSupabaseDevelopmentUserClient } from "../supabaseDevelopment";
import { publicProcedure, router } from "../_core/trpc";

const accessTokenInput = z.object({ accessToken: z.string().min(20) });
const uuidInput = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalDate = z.coerce.date().nullable().optional();
const operationalListInput = accessTokenInput.extend({
  search: z.string().trim().max(100).optional(),
  searchScope: z.enum(["all", "facility", "owner"]).default("all"),
  facilityType: z.enum(["pharmacy", "warehouse"]).optional(),
  status: z.enum(["active", "expired", "suspended", "archived"]).optional(),
  governorate: z.string().trim().max(120).optional(),
  issueDateFrom: z.coerce.date().optional(),
  issueDateTo: z.coerce.date().optional(),
  archiveDateFrom: z.coerce.date().optional(),
  archiveDateTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "licenseNo", "facilityName", "issueDate", "expiryDate"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const operationalAdditionalFields = {
  nationalIdIssuedBy: optionalText(255),
  nationalIdIssueGovernorate: optionalText(120),
  nationalIdIssueDate: optionalDate,
  birthPlace: optionalText(255),
  birthGovernorate: optionalText(120),
  birthDate: optionalDate,
  graduationPlace: optionalText(255),
  graduationInstitutionType: z.enum(["institute", "university"]).nullable().optional(),
  graduationDate: optionalDate,
  previousLicenseNo: optionalText(100),
  previousLicenseIssuedBy: optionalText(255),
  previousLicenseIssueDate: optionalDate,
  siteInspectionFormNo: optionalText(100),
  siteInspectionFormDate: optionalDate,
  committeeMinutesNo: optionalText(100),
  committeeMinutesDate: optionalDate,
  feeReceiptNo: optionalText(100),
  feeReceiptDate: optionalDate,
  healthOfficeIssueDate: optionalDate,
  healthOfficeDirectorName: optionalText(255),
  healthOfficeDirectorGovernorate: optionalText(120),
  licenseDeliveryDate: optionalDate,
  licenseDeliveryRecipientName: optionalText(255),
  licenseDeliverySignature: optionalText(255),
  licenseDeliveryFingerprint: optionalText(255),
};

const operationalCreateInput = accessTokenInput.extend({
  licenseNo: z.string().trim().min(1).max(100),
  facilityName: z.string().trim().min(2).max(255),
  facilityType: z.enum(["pharmacy", "warehouse"]),
  holderName: z.string().trim().min(2).max(255),
  holderNationalId: z.string().trim().min(3).max(100),
  governorate: z.string().trim().min(2).max(120),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  status: z.enum(["active", "expired", "suspended"]).optional(),
  idempotencyKey: uuidInput,
  holderPhone: optionalText(40),
  address: optionalText(2000),
  street: optionalText(255),
  area: optionalText(255),
  district: optionalText(255),
  propertyOwnerName: optionalText(255),
  qualification: optionalText(255),
  qualificationLevel: z.enum(["diploma", "bachelor"]).nullable().optional(),
  graduationCountry: optionalText(120),
  graduationInstitute: optionalText(255),
  professionalLicenseNo: optionalText(100),
  professionalLicenseIssueDate: optionalDate,
  archiveDate: optionalDate,
  archiveOfficerName: optionalText(255),
  notes: optionalText(4000),
  ...operationalAdditionalFields,
});

const licenseCreateInput = accessTokenInput.extend({
  licenseNo: z.string().trim().min(1).max(100),
  facilityName: z.string().trim().min(2).max(255),
  facilityType: z.enum(["pharmacy", "warehouse"]),
  holderName: z.string().trim().min(2).max(255),
  holderNationalId: z.string().trim().min(3).max(100),
  governorate: z.string().trim().min(2).max(120),
  issueDate: z.coerce.date(),
  expiryDate: z.coerce.date(),
  idempotencyKey: uuidInput,
});

const licenseUpdateInput = accessTokenInput.extend({
  id: uuidInput,
  payload: z.object({
    facilityName: z.string().trim().min(2).max(255).optional(),
    holderName: z.string().trim().min(2).max(255).optional(),
    holderNationalId: z.string().trim().min(3).max(100).optional(),
    holderPhone: z.string().trim().max(40).nullable().optional(),
    governorate: z.string().trim().min(2).max(120).optional(),
    address: z.string().trim().max(2000).nullable().optional(),
    street: z.string().trim().max(255).nullable().optional(),
    area: z.string().trim().max(255).nullable().optional(),
    district: z.string().trim().max(255).nullable().optional(),
    propertyOwnerName: z.string().trim().max(255).nullable().optional(),
    qualification: z.string().trim().max(255).nullable().optional(),
    qualificationLevel: z.enum(["diploma", "bachelor"]).nullable().optional(),
    graduationCountry: z.string().trim().max(120).nullable().optional(),
    graduationInstitute: z.string().trim().max(255).nullable().optional(),
    professionalLicenseNo: z.string().trim().max(100).nullable().optional(),
    professionalLicenseIssueDate: z.coerce.date().nullable().optional(),
    issueDate: z.coerce.date().optional(),
    expiryDate: z.coerce.date().optional(),
    archiveDate: z.coerce.date().nullable().optional(),
    archiveOfficerName: z.string().trim().max(255).nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    status: z.enum(["active", "expired", "suspended"]).optional(),
    ...operationalAdditionalFields,
  }),
});

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function raiseSupabaseError(error: { message: string; code?: string | null }) {
  if (error.code === "42501") throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك الصلاحية المطلوبة في Supabase Development" });
  if (error.code === "23505") throw new TRPCError({ code: "CONFLICT", message: error.message });
  if (error.code === "22023") throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إكمال العملية في Supabase Development" });
}

function requestHash(input: Omit<z.infer<typeof licenseCreateInput>, "accessToken" | "idempotencyKey">) {
  return createHash("sha256").update(JSON.stringify({
    ...input,
    issueDate: isoDate(input.issueDate),
    expiryDate: isoDate(input.expiryDate),
  })).digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(isoDate(value));
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function toSupabaseUpdatePayload(input: z.infer<typeof licenseUpdateInput>["payload"]) {
  const payload: Record<string, string | null> = {};
  const mapping: Record<string, string> = {
    facilityName: "facility_name",
    holderName: "holder_name",
    holderNationalId: "holder_national_id",
    holderPhone: "holder_phone",
    governorate: "governorate",
    address: "address",
    street: "street",
    area: "area",
    district: "district",
    propertyOwnerName: "property_owner_name",
    qualification: "qualification",
    qualificationLevel: "qualification_level",
    graduationCountry: "graduation_country",
    graduationInstitute: "graduation_institute",
    graduationPlace: "graduation_place",
    graduationInstitutionType: "graduation_institution_type",
    professionalLicenseNo: "professional_license_no",
    nationalIdIssuedBy: "national_id_issued_by",
    nationalIdIssueGovernorate: "national_id_issue_governorate",
    birthPlace: "birth_place",
    birthGovernorate: "birth_governorate",
    previousLicenseNo: "previous_license_no",
    previousLicenseIssuedBy: "previous_license_issued_by",
    siteInspectionFormNo: "site_inspection_form_no",
    committeeMinutesNo: "committee_minutes_no",
    feeReceiptNo: "fee_receipt_no",
    archiveOfficerName: "archive_officer_name",
    healthOfficeDirectorName: "health_office_director_name",
    healthOfficeDirectorGovernorate: "health_office_director_governorate",
    licenseDeliveryRecipientName: "license_delivery_recipient_name",
    licenseDeliverySignature: "license_delivery_signature",
    licenseDeliveryFingerprint: "license_delivery_fingerprint",
    notes: "notes",
    status: "status",
  };
  for (const [camel, snake] of Object.entries(mapping)) {
    const value = input[camel as keyof typeof input];
    if (value !== undefined) payload[snake] = value === null ? null : String(value);
  }
  const dates: Record<string, Date | null | undefined> = {
    professional_license_issue_date: input.professionalLicenseIssueDate,
    national_id_issue_date: input.nationalIdIssueDate,
    birth_date: input.birthDate,
    graduation_date: input.graduationDate,
    previous_license_issue_date: input.previousLicenseIssueDate,
    site_inspection_form_date: input.siteInspectionFormDate,
    committee_minutes_date: input.committeeMinutesDate,
    fee_receipt_date: input.feeReceiptDate,
    issue_date: input.issueDate,
    expiry_date: input.expiryDate,
    archive_date: input.archiveDate,
    health_office_issue_date: input.healthOfficeIssueDate,
    license_delivery_date: input.licenseDeliveryDate,
  };
  for (const [key, value] of Object.entries(dates)) {
    if (value !== undefined) payload[key] = value ? isoDate(value) : null;
  }
  return payload;
}

export function toSupabaseOperationalCreatePayload(input: Omit<z.infer<typeof operationalCreateInput>, "accessToken" | "idempotencyKey">) {
  return {
    ...toSupabaseUpdatePayload(input),
    license_no: input.licenseNo,
    facility_name: input.facilityName,
    facility_type: input.facilityType,
    holder_name: input.holderName,
    holder_national_id: input.holderNationalId,
    governorate: input.governorate,
    issue_date: isoDate(input.issueDate),
    expiry_date: isoDate(input.expiryDate),
  };
}

export function normalizeSupabaseLicense(row: Record<string, unknown>) {
  const expiryDate = String(row.expiry_date ?? "");
  return {
    id: String(row.id),
    licenseNo: String(row.license_no),
    archiveNumber: String(row.archive_number),
    facilityName: String(row.facility_name),
    facilityType: String(row.facility_type),
    holderName: String(row.holder_name),
    governorate: String(row.governorate),
    issueDate: expiryDate ? new Date(String(row.issue_date)) : null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    status: String(row.status),
    createdAt: row.created_at ? new Date(String(row.created_at)) : null,
    daysRemaining: expiryDate ? getDaysRemaining(new Date(expiryDate)) : null,
  };
}

export function normalizeSupabaseOperationalList(rows: Record<string, unknown>[], page: number, pageSize: number) {
  const items = rows.map((row) => {
    const item = normalizeSupabaseLicense(row);
    return {
      ...item,
      archiveDate: row.archive_date ? new Date(String(row.archive_date)) : null,
      effectiveStatus: item.status === "suspended" || item.status === "archived" || (item.daysRemaining ?? 0) < 0 ? "expired" : "active",
    };
  });
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      offset: (page - 1) * pageSize,
    },
  };
}

export const supabaseLicenseRouter = router({
  profile: publicProcedure.input(accessTokenInput).query(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.from("app_profiles").select("user_id, display_name, email, role, access_status").limit(1).maybeSingle();
    if (error) raiseSupabaseError(error);
    if (!data) throw new TRPCError({ code: "UNAUTHORIZED", message: "جلسة Supabase Development غير معتمدة" });
    return data;
  }),

  list: publicProcedure.input(accessTokenInput.extend({ search: z.string().trim().max(100).optional(), facilityType: z.enum(["pharmacy", "warehouse"]).optional(), status: z.enum(["active", "expired", "suspended", "archived"]).optional() })).query(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    let query = client.from("licenses").select("*").order("created_at", { ascending: false }).limit(100);
    if (input.facilityType) query = query.eq("facility_type", input.facilityType);
    if (input.status) query = query.eq("status", input.status);
    const { data, error } = await query;
    if (error) raiseSupabaseError(error);
    const search = input.search?.toLocaleLowerCase("ar-EG");
    return (data ?? []).filter((row) => {
      if (row.deleted_at) return false;
      if (!search) return true;
      return [row.license_no, row.archive_number, row.facility_name, row.holder_name]
        .some((value) => value.toLocaleLowerCase("ar-EG").includes(search));
    }).map((row) => normalizeSupabaseLicense(row));
  }),

  operationalList: publicProcedure.input(operationalListInput).query(async ({ input }) => {
    if (input.issueDateFrom && input.issueDateTo && input.issueDateTo < input.issueDateFrom) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ الإصدار إلى يجب أن يكون بعد أو مساوياً لتاريخ الإصدار من" });
    }
    if (input.archiveDateFrom && input.archiveDateTo && input.archiveDateTo < input.archiveDateFrom) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ الأرشفة إلى يجب أن يكون بعد أو مساوياً لتاريخ الأرشفة من" });
    }
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("list_operational_licenses", {
      p_search: input.search || null,
      p_search_scope: input.searchScope,
      p_facility_type: input.facilityType ?? null,
      p_status: input.status ?? null,
      p_governorate: input.governorate || null,
      p_issue_date_from: input.issueDateFrom ? isoDate(input.issueDateFrom) : null,
      p_issue_date_to: input.issueDateTo ? isoDate(input.issueDateTo) : null,
      p_archive_date_from: input.archiveDateFrom ? isoDate(input.archiveDateFrom) : null,
      p_archive_date_to: input.archiveDateTo ? isoDate(input.archiveDateTo) : null,
      p_sort_by: {
        createdAt: "created_at",
        licenseNo: "license_no",
        facilityName: "facility_name",
        issueDate: "issue_date",
        expiryDate: "expiry_date",
      }[input.sortBy],
      p_sort_direction: input.sortDirection,
      p_page: input.page,
      p_page_size: input.pageSize,
    });
    if (error) raiseSupabaseError(error);
    return normalizeSupabaseOperationalList((data ?? []) as Record<string, unknown>[], input.page, input.pageSize);
  }),

  dashboard: publicProcedure.input(accessTokenInput.extend({ year: z.number().int().min(2000).max(2100).optional(), month: z.number().int().min(1).max(12).nullable().optional() })).query(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("dashboard_operational", {
      p_year: input.year ?? new Date().getFullYear(),
      p_month: input.month ?? null,
    });
    if (error) raiseSupabaseError(error);
    return data as Record<string, unknown>;
  }),

  trashList: publicProcedure.input(accessTokenInput).query(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.from("licenses").select("*").not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(100);
    if (error) raiseSupabaseError(error);
    return (data ?? []).map((row) => normalizeSupabaseLicense(row));
  }),

  getById: publicProcedure.input(accessTokenInput.extend({ id: uuidInput })).query(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.from("licenses").select("*").eq("id", input.id).maybeSingle();
    if (error) raiseSupabaseError(error);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الترخيص" });
    return data;
  }),

  events: publicProcedure.input(accessTokenInput.extend({ id: uuidInput })).query(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.from("license_events")
      .select("id, event_type, note, created_at, performed_by")
      .eq("license_id", input.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) raiseSupabaseError(error);
    return data ?? [];
  }),

  auditLog: publicProcedure.input(accessTokenInput.extend({ id: uuidInput })).query(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.from("audit_logs")
      .select("id, action, actor_id, metadata, created_at")
      .eq("entity_type", "license")
      .eq("entity_id", input.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) raiseSupabaseError(error);
    const actorIds = Array.from(new Set((data ?? []).map((entry) => entry.actor_id).filter((id): id is string => Boolean(id))));
    const { data: profiles, error: profileError } = actorIds.length
      ? await client.from("app_profiles").select("user_id, display_name, email").in("user_id", actorIds).limit(50)
      : { data: [], error: null };
    if (profileError) raiseSupabaseError(profileError);
    const profileNames = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.display_name || profile.email || profile.user_id]));
    return (data ?? []).map((entry) => ({ ...entry, actor_name: entry.actor_id ? profileNames.get(entry.actor_id) ?? entry.actor_id : null }));
  }),

  create: publicProcedure.input(licenseCreateInput).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { accessToken, idempotencyKey, ...values } = input;
    const { data, error } = await client.rpc("create_license_idempotent", {
      p_license_no: values.licenseNo,
      p_facility_name: values.facilityName,
      p_facility_type: values.facilityType,
      p_holder_name: values.holderName,
      p_holder_national_id: values.holderNationalId,
      p_governorate: values.governorate,
      p_issue_date: isoDate(values.issueDate),
      p_expiry_date: isoDate(values.expiryDate),
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash(values),
    });
    if (error) raiseSupabaseError(error);
    return data?.[0] ?? null;
  }),

  operationalCreate: publicProcedure.input(operationalCreateInput).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { accessToken: _accessToken, idempotencyKey, ...values } = input;
    const payload = toSupabaseOperationalCreatePayload(values);
    const { data, error } = await client.rpc("create_operational_license_idempotent", {
      p_payload: payload,
      p_idempotency_key: idempotencyKey,
      p_request_hash: createHash("sha256").update(stableSerialize(payload)).digest("hex"),
    });
    if (error) raiseSupabaseError(error);
    return data?.[0] ?? null;
  }),

  update: publicProcedure.input(licenseUpdateInput).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("update_license_details", {
      p_license_id: input.id,
      p_payload: toSupabaseUpdatePayload(input.payload),
    });
    if (error) raiseSupabaseError(error);
    return data?.[0] ?? null;
  }),

  changeArchiveNumber: publicProcedure.input(accessTokenInput.extend({ id: uuidInput, archiveNumber: z.string().trim().regex(/^\d{4}-\d{4}[صم]$/), reason: z.string().trim().min(5).max(1000) })).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("change_archive_number", { p_license_id: input.id, p_new_archive_number: input.archiveNumber, p_reason: input.reason });
    if (error) raiseSupabaseError(error);
    return data?.[0] ?? null;
  }),

  renew: publicProcedure.input(accessTokenInput.extend({ id: uuidInput, issueDate: z.coerce.date(), expiryDate: z.coerce.date(), reason: z.string().trim().min(5).max(1000) })).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("renew_license", { p_license_id: input.id, p_issue_date: isoDate(input.issueDate), p_expiry_date: isoDate(input.expiryDate), p_reason: input.reason });
    if (error) raiseSupabaseError(error);
    return data?.[0] ?? null;
  }),

  archive: publicProcedure.input(accessTokenInput.extend({ id: uuidInput, reason: z.string().trim().min(5).max(1000) })).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { error } = await client.rpc("archive_license", { p_license_id: input.id, p_reason: input.reason });
    if (error) raiseSupabaseError(error);
    return { success: true };
  }),

  moveToTrash: publicProcedure.input(accessTokenInput.extend({ id: uuidInput, reason: z.string().trim().min(5).max(1000) })).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { error } = await client.rpc("move_license_to_trash", { p_license_id: input.id, p_reason: input.reason });
    if (error) raiseSupabaseError(error);
    return { success: true };
  }),

  restoreFromTrash: publicProcedure.input(accessTokenInput.extend({ id: uuidInput, reason: z.string().trim().min(5).max(1000) })).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { error } = await client.rpc("restore_license_from_trash", { p_license_id: input.id, p_reason: input.reason });
    if (error) raiseSupabaseError(error);
    return { success: true };
  }),
});

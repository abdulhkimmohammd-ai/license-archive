import { supabaseDevelopment } from "./supabaseDevelopment";

export type LicenseApiBackend = "legacy" | "supabase" | "worker";

const workerBaseUrl = (import.meta.env.VITE_LICENSE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

export async function callLicenseApi<T>(
  rpc: string,
  payload: Record<string, unknown>,
  backend: LicenseApiBackend = workerBaseUrl ? "worker" : "supabase",
): Promise<T> {
  if (backend === "legacy") throw new Error("Legacy API must be called through the typed tRPC client");
  if (backend === "worker") {
    if (!workerBaseUrl) throw new Error("عنوان Worker غير مضبوط");
    const session = await supabaseDevelopment?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) throw new Error("جلسة Supabase مطلوبة");
    const response = await fetch(`${workerBaseUrl}/api/licenses/rpc/${rpc}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Worker request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }
  if (!supabaseDevelopment) throw new Error("Supabase Development غير مضبوط");
  const { data, error } = await supabaseDevelopment.rpc(rpc, payload);
  if (error) throw new Error(error.message);
  return data as T;
}


type SupabaseClient = NonNullable<typeof supabaseDevelopment>;
type LicenseUpdatePayload = Record<string, unknown>;

function requireSupabase(): SupabaseClient {
  if (!supabaseDevelopment) throw new Error("Supabase Development غير مضبوط");
  return supabaseDevelopment;
}

function raiseSupabaseError(error: { message: string; code?: string | null }) {
  if (error.code === "42501") throw new Error("لا تملك الصلاحية المطلوبة في Supabase Development");
  if (error.code === "23505") throw new Error("القيمة موجودة مسبقاً ولا يمكن تكرارها");
  if (error.code === "22023") throw new Error(error.message);
  throw new Error(error.message || "تعذر إكمال العملية في Supabase Development");
}

function isoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

const updateFieldMap: Record<string, string> = {
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
  notes: "notes",
  status: "status",
};

const updateDateMap: Record<string, string> = {
  professionalLicenseIssueDate: "professional_license_issue_date",
  nationalIdIssueDate: "national_id_issue_date",
  birthDate: "birth_date",
  graduationDate: "graduation_date",
  previousLicenseIssueDate: "previous_license_issue_date",
  siteInspectionFormDate: "site_inspection_form_date",
  committeeMinutesDate: "committee_minutes_date",
  feeReceiptDate: "fee_receipt_date",
  issueDate: "issue_date",
  expiryDate: "expiry_date",
  archiveDate: "archive_date",
  healthOfficeIssueDate: "health_office_issue_date",
  licenseDeliveryDate: "license_delivery_date",
};

export function toSupabaseClientUpdatePayload(input: LicenseUpdatePayload) {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const mapped = updateFieldMap[key] ?? updateDateMap[key];
    if (!mapped) continue;
    payload[mapped] = updateDateMap[key] && value ? isoDate(value as Date | string) : value;
  }
  return payload;
}

export async function getSupabaseProfile() {
  const client = requireSupabase();
  const { data, error } = await client.from("app_profiles").select("user_id, display_name, email, role, access_status").limit(1).maybeSingle();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error("جلسة Supabase Development غير معتمدة");
  return data;
}

export async function getSupabaseLicense(id: string) {
  const client = requireSupabase();
  const { data, error } = await client.from("licenses").select("*").eq("id", id).maybeSingle();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error("لم يتم العثور على الترخيص");
  return data;
}

export async function getSupabaseLicenseEvents(id: string) {
  const client = requireSupabase();
  const { data, error } = await client.from("license_events").select("id, event_type, note, created_at, performed_by").eq("license_id", id).order("created_at", { ascending: false }).limit(50);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function getSupabaseLicenseAuditLog(id: string) {
  const client = requireSupabase();
  const { data, error } = await client.from("audit_logs").select("id, action, actor_id, metadata, created_at").eq("entity_type", "license").eq("entity_id", id).order("created_at", { ascending: false }).limit(50);
  if (error) raiseSupabaseError(error);
  const actorIds = Array.from(new Set((data ?? []).map((entry) => entry.actor_id).filter((value): value is string => Boolean(value))));
  if (!actorIds.length) return (data ?? []).map((entry) => ({ ...entry, actor_name: null }));
  const { data: profiles, error: profileError } = await client.from("app_profiles").select("user_id, display_name, email").in("user_id", actorIds).limit(50);
  if (profileError) raiseSupabaseError(profileError);
  const names = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.display_name || profile.email || profile.user_id]));
  return (data ?? []).map((entry) => ({ ...entry, actor_name: entry.actor_id ? names.get(entry.actor_id) ?? entry.actor_id : null }));
}

export async function updateSupabaseLicense(id: string, payload: LicenseUpdatePayload) {
  const data = await callLicenseApi<Array<Record<string, unknown>>>("update_license_details", { p_license_id: id, p_payload: toSupabaseClientUpdatePayload(payload) });
  return data?.[0] ?? null;
}

export async function renewSupabaseLicense(id: string, issueDate: Date | string, expiryDate: Date | string, reason: string) {
  const data = await callLicenseApi<Array<Record<string, unknown>>>("renew_license", { p_license_id: id, p_issue_date: isoDate(issueDate), p_expiry_date: isoDate(expiryDate), p_reason: reason });
  return data?.[0] ?? null;
}

export async function changeSupabaseArchiveNumber(id: string, archiveNumber: string, reason: string) {
  const data = await callLicenseApi<Array<Record<string, unknown>>>("change_archive_number", { p_license_id: id, p_new_archive_number: archiveNumber, p_reason: reason });
  return data?.[0] ?? null;
}

export async function archiveSupabaseLicense(id: string, reason: string) {
  await callLicenseApi("archive_license", { p_license_id: id, p_reason: reason });
}

export async function moveSupabaseLicenseToTrash(id: string, reason: string) {
  await callLicenseApi("move_license_to_trash", { p_license_id: id, p_reason: reason });
}

export async function restoreSupabaseLicenseFromTrash(id: string, reason: string) {
  await callLicenseApi("restore_license_from_trash", { p_license_id: id, p_reason: reason });
}


export type SupabaseTeamMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: "user" | "archivist" | "admin";
  accessStatus: "pending" | "approved" | "blocked";
  createdAt: string;
};

export async function listSupabaseTeamMembers() {
  const data = await callLicenseApi<Array<Record<string, unknown>>>("list_team_members", {});
  return (data ?? []).map((member) => ({
    id: String(member.user_id),
    name: member.display_name ? String(member.display_name) : null,
    email: member.email ? String(member.email) : null,
    role: String(member.role) as SupabaseTeamMember["role"],
    accessStatus: String(member.access_status) as SupabaseTeamMember["accessStatus"],
    createdAt: String(member.created_at),
  }));
}

export async function setSupabaseTeamRole(userId: string, role: SupabaseTeamMember["role"]) {
  return callLicenseApi("set_team_role", { p_user_id: userId, p_role: role });
}

export async function setSupabaseTeamAccessStatus(userId: string, accessStatus: SupabaseTeamMember["accessStatus"]) {
  return callLicenseApi("set_team_access_status", { p_user_id: userId, p_access_status: accessStatus });
}


function stableSerialize(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(isoDate(value));
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type SupabaseOperationalCreateInput = {
  licenseNo: string;
  facilityName: string;
  facilityType: "pharmacy" | "warehouse";
  holderName: string;
  holderNationalId: string;
  governorate: string;
  issueDate: Date | string;
  expiryDate: Date | string;
};

export async function createSupabaseOperationalLicense(input: SupabaseOperationalCreateInput, idempotencyKey: string = crypto.randomUUID()) {
  const payload = {
    license_no: input.licenseNo.trim(),
    facility_name: input.facilityName.trim(),
    facility_type: input.facilityType,
    holder_name: input.holderName.trim(),
    holder_national_id: input.holderNationalId.trim(),
    governorate: input.governorate.trim(),
    issue_date: isoDate(input.issueDate),
    expiry_date: isoDate(input.expiryDate),
  };
  const requestHash = await sha256(stableSerialize(payload));
  const data = await callLicenseApi<Array<Record<string, unknown>>>("create_operational_license_idempotent", {
    p_payload: payload,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
  });
  return { result: data?.[0] ?? null, idempotencyKey };
}


export type SupabaseTeamInvitation = {
  id: string;
  invitedEmail: string;
  invitedRole: "user" | "archivist";
  status: "pending" | "accepted" | "rejected" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
  invitedBy: string;
};

export async function createSupabaseTeamInvitation(email: string, role: "user" | "archivist", expiresAt: Date) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const tokenHash = await sha256(token);
  const data = await callLicenseApi<Array<Record<string, unknown>>>("create_team_invitation", {
    p_invited_email: email.trim(),
    p_invited_role: role,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt.toISOString(),
  });
  const invitationId = String(data?.[0]?.invitation_id ?? "");
  return { invitationId, token, link: `${window.location.origin}/supabase-development/invitations/accept?invitation=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}` };
}

export async function listSupabaseTeamInvitations() {
  const data = await callLicenseApi<Array<Record<string, unknown>>>("list_team_invitations", {});
  return (data ?? []).map((item) => ({
    id: String(item.id),
    invitedEmail: String(item.invited_email),
    invitedRole: String(item.invited_role) as SupabaseTeamInvitation["invitedRole"],
    status: String(item.status) as SupabaseTeamInvitation["status"],
    createdAt: String(item.created_at),
    expiresAt: String(item.expires_at),
    invitedBy: String(item.invited_by),
  }));
}

export async function revokeSupabaseTeamInvitation(id: string, reason: string) {
  await callLicenseApi("revoke_team_invitation", { p_invitation_id: id, p_reason: reason });
}

export async function acceptSupabaseTeamInvitation(id: string, token: string) {
  return callLicenseApi("accept_team_invitation", { p_invitation_id: id, p_token_hash: await sha256(token) });
}

export async function rejectSupabaseTeamInvitation(id: string, token: string) {
  await callLicenseApi("reject_team_invitation", { p_invitation_id: id, p_token_hash: await sha256(token) });
}

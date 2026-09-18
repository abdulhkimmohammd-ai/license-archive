import { describe, expect, it } from "vitest";
import { normalizeSupabaseLicense, normalizeSupabaseOperationalList, toSupabaseOperationalCreatePayload, toSupabaseUpdatePayload } from "./supabaseLicenses";

describe("Supabase license router helpers", () => {
  it("maps only editable fields and never maps archive identity", () => {
    const payload = toSupabaseUpdatePayload({
      holderName: "مالك مختبر",
      holderPhone: null,
      issueDate: new Date("2026-08-01T00:00:00.000Z"),
      expiryDate: new Date("2028-08-01T00:00:00.000Z"),
    });

    expect(payload).toEqual({
      holder_name: "مالك مختبر",
      holder_phone: null,
      issue_date: "2026-08-01",
      expiry_date: "2028-08-01",
    });
    expect(payload).not.toHaveProperty("archive_number");
    expect(payload).not.toHaveProperty("license_no");
  });

  it("normalizes UUID-backed Supabase rows for the existing Arabic UI", () => {
    const license = normalizeSupabaseLicense({
      id: "8f4a8b37-0123-4cba-9e55-000000000001",
      license_no: "صيدلية-6543",
      archive_number: "6543-0001ص",
      facility_name: "صيدلية الاختبار",
      facility_type: "pharmacy",
      holder_name: "مالك الاختبار",
      governorate: "صنعاء",
      issue_date: "2026-08-01",
      expiry_date: "2028-08-01",
      status: "active",
      created_at: "2026-08-01T00:00:00.000Z",
    });

    expect(license.id).toBe("8f4a8b37-0123-4cba-9e55-000000000001");
    expect(license.archiveNumber).toBe("6543-0001ص");
    expect(license.licenseNo).toBe("صيدلية-6543");
    expect(license.daysRemaining).toBeTypeOf("number");
  });

  it("preserves the current page contract for server-side Supabase pagination", () => {
    const result = normalizeSupabaseOperationalList([{
      id: "8f4a8b37-0123-4cba-9e55-000000000002",
      license_no: "مخزن-8765",
      archive_number: "8765-0001م",
      facility_name: "مخزن الاختبار",
      facility_type: "warehouse",
      holder_name: "مالك الاختبار",
      governorate: "صنعاء",
      issue_date: "2026-08-01",
      expiry_date: "2028-08-01",
      archive_date: "2026-08-02",
      status: "active",
      created_at: "2026-08-01T00:00:00.000Z",
      total_count: 41,
    }], 2, 20);

    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 41, totalPages: 3, offset: 20 });
    expect(result.items[0]).toMatchObject({ archiveNumber: "8765-0001م", effectiveStatus: "active" });
  });

  it("maps operational creation fields without allowing a client archive number", () => {
    const payload = toSupabaseOperationalCreatePayload({
      licenseNo: "ترخيص-6543",
      facilityName: "صيدلية اختبار",
      facilityType: "pharmacy",
      holderName: "مالك اختبار",
      holderNationalId: "ID-6543",
      governorate: "صنعاء",
      issueDate: new Date("2026-08-01T00:00:00.000Z"),
      expiryDate: new Date("2028-08-01T00:00:00.000Z"),
      graduationPlace: "صنعاء",
      graduationInstitutionType: "university",
    });

    expect(payload).toMatchObject({
      license_no: "ترخيص-6543",
      facility_type: "pharmacy",
      graduation_place: "صنعاء",
      graduation_institution_type: "university",
    });
    expect(payload).not.toHaveProperty("archive_number");
  });
});

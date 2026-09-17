import { describe, expect, it } from "vitest";
import { toSupabaseClientUpdatePayload } from "./licenseApi";

describe("licenseApi client contract", () => {
  it("maps editable fields and dates to the Supabase RPC payload", () => {
    expect(toSupabaseClientUpdatePayload({
      facilityName: "صيدلية اختبار",
      issueDate: new Date("2026-08-01T00:00:00.000Z"),
      expiryDate: "2028-08-01",
      notes: null,
    })).toEqual({
      facility_name: "صيدلية اختبار",
      issue_date: "2026-08-01",
      expiry_date: "2028-08-01",
      notes: null,
    });
  });

  it("does not forward license or archive numbers through details update", () => {
    expect(toSupabaseClientUpdatePayload({
      licenseNo: "6543-0001ص",
      archiveNumber: "6543-0001ص",
      facilityName: "صيدلية اختبار",
    })).toEqual({ facility_name: "صيدلية اختبار" });
  });
});

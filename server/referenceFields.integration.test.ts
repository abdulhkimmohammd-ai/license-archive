import { describe, expect, it } from "vitest";
import { buildLicensesCsv, buildPrintRows } from "../client/src/lib/licensePresentation";
import { licenseInput, serializeLicense } from "./routers/licenses";

const core = { licenseNo: "R-1", facilityName: "منشأة", facilityType: "pharmacy" as const, holderName: "صاحب", holderNationalId: "123", governorate: "صنعاء", address: "العنوان", archiveNumber: "ARC-1", issueDate: new Date("2026-01-01"), expiryDate: new Date("2028-01-01") };
const persisted = (values: Record<string, unknown>) => serializeLicense({ id: 1, ...core, status: "active", holderPhone: null, qualification: null, graduationPlace: null, graduationDate: null, professionalLicenseNo: null, professionalLicenseIssueDate: null, siteInspectionFormNo: null, siteInspectionFormDate: null, committeeMinutesNo: null, committeeMinutesDate: null, feeReceiptNo: null, feeReceiptDate: null, propertyOwnerName: null, healthOfficeIssueDate: null, licenseDeliveryDate: null, notes: null, archiveReason: null, archivedBy: null, archivedAt: null, createdBy: 1, updatedBy: 1, createdAt: new Date(), updatedAt: new Date(), ...values } as never);

describe("reference fields server flow", () => {
  it("accepts an empty optional reference set and reads it safely", () => {
    const input = licenseInput.parse(core);
    expect(input.siteInspectionFormNo).toBeUndefined();
    const read = persisted({});
    expect(read.siteInspectionFormNo).toBeNull();
    expect(buildPrintRows(read).some(([label]) => label === "رقم استمارة معاينة الموقع")).toBe(false);
  });

  it("carries saved references into read, print, and CSV payloads", () => {
    const input = licenseInput.parse({ ...core, siteInspectionFormNo: "INS-1", siteInspectionFormDate: new Date("2025-12-01"), committeeMinutesNo: "COM-1", committeeMinutesDate: new Date("2025-12-02"), feeReceiptNo: "REC-1", feeReceiptDate: new Date("2025-12-03"), licenseDeliveryDate: new Date("2026-01-09") });
    const read = persisted(input);
    expect(read.feeReceiptNo).toBe("REC-1");
    expect(new Map(buildPrintRows(read)).get("رقم محضر اللجنة")).toBe("COM-1");
    expect(buildLicensesCsv([{ ...read, effectiveStatus: "active" }])).toContain("INS-1");
  });
});

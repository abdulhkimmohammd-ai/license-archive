import { describe, expect, it } from "vitest";
import { buildArchiveCsv, buildLicensesCsv, buildPrintRows, displayOptional, formatOptionalDate } from "../client/src/lib/licensePresentation";
import { licenseInput } from "./routers/licenses";

describe("license presentation for legacy and expanded records", () => {
  it("uses a visible safe placeholder for optional details in legacy records", () => {
    expect(displayOptional(null)).toBe("—");
    expect(displayOptional("   ")).toBe("—");
    expect(formatOptionalDate(null)).toBe("—");
  });

  it("exports expanded fields and leaves missing legacy values blank without serializing null", () => {
    const csv = buildLicensesCsv([{ licenseNo: "A-1", facilityName: "منشأة", facilityType: "warehouse", holderName: "صاحب", holderNationalId: "123", holderPhone: null, qualification: null, graduationDate: null, professionalLicenseNo: null, professionalLicenseIssueDate: null, governorate: "صنعاء", address: "العنوان", propertyOwnerName: null, effectiveStatus: "active", issueDate: new Date("2026-01-01"), healthOfficeIssueDate: null, expiryDate: new Date("2028-01-01"), archiveNumber: "ARC-1" }]);
    expect(csv).toContain("رقم مزاولة المهنة");
    expect(csv).toContain("A-1");
    expect(csv).not.toContain("null");
    expect(csv).not.toContain("مكان التخرج");
  });

  it("exports the archive search result fields as an Excel-compatible CSV and protects formulas", () => {
    const csv = buildArchiveCsv([{ archiveNumber: "4-3301-ص", licenseNo: "=A1", facilityName: "صيدلية الشفاء", facilityType: "pharmacy", holderName: "أحمد", effectiveStatus: "active", archiveDate: new Date("2026-08-17"), archiveOfficerName: null, issueDate: new Date("2026-08-01") }]);
    expect(csv.startsWith("\ufeffرقم الأرشيف")).toBe(true);
    expect(csv).toContain("اسم المالك");
    expect(csv).toContain("صيدلية الشفاء");
    expect(csv).toContain("'=A1");
    expect(csv).not.toContain("null");
  });

  it("carries parsed detail fields to the print rows and CSV contract without persistence", () => {
    const input = licenseInput.parse({ licenseNo: "A-2", facilityName: "منشأة", facilityType: "pharmacy", holderName: "صاحب", holderNationalId: "123", nationalIdIssuedBy: "الأحوال المدنية", nationalIdIssueGovernorate: "صنعاء", nationalIdIssueDate: new Date("2019-01-01"), birthPlace: "صنعاء", birthGovernorate: "صنعاء", birthDate: new Date("1990-03-02"), holderPhone: "777123456", qualification: "بكالوريوس صيدلة", graduationPlace: "الجامعة", graduationDate: new Date("2020-07-01"), professionalLicenseNo: "PH-1", professionalLicenseIssueDate: new Date("2021-01-01"), governorate: "صنعاء", address: "العنوان", propertyOwnerName: "مالك", archiveNumber: "ARC-2", issueDate: new Date("2026-01-01"), healthOfficeIssueDate: new Date("2026-01-02"), expiryDate: new Date("2028-01-01") });
    const printRows = new Map(buildPrintRows({ ...input, siteInspectionFormNo: "INS-11", siteInspectionFormDate: new Date("2025-12-01"), committeeMinutesNo: "COM-22", committeeMinutesDate: new Date("2025-12-05"), feeReceiptNo: "REC-33", feeReceiptDate: new Date("2025-12-10"), licenseDeliveryDate: new Date("2026-01-09") }));
    expect(printRows.get("رقم الهاتف")).toBe("777123456");
    expect(printRows.get("البطاقة صادرة من")).toBe("الأحوال المدنية");
    expect(printRows.get("مكان الميلاد")).toBe("صنعاء");
    expect(printRows.get("رقم ترخيص مزاولة المهنة")).toBe("PH-1");
    expect(printRows.get("رقم استمارة معاينة الموقع")).toBe("INS-11");
    expect(printRows.get("رقم سند الرسوم القانونية")).toBe("REC-33");
    expect(printRows.has("مكان التخرج")).toBe(false);
    const csv = buildLicensesCsv([{ ...input, effectiveStatus: "active" }]);
    expect(csv).toContain("PH-1");
    expect(csv).toContain("جهة إصدار البطاقة");
    expect(csv).toContain("الأحوال المدنية");
  });

  it("keeps legacy print rows safe when optional fields are null", () => {
    const rows = new Map(buildPrintRows({ holderName: "صاحب", holderNationalId: "123", holderPhone: null, archiveNumber: "ARC-3", issueDate: new Date("2026-01-01"), healthOfficeIssueDate: null, expiryDate: new Date("2028-01-01"), propertyOwnerName: null, qualification: null, graduationPlace: null, graduationDate: null, professionalLicenseNo: null, professionalLicenseIssueDate: null, governorate: "صنعاء" }));
    expect(rows.get("رقم الهاتف")).toBe("—");
    expect(rows.get("المؤهل")).toBe("—");
    expect(rows.get("تاريخ إصدار مكتب الصحة")).toBe("—");
    expect(rows.get("رقم ترخيص مزاولة المهنة")).toBe("—");
    expect(rows.has("رقم استمارة معاينة الموقع")).toBe(false);
  });
});

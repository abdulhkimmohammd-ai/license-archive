import { describe, expect, it } from "vitest";
import { archiveTypeSuffix, buildArchiveNumber, licenseInput, resolveLicenseExpiryDate, serializeLicense, validateQualificationRules } from "./routers/licenses";

const baseInput = {
  licenseNo: "A-23301",
  facilityName: "مخزن تجريبي",
  facilityType: "warehouse" as const,
  holderName: "صاحب الترخيص",
  holderNationalId: "123456789",
  governorate: "صنعاء",
  address: "المنطقة، الشارع الرئيسي",
  archiveNumber: "ARC-001",
  issueDate: new Date("2026-01-01"),
  expiryDate: new Date("2028-01-01"),
};

describe("license detail contract", () => {
  it("accepts personal, professional, property, and optional issue-reference fields", () => {
    const parsed = licenseInput.parse({
      ...baseInput,
      nationalIdIssuedBy: "الأحوال المدنية",
      nationalIdIssueGovernorate: "صنعاء",
      nationalIdIssueDate: new Date("2019-01-01"),
      birthPlace: "صنعاء",
      birthGovernorate: "صنعاء",
      birthDate: new Date("1990-03-02"),
      holderPhone: "777123456",
      qualification: "بكالوريوس صيدلة",
      graduationPlace: "جامعة صنعاء",
      graduationCountry: "اليمن",
      graduationInstitute: "المعهد الصحي",
      graduationDate: new Date("2020-07-01"),
      professionalLicenseNo: "PH-4001",
      professionalLicenseIssueDate: new Date("2021-01-15"),
      previousLicenseNo: "PH-3011",
      previousLicenseIssuedBy: "مكتب الصحة والسكان",
      previousLicenseIssueDate: new Date("2024-01-15"),
      propertyOwnerName: "مالك العقار",
      street: "شارع الزبيري",
      area: "التحرير",
      district: "صنعاء القديمة",
      healthOfficeIssueDate: new Date("2026-01-05"),
      siteInspectionFormNo: "INS-11",
      siteInspectionFormDate: new Date("2025-12-01"),
      committeeMinutesNo: "COM-22",
      committeeMinutesDate: new Date("2025-12-05"),
      feeReceiptNo: "REC-33",
      feeReceiptDate: new Date("2025-12-10"),
      licenseDeliveryDate: new Date("2026-01-09"),
      archiveDate: new Date("2026-01-10"),
      archiveOfficerName: "احمد محمد المشدلي",
      healthOfficeDirectorName: "د. مجاهد احمد الخطري",
      healthOfficeDirectorGovernorate: "صنعاء",
    });
    expect(parsed.holderPhone).toBe("777123456");
    expect(parsed.nationalIdIssuedBy).toBe("الأحوال المدنية");
    expect(parsed.birthPlace).toBe("صنعاء");
    expect(parsed.professionalLicenseNo).toBe("PH-4001");
    expect(parsed.previousLicenseNo).toBe("PH-3011");
    expect(parsed.previousLicenseIssuedBy).toBe("مكتب الصحة والسكان");
    expect(parsed.graduationCountry).toBe("اليمن");
    expect(parsed.graduationInstitute).toBe("المعهد الصحي");
    expect(parsed.street).toBe("شارع الزبيري");
    expect(parsed.area).toBe("التحرير");
    expect(parsed.district).toBe("صنعاء القديمة");
    expect(parsed.propertyOwnerName).toBe("مالك العقار");
    expect(parsed.committeeMinutesNo).toBe("COM-22");
    expect(parsed.feeReceiptNo).toBe("REC-33");
    expect(parsed.archiveOfficerName).toBe("احمد محمد المشدلي");
    expect(parsed.healthOfficeDirectorName).toBe("د. مجاهد احمد الخطري");
    expect(parsed.healthOfficeDirectorGovernorate).toBe("صنعاء");
  });

  it("accepts the qualification degree and institution type dropdown values", () => {
    const warehouse = licenseInput.parse({ ...baseInput, qualificationLevel: "diploma", graduationInstitutionType: "institute" });
    const pharmacy = licenseInput.parse({ ...baseInput, facilityType: "pharmacy", qualificationLevel: "bachelor", graduationInstitutionType: "university" });
    expect(warehouse.qualificationLevel).toBe("diploma");
    expect(warehouse.graduationInstitutionType).toBe("institute");
    expect(pharmacy.qualificationLevel).toBe("bachelor");
    expect(pharmacy.graduationInstitutionType).toBe("university");
  });

  it("enforces the qualification rules for warehouse and pharmacy records", () => {
    expect(() => validateQualificationRules({ facilityType: "warehouse", qualificationLevel: "bachelor", graduationInstitutionType: "institute" })).toThrow("دبلوم");
    expect(() => validateQualificationRules({ facilityType: "pharmacy", qualificationLevel: "bachelor", graduationInstitutionType: "institute" })).toThrow("جامعة");
    expect(() => validateQualificationRules({ facilityType: "warehouse", qualificationLevel: "diploma", graduationInstitutionType: "institute" })).not.toThrow();
    expect(() => validateQualificationRules({ facilityType: "pharmacy", qualificationLevel: "bachelor", graduationInstitutionType: "university" })).not.toThrow();
  });

  it("requires a manual expiry date for warehouses and derives the pharmacy expiry after two years", () => {
    expect(() => resolveLicenseExpiryDate({ facilityType: "warehouse", issueDate: new Date("2026-01-01") })).toThrow("تاريخ انتهاء ترخيص المخزن");
    expect(resolveLicenseExpiryDate({ facilityType: "warehouse", issueDate: new Date("2026-01-01"), expiryDate: new Date("2029-06-15") })).toEqual(new Date("2029-06-15"));
    expect(resolveLicenseExpiryDate({ facilityType: "pharmacy", issueDate: new Date("2026-01-01"), expiryDate: new Date("2030-01-01") })).toEqual(new Date("2028-01-01"));
  });

  it("builds archive numbers with the facility marker", () => {
    expect(archiveTypeSuffix("pharmacy")).toBe("ص");
    expect(archiveTypeSuffix("warehouse")).toBe("م");
    expect(buildArchiveNumber(2, "A-23301", "pharmacy")).toBe("3301-0002ص");
    expect(buildArchiveNumber(4, "PH-9876", "warehouse")).toBe("9876-0004م");
  });

  it("accepts a missing detailed address for a license record", () => {
    const parsed = licenseInput.parse({ ...baseInput, address: undefined });
    expect(parsed.address).toBeUndefined();
  });

  it("allows the hidden archive number to be omitted", () => {
    const parsed = licenseInput.parse({ ...baseInput, archiveNumber: undefined });
    expect(parsed.archiveNumber).toBe("");
  });

  it("keeps legacy records without optional values display-safe", () => {
    const parsed = licenseInput.parse(baseInput);
    expect(parsed.holderPhone).toBeUndefined();
    expect(parsed.nationalIdIssuedBy).toBeUndefined();
    expect(parsed.birthPlace).toBeUndefined();
    expect(parsed.qualification).toBeUndefined();
    expect(parsed.graduationCountry).toBeUndefined();
    expect(parsed.street).toBeUndefined();
    expect(parsed.siteInspectionFormNo).toBeUndefined();
    expect(parsed.licenseDeliveryDate).toBeUndefined();
    const legacy = serializeLicense({
      id: 1, ...baseInput, status: "active", nationalIdIssuedBy: null, nationalIdIssueGovernorate: null, nationalIdIssueDate: null, birthPlace: null, birthGovernorate: null, birthDate: null, holderPhone: null, qualification: null, graduationPlace: null, graduationCountry: null, graduationInstitute: null, graduationDate: null,
      professionalLicenseNo: null, professionalLicenseIssueDate: null, previousLicenseNo: null, previousLicenseIssuedBy: null, previousLicenseIssueDate: null, siteInspectionFormNo: null, siteInspectionFormDate: null, committeeMinutesNo: null, committeeMinutesDate: null, feeReceiptNo: null, feeReceiptDate: null, street: null, area: null, district: null, propertyOwnerName: null, healthOfficeIssueDate: null, healthOfficeDirectorName: null, healthOfficeDirectorGovernorate: null, licenseDeliveryDate: null, licenseDeliveryRecipientName: null, licenseDeliverySignature: null, licenseDeliveryFingerprint: null,
      notes: null, archiveReason: null, archivedBy: null, archivedAt: null, createdBy: 1, updatedBy: 1, createdAt: new Date(), updatedAt: new Date(),
    });
    expect(legacy.holderPhone).toBeNull();
    expect(legacy.nationalIdIssuedBy).toBeNull();
    expect(legacy.birthPlace).toBeNull();
    expect(legacy.professionalLicenseNo).toBeNull();
    expect(legacy.previousLicenseNo).toBeNull();
    expect(legacy.siteInspectionFormNo).toBeNull();
    expect(legacy.effectiveStatus).toBe("active");
  });
});

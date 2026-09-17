import { describe, expect, it } from "vitest";
import {
  MINISTRY_BACK_FIELD_COORDINATES,
  MINISTRY_BACK_OFFICIAL_COORDINATES,
  MINISTRY_BACK_OFFICIAL_NAMES,
  MINISTRY_BACK_FIELD_LABELS,
  MINISTRY_FRONT_FIELD_COORDINATES,
  MINISTRY_FRONT_LAYOUT,
  MINISTRY_PRINT_PAGE_SIZE,
  getMinistryPrintMessage,
  MINISTRY_DATE_TEXT_SIZE,
  MINISTRY_FRONT_TEXT_SIZE,
  MINISTRY_HOLDER_FONT_WEIGHT,
  MINISTRY_ARCHIVE_TEXT_SIZE,
  getMinistryBackFieldCoordinates,
  getMinistryFrontLayout,
  getMinistryPrintTemplate,
  shouldPrintExpiryDate,
  shouldPrintBackOfficials,
} from "../client/src/lib/ministryPrint";

describe("Ministry print contract", () => {
  it("explains authentication and print-data failures instead of showing a generic error", () => {
    expect(getMinistryPrintMessage({ authLoading: true, queryLoading: false, hasData: false })).toContain("التحقق من جلسة الدخول");
    expect(getMinistryPrintMessage({ authLoading: false, queryLoading: false, hasData: false })).toContain("انتهت جلسة الدخول");
    expect(getMinistryPrintMessage({ authLoading: false, userRole: "user", queryLoading: false, hasData: false })).toContain("مدير النظام");
    expect(getMinistryPrintMessage({ authLoading: false, userRole: "admin", queryLoading: false, hasData: false, errorCode: "NOT_FOUND" })).toContain("لم يتم العثور");
    expect(getMinistryPrintMessage({ authLoading: false, userRole: "admin", queryLoading: false, hasData: true })).toBeNull();
  });

  it("keeps the requested back-side wording explicit", () => {
    expect(MINISTRY_BACK_FIELD_LABELS.inspectionNumber).toContain("استمارة معاينة الموقع");
    expect(MINISTRY_BACK_FIELD_LABELS.committeeNumber).toContain("محضر اللجنة الخاصة بالمنشآت الصيدلانية");
    expect(MINISTRY_BACK_FIELD_LABELS.feeNumber).toContain("الرسوم القانونية");
    expect(MINISTRY_BACK_FIELD_LABELS.previousLicenseNo).toContain("الترخيص السابق");
    expect(MINISTRY_BACK_FIELD_LABELS.archiveFacilityName).toContain("اسم المنشأة");
    expect(MINISTRY_BACK_FIELD_LABELS.archiveOwnerName).toContain("اسم مالك المنشأة");
    expect(MINISTRY_BACK_FIELD_LABELS.archiveNumber).toContain("رقم الأرشيف");
    expect(MINISTRY_BACK_FIELD_LABELS.archiveDate).toContain("تاريخ قيد الأرشيف");
    expect(MINISTRY_BACK_FIELD_LABELS.archiveOfficerName).toContain("رئيس قسم الأرشيف");
    expect(MINISTRY_BACK_FIELD_LABELS.validityStart).toContain("عامان");
    expect(MINISTRY_BACK_FIELD_LABELS.validityEnd).toBe("وينتهي في");
  });

  it("applies the requested front-side offsets", () => {
    expect(MINISTRY_FRONT_FIELD_COORDINATES.holderNationalId.x).toBe(170);
    expect(MINISTRY_FRONT_FIELD_COORDINATES.nationalIdIssuedBy.x).toBe(37.5);
    expect(MINISTRY_FRONT_FIELD_COORDINATES.nationalIdIssueGovernorate.x).toBe(77);
    expect(MINISTRY_FRONT_FIELD_COORDINATES.nationalIdIssueDate.x).toBe(109);
    expect(MINISTRY_FRONT_FIELD_COORDINATES.holderName).toMatchObject({ x: 91, y: 120.75 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.nationalIdIssuedBy).toMatchObject({ x: 37.5, y: 131.5 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.birthPlace).toMatchObject({ x: 37.5, y: 140 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.birthGovernorate).toMatchObject({ x: 82, y: 140.25 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.birthDate).toMatchObject({ x: 111.5, y: 140.25 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.graduationCountry).toMatchObject({ x: 89, y: 148.75 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.graduationInstitute).toMatchObject({ x: 138.5, y: 148.75 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.graduationYear).toMatchObject({ x: 174, y: 148.75 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.professionalLicenseNo).toMatchObject({ x: 112, y: 159.75 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.professionalLicenseIssueDate).toMatchObject({ x: 156.5, y: 159.75 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.facilityName).toMatchObject({ x: 72, y: 171, width: 55 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.street).toMatchObject({ x: 149, y: 170.75 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.area).toMatchObject({ x: 27, y: 179 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.district).toMatchObject({ x: 75, y: 179 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.propertyOwner).toMatchObject({ x: 143, y: 179 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.healthOfficeIssueDate).toMatchObject({ x: 106, y: 196 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.healthOfficeDirector).toMatchObject({ x: 121, y: 222.5 });
    expect(MINISTRY_FRONT_FIELD_COORDINATES.healthOfficeDirectorGovernorate).toMatchObject({ x: 121, y: 228.5 });
    expect(MINISTRY_FRONT_TEXT_SIZE).toBe(12);
    expect(MINISTRY_DATE_TEXT_SIZE).toBe(12);
    expect(MINISTRY_HOLDER_FONT_WEIGHT).toBe(900);
    expect(MINISTRY_ARCHIVE_TEXT_SIZE).toBe(12);
  });

  it("locks the front layout dimensions and coordinates", () => {
    expect(MINISTRY_PRINT_PAGE_SIZE).toEqual({ widthMm: 197, heightMm: 250 });
    expect(MINISTRY_FRONT_LAYOUT.page).toBe(MINISTRY_PRINT_PAGE_SIZE);
    expect(MINISTRY_FRONT_LAYOUT.fields).toBe(MINISTRY_FRONT_FIELD_COORDINATES);
    expect(Object.isFrozen(MINISTRY_FRONT_LAYOUT)).toBe(true);
    expect(Object.isFrozen(MINISTRY_FRONT_LAYOUT.fields)).toBe(true);
    expect(Object.isFrozen(MINISTRY_FRONT_LAYOUT.fields.holderName)).toBe(true);
    expect(MINISTRY_FRONT_LAYOUT.textSize).toBe(12);
    expect(MINISTRY_FRONT_LAYOUT.dateTextSize).toBe(12);
  });

  it("uses the same calibrated front layout for pharmacy and warehouse templates", () => {
    expect(getMinistryFrontLayout("pharmacy")).toBe(MINISTRY_FRONT_LAYOUT);
    expect(getMinistryFrontLayout("warehouse")).toBe(MINISTRY_FRONT_LAYOUT);
    expect(getMinistryFrontLayout("pharmacy").fields.holderNationalId).toEqual({ x: 170, y: 120.75, width: 27 });
    expect(getMinistryFrontLayout("warehouse").fields.professionalLicenseIssueDate).toEqual({ x: 156.5, y: 159.75, width: 27 });
  });

  it("keeps back-side date and archive offsets within the 19.7cm card", () => {
    expect(MINISTRY_BACK_FIELD_COORDINATES.inspectionNumber.x).toBe(133);
    expect(MINISTRY_BACK_FIELD_COORDINATES.inspectionDate.x).toBe(176);
    expect(MINISTRY_BACK_FIELD_COORDINATES.committeeDate.x).toBe(146);
    expect(MINISTRY_BACK_FIELD_COORDINATES.feeDate.x).toBe(151);
    expect(MINISTRY_BACK_FIELD_COORDINATES.validityStart.x).toBe(134);
    expect(MINISTRY_BACK_FIELD_COORDINATES.validityEnd.x).toBe(78);
    expect(MINISTRY_BACK_FIELD_COORDINATES.validityStart.y).toBe(40);
    expect(MINISTRY_BACK_FIELD_COORDINATES.archiveFacilityName).toEqual({ x: 89, y: 133, width: 50 });
    expect(MINISTRY_BACK_FIELD_COORDINATES.archiveOwnerName).toEqual({ x: 19, y: 133, width: 44 });
    expect(MINISTRY_BACK_FIELD_COORDINATES.archiveNumber).toEqual({ x: 83, y: 142, width: 38 });
    expect(MINISTRY_BACK_FIELD_COORDINATES.archiveDate).toEqual({ x: 20, y: 142, width: 42 });
    expect(MINISTRY_BACK_FIELD_COORDINATES.archiveOfficerName).toEqual({ x: 70, y: 151, width: 54 });
    expect(MINISTRY_BACK_OFFICIAL_COORDINATES.licensingHead).toMatchObject({ x: 23, y: 102, width: 62 });
    expect(MINISTRY_BACK_OFFICIAL_COORDINATES.pharmacyDirector).toMatchObject({ x: 122, y: 102, width: 62 });
    expect(MINISTRY_BACK_OFFICIAL_NAMES.licensingHead).toBe("د. علي حسين العرادي");
    expect(MINISTRY_BACK_OFFICIAL_NAMES.pharmacyDirector).toBe("د. توفيق المريسي");
  });

  it("selects a separate pharmacy template without an expiry date and a warehouse template with one", () => {
    const pharmacy = getMinistryPrintTemplate("pharmacy");
    const warehouse = getMinistryPrintTemplate("warehouse");
    expect(pharmacy).toMatchObject({ displayName: "نموذج الصيدلية", holderTitle: "الصيدلاني", qualificationTitle: "بكالوريوس صيدلة", institutionTitle: "جامعة", showExpiryDate: false, showPreviousLicenseClause: true });
    expect(warehouse).toMatchObject({ displayName: "نموذج مخزن الأدوية", holderTitle: "فني صيدلة", qualificationTitle: "دبلوم صيدلة", institutionTitle: "معهد", showExpiryDate: true, showPreviousLicenseClause: false });
    expect(pharmacy.frontReference).not.toBe(warehouse.frontReference);
    expect(warehouse.backReference).not.toBe(pharmacy.backReference);
    expect(warehouse.frontReference).toBe("/manus-storage/ministry-warehouse-front-new_85a339f3.jpg");
    expect(getMinistryBackFieldCoordinates("pharmacy")).not.toBe(getMinistryBackFieldCoordinates("warehouse"));
    expect(getMinistryBackFieldCoordinates("pharmacy")).toHaveProperty("previousLicenseNo");
    expect(getMinistryBackFieldCoordinates("warehouse")).not.toHaveProperty("previousLicenseNo");
    expect(shouldPrintExpiryDate("pharmacy")).toBe(false);
    expect(shouldPrintExpiryDate("warehouse")).toBe(true);
    expect(shouldPrintBackOfficials("pharmacy")).toBe(true);
    expect(shouldPrintBackOfficials("warehouse")).toBe(true);
  });
});

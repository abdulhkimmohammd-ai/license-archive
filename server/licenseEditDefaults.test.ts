import { describe, expect, it } from "vitest";
import { getSafeLicenseEditDefaults } from "../client/src/lib/licenseEditDefaults";

describe("ترقيم القيم الافتراضية في تعديل الترخيص", () => {
  it("يعالج سجل الترخيص القديم عند غياب نوع المنشأة وبيانات المؤهل", () => {
    expect(getSafeLicenseEditDefaults({})).toMatchObject({
      facilityType: "warehouse",
      qualificationLevel: "diploma",
      graduationInstitutionType: "institute",
      qualificationLabel: "دبلوم صيدلة",
    });
  });

  it("يحافظ على القيم الصحيحة المتوافقة مع الصيدلية", () => {
    expect(getSafeLicenseEditDefaults({ facilityType: "pharmacy", qualificationLevel: "bachelor", graduationInstitutionType: "university" })).toMatchObject({
      facilityType: "pharmacy",
      qualificationLevel: "bachelor",
      graduationInstitutionType: "university",
    });
  });
});

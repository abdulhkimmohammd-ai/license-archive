import { describe, expect, it } from "vitest";
import { getLicenseSaveGuidance, getMissingRequiredLicenseFields } from "../client/src/lib/licenseFormValidation";

describe("License form guidance", () => {
  it("يسرد أسماء الحقول الإلزامية الناقصة باللغة العربية", () => {
    expect(getMissingRequiredLicenseFields({ licenseNo: "", facilityName: "", holderName: "", holderNationalId: "", governorate: "", address: "", issueDate: "" }))
      .toEqual(["رقم الترخيص", "اسم المنشأة", "اسم صاحب الترخيص", "رقم الهوية", "المحافظة", "تاريخ بداية سريان الترخيص"]);
  });

  it("لا يعرض رسالة منع عند اكتمال الحقول المطلوبة", () => {
    expect(getLicenseSaveGuidance({ licenseNo: "A-1", facilityName: "صيدلية النور", holderName: "أحمد علي", holderNationalId: "12345", governorate: "صنعاء", address: "", issueDate: "2026-08-17" })).toBeNull();
  });
});

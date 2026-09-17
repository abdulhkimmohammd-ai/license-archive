import { describe, expect, it } from "vitest";
import { normalizeLicenseNumber } from "../shared/licenseNumber";

describe("تأكيد الحذف النهائي للترخيص", () => {
  it("يطابق الرقم عند إدخاله بالأرقام العربية أو مع مسافات خفية", () => {
    expect(normalizeLicenseNumber("٦٥٤٤٤٤٤")).toBe("6544444");
    expect(normalizeLicenseNumber(" 6544444‎ ")).toBe("6544444");
    expect(normalizeLicenseNumber("٦٥٤٤٤٤٤")).toBe(normalizeLicenseNumber("6544444"));
  });

  it("لا يطابق رقم ترخيص مختلف", () => {
    expect(normalizeLicenseNumber("6544443")).not.toBe(normalizeLicenseNumber("6544444"));
  });
});

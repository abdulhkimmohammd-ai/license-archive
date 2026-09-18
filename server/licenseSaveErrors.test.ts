import { describe, expect, it } from "vitest";
import { getLicenseCreateErrorMessage } from "./routers/licenses";

describe("License save error messages", () => {
  it("explains duplicate license numbers clearly", () => {
    expect(getLicenseCreateErrorMessage(new Error("Duplicate entry 'A-1' for key 'licenses_license_no_unique'"))).toContain("مسجل بالفعل");
  });

  it("explains missing database values and unknown server errors", () => {
    expect(getLicenseCreateErrorMessage(new Error("Column 'holderName' cannot be null"))).toContain("البيانات الإلزامية");
    expect(getLicenseCreateErrorMessage(new Error("network failure"))).toContain("خطأ مؤقت");
  });
});

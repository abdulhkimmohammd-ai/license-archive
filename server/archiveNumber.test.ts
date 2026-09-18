import { describe, expect, it } from "vitest";
import { buildArchiveNumber, getArchiveSequence, getNextArchiveSequence, isArchiveNumberForLicense, lastFourLicenseDigits } from "../shared/archiveNumber";

describe("عقد رقم الأرشفة المحصن", () => {
  it("يبني تسلسلاً رباعياً بصيغة آخر أربعة أرقام ثم اللاحقة النهائية", () => {
    expect(lastFourLicenseDigits("6543")).toBe("6543");
    expect(buildArchiveNumber(1, "6543", "pharmacy")).toBe("6543-0001ص");
    expect(buildArchiveNumber(2, "6543", "pharmacy")).toBe("6543-0002ص");
    expect(buildArchiveNumber(1, "8765", "warehouse")).toBe("8765-0001م");
    expect(buildArchiveNumber(2, "8765", "warehouse")).toBe("8765-0002م");
  });

  it("يفصل تسلسلي الصيدلية والمخزن ولا يعيد استخدام أعلى تسلسل تاريخي", () => {
    expect(getArchiveSequence("6543-0002ص", "pharmacy")).toBe(2);
    expect(getArchiveSequence("12-9999-ص", "pharmacy")).toBe(12);
    expect(getNextArchiveSequence(["6543-0001ص", "6543-0002ص", "12-9999-ص"], "pharmacy")).toBe(13);
    expect(getNextArchiveSequence(["8765-0001م", "نص غير صالح"], "warehouse")).toBe(2);
  });

  it("يرفض رقماً لا يطابق رقم الترخيص أو نوع المنشأة", () => {
    expect(isArchiveNumberForLicense("6543-0001ص", "6543", "pharmacy")).toBe(true);
    expect(isArchiveNumberForLicense("6543-0001م", "6543", "pharmacy")).toBe(false);
    expect(isArchiveNumberForLicense("8765-0001م", "6543", "warehouse")).toBe(false);
  });
});

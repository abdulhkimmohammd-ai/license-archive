import { describe, expect, it } from "vitest";
import { filterOfflineLicenseIndex, getOfflineLicenseFingerprint, type OfflineLicenseIndexItem } from "../client/src/lib/offlineLicenses";

const rows: OfflineLicenseIndexItem[] = [
  { id: 1, licenseNo: "1234", archiveNumber: "1234-0001ص", facilityName: "صيدلية الأمل", holderName: "أحمد محمد", facilityType: "pharmacy", governorate: "صنعاء", archiveDate: "2026-08-10T00:00:00.000Z", issueDate: "2026-08-01T00:00:00.000Z", expiryDate: "2028-08-01T00:00:00.000Z", effectiveStatus: "active", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: 2, licenseNo: "5678", archiveNumber: "5678-0001م", facilityName: "مخزن الشفاء", holderName: "علي صالح", facilityType: "warehouse", governorate: "عدن", archiveDate: null, issueDate: "2026-07-15T00:00:00.000Z", expiryDate: "2028-07-15T00:00:00.000Z", effectiveStatus: "expired", createdAt: "2026-07-15T00:00:00.000Z" },
];

describe("البحث المحلي للتراخيص", () => {
  it("يبحث بالاسم أو الرقم أو رقم الأرشيف دون الحاجة إلى الشبكة", () => {
    expect(filterOfflineLicenseIndex(rows, { search: "الامل" }).map(item => item.id)).toEqual([1]);
    expect(filterOfflineLicenseIndex(rows, { search: "5678-0001م" }).map(item => item.id)).toEqual([2]);
    expect(filterOfflineLicenseIndex(rows, { search: "أحمد" }).map(item => item.id)).toEqual([1]);
  });

  it("يلتزم بنطاق البحث والفلتر الزمني ونوع المنشأة", () => {
    expect(filterOfflineLicenseIndex(rows, { search: "الشفاء", searchScope: "facility", facilityType: "warehouse", archiveDateFrom: "2026-07-01", archiveDateTo: "2026-07-31" }).map(item => item.id)).toEqual([2]);
    expect(filterOfflineLicenseIndex(rows, { search: "الشفاء", searchScope: "owner" })).toEqual([]);
  });

  it("يبني بصمة ثابتة تمنع تكرار إدراج العملية نفسها في طابور المزامنة", () => {
    expect(getOfflineLicenseFingerprint({ licenseNo: " 6543 ", facilityType: "pharmacy" })).toBe("pharmacy:6543");
    expect(getOfflineLicenseFingerprint({ licenseNo: "6543", facilityType: "warehouse" })).toBe("warehouse:6543");
  });
});

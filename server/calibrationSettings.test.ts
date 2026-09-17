import { describe, expect, it } from "vitest";
import { CALIBRATION_BACK_LABELS, CALIBRATION_FRONT_LABELS, createCalibrationExport, getCalibrationStorageKey, parseCalibrationExport } from "../client/src/lib/calibration";

describe("لوحة إعدادات المعايرة", () => {
  it("تستخدم مسميات عربية للحقول الشائعة", () => {
    expect(CALIBRATION_FRONT_LABELS.holderNationalId).toBe("رقم البطاقة الشخصية");
    expect(CALIBRATION_FRONT_LABELS.professionalLicenseIssueDate).toBe("تاريخ إصدار رخصة المزاولة");
    expect(CALIBRATION_FRONT_LABELS.facilityName).toBe("اسم المنشأة");
    expect(CALIBRATION_FRONT_LABELS.healthOfficeDirectorGovernorate).toBe("محافظة مدير مكتب الصحة");
    expect(CALIBRATION_BACK_LABELS.committeeNumber).toBe("رقم محضر اللجنة");
    expect(CALIBRATION_BACK_LABELS.archiveNumber).toBe("رقم الأرشيف في قيد الأرشفة");
    expect(CALIBRATION_BACK_LABELS.archiveDate).toBe("تاريخ قيد الأرشيف");
    expect(CALIBRATION_BACK_LABELS.archiveOfficerName).toBe("اسم رئيس قسم الأرشيف في قيد الأرشفة");
  });

  it("يفصل إعدادات الصيدلية عن المخزن والوجه الأمامي عن الخلفي", () => {
    expect(getCalibrationStorageKey("pharmacy", "front")).toBe("ministry_pharmacy_front_offsets_custom_v2");
    expect(getCalibrationStorageKey("warehouse", "front")).toBe("ministry_warehouse_front_offsets_custom_v2");
    expect(getCalibrationStorageKey("warehouse", "back")).toBe("ministry_warehouse_back_offsets_custom_v2");
  });

  it("ينشئ ملف تصدير صالحاً ويستعيده فقط عند تطابق البنية", () => {
    const calibration = {
      pharmacy: {
        front: { holderName: { x: 1, y: 2, width: 3 } },
        back: { committeeNumber: { x: 4, y: 5, width: 6 } },
      },
      warehouse: {
        front: { holderName: { x: 7, y: 8, width: 9 } },
        back: { committeeNumber: { x: 10, y: 11, width: 12 } },
      },
    };
    const exported = createCalibrationExport(calibration);
    expect(parseCalibrationExport(exported)?.calibration.warehouse.back.committeeNumber).toEqual({ x: 10, y: 11, width: 12 });
    expect(parseCalibrationExport({ ...exported, version: 99 })).toBeNull();
    expect(parseCalibrationExport({ ...exported, calibration: { pharmacy: exported.calibration.pharmacy } })).toBeNull();
  });
});

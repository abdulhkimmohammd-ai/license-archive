import type { MinistryPrintTemplateKind } from "./ministryPrint";

export type CalibrationSide = "front" | "back";
export type CalibrationCoordinate = { x: number; y: number; width: number };
export type CalibrationFields = Record<string, CalibrationCoordinate>;
export type CalibrationData = Record<MinistryPrintTemplateKind, Record<CalibrationSide, CalibrationFields>>;

export const CALIBRATION_EXPORT_FORMAT = "license-archive-calibration";
export const CALIBRATION_EXPORT_VERSION = 1;

export type CalibrationExportFile = {
  format: typeof CALIBRATION_EXPORT_FORMAT;
  version: typeof CALIBRATION_EXPORT_VERSION;
  exportedAt: string;
  calibration: CalibrationData;
};

export const CALIBRATION_FRONT_LABELS: Record<string, string> = {
  holderName: "اسم صاحب المنشأة",
  holderNationalId: "رقم البطاقة الشخصية",
  nationalIdIssuedBy: "جهة إصدار البطاقة",
  nationalIdIssueGovernorate: "محافظة إصدار البطاقة",
  nationalIdIssueDate: "تاريخ إصدار البطاقة",
  birthPlace: "مكان الميلاد",
  birthGovernorate: "محافظة الميلاد",
  birthDate: "تاريخ الميلاد",
  graduationCountry: "دولة التخرج",
  graduationInstitute: "جهة التخرج (جامعة أو معهد)",
  graduationYear: "عام التخرج",
  professionalLicenseNo: "رقم رخصة مزاولة المهنة",
  professionalLicenseIssueDate: "تاريخ إصدار رخصة المزاولة",
  facilityName: "اسم المنشأة",
  street: "شارع المنشأة",
  area: "منطقة المنشأة",
  district: "مديرية المنشأة",
  propertyOwner: "اسم مالك العقار",
  healthOfficeIssueDate: "تاريخ إصدار الترخيص من مكتب الصحة",
  healthOfficeDirector: "اسم مدير مكتب الصحة",
  healthOfficeDirectorGovernorate: "محافظة مدير مكتب الصحة",
};

export const CALIBRATION_BACK_LABELS: Record<string, string> = {
  inspectionNumber: "رقم استمارة معاينة الموقع",
  inspectionDate: "تاريخ استمارة معاينة الموقع",
  committeeNumber: "رقم محضر اللجنة",
  committeeDate: "تاريخ محضر اللجنة",
  feeNumber: "رقم سند الرسوم القانونية",
  feeDate: "تاريخ سداد الرسوم القانونية",
  previousLicenseNo: "رقم الترخيص السابق (الصيدلية)",
  previousLicenseIssuedBy: "جهة إصدار الترخيص السابق (الصيدلية)",
  previousLicenseIssueDate: "تاريخ إصدار الترخيص السابق (الصيدلية)",
  validityStart: "تاريخ بداية صلاحية الترخيص",
  validityEnd: "تاريخ انتهاء الترخيص",
  archiveFacilityName: "اسم المنشأة في قيد الأرشيف",
  archiveOwnerName: "اسم مالك المنشأة في قيد الأرشيف",
  archiveNumber: "رقم الأرشيف في قيد الأرشفة",
  archiveDate: "تاريخ قيد الأرشيف",
  archiveOfficerName: "اسم رئيس قسم الأرشيف في قيد الأرشفة",
  licensingHead: "اسم رئيس قسم التراخيص",
  pharmacyDirector: "اسم مدير إدارة الصيدلة والتموين الطبي",
};

export function getCalibrationStorageKey(template: MinistryPrintTemplateKind, side: CalibrationSide) {
  return `ministry_${template}_${side}_offsets_custom_v2`;
}

export function getLegacyCalibrationStorageKey(side: CalibrationSide) {
  return side === "front" ? "ministry_front_offsets_custom_v1" : "ministry_back_offsets_custom_v1";
}

export function getCalibrationLabel(side: CalibrationSide, key: string) {
  return (side === "front" ? CALIBRATION_FRONT_LABELS : CALIBRATION_BACK_LABELS)[key] ?? key;
}

function isCoordinate(value: unknown): value is CalibrationCoordinate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return [candidate.x, candidate.y, candidate.width].every((item) => typeof item === "number" && Number.isFinite(item));
}

function isFields(value: unknown): value is CalibrationFields {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length > 0 && Object.values(value as Record<string, unknown>).every(isCoordinate);
}

export function createCalibrationExport(calibration: CalibrationData): CalibrationExportFile {
  return {
    format: CALIBRATION_EXPORT_FORMAT,
    version: CALIBRATION_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    calibration: JSON.parse(JSON.stringify(calibration)) as CalibrationData,
  };
}

export function parseCalibrationExport(input: unknown): CalibrationExportFile | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Record<string, unknown>;
  if (candidate.format !== CALIBRATION_EXPORT_FORMAT || candidate.version !== CALIBRATION_EXPORT_VERSION || typeof candidate.exportedAt !== "string") return null;
  if (!candidate.calibration || typeof candidate.calibration !== "object") return null;
  const calibration = candidate.calibration as Record<string, unknown>;
  const hasValidTemplate = (template: MinistryPrintTemplateKind) => {
    const value = calibration[template];
    return Boolean(value) && typeof value === "object" && isFields((value as Record<string, unknown>).front) && isFields((value as Record<string, unknown>).back);
  };
  if (!hasValidTemplate("pharmacy") || !hasValidTemplate("warehouse")) return null;
  return candidate as unknown as CalibrationExportFile;
}

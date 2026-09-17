import { csvEscape, facilityTypeMap, formatDate, statusMap } from "./licenses";

export function displayOptional(value: string | null | undefined) {
  return value?.trim() || "—";
}

export function formatOptionalDate(value: Date | string | null | undefined) {
  return value ? formatDate(value) : "—";
}

export type PrintableLicenseDetails = {
  holderName: string; holderNationalId: string; nationalIdIssuedBy?: string | null; nationalIdIssueGovernorate?: string | null; nationalIdIssueDate?: Date | string | null; birthPlace?: string | null; birthGovernorate?: string | null; birthDate?: Date | string | null; holderPhone?: string | null; archiveNumber: string; issueDate: Date | string;
  healthOfficeIssueDate?: Date | string | null; expiryDate: Date | string; propertyOwnerName?: string | null; qualification?: string | null;
  graduationDate?: Date | string | null; professionalLicenseNo?: string | null; professionalLicenseIssueDate?: Date | string | null; siteInspectionFormNo?: string | null; siteInspectionFormDate?: Date | string | null; committeeMinutesNo?: string | null; committeeMinutesDate?: Date | string | null; feeReceiptNo?: string | null; feeReceiptDate?: Date | string | null; licenseDeliveryDate?: Date | string | null; governorate: string;
};

export function buildPrintRows(license: PrintableLicenseDetails) {
  const essentialRows = [
    ["صاحب الترخيص", license.holderName], ["رقم الهوية", license.holderNationalId], ["البطاقة صادرة من", displayOptional(license.nationalIdIssuedBy)], ["محافظة إصدار البطاقة", displayOptional(license.nationalIdIssueGovernorate)], ["تاريخ إصدار البطاقة", formatOptionalDate(license.nationalIdIssueDate)], ["مكان الميلاد", displayOptional(license.birthPlace)], ["محافظة الميلاد", displayOptional(license.birthGovernorate)], ["تاريخ الميلاد", formatOptionalDate(license.birthDate)], ["رقم الهاتف", displayOptional(license.holderPhone)], ["رقم القيد في الأرشيف", license.archiveNumber],
    ["بداية سريان الترخيص", formatDate(license.issueDate)], ["تاريخ إصدار مكتب الصحة", formatOptionalDate(license.healthOfficeIssueDate)], ["تاريخ الانتهاء", formatDate(license.expiryDate)], ["مالك العقار", displayOptional(license.propertyOwnerName)],
    ["المؤهل", displayOptional(license.qualification)], ["تاريخ التخرج", formatOptionalDate(license.graduationDate)], ["رقم ترخيص مزاولة المهنة", displayOptional(license.professionalLicenseNo)], ["تاريخ إصدار المزاولة", formatOptionalDate(license.professionalLicenseIssueDate)], ["المحافظة", license.governorate],
  ] as const;
  const optionalRows = [
    ["رقم استمارة معاينة الموقع", license.siteInspectionFormNo], ["تاريخ استمارة المعاينة", license.siteInspectionFormDate ? formatDate(license.siteInspectionFormDate) : null],
    ["رقم محضر اللجنة", license.committeeMinutesNo], ["تاريخ محضر اللجنة", license.committeeMinutesDate ? formatDate(license.committeeMinutesDate) : null],
    ["رقم سند الرسوم القانونية", license.feeReceiptNo], ["تاريخ سند الرسوم", license.feeReceiptDate ? formatDate(license.feeReceiptDate) : null], ["تاريخ تسليم الترخيص لصاحبه", license.licenseDeliveryDate ? formatDate(license.licenseDeliveryDate) : null],
  ] as const;
  return [...essentialRows, ...optionalRows.filter(([, value]) => Boolean(value))].map(([label, value]) => [label, value || ""] as const);
}

type ExportableLicense = {
  licenseNo: string; facilityName: string; facilityType: keyof typeof facilityTypeMap; holderName: string; holderNationalId: string;
  holderPhone?: string | null; nationalIdIssuedBy?: string | null; nationalIdIssueGovernorate?: string | null; nationalIdIssueDate?: Date | string | null; birthPlace?: string | null; birthGovernorate?: string | null; birthDate?: Date | string | null; qualification?: string | null; graduationDate?: Date | string | null;
  professionalLicenseNo?: string | null; professionalLicenseIssueDate?: Date | string | null; siteInspectionFormNo?: string | null; siteInspectionFormDate?: Date | string | null; committeeMinutesNo?: string | null; committeeMinutesDate?: Date | string | null; feeReceiptNo?: string | null; feeReceiptDate?: Date | string | null; licenseDeliveryDate?: Date | string | null; governorate: string; address?: string | null;
  propertyOwnerName?: string | null; effectiveStatus: string; issueDate: Date | string; healthOfficeIssueDate?: Date | string | null;
  expiryDate: Date | string; archiveNumber: string;
};

export function buildLicensesCsv(rows: ExportableLicense[]) {
  const header = ["رقم الترخيص", "اسم المنشأة", "النوع", "صاحب الترخيص", "رقم الهوية", "جهة إصدار البطاقة", "محافظة الإصدار", "تاريخ إصدار البطاقة", "مكان الميلاد", "محافظة الميلاد", "تاريخ الميلاد", "رقم الهاتف", "المؤهل", "تاريخ التخرج", "رقم مزاولة المهنة", "تاريخ إصدار المزاولة", "رقم استمارة المعاينة", "تاريخ الاستمارة", "رقم محضر اللجنة", "تاريخ المحضر", "رقم سند الرسوم", "تاريخ السند", "تاريخ التسليم", "المحافظة", "العنوان", "مالك العقار", "الحالة", "بداية سريان الترخيص", "تاريخ إصدار مكتب الصحة", "تاريخ الانتهاء", "رقم الأرشيف"];
  const body = rows.map(item => [item.licenseNo, item.facilityName, facilityTypeMap[item.facilityType], item.holderName, item.holderNationalId, item.nationalIdIssuedBy, item.nationalIdIssueGovernorate, item.nationalIdIssueDate ? formatDate(item.nationalIdIssueDate) : "", item.birthPlace, item.birthGovernorate, item.birthDate ? formatDate(item.birthDate) : "", item.holderPhone, item.qualification, item.graduationDate ? formatDate(item.graduationDate) : "", item.professionalLicenseNo, item.professionalLicenseIssueDate ? formatDate(item.professionalLicenseIssueDate) : "", item.siteInspectionFormNo, item.siteInspectionFormDate ? formatDate(item.siteInspectionFormDate) : "", item.committeeMinutesNo, item.committeeMinutesDate ? formatDate(item.committeeMinutesDate) : "", item.feeReceiptNo, item.feeReceiptDate ? formatDate(item.feeReceiptDate) : "", item.licenseDeliveryDate ? formatDate(item.licenseDeliveryDate) : "", item.governorate, item.address, item.propertyOwnerName, statusMap[item.effectiveStatus as keyof typeof statusMap]?.label || item.effectiveStatus, formatDate(item.issueDate), item.healthOfficeIssueDate ? formatDate(item.healthOfficeIssueDate) : "", formatDate(item.expiryDate), item.archiveNumber].map(csvEscape).join(","));
  return "\ufeff" + [header.join(","), ...body].join("\n");
}

type ArchiveExportableLicense = Pick<ExportableLicense, "licenseNo" | "facilityName" | "facilityType" | "holderName" | "effectiveStatus" | "issueDate" | "archiveNumber"> & {
  archiveDate?: Date | string | null;
  archiveOfficerName?: string | null;
};

export function buildArchiveCsv(rows: ArchiveExportableLicense[]) {
  const header = ["رقم الأرشيف", "رقم الترخيص", "اسم المنشأة", "نوع المنشأة", "اسم المالك", "الحالة", "تاريخ قيد الأرشيف", "رئيس قسم الأرشيف", "تاريخ بداية الترخيص"];
  const body = rows.map(item => [
    item.archiveNumber,
    item.licenseNo,
    item.facilityName,
    facilityTypeMap[item.facilityType],
    item.holderName,
    statusMap[item.effectiveStatus as keyof typeof statusMap]?.label || item.effectiveStatus,
    item.archiveDate ? formatDate(item.archiveDate) : "",
    item.archiveOfficerName,
    formatDate(item.issueDate),
  ].map(csvEscape).join(","));
  return "\ufeff" + [header.join(","), ...body].join("\n");
}

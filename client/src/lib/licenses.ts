export const statusMap = {
  active: { label: "ساري", className: "bg-emerald-100 text-emerald-800" },
  expired: { label: "منتهٍ", className: "bg-rose-100 text-rose-800" },
} as const;

export const facilityTypeMap = { warehouse: "مخزن أدوية", pharmacy: "صيدلية" } as const;
export const archiveTypeSuffixMap = { warehouse: "م", pharmacy: "ص" } as const;
export function lastFourLicenseDigits(licenseNo: string) {
  const digits = licenseNo.replace(/\D/g, "");
  return (digits || licenseNo.replace(/[^A-Za-z0-9]/g, "")).slice(-4).padStart(4, "0");
}
export function getArchiveNumberPreview(licenseNo: string, facilityType: keyof typeof archiveTypeSuffixMap) {
  if (!licenseNo) return "";
  return `${lastFourLicenseDigits(licenseNo)}-0001${archiveTypeSuffixMap[facilityType]} (العداد يحدد تلقائياً عند الحفظ)`;
}
export const qualificationLevelMap = { diploma: "دبلوم صيدلة", bachelor: "بكالوريوس صيدلة" } as const;
export const graduationInstitutionTypeMap = { institute: "معهد", university: "جامعة" } as const;
export const qualificationDefaults = {
  warehouse: { qualificationLevel: "diploma", graduationInstitutionType: "institute" },
  pharmacy: { qualificationLevel: "bachelor", graduationInstitutionType: "university" },
} as const;

export function getTwoYearExpiryInput(issueDate: string) {
  if (!issueDate) return "";
  const source = new Date(`${issueDate}T00:00:00.000Z`);
  if (Number.isNaN(source.getTime())) return "";
  const year = source.getUTCFullYear() + 2;
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const expiry = new Date(Date.UTC(year, month, Math.min(day, lastDay)));
  return expiry.toISOString().slice(0, 10);
}

export const documentTypeMap = {
  national_id: "البطاقة الشخصية",
  license: "الترخيص",
  qualification: "المؤهل",
  directive: "مستند التوجيه",
  opening_request: "طلب الفتح",
} as const;

export const documentTypes = Object.keys(documentTypeMap) as Array<keyof typeof documentTypeMap>;

export function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("ar-YE", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function csvEscape(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

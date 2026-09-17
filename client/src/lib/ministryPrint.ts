export const MINISTRY_BACK_FIELD_LABELS = {
  inspectionNumber: "صدر هذا الترخيص بناء على استمارة معاينة الموقع رقم",
  inspectionDate: "تاريخ استمارة معاينة الموقع",
  committeeNumber: "والموافق عليها في محضر اللجنة الخاصة بالمنشآت الصيدلانية برقم",
  committeeDate: "تاريخ محضر اللجنة الخاصة بالمنشآت الصيدلانية",
  feeNumber: "تم سداد الرسوم القانونية بسند رقم",
  feeDate: "تاريخ سند الرسوم القانونية",
  previousLicenseNo: "رقم الترخيص السابق",
  previousLicenseIssuedBy: "الجهة الصادر منها الترخيص السابق",
  previousLicenseIssueDate: "تاريخ إصدار الترخيص السابق",
  validityStart: "مدة صلاحية الترخيص عامان ابتداء من تاريخ",
  validityEnd: "وينتهي في",
  archiveEntry: "قيد الترخيص في أرشيف مكتب الصحة والسكان",
  archiveFacilityName: "اسم المنشأة في قيد الأرشيف",
  archiveOwnerName: "اسم مالك المنشأة في قيد الأرشيف",
  archiveNumber: "رقم الأرشيف",
  archiveDate: "تاريخ قيد الأرشيف",
  archiveOfficerName: "اسم رئيس قسم الأرشيف",
} as const;

export type MinistryPrintTemplateKind = "pharmacy" | "warehouse";

export const MINISTRY_PRINT_TEMPLATES = Object.freeze({
  pharmacy: Object.freeze({
    kind: "pharmacy" as const,
    displayName: "نموذج الصيدلية",
    frontTitle: "ترخيص فتح وإدارة صيدلية",
    holderTitle: "الصيدلاني",
    qualificationTitle: "بكالوريوس صيدلة",
    institutionTitle: "جامعة",
    facilityTitle: "صيدلية",
    archiveTitle: "تم قيد ترخيص صيدلية",
    showExpiryDate: false,
    showPreviousLicenseClause: true,
    frontReference: "/manus-storage/ministry-pharmacy-front_3d76d2a8.jpg",
    backReference: "/manus-storage/ministry-pharmacy-back_f1bff011.jpg",
  }),
  warehouse: Object.freeze({
    kind: "warehouse" as const,
    displayName: "نموذج مخزن الأدوية",
    frontTitle: "ترخيص فتح وإدارة مخزن أدوية",
    holderTitle: "فني صيدلة",
    qualificationTitle: "دبلوم صيدلة",
    institutionTitle: "معهد",
    facilityTitle: "مخزن أدوية",
    archiveTitle: "تم قيد ترخيص مخزن أدوية",
    showExpiryDate: true,
    showPreviousLicenseClause: false,
    frontReference: "/manus-storage/ministry-warehouse-front-new_85a339f3.jpg",
    backReference: "/manus-storage/ministry-warehouse-back_fa9fb19f.jpg",
  }),
});

export function getMinistryPrintTemplate(facilityType?: string | null) {
  return facilityType === "pharmacy" ? MINISTRY_PRINT_TEMPLATES.pharmacy : MINISTRY_PRINT_TEMPLATES.warehouse;
}

export function shouldPrintExpiryDate(facilityType?: string | null) {
  return getMinistryPrintTemplate(facilityType).showExpiryDate;
}

export const MINISTRY_BACK_FIELD_COORDINATES = {
  inspectionNumber: { x: 133, y: 11, width: 27 },
  inspectionDate: { x: 176, y: 11, width: 25 },
  committeeNumber: { x: 106, y: 20, width: 27 },
  committeeDate: { x: 146, y: 20, width: 25 },
  feeNumber: { x: 105, y: 29, width: 27 },
  feeDate: { x: 151, y: 29, width: 25 },
  validityStart: { x: 134, y: 40, width: 26 },
  validityEnd: { x: 78, y: 40, width: 26 },
  archiveFacilityName: { x: 89, y: 133, width: 50 },
  archiveOwnerName: { x: 19, y: 133, width: 44 },
  archiveNumber: { x: 83, y: 142, width: 38 },
  archiveDate: { x: 20, y: 142, width: 42 },
  archiveOfficerName: { x: 70, y: 151, width: 54 },
} as const;

export const MINISTRY_BACK_FIELD_COORDINATES_BY_TEMPLATE = Object.freeze({
  pharmacy: Object.freeze({
    ...MINISTRY_BACK_FIELD_COORDINATES,
    previousLicenseNo: { x: 111, y: 34.5, width: 24 },
    previousLicenseIssuedBy: { x: 142, y: 34.5, width: 27 },
    previousLicenseIssueDate: { x: 174, y: 34.5, width: 20 },
  }),
  warehouse: Object.freeze({ ...MINISTRY_BACK_FIELD_COORDINATES }),
});

export function getMinistryBackFieldCoordinates(facilityType?: string | null) {
  return facilityType === "pharmacy"
    ? MINISTRY_BACK_FIELD_COORDINATES_BY_TEMPLATE.pharmacy
    : MINISTRY_BACK_FIELD_COORDINATES_BY_TEMPLATE.warehouse;
}

const MINISTRY_FRONT_FIELD_COORDINATES_SOURCE = {
  holderName: { x: 91, y: 120.75, width: 75 },
  holderNationalId: { x: 170, y: 120.75, width: 27 },
  nationalIdIssuedBy: { x: 37.5, y: 131.5, width: 27 },
  nationalIdIssueGovernorate: { x: 77, y: 131.75, width: 25 },
  nationalIdIssueDate: { x: 109, y: 131.75, width: 32 },
  birthPlace: { x: 37.5, y: 140, width: 27 },
  birthGovernorate: { x: 82, y: 140.25, width: 25 },
  birthDate: { x: 111.5, y: 140.25, width: 32 },
  graduationCountry: { x: 89, y: 148.75, width: 32 },
  graduationInstitute: { x: 138.5, y: 148.75, width: 34 },
  graduationYear: { x: 174, y: 148.75, width: 20 },
  professionalLicenseNo: { x: 112, y: 159.75, width: 27 },
  professionalLicenseIssueDate: { x: 156.5, y: 159.75, width: 27 },
  facilityName: { x: 72, y: 171, width: 55 },
  street: { x: 149, y: 170.75, width: 45 },
  area: { x: 27, y: 179, width: 30 },
  district: { x: 75, y: 179, width: 30 },
  propertyOwner: { x: 143, y: 179, width: 40 },
  healthOfficeIssueDate: { x: 106, y: 196, width: 34 },
  healthOfficeDirector: { x: 121, y: 222.5, width: 58 },
  healthOfficeDirectorGovernorate: { x: 121, y: 228.5, width: 58 },
} as const;
Object.values(MINISTRY_FRONT_FIELD_COORDINATES_SOURCE).forEach((field) => Object.freeze(field));
export const MINISTRY_FRONT_FIELD_COORDINATES = Object.freeze(MINISTRY_FRONT_FIELD_COORDINATES_SOURCE);

export const MINISTRY_PRINT_PAGE_SIZE = Object.freeze({ widthMm: 197, heightMm: 250 });
export const MINISTRY_FRONT_TEXT_SIZE = 12;
export const MINISTRY_DATE_TEXT_SIZE = 12;
export const MINISTRY_HOLDER_FONT_WEIGHT = 900;
export const MINISTRY_ARCHIVE_TEXT_SIZE = 12;
export const MINISTRY_FRONT_LAYOUT = Object.freeze({
  page: MINISTRY_PRINT_PAGE_SIZE,
  fields: MINISTRY_FRONT_FIELD_COORDINATES,
  textSize: MINISTRY_FRONT_TEXT_SIZE,
  dateTextSize: MINISTRY_DATE_TEXT_SIZE,
  holderFontWeight: MINISTRY_HOLDER_FONT_WEIGHT,
} as const);

export function getMinistryFrontLayout(_facilityType?: string | null) {
  return MINISTRY_FRONT_LAYOUT;
}

export const MINISTRY_BACK_OFFICIAL_COORDINATES = Object.freeze({
  licensingHead: { x: 23, y: 102, width: 62 },
  pharmacyDirector: { x: 122, y: 102, width: 62 },
} as const);

export const MINISTRY_BACK_OFFICIAL_NAMES = Object.freeze({
  licensingHead: "د. علي حسين العرادي",
  pharmacyDirector: "د. توفيق المريسي",
} as const);

export function shouldPrintBackOfficials(facilityType?: string | null) {
  return getMinistryPrintTemplate(facilityType).kind === "pharmacy" || getMinistryPrintTemplate(facilityType).kind === "warehouse";
}

export type MinistryBackField = keyof typeof MINISTRY_BACK_FIELD_LABELS;

export function getMinistryPrintMessage({
  authLoading,
  userRole,
  queryLoading,
  hasData,
  errorCode,
  errorMessage,
}: {
  authLoading: boolean;
  userRole?: string | null;
  queryLoading: boolean;
  hasData: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  if (authLoading) return "جارٍ التحقق من جلسة الدخول...";
  if (!userRole) return "انتهت جلسة الدخول. أعد تسجيل الدخول بحساب المدير للوصول إلى نموذج الطباعة.";
  if (userRole !== "admin") return "طباعة نموذج الوزارة متاحة لمدير النظام فقط.";
  if (queryLoading) return "جارٍ تجهيز نموذج الطباعة...";
  if (errorCode === "NOT_FOUND") return "لم يتم العثور على الترخيص المطلوب للطباعة.";
  if (errorCode === "FORBIDDEN" || errorCode === "UNAUTHORIZED") return "لا تملك صلاحية تجهيز نموذج الطباعة.";
  if (errorCode) return errorMessage || "تعذر تجهيز بيانات نموذج الطباعة. حاول تحديث الصفحة.";
  if (!hasData) return "تعذر تجهيز بيانات نموذج الطباعة. حاول تحديث الصفحة.";
  return null;
}

const arabicIndicDigits = "٠١٢٣٤٥٦٧٨٩";
const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeLicenseNumber(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[٠-٩]/g, digit => String(arabicIndicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(easternArabicDigits.indexOf(digit)))
    .replace(/[\s\u00A0\u200B-\u200F\u061C]/g, "")
    .toUpperCase();
}

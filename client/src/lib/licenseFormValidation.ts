export type RequiredLicenseValues = {
  facilityType?: "warehouse" | "pharmacy";
  licenseNo?: string;
  facilityName?: string;
  holderName?: string;
  holderNationalId?: string;
  governorate?: string;
  issueDate?: string;
  expiryDate?: string;
};

const requiredFields = [
  ["licenseNo", "رقم الترخيص", 1],
  ["facilityName", "اسم المنشأة", 2],
  ["holderName", "اسم صاحب الترخيص", 2],
  ["holderNationalId", "رقم الهوية", 3],
  ["governorate", "المحافظة", 2],
  ["issueDate", "تاريخ بداية سريان الترخيص", 1],
] as const;

export function getMissingRequiredLicenseFields(values: RequiredLicenseValues) {
  return requiredFields
    .filter(([key, , minLength]) => (values[key] || "").trim().length < minLength)
    .map(([, label]) => label);
}

export function getLicenseSaveGuidance(values: RequiredLicenseValues) {
  const missing: string[] = getMissingRequiredLicenseFields(values);
  if (values.facilityType === "warehouse" && !(values.expiryDate || "").trim()) missing.push("تاريخ انتهاء ترخيص المخزن");
  return missing.length ? `لا يمكن حفظ الترخيص قبل إدخال: ${missing.join("، ")}.` : null;
}

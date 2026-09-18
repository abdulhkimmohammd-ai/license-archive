export const archiveFacilitySuffix = {
  pharmacy: "ص",
  warehouse: "م",
} as const;

export type ArchiveFacilityType = keyof typeof archiveFacilitySuffix;

export function lastFourLicenseDigits(licenseNo: string) {
  const digits = licenseNo.replace(/\D/g, "");
  return (digits || licenseNo.replace(/[^A-Za-z0-9]/g, "")).slice(-4).padStart(4, "0");
}

export function archiveTypeSuffix(facilityType: ArchiveFacilityType) {
  return archiveFacilitySuffix[facilityType];
}

export function buildArchiveNumber(sequence: number, licenseNo: string, facilityType: ArchiveFacilityType) {
  return `${lastFourLicenseDigits(licenseNo)}-${Math.max(1, sequence).toString().padStart(4, "0")}${archiveTypeSuffix(facilityType)}`;
}

export function getArchiveSequence(archiveNumber: string, facilityType: ArchiveFacilityType) {
  const suffix = archiveTypeSuffix(facilityType);
  const normalized = archiveNumber.trim();
  const current = new RegExp(`^\\d{4}-(\\d{4})${suffix}$`).exec(normalized);
  if (current) return Number(current[1]);
  const legacy = new RegExp(`^${suffix}\\d{4}-(\\d+)$`).exec(normalized);
  if (legacy) return Number(legacy[1]);
  const legacySuffix = new RegExp(`^(\\d+)-\\d{4}-${suffix}$`).exec(normalized);
  return legacySuffix ? Number(legacySuffix[1]) : 0;
}

export function getNextArchiveSequence(archiveNumbers: string[], facilityType: ArchiveFacilityType) {
  return Math.max(0, ...archiveNumbers.map((archiveNumber) => getArchiveSequence(archiveNumber, facilityType))) + 1;
}

export function isArchiveNumberForLicense(archiveNumber: string, licenseNo: string, facilityType: ArchiveFacilityType) {
  return new RegExp(`^${lastFourLicenseDigits(licenseNo)}-\\d{4}${archiveTypeSuffix(facilityType)}$`).test(archiveNumber.trim());
}

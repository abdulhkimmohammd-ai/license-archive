import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { getTwoYearExpiryInput, qualificationLevelMap } from "./licenses";

export type LicenseFormValues = {
  licenseNo: string; facilityName: string; facilityType: "warehouse" | "pharmacy"; issueDate: string; expiryDate: string; healthOfficeIssueDate: string; healthOfficeDirectorName: string; healthOfficeDirectorGovernorate: string;
  holderName: string; holderNationalId: string; holderPhone: string; nationalIdIssuedBy: string; nationalIdIssueGovernorate: string; nationalIdIssueDate: string;
  birthPlace: string; birthGovernorate: string; birthDate: string; qualificationLevel: "diploma" | "bachelor"; graduationInstitutionType: "institute" | "university"; graduationCountry: string; graduationInstitute: string; graduationDate: string;
  professionalLicenseNo: string; professionalLicenseIssueDate: string; previousLicenseNo: string; previousLicenseIssuedBy: string; previousLicenseIssueDate: string;
  siteInspectionFormNo: string; siteInspectionFormDate: string; committeeMinutesNo: string; committeeMinutesDate: string; feeReceiptNo: string; feeReceiptDate: string;
  governorate: string; address: string; street: string; area: string; district: string; propertyOwnerName: string; archiveDate: string; archiveOfficerName: string; licenseDeliveryDate: string; notes: string;
};

export type LicenseCreateInput = inferRouterInputs<AppRouter>["licenses"]["create"];
const optional = (value: string) => value.trim() || null;
const optionalDate = (value: string) => value ? new Date(value) : null;

export function buildLicenseCreateInput(form: LicenseFormValues, idempotencyKey?: string): LicenseCreateInput {
  return {
    licenseNo: form.licenseNo, facilityName: form.facilityName, facilityType: form.facilityType, holderName: form.holderName, holderNationalId: form.holderNationalId,
    governorate: form.governorate, address: optional(form.address), issueDate: new Date(form.issueDate), expiryDate: new Date(form.facilityType === "pharmacy" ? getTwoYearExpiryInput(form.issueDate) : form.expiryDate), status: "active", archiveNumber: "", idempotencyKey,
    qualification: qualificationLevelMap[form.qualificationLevel], qualificationLevel: form.qualificationLevel, graduationInstitutionType: form.graduationInstitutionType,
    archiveDate: optionalDate(form.archiveDate), archiveOfficerName: optional(form.archiveOfficerName), healthOfficeIssueDate: optionalDate(form.healthOfficeIssueDate), healthOfficeDirectorName: optional(form.healthOfficeDirectorName), healthOfficeDirectorGovernorate: optional(form.healthOfficeDirectorGovernorate), licenseDeliveryDate: optionalDate(form.licenseDeliveryDate),
    nationalIdIssuedBy: optional(form.nationalIdIssuedBy), nationalIdIssueGovernorate: optional(form.nationalIdIssueGovernorate), nationalIdIssueDate: optionalDate(form.nationalIdIssueDate),
    birthPlace: optional(form.birthPlace), birthGovernorate: optional(form.birthGovernorate), birthDate: optionalDate(form.birthDate), holderPhone: optional(form.holderPhone),
    graduationCountry: optional(form.graduationCountry), graduationInstitute: optional(form.graduationInstitute), graduationDate: optionalDate(form.graduationDate),
    professionalLicenseNo: optional(form.professionalLicenseNo), professionalLicenseIssueDate: optionalDate(form.professionalLicenseIssueDate),
    previousLicenseNo: form.facilityType === "pharmacy" ? optional(form.previousLicenseNo) : null, previousLicenseIssuedBy: form.facilityType === "pharmacy" ? optional(form.previousLicenseIssuedBy) : null, previousLicenseIssueDate: form.facilityType === "pharmacy" ? optionalDate(form.previousLicenseIssueDate) : null,
    siteInspectionFormNo: optional(form.siteInspectionFormNo), siteInspectionFormDate: optionalDate(form.siteInspectionFormDate), committeeMinutesNo: optional(form.committeeMinutesNo), committeeMinutesDate: optionalDate(form.committeeMinutesDate), feeReceiptNo: optional(form.feeReceiptNo), feeReceiptDate: optionalDate(form.feeReceiptDate),
    street: optional(form.street), area: optional(form.area), district: optional(form.district), propertyOwnerName: optional(form.propertyOwnerName), notes: optional(form.notes) || undefined,
  };
}

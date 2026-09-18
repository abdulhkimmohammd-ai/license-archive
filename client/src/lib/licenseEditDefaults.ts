import { graduationInstitutionTypeMap, qualificationDefaults, qualificationLevelMap } from "./licenses";

type EditableFacilityType = "warehouse" | "pharmacy";
type QualificationLevel = "diploma" | "bachelor";
type GraduationInstitutionType = "institute" | "university";

export function getSafeLicenseEditDefaults(item: { facilityType?: unknown; qualificationLevel?: unknown; graduationInstitutionType?: unknown }) {
  const facilityType: EditableFacilityType = item.facilityType === "pharmacy" ? "pharmacy" : "warehouse";
  const defaults = qualificationDefaults[facilityType];
  const qualificationLevel: QualificationLevel = defaults.qualificationLevel;
  const graduationInstitutionType: GraduationInstitutionType = defaults.graduationInstitutionType;
  return {
    facilityType,
    qualificationLevel,
    graduationInstitutionType,
    qualificationLabel: qualificationLevelMap[qualificationLevel],
    graduationInstitutionLabel: graduationInstitutionTypeMap[graduationInstitutionType],
  };
}

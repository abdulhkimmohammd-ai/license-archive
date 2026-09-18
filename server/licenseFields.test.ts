import { describe, expect, it } from "vitest";
import { licenses } from "../drizzle/schema";

describe("license detail fields", () => {
  it("defines the owner, qualification, professional practice, property, and health office fields", () => {
    expect(Object.keys(licenses)).toEqual(expect.arrayContaining([
      "holderPhone",
      "qualification",
      "qualificationLevel",
      "graduationPlace",
      "graduationDate",
      "graduationInstitutionType",
      "professionalLicenseNo",
      "professionalLicenseIssueDate",
      "propertyOwnerName",
      "healthOfficeIssueDate",
    ]));
  });
});

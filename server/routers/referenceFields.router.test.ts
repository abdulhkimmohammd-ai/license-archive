import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getLicenseById: vi.fn(), writeAuditLog: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb, getLicenseById: mocks.getLicenseById, getLicenseDocuments: vi.fn(), writeAuditLog: mocks.writeAuditLog }));
import { licenseRouter } from "./licenses";

const base = { id: 1, licenseNo: "R-1", facilityName: "منشأة اختبار", facilityType: "pharmacy" as const, holderName: "صاحب", holderNationalId: "12345", holderPhone: null, qualification: null, graduationPlace: null, graduationDate: null, professionalLicenseNo: null, professionalLicenseIssueDate: null, siteInspectionFormNo: null, siteInspectionFormDate: null, committeeMinutesNo: null, committeeMinutesDate: null, feeReceiptNo: null, feeReceiptDate: null, governorate: "صنعاء", address: "العنوان الكامل", propertyOwnerName: null, archiveNumber: "ARC-1", issueDate: new Date("2026-01-01"), healthOfficeIssueDate: null, licenseDeliveryDate: null, expiryDate: new Date("2027-01-01"), status: "active" as const, notes: null, archiveReason: null, archivedBy: null, archivedAt: null, createdBy: 1, updatedBy: 1, createdAt: new Date(), updatedAt: new Date() };
const adminContext = { user: { id: 1, openId: "admin", name: "مدير", email: "admin@example.com", loginMethod: "email", role: "admin" as const, accessStatus: "approved" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} }, res: {} } as any;

describe("reference field router flow", () => {
  let captured: Record<string, unknown> = {};
  beforeEach(() => {
    captured = {}; mocks.getLicenseById.mockResolvedValue(base); mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.getDb.mockResolvedValue({ update: () => ({ set: (values: Record<string, unknown>) => { captured = values; return { where: vi.fn().mockResolvedValue(undefined) }; } }), insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }) });
  });
  it("updates normally when optional references are omitted", async () => {
    const caller = licenseRouter.createCaller(adminContext);
    await expect(caller.update({ ...base, notes: undefined, id: 1, status: "active" })).resolves.toEqual({ success: true });
    expect(captured.siteInspectionFormNo).toBeNull();
    expect(captured.feeReceiptNo).toBeNull();
  });
  it("passes saved references through update and printPayload router procedures", async () => {
    const caller = licenseRouter.createCaller(adminContext);
    await caller.update({ ...base, notes: undefined, id: 1, status: "active", siteInspectionFormNo: "INS-1", committeeMinutesNo: "COM-1", feeReceiptNo: "REC-1", licenseDeliveryDate: new Date("2026-01-09") });
    expect(captured.siteInspectionFormNo).toBe("INS-1"); expect(captured.committeeMinutesNo).toBe("COM-1"); expect(captured.feeReceiptNo).toBe("REC-1");
    mocks.getLicenseById.mockResolvedValue({ ...base, siteInspectionFormNo: "INS-1", committeeMinutesNo: "COM-1", feeReceiptNo: "REC-1", licenseDeliveryDate: new Date("2026-01-09") });
    await expect(caller.printPayload({ id: 1 })).resolves.toMatchObject({ license: { siteInspectionFormNo: "INS-1", committeeMinutesNo: "COM-1", feeReceiptNo: "REC-1" } });
  });
});

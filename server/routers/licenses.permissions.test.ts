import { describe, expect, it } from "vitest";
import { licenseRouter } from "./licenses";

const archivistContext = {
  user: {
    id: 2,
    openId: "archivist-user",
    name: "موظف الأرشيف",
    email: "archive@example.com",
    loginMethod: "email",
    role: "archivist" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { headers: {} },
  res: {},
} as any;

const adminContext = {
  user: {
    id: 1,
    openId: "admin-user",
    name: "مدير النظام",
    email: "admin@example.com",
    loginMethod: "email",
    role: "admin" as const,
    accessStatus: "approved" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { headers: {} },
  res: {},
} as any;

const validUpdate = {
  id: 1,
  licenseNo: "A-1",
  facilityName: "منشأة اختبار",
  facilityType: "warehouse" as const,
  holderName: "صاحب الترخيص",
  holderNationalId: "12345",
  governorate: "صنعاء",
  address: "المنطقة، الشارع",
  archiveNumber: "ARC-1",
  issueDate: new Date("2026-01-01"),
  expiryDate: new Date("2027-01-01"),
  status: "active" as const,
};

describe("license router archivist permissions", () => {
  it("rejects a license update from the archivist", async () => {
    const caller = licenseRouter.createCaller(archivistContext);
    await expect(caller.update(validUpdate)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects audit-log access and CSV export from the archivist", async () => {
    const caller = licenseRouter.createCaller(archivistContext);
    await expect(caller.auditLog({ licenseId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.exportRows()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.archiveExport({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects print payload access from the archivist", async () => {
    const caller = licenseRouter.createCaller(archivistContext);
    await expect(caller.printPayload({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects archive and permanent deletion from the archivist", async () => {
    const caller = licenseRouter.createCaller(archivistContext);
    await expect(caller.archive({ id: 1, reason: "أرشفة اختبارية" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.deletePermanently({ id: 1, confirmation: "A-1", acknowledged: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.changeArchiveNumber({ id: 1, archiveNumber: "0001-0001م", reason: "سبب اختبار صالح" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires an explicit reason before an administrator can change the archive number", async () => {
    const caller = licenseRouter.createCaller(adminContext);
    await expect(caller.changeArchiveNumber({ id: 1, archiveNumber: "0001-0001م", reason: "قصير" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

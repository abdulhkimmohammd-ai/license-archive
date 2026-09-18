import { describe, expect, it } from "vitest";
import { isAccountApproved } from "./accessControl";
import { appRouter } from "./routers";
import { licenseRouter } from "./routers/licenses";
import { teamRouter } from "./routers/team";

function context(accessStatus: "pending" | "approved" | "blocked", role: "user" | "archivist" | "admin" = "archivist") {
  return {
    user: {
      id: 99,
      openId: "approval-test-user",
      name: "حساب اختبار",
      email: "approval@example.com",
      loginMethod: "email",
      role,
      accessStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} },
    res: {},
  } as any;
}

describe("Account approval access control", () => {
  it("recognizes only an explicitly approved account as operational", () => {
    expect(isAccountApproved("approved")).toBe(true);
    expect(isAccountApproved("pending")).toBe(false);
    expect(isAccountApproved("blocked")).toBe(false);
  });

  it("keeps account status available to the unauthenticated profile endpoint for the waiting screen", async () => {
    const caller = appRouter.createCaller(context("pending", "user"));
    await expect(caller.auth.me()).resolves.toMatchObject({ accessStatus: "pending", email: "approval@example.com" });
  });

  it("rejects pending and blocked accounts before reaching license data", async () => {
    await expect(licenseRouter.createCaller(context("pending")).dashboard()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "حسابك بانتظار موافقة مدير النظام.",
    });
    await expect(licenseRouter.createCaller(context("blocked")).dashboard()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "تم حظر هذا الحساب. تواصل مع مدير النظام.",
    });
  });

  it("rejects a pending administrator before the team management query runs", async () => {
    await expect(teamRouter.createCaller(context("pending", "admin")).list()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "حسابك بانتظار موافقة مدير النظام.",
    });
  });
});

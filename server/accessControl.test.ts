import { describe, expect, it } from "vitest";
import { canManageLicenses, isSystemAdmin } from "./accessControl";

describe("access control", () => {
  it("allows the archivist to enter and view licenses without granting administration", () => {
    expect(canManageLicenses("archivist")).toBe(true);
    expect(isSystemAdmin("archivist")).toBe(false);
  });

  it("allows the administrator to manage the entire system", () => {
    expect(canManageLicenses("admin")).toBe(true);
    expect(isSystemAdmin("admin")).toBe(true);
  });

  it("blocks an unassigned user from license operations", () => {
    expect(canManageLicenses("user")).toBe(false);
    expect(isSystemAdmin("user")).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDaysRemaining, getEffectiveStatus, getTwoYearExpiryDate } from "./licenseStatus";
import { getArchiveNumberPreview, getTwoYearExpiryInput, statusMap } from "../client/src/lib/licenses";

const fixedNow = new Date("2026-08-15T09:00:00.000Z");
const afterDays = (days: number) => new Date(fixedNow.getTime() + days * 24 * 60 * 60 * 1000);

describe("license status", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => vi.useRealTimers());

  it("calculates a two-year license term from the issue date", () => {
    expect(getTwoYearExpiryDate(new Date("2026-08-15T00:00:00.000Z")).toISOString()).toBe("2028-08-15T00:00:00.000Z");
    expect(getTwoYearExpiryDate(new Date("2024-02-29T00:00:00.000Z")).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("formats the archive preview with the facility marker", () => {
    expect(getArchiveNumberPreview("A-7777", "pharmacy")).toBe("7777-0001ص (العداد يحدد تلقائياً عند الحفظ)");
    expect(getArchiveNumberPreview("WH-7777", "warehouse")).toBe("7777-0001م (العداد يحدد تلقائياً عند الحفظ)");
  });

  it("formats the two-year expiry date for the date input", () => {
    expect(getTwoYearExpiryInput("2026-08-15")).toBe("2028-08-15");
    expect(getTwoYearExpiryInput("2024-02-29")).toBe("2026-02-28");
  });

  it("shows administrative suspension as expired in the simplified user status", () => {
    expect(getEffectiveStatus({ status: "suspended", expiryDate: afterDays(120) })).toBe("expired");
  });

  it("shows an archived license as expired in the simplified user status", () => {
    expect(getEffectiveStatus({ status: "archived", expiryDate: afterDays(120) })).toBe("expired");
  });

  it("marks an active license as expired after its expiry date", () => {
    expect(getEffectiveStatus({ status: "active", expiryDate: afterDays(-1) })).toBe("expired");
  });

  it("keeps a non-expired license active at the 90-day threshold", () => {
    expect(getEffectiveStatus({ status: "active", expiryDate: afterDays(90) })).toBe("active");
  });

  it("keeps a license active when more than 90 days remain", () => {
    expect(getEffectiveStatus({ status: "active", expiryDate: afterDays(91) })).toBe("active");
    expect(getDaysRemaining(afterDays(30))).toBe(30);
  });

  it("limits displayed status choices to active and expired", () => {
    expect(Object.keys(statusMap)).toEqual(["active", "expired"]);
    expect(statusMap.active.label).toBe("ساري");
    expect(statusMap.expired.label).toBe("منتهٍ");
  });
});

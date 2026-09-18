import { describe, expect, it } from "vitest";
import { buildDashboardAnalytics, createStatusCounts } from "./dashboardAnalytics";

const records = [
  { issueDate: new Date("2026-01-15T00:00:00Z"), createdAt: new Date("2026-08-15T00:00:00Z"), expiryDate: new Date("2026-09-10T00:00:00Z"), governorate: "صنعاء", facilityType: "pharmacy" as const, effectiveStatus: "active" },
  { issueDate: new Date("2026-01-20T00:00:00Z"), createdAt: new Date("2026-07-20T00:00:00Z"), expiryDate: new Date("2026-08-01T00:00:00Z"), governorate: "صنعاء", facilityType: "warehouse" as const, effectiveStatus: "expired" },
  { issueDate: new Date("2026-02-11T00:00:00Z"), createdAt: new Date("2026-08-18T00:00:00Z"), expiryDate: new Date("2026-08-04T00:00:00Z"), governorate: "إب", facilityType: "pharmacy" as const, effectiveStatus: "expired" },
  { issueDate: new Date("2025-12-11T00:00:00Z"), createdAt: new Date("2025-12-11T00:00:00Z"), expiryDate: new Date("2026-10-01T00:00:00Z"), governorate: "إب", facilityType: "warehouse" as const, effectiveStatus: "active" },
];

describe("Dashboard analytics", () => {
  it("counts current effective statuses without treating legacy statuses as active or expired", () => {
    expect(createStatusCounts([...records, { issueDate: new Date("2026-02-20T00:00:00Z"), facilityType: "warehouse", effectiveStatus: "expiring" }])).toEqual({ total: 5, active: 2, expired: 2 });
  });

  it("filters the selected month and separates pharmacy and warehouse metrics", () => {
    const result = buildDashboardAnalytics(records, { year: 2026, month: 1 });
    expect(result.period).toEqual({ year: 2026, month: 1, label: "يناير 2026" });
    expect(result.total).toEqual({ total: 2, active: 1, expired: 1 });
    expect(result.facilities.pharmacy).toEqual({ total: 1, active: 1, expired: 0 });
    expect(result.facilities.warehouse).toEqual({ total: 1, active: 0, expired: 1 });
  });

  it("returns a full twelve-month series for annual filtering and offers historical years", () => {
    const result = buildDashboardAnalytics(records, { year: 2026 });
    expect(result.period).toEqual({ year: 2026, month: null, label: "عام 2026" });
    expect(result.total).toEqual({ total: 3, active: 1, expired: 2 });
    expect(result.monthlySeries).toHaveLength(12);
    expect(result.monthlySeries[0]).toMatchObject({ month: 1, label: "يناير", total: 2 });
    expect(result.monthlySeries[1]).toMatchObject({ month: 2, label: "فبراير", total: 1 });
    expect(result.availableYears).toEqual([2026, 2025]);
  });

  it("يعرض نشاط الإضافة والتنبيهات الزمنية وتوزيع المحافظات", () => {
    const result = buildDashboardAnalytics(records, { year: 2026, now: new Date("2026-08-20T00:00:00Z") });
    expect(result.activity).toEqual({ addedThisMonth: 2, addedPreviousMonth: 1, addedThisYear: 3, monthlyChange: 1 });
    expect(result.expiryWindows).toEqual({ days30: 1, days60: 2, days90: 2 });
    expect(result.governorates).toEqual([{ name: "إب", total: 2 }, { name: "صنعاء", total: 2 }]);
  });
});

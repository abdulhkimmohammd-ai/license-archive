import { and } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it } from "vitest";
import { buildArchiveFilterConditions, buildLicenseListFilterConditions, buildLicenseSearchCondition, getArchiveDateRange, getArchivePagination, licenseListFilterInput } from "./routers/licenses";

const dialect = new MySqlDialect();

describe("بحث الأرشفة بالاسم", () => {
  it("يحصر التصفية باسم المنشأة في حقل اسم المنشأة", () => {
    const query = dialect.sqlToQuery(buildLicenseSearchCondition("الشفاء", "facility"));
    expect(query.sql).toContain("`facilityName` like ?");
    expect(query.sql).not.toContain("`holderName` like ?");
    expect(query.params).toEqual(["%الشفاء%"]);
  });

  it("يحصر التصفية باسم المالك في حقل صاحب الترخيص", () => {
    const query = dialect.sqlToQuery(buildLicenseSearchCondition("أحمد", "owner"));
    expect(query.sql).toContain("`holderName` like ?");
    expect(query.sql).not.toContain("`facilityName` like ?");
    expect(query.params).toEqual(["%أحمد%"]);
  });

  it("يبقي البحث العام شاملاً رقم الأرشيف واسم المنشأة واسم المالك", () => {
    const query = dialect.sqlToQuery(buildLicenseSearchCondition("3301"));
    expect(query.sql).toContain("`archiveNumber` like ?");
    expect(query.sql).toContain("`facilityName` like ?");
    expect(query.sql).toContain("`holderName` like ?");
    expect(query.params).toEqual(["%3301%", "%3301%", "%3301%", "%3301%"]);
  });

  it("يحسب صفحة الأرشفة وحدود عرضها من العدد الكلي للسجلات", () => {
    expect(getArchivePagination(37, 2, 12)).toEqual({ page: 2, pageSize: 12, total: 37, totalPages: 4, offset: 12 });
    expect(getArchivePagination(37, 99, 12)).toEqual({ page: 4, pageSize: 12, total: 37, totalPages: 4, offset: 36 });
    expect(getArchivePagination(0, 1, 12)).toEqual({ page: 1, pageSize: 12, total: 0, totalPages: 1, offset: 0 });
  });

  it("يشمل النطاق الزمني تاريخ البداية ويوم النهاية كاملاً", () => {
    expect(getArchiveDateRange(new Date("2026-08-01T15:00:00.000Z"), new Date("2026-08-31T07:00:00.000Z"))).toEqual({
      start: new Date("2026-08-01T00:00:00.000Z"),
      endExclusive: new Date("2026-09-01T00:00:00.000Z"),
    });
  });

  it("يضيف فلتر نوع المنشأة وحالة السريان إلى استعلام الأرشفة", () => {
    const conditions = buildArchiveFilterConditions({ facilityType: "warehouse", status: "active" });
    const query = dialect.sqlToQuery(and(...conditions)!);
    expect(query.sql).toContain("`facilityType` = ?");
    expect(query.sql).toContain("`expiryDate` >= ?");
    expect(query.params).toContain("warehouse");
  });

  it("يعامل المنتهي كتاريخ منقض أو ترخيص موقوف أو مؤرشف", () => {
    const conditions = buildArchiveFilterConditions({ status: "expired" });
    const query = dialect.sqlToQuery(and(...conditions)!);
    expect(query.sql).toContain("`expiryDate` < ?");
    expect(query.params).toContain("suspended");
    expect(query.params).toContain("archived");
  });

  it("يطبق فلاتر سجل التراخيص ويستبعد السجلات الموجودة في سلة المحذوفات", () => {
    const conditions = buildLicenseListFilterConditions({ search: "الشفاء", facilityType: "pharmacy", status: "active", issueDateFrom: new Date("2026-01-01"), issueDateTo: new Date("2026-01-31") });
    const query = dialect.sqlToQuery(and(...conditions)!);
    expect(query.sql).toContain("`deletedAt` is null");
    expect(query.sql).toContain("`facilityType` = ?");
    expect(query.sql).toContain("`issueDate` >= ?");
    expect(query.sql).toContain("`issueDate` < ?");
    expect(query.params).toContain("pharmacy");
  });

  it("يرفض نطاق تاريخ إصدار مقلوب في بحث سجل التراخيص", () => {
    expect(() => licenseListFilterInput.parse({ issueDateFrom: "2026-02-01", issueDateTo: "2026-01-01" })).toThrow("يجب أن يكون تاريخ نهاية الإصدار");
  });
});

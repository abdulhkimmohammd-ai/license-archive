export type AnalyticsStatus = "active" | "expired" | string;
export type AnalyticsFacilityType = "pharmacy" | "warehouse";

export type AnalyticsRecord = {
  issueDate: Date;
  facilityType: AnalyticsFacilityType;
  effectiveStatus: AnalyticsStatus;
  createdAt?: Date;
  expiryDate?: Date;
  governorate?: string;
};

type StatusCounts = {
  total: number;
  active: number;
  expired: number;
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
] as const;

export function getCurrentAnalyticsYear(now = new Date()) {
  return now.getUTCFullYear();
}

export function createStatusCounts(records: AnalyticsRecord[]): StatusCounts {
  return records.reduce<StatusCounts>((counts, record) => {
    counts.total += 1;
    if (record.effectiveStatus === "active") counts.active += 1;
    if (record.effectiveStatus === "expired") counts.expired += 1;
    return counts;
  }, { total: 0, active: 0, expired: 0 });
}

export function buildDashboardAnalytics(records: AnalyticsRecord[], input: { year?: number; month?: number; now?: Date } = {}) {
  const year = input.year ?? getCurrentAnalyticsYear();
  const month = input.month;
  const now = input.now ?? new Date();
  const inSelectedPeriod = records.filter((record) => {
    const issueYear = record.issueDate.getUTCFullYear();
    const issueMonth = record.issueDate.getUTCMonth() + 1;
    return issueYear === year && (month === undefined || issueMonth === month);
  });
  const pharmacy = inSelectedPeriod.filter((record) => record.facilityType === "pharmacy");
  const warehouse = inSelectedPeriod.filter((record) => record.facilityType === "warehouse");
  const yearlyRecords = records.filter((record) => record.issueDate.getUTCFullYear() === year);
  const availableYears = Array.from(new Set([...records.map((record) => record.issueDate.getUTCFullYear()), year]))
    .sort((a, b) => b - a);
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const addedThisMonth = records.filter((record) => record.createdAt && record.createdAt.getUTCFullYear() === currentYear && record.createdAt.getUTCMonth() === currentMonth).length;
  const addedPreviousMonth = records.filter((record) => record.createdAt && record.createdAt.getUTCFullYear() === previousMonthYear && record.createdAt.getUTCMonth() === previousMonth).length;
  const addedThisYear = records.filter((record) => record.createdAt && record.createdAt.getUTCFullYear() === currentYear).length;
  const expiringWithin = (days: number) => records.filter((record) => {
    if (!record.expiryDate || record.effectiveStatus !== "active") return false;
    const remaining = Math.ceil((record.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return remaining >= 0 && remaining <= days;
  }).length;
  const governorates = Array.from(records.reduce((map, record) => {
    const key = record.governorate?.trim() || "غير محددة";
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ar")).slice(0, 6);

  return {
    period: {
      year,
      month: month ?? null,
      label: month ? `${ARABIC_MONTHS[month - 1]} ${year}` : `عام ${year}`,
    },
    availableYears,
    total: createStatusCounts(inSelectedPeriod),
    facilities: {
      pharmacy: createStatusCounts(pharmacy),
      warehouse: createStatusCounts(warehouse),
    },
    monthlySeries: ARABIC_MONTHS.map((label, index) => {
      const monthNumber = index + 1;
      return {
        month: monthNumber,
        label,
        ...createStatusCounts(yearlyRecords.filter((record) => record.issueDate.getUTCMonth() + 1 === monthNumber)),
      };
    }),
    activity: {
      addedThisMonth,
      addedPreviousMonth,
      addedThisYear,
      monthlyChange: addedThisMonth - addedPreviousMonth,
    },
    expiryWindows: { days30: expiringWithin(30), days60: expiringWithin(60), days90: expiringWithin(90) },
    governorates,
  };
}

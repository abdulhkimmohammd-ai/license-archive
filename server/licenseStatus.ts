import type { License } from "../drizzle/schema";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Adds exactly two calendar years while clamping February 29 to February 28 when needed. */
export function getTwoYearExpiryDate(issueDate: Date) {
  const result = new Date(issueDate.getTime());
  const targetYear = result.getUTCFullYear() + 2;
  const month = result.getUTCMonth();
  const day = result.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
  result.setUTCFullYear(targetYear, month, Math.min(day, lastDayOfTargetMonth));
  return result;
}

export function getEffectiveStatus(license: Pick<License, "status" | "expiryDate">) {
  if (license.status === "suspended" || license.status === "archived") return "expired";

  const daysRemaining = Math.ceil((license.expiryDate.getTime() - Date.now()) / DAY_MS);
  if (daysRemaining < 0) return "expired";
  return "active";
}

export function getDaysRemaining(expiryDate: Date) {
  return Math.ceil((expiryDate.getTime() - Date.now()) / DAY_MS);
}

import type { LicenseFormValues } from "./licenseSubmission";

export const OFFLINE_DATA_EVENT = "license-archive:offline-data-updated";
const INDEX_PREFIX = "license-archive:offline-index:";
const QUEUE_PREFIX = "license-archive:offline-queue:";

export type OfflineLicenseIndexItem = { id: number; licenseNo: string; archiveNumber: string; facilityName: string; holderName: string; facilityType: "warehouse" | "pharmacy"; governorate: string; archiveDate: string | null; issueDate: string; expiryDate: string; effectiveStatus: "active" | "expired"; createdAt: string; };
export type OfflineQueueItem = { id: string; operation: "create"; idempotencyKey: string; fingerprint: string; createdAt: number; form: LicenseFormValues; error?: string; };
export type OfflineLicenseFilters = { search?: string; searchScope?: "all" | "facility" | "owner"; facilityType?: "warehouse" | "pharmacy"; status?: "active" | "expired"; governorate?: string; archiveDateFrom?: string; archiveDateTo?: string; };
export type QueueLicenseResult = { queued: boolean; item: OfflineQueueItem };

function read<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function write<T>(key: string, value: T) { try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event(OFFLINE_DATA_EVENT)); return true; } catch { return false; } }
function indexKey(userId: number) { return `${INDEX_PREFIX}${userId}`; }
function queueKey(userId: number) { return `${QUEUE_PREFIX}${userId}`; }
function normalize(value: string | undefined) { return (value ?? "").trim().toLocaleLowerCase("ar").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه"); }

export function getOfflineLicenseIndex(userId: number) { return read<OfflineLicenseIndexItem[]>(indexKey(userId), []); }
export function cacheOfflineLicenseIndex(userId: number, rows: Array<Record<string, unknown>>, replace = false) {
  const mapped = rows.map((row) => ({ id: Number(row.id), licenseNo: String(row.licenseNo ?? ""), archiveNumber: String(row.archiveNumber ?? ""), facilityName: String(row.facilityName ?? ""), holderName: String(row.holderName ?? ""), facilityType: row.facilityType === "pharmacy" ? "pharmacy" : "warehouse", governorate: String(row.governorate ?? ""), archiveDate: row.archiveDate ? new Date(row.archiveDate as string | number | Date).toISOString() : null, issueDate: new Date(row.issueDate as string | number | Date).toISOString(), expiryDate: new Date(row.expiryDate as string | number | Date).toISOString(), effectiveStatus: row.effectiveStatus === "expired" ? "expired" : "active", createdAt: new Date(row.createdAt as string | number | Date).toISOString() }));
  const next = replace ? mapped : Array.from(new Map([...getOfflineLicenseIndex(userId), ...mapped].map((row) => [row.id, row])).values());
  return write(indexKey(userId), next.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export function filterOfflineLicenseIndex(rows: OfflineLicenseIndexItem[], filters: OfflineLicenseFilters) {
  const terms = normalize(filters.search).split(/\s+/).filter(Boolean);
  const governorate = normalize(filters.governorate);
  return rows.filter((row) => {
    const searchable = filters.searchScope === "facility" ? [row.facilityName] : filters.searchScope === "owner" ? [row.holderName] : [row.licenseNo, row.archiveNumber, row.facilityName, row.holderName];
    const archiveDate = (row.archiveDate ?? row.issueDate).slice(0, 10);
    return (!filters.facilityType || row.facilityType === filters.facilityType) && (!filters.status || row.effectiveStatus === filters.status) && (!governorate || normalize(row.governorate).includes(governorate)) && (!filters.archiveDateFrom || archiveDate >= filters.archiveDateFrom) && (!filters.archiveDateTo || archiveDate <= filters.archiveDateTo) && terms.every((term) => searchable.some((value) => normalize(value).includes(term)));
  });
}
export function getQueuedLicenses(userId: number) { return read<OfflineQueueItem[]>(queueKey(userId), []); }
export function getOfflineLicenseFingerprint(form: Pick<LicenseFormValues, "licenseNo" | "facilityType">) { return `${form.facilityType}:${normalize(form.licenseNo)}`; }
export function queueLicenseForSync(userId: number, form: LicenseFormValues): QueueLicenseResult | null {
  const current = getQueuedLicenses(userId);
  const fingerprint = getOfflineLicenseFingerprint(form);
  const existing = current.find((item) => item.fingerprint === fingerprint || (!item.fingerprint && getOfflineLicenseFingerprint(item.form) === fingerprint));
  if (existing) return { queued: false, item: existing };
  const item: OfflineQueueItem = { id: crypto.randomUUID(), operation: "create", idempotencyKey: crypto.randomUUID(), fingerprint, createdAt: Date.now(), form };
  return write(queueKey(userId), [...current, item]) ? { queued: true, item } : null;
}
export function removeQueuedLicense(userId: number, itemId: string) { return write(queueKey(userId), getQueuedLicenses(userId).filter((item) => item.id !== itemId)); }
export function setQueuedLicenseError(userId: number, itemId: string, error: string) { return write(queueKey(userId), getQueuedLicenses(userId).map((item) => item.id === itemId ? { ...item, error } : item)); }
export function clearOfflineLicenseData(userId: number) { try { localStorage.removeItem(indexKey(userId)); localStorage.removeItem(queueKey(userId)); window.dispatchEvent(new Event(OFFLINE_DATA_EVENT)); } catch {} }

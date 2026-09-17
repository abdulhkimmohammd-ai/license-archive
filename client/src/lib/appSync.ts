export const APP_SYNC_STORAGE_KEY = "license-archive:last-sync-at";

export function formatSyncTime(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return "لم تُجرَ مزامنة يدوية بعد";
  return new Intl.DateTimeFormat("ar-YE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function getNextSyncTimestamp(now = Date.now()) {
  return Math.max(0, Math.floor(now));
}

export type SupabaseDevelopmentCreatePayload = {
  licenseNo: string;
  facilityName: string;
  facilityType: "pharmacy" | "warehouse";
  holderName: string;
  holderNationalId: string;
  governorate: string;
  issueDate: string;
  expiryDate: string;
};

export type SupabaseDevelopmentQueueItem = {
  id: string;
  idempotencyKey: string;
  fingerprint: string;
  createdAt: number;
  payload: SupabaseDevelopmentCreatePayload;
  error?: string;
  attempts?: number;
  lastAttemptAt?: number;
};

export const SUPABASE_OFFLINE_DATA_EVENT = "license-archive:supabase-development-offline-data";
const PREFIX = "license-archive:supabase-development-queue:";
const locks = new Set<string>();
const keyFor = (userId: string) => `${PREFIX}${userId}`;
const normalize = (value: string) => value.trim().toLocaleLowerCase("ar");

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SUPABASE_OFFLINE_DATA_EVENT));
}

function read(userId: string): SupabaseDevelopmentQueueItem[] {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    return raw ? JSON.parse(raw) as SupabaseDevelopmentQueueItem[] : [];
  } catch {
    return [];
  }
}

function write(userId: string, items: SupabaseDevelopmentQueueItem[]) {
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(items));
    notify();
    return true;
  } catch {
    return false;
  }
}

export function getSupabaseDevelopmentQueue(userId: string) {
  return read(userId);
}

export function enqueueSupabaseDevelopmentCreate(userId: string, payload: SupabaseDevelopmentCreatePayload) {
  const items = read(userId);
  const fingerprint = `${payload.facilityType}:${normalize(payload.licenseNo)}`;
  const existing = items.find((item) => item.fingerprint === fingerprint);
  if (existing) return { queued: false, item: existing };
  const item: SupabaseDevelopmentQueueItem = {
    id: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    fingerprint,
    createdAt: Date.now(),
    payload,
  };
  return write(userId, [...items, item]) ? { queued: true, item } : null;
}

export function removeSupabaseDevelopmentQueueItem(userId: string, itemId: string) {
  return write(userId, read(userId).filter((item) => item.id !== itemId));
}

export function setSupabaseDevelopmentQueueItemError(userId: string, itemId: string, error: string) {
  return write(userId, read(userId).map((item) => item.id === itemId ? { ...item, error, attempts: (item.attempts ?? 0) + 1, lastAttemptAt: Date.now() } : item));
}

export async function syncSupabaseDevelopmentQueue(
  userId: string,
  send: (payload: SupabaseDevelopmentCreatePayload, idempotencyKey: string) => Promise<unknown>,
  retryFailed = false,
) {
  if (locks.has(userId)) return { saved: 0, failed: 0, remaining: read(userId) };
  locks.add(userId);
  let saved = 0;
  let failed = 0;
  try {
    const items = read(userId).filter((item) => retryFailed || !item.error);
    for (const item of items) {
      try {
        await send(item.payload, item.idempotencyKey);
        removeSupabaseDevelopmentQueueItem(userId, item.id);
        saved += 1;
      } catch (error) {
        setSupabaseDevelopmentQueueItemError(userId, item.id, error instanceof Error ? error.message : "تعذرت مزامنة العملية");
        failed += 1;
      }
    }
    return { saved, failed, remaining: read(userId) };
  } finally {
    locks.delete(userId);
  }
}

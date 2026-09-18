import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueSupabaseDevelopmentCreate, getSupabaseDevelopmentQueue, syncSupabaseDevelopmentQueue } from "../client/src/lib/supabaseDevelopmentOffline";

const userId = "offline-test-user";
const payload = { licenseNo: "6543-0001", facilityName: "صيدلية اختبار محلية", facilityType: "pharmacy" as const, holderName: "مالك اختبار", holderNationalId: "ID-TEST", governorate: "صنعاء", issueDate: "2026-08-01", expiryDate: "2028-08-01" };

function installStorage() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent: vi.fn() });
}

afterEach(() => vi.unstubAllGlobals());

describe("Supabase Development offline queue", () => {
  it("deduplicates the same license fingerprint and preserves idempotency key", () => {
    installStorage();
    const first = enqueueSupabaseDevelopmentCreate(userId, payload);
    const second = enqueueSupabaseDevelopmentCreate(userId, payload);
    expect(first?.queued).toBe(true);
    expect(second?.queued).toBe(false);
    expect(second?.item.idempotencyKey).toBe(first?.item.idempotencyKey);
    expect(getSupabaseDevelopmentQueue(userId)).toHaveLength(1);
  });

  it("keeps a failed item for retry while removing successful items", async () => {
    installStorage();
    const first = enqueueSupabaseDevelopmentCreate(userId, payload);
    const secondPayload = { ...payload, licenseNo: "8765-0001", facilityName: "مخزن اختبار محلي", facilityType: "warehouse" as const };
    enqueueSupabaseDevelopmentCreate(userId, secondPayload);
    let calls = 0;
    const result = await syncSupabaseDevelopmentQueue(userId, async (item) => {
      calls += 1;
      if (item.licenseNo === payload.licenseNo) throw new Error("تعذر الاتصال المؤقت");
    });
    expect(calls).toBe(2);
    expect(result.saved).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0]?.idempotencyKey).toBe(first?.item.idempotencyKey);
    expect(result.remaining[0]?.attempts).toBe(1);
    const retry = await syncSupabaseDevelopmentQueue(userId, async () => undefined, true);
    expect(retry.saved).toBe(1);
    expect(getSupabaseDevelopmentQueue(userId)).toHaveLength(0);
  });
});

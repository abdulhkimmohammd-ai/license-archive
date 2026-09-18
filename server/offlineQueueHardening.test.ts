import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LicenseFormValues } from "../client/src/lib/licenseSubmission";
import { getQueuedLicenses, queueLicenseForSync, removeQueuedLicense, setQueuedLicenseError } from "../client/src/lib/offlineLicenses";

const form = { licenseNo: "6543", facilityType: "pharmacy" } as LicenseFormValues;

describe("طابور Offline المحصن", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("يحتفظ بمفتاح idempotency واحد للعملية نفسها ولا يضيف سجلين", () => {
    const first = queueLicenseForSync(7, form);
    const repeated = queueLicenseForSync(7, { ...form, licenseNo: " 6543 " });

    expect(first?.queued).toBe(true);
    expect(first?.item).toMatchObject({ operation: "create" });
    expect(first?.item.idempotencyKey).toHaveLength(36);
    expect(repeated).toMatchObject({ queued: false, item: { id: first?.item.id, idempotencyKey: first?.item.idempotencyKey } });
    expect(getQueuedLicenses(7)).toHaveLength(1);
  });

  it("يبقي العملية الفاشلة قابلة لإعادة المحاولة ولا يحذفها قبل نجاح مؤكد", () => {
    const queued = queueLicenseForSync(7, form);
    expect(queued).not.toBeNull();
    setQueuedLicenseError(7, queued!.item.id, "انقطع الاتصال بعد إرسال الطلب");
    expect(getQueuedLicenses(7)[0]).toMatchObject({ idempotencyKey: queued!.item.idempotencyKey, error: "انقطع الاتصال بعد إرسال الطلب" });
    removeQueuedLicense(7, queued!.item.id);
    expect(getQueuedLicenses(7)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { APP_SYNC_STORAGE_KEY, formatSyncTime, getNextSyncTimestamp } from "../client/src/lib/appSync";

describe("مزامنة التطبيق", () => {
  it("يستخدم مفتاحاً ثابتاً ويحفظ طابعاً زمنياً صالحاً للمزامنة", () => {
    expect(APP_SYNC_STORAGE_KEY).toBe("license-archive:last-sync-at");
    expect(getNextSyncTimestamp(1_786_000_000_000.7)).toBe(1_786_000_000_000);
    expect(getNextSyncTimestamp(-4)).toBe(0);
  });

  it("يعرض حالة مفهومة قبل أول مزامنة", () => {
    expect(formatSyncTime(null)).toBe("لم تُجرَ مزامنة يدوية بعد");
  });
});

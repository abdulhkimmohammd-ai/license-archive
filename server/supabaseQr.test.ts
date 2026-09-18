import { describe, expect, it } from "vitest";
import { buildSupabaseQrPayload, parseSupabaseQrPayload } from "../client/src/lib/supabaseQr";

describe("Supabase QR contract", () => {
  it("encodes only the stable license identity fields", () => {
    const payload = buildSupabaseQrPayload({ id: "license-test-id", licenseNo: "6543-TEST", archiveNumber: "6543-0001ص" });
    expect(parseSupabaseQrPayload(payload)).toEqual({ version: 1, kind: "license", id: "license-test-id", licenseNo: "6543-TEST", archiveNumber: "6543-0001ص" });
    expect(payload).not.toContain("holder");
    expect(payload).not.toContain("national");
  });

  it("rejects malformed or unrelated QR content", () => {
    expect(parseSupabaseQrPayload("not-json")).toBeNull();
    expect(parseSupabaseQrPayload(JSON.stringify({ version: 2, kind: "other", id: "x" }))).toBeNull();
  });
});

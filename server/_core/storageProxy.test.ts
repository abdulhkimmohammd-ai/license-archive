import { describe, expect, it } from "vitest";
import { getStorageProxyKey } from "./storageProxy";

describe("storage proxy route key", () => {
  it("reconstructs Express 5 wildcard path segments without losing nested keys", () => {
    expect(getStorageProxyKey(["assets", "licenses", "card.pdf"])).toBe("assets/licenses/card.pdf");
    expect(getStorageProxyKey("single-file.pdf")).toBe("single-file.pdf");
    expect(getStorageProxyKey(undefined)).toBeUndefined();
  });
});

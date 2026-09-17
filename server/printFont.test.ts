import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("خطوط الواجهة والطباعة", () => {
  it("يحمّل خط Tajawal للواجهة وخط Noto Naskh Arabic لقالب الطباعة", () => {
    const html = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(html).toContain("family=Tajawal");
    expect(html).toContain("family=Noto+Naskh+Arabic");
  });
});

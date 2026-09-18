import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

async function source(relativePath: string) {
  return readFile(new URL(relativePath, root), "utf8");
}

describe("independent Pages runtime contract", () => {
  it("does not import legacy tRPC or Manus auth from the independent entry", async () => {
    const [entry, app] = await Promise.all([source("client/src/main.pages.tsx"), source("client/src/IndependentApp.tsx")]);
    const combined = `${entry}\n${app}`;
    expect(combined).not.toMatch(/@trpc|\/api\/trpc|startLogin|vite-plugin-manus-runtime|OAUTH_SERVER_URL|BUILT_IN_FORGE/);
  });
});

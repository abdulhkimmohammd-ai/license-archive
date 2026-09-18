import { describe, expect, it } from "vitest";
import {
  getPwaConnectionLabel,
  isStandaloneDisplayMode,
  PWA_MANIFEST_PATH,
  PWA_SERVICE_WORKER_PATH,
} from "../client/src/lib/pwa";

describe("PWA contract", () => {
  it("keeps the manifest and service worker at stable public paths", () => {
    expect(PWA_MANIFEST_PATH).toBe("/manifest.webmanifest");
    expect(PWA_SERVICE_WORKER_PATH).toBe("/sw.js");
  });

  it("shows a clear Arabic connection label", () => {
    expect(getPwaConnectionLabel("online")).toBe("متصل");
    expect(getPwaConnectionLabel("offline")).toBe("بدون إنترنت");
  });

  it("recognizes standalone app launches across supported browser modes", () => {
    expect(isStandaloneDisplayMode("standalone")).toBe(true);
    expect(isStandaloneDisplayMode("fullscreen")).toBe(true);
    expect(isStandaloneDisplayMode("browser")).toBe(false);
    expect(isStandaloneDisplayMode(undefined, true)).toBe(true);
  });
});

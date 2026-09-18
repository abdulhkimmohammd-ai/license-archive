export const PWA_MANIFEST_PATH = "/manifest.webmanifest";
export const PWA_SERVICE_WORKER_PATH = "/sw.js";

export type PwaConnectionState = "online" | "offline";

export function getPwaConnectionLabel(state: PwaConnectionState) {
  return state === "online" ? "متصل" : "بدون إنترنت";
}

export function isStandaloneDisplayMode(displayMode?: string, appleStandalone = false) {
  return displayMode === "standalone" || displayMode === "fullscreen" || displayMode === "minimal-ui" || appleStandalone;
}

export async function registerPwaServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !import.meta.env.PROD) return null;
  try {
    const registration = await navigator.serviceWorker.register(PWA_SERVICE_WORKER_PATH, { scope: "/" });
    return registration;
  } catch (error) {
    console.warn("[PWA] تعذر تسجيل Service Worker", error);
    return null;
  }
}

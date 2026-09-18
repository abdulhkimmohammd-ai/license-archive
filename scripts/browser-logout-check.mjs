import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const tokenLines = readFileSync("/tmp/license_archive_test_session.txt", "utf8").trim().split("\n");
const sessionToken = tokenLines[tokenLines.length - 1];
const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const screenshotDir = "/home/ubuntu/logout-qa";

async function addSession(context) {
  const secure = baseUrl.startsWith("https://");
  await context.addCookies([{ name: "app_session_id", value: sessionToken, url: baseUrl, httpOnly: true, secure, sameSite: secure ? "None" : "Lax" }]);
}

async function verifyLoggedOut(page) {
  for (const path of ["/", "/licenses"]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "تسجيل الدخول الآمن" }).waitFor({ state: "visible", timeout: 10000 });
    if (await page.getByText("سجل التراخيص", { exact: true }).isVisible().catch(() => false)) throw new Error(`protected interface was visible at ${path}`);
  }
}

async function logoutAndWait(page, button) {
  await button.click();
  await page.getByRole("button", { name: "تسجيل الدخول الآمن" }).waitFor({ state: "visible", timeout: 10000 });
}

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await addSession(desktopContext);
  const desktop = await desktopContext.newPage();
  await desktop.goto(baseUrl, { waitUntil: "networkidle" });
  const desktopLogout = desktop.getByRole("button", { name: "تسجيل الخروج" }).first();
  await desktopLogout.waitFor({ state: "visible", timeout: 10000 });
  await desktop.screenshot({ path: `${screenshotDir}/logout-desktop.png` });
  await logoutAndWait(desktop, desktopLogout);
  await verifyLoggedOut(desktop);
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
  await addSession(mobileContext);
  const mobile = await mobileContext.newPage();
  await mobile.goto(baseUrl, { waitUntil: "networkidle" });
  const mobileLogout = mobile.getByRole("button", { name: "تسجيل الخروج" }).first();
  await mobileLogout.waitFor({ state: "visible", timeout: 10000 });
  await mobile.screenshot({ path: `${screenshotDir}/logout-mobile.png` });
  await logoutAndWait(mobile, mobileLogout);
  await verifyLoggedOut(mobile);
  await mobileContext.close();

  console.log("browser-logout-check: PASS");
} finally {
  await browser.close();
}

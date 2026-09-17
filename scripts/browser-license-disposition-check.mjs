import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const lines = readFileSync("/tmp/license_archive_test_session.txt", "utf8").trim().split("\n");
const sessionToken = lines[lines.length - 1];
const baseUrl = process.env.TEST_BASE_URL || "https://3000-iahyn5bwoi6jhjyevfn7u-e24db5c8.us3.manus.computer";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addCookies([{ name: "app_session_id", value: sessionToken, url: baseUrl, httpOnly: true, secure: true, sameSite: "None" }]);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/licenses`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "أرشفة الترخيص" }).first().click();
  await page.getByRole("heading", { name: "أرشفة الترخيص" }).waitFor({ state: "visible" });
  await page.locator('[role="alertdialog"] textarea').fill("تحقق آلي من نافذة الأرشفة");
  await page.getByRole("button", { name: "إلغاء" }).last().click();
  await page.getByRole("button", { name: "حذف نهائي" }).first().click();
  await page.getByRole("heading", { name: "حذف نهائي غير قابل للتراجع" }).waitFor({ state: "visible" });
  await page.getByText("أقر بأن هذه العملية نهائية").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "إلغاء" }).last().click();
  await context.close();
  console.log("browser-license-disposition-check: PASS");
} finally {
  await browser.close();
}

import { randomUUID } from "node:crypto";
import { chromium } from "playwright-core";
import { afterEach, describe, expect, it } from "vitest";
import { createSupabaseDevelopmentAdminClient } from "./supabaseDevelopment";

let userIdToBlock: string | undefined;

afterEach(async () => {
  if (!userIdToBlock) return;
  const { error } = await createSupabaseDevelopmentAdminClient().from("app_profiles")
    .update({ access_status: "blocked" })
    .eq("user_id", userIdToBlock);
  expect(error).toBeNull();
  userIdToBlock = undefined;
});

describe("Supabase Development browser Offline→Online", () => {
  it("queues a real browser form while offline and creates exactly one license when the network returns", async () => {
    const email = `license-archive-browser-${randomUUID()}@example.com`;
    const password = `${randomUUID()}Aa1!`;
    const licenseNo = `7${Date.now().toString().slice(-7)}`;
    const admin = createSupabaseDevelopmentAdminClient();
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(createError).toBeNull();
    userIdToBlock = createdUser.user!.id;
    const { error: profileError } = await admin.from("app_profiles")
      .update({ role: "admin", access_status: "approved", display_name: "مدير اختبار المتصفح" })
      .eq("user_id", userIdToBlock);
    expect(profileError).toBeNull();

    const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-zygote"] });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:3000/migration-lab/supabase", { waitUntil: "networkidle" });
      await page.getByLabel("البريد الإلكتروني").fill(email);
      await page.getByLabel("كلمة المرور").fill(password);
      await page.getByRole("button", { name: "تسجيل دخول المختبر" }).click();
      await page.getByText("الدور: مدير").waitFor();

      await context.setOffline(true);
      await page.getByLabel("رقم الترخيص اليدوي").fill(licenseNo);
      await page.getByLabel("اسم المنشأة").fill("صيدلية اختبار Offline المتصفحي");
      await page.getByLabel("صاحب الترخيص").fill("صاحب اختبار المتصفح");
      await page.getByLabel("رقم الهوية").fill(`ID-${randomUUID().slice(0, 8)}`);
      await page.getByLabel("المحافظة").fill("صنعاء");
      await page.getByLabel("تاريخ الإصدار").fill("2026-08-01");
      await page.getByLabel("تاريخ الانتهاء").fill("2028-08-01");
      await page.getByRole("button", { name: "إنشاء مع رقم أرشفة مولّد" }).click();
      await page.getByText(/طابور Offline: 1 عملية تنتظر المزامنة/).waitFor();
      expect(await page.evaluate(() => Object.keys(window.localStorage).some((key) => key.startsWith("license-archive:supabase-development-queue:")))).toBe(true);

      await context.setOffline(false);
      // Playwright toggles network transport but does not consistently dispatch `online`.
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.waitForTimeout(2_000);
      const remainingQueue = await page.evaluate(() => Object.entries(window.localStorage).filter(([key]) => key.startsWith("license-archive:supabase-development-queue:")).map(([, value]) => value));
      if (remainingQueue.some((value) => value !== "[]")) throw new Error(`بقي عنصر في طابور Offline بعد عودة الشبكة: ${remainingQueue.join(" | ")}`);
      await expect.poll(async () => {
        const { count, error } = await admin.from("licenses").select("id", { count: "exact", head: true }).eq("license_no", licenseNo);
        expect(error).toBeNull();
        return count;
      }, { timeout: 15_000 }).toBe(1);
      await context.close();
    } finally {
      await browser.close();
    }
  }, 45_000);
});

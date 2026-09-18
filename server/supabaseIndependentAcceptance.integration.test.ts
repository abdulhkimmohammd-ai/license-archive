import { chromium, type BrowserContext, type Page } from "playwright-core";
import { afterEach, describe, expect, it } from "vitest";
import { createSupabaseDevelopmentAdminClient } from "./supabaseDevelopment";

const userIdsToBlock: string[] = [];

afterEach(async () => {
  const admin = createSupabaseDevelopmentAdminClient();
  for (const userId of userIdsToBlock) {
    const { error } = await admin.from("app_profiles").update({ access_status: "blocked" }).eq("user_id", userId);
    expect(error).toBeNull();
  }
  userIdsToBlock.length = 0;
});

async function login(page: Page, email: string, password: string, expectedText = "الدور: مدير") {
  await page.goto("http://127.0.0.1:3000/migration-lab/supabase", { waitUntil: "networkidle" });
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "تسجيل دخول المختبر" }).click();
  await page.getByText(expectedText).waitFor({ state: "visible", timeout: 15_000 });
}

async function assertIndependentRoutes(context: BrowserContext) {
  const page = await context.newPage();
  for (const route of [
    ["/supabase-development/dashboard", "لوحة مؤشرات أرشيف التراخيص"],
    ["/supabase-development/archive", "أرشيف التراخيص"],
    ["/supabase-development/licenses/new", "إضافة ترخيص"],
    ["/supabase-development/team", "المستخدمون والصلاحيات"],
    ["/supabase-development/trash", "سلة المحذوفات"],
  ] as const) {
    await page.goto(`http://127.0.0.1:3000${route[0]}`, { waitUntil: "networkidle" });
    expect(await page.locator("html").getAttribute("dir")).toBe("rtl");
    const heading = page.getByText(route[1], { exact: false }).first();
    await heading.waitFor({ state: "visible", timeout: 15_000 });
    expect(await heading.isVisible()).toBe(true);
  }
  await page.close();
}

describe("Supabase independent runtime acceptance", () => {
  it("renders the independent routes for synthetic admin sessions on desktop and mobile", async () => {
    const email = `license-archive-acceptance-${crypto.randomUUID()}@example.com`;
    const password = `${crypto.randomUUID()}Aa1!`;
    const admin = createSupabaseDevelopmentAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(error).toBeNull();
    userIdsToBlock.push(data.user!.id);
    const adminUserId = data.user!.id;
    const { error: profileError } = await admin.from("app_profiles").update({ role: "admin", access_status: "approved", display_name: "مدير قبول اصطناعي" }).eq("user_id", adminUserId);
    expect(profileError).toBeNull();

    const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-zygote"] });
    try {
      const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const desktopPage = await desktop.newPage();
      await login(desktopPage, email, password);
      await assertIndependentRoutes(desktop);
      await desktop.close();

      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
      const mobilePage = await mobile.newPage();
      await login(mobilePage, email, password);
      await assertIndependentRoutes(mobile);
      await mobile.close();

      const blockedEmail = `license-archive-blocked-${crypto.randomUUID()}@example.com`;
      const blockedPassword = `${crypto.randomUUID()}Aa1!`;
      const { data: blockedData, error: blockedError } = await admin.auth.admin.createUser({ email: blockedEmail, password: blockedPassword, email_confirm: true });
      expect(blockedError).toBeNull();
      userIdsToBlock.push(blockedData.user!.id);
      const { error: blockedProfileError } = await admin.from("app_profiles").update({ role: "user", access_status: "blocked", display_name: "مستخدم محظور اصطناعي" }).eq("user_id", blockedData.user!.id);
      expect(blockedProfileError).toBeNull();
      const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
      const blockedPage = await blockedContext.newPage();
      await login(blockedPage, blockedEmail, blockedPassword, "الحساب غير معتمد");
      await blockedPage.getByText("الحساب غير معتمد").waitFor({ state: "visible", timeout: 15_000 });
      expect(await blockedPage.getByText("الحساب غير معتمد").isVisible()).toBe(true);
      await blockedContext.close();
    } finally {
      await browser.close();
    }
  }, 60_000);
});

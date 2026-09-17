import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const coreOperationFiles = [
  "client/src/App.tsx",
  "client/src/pages/LicenseForm.tsx",
  "client/src/pages/LicenseEdit.tsx",
  "client/src/pages/Licenses.tsx",
  "client/src/pages/ArchivePage.tsx",
  "client/src/pages/LicenseDetails.tsx",
  "client/src/pages/LicensePrintPreview.tsx",
  "client/src/pages/MinistryLicensePrint.tsx",
  "client/src/components/LicenseAdminActions.tsx",
  "client/src/components/OfflineSyncManager.tsx",
  "client/src/lib/licenseSubmission.ts",
  "shared/archiveNumber.ts",
  "server/routers.ts",
  "server/routers/licenses.ts",
  "server/dashboardAnalytics.ts",
];

const forbiddenAiIntegrations = [
  /\binvokeLLM\b/,
  /_core\/llm/,
  /\/llm\b/i,
  /\bimageGeneration\b/,
  /\bvoiceTranscription\b/,
  /\bopenai\b/i,
  /\banthropic\b/i,
  /\/v1\/(chat|completions)/i,
];

describe("Zero-AI للعمليات الأساسية", () => {
  it("يبقي تدفقات التراخيص اليومية خالية من استدعاءات الذكاء الاصطناعي", () => {
    for (const relativePath of coreOperationFiles) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      for (const forbiddenPattern of forbiddenAiIntegrations) {
        expect(source, `${relativePath} يجب ألا يتضمن ${forbiddenPattern}`).not.toMatch(forbiddenPattern);
      }
    }
  });

  it("لا يسجل مساراً إنتاجياً لواجهة دردشة أو صفحة ذكاء اصطناعي", () => {
    const appRoutes = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(appRoutes).not.toMatch(/AIChatBox|ComponentShowcase/);
  });
});

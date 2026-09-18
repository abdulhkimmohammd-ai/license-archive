import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const supabaseRoot = join(process.cwd(), "supabase");
const forbiddenPatterns = [
  /invokeLLM/i,
  /openai/i,
  /anthropic/i,
  /generat(?:e|ion).*image/i,
  /supabase\.storage/i,
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?documents\b/i,
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?attachments?\b/i,
];

function collectSql(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSql(path);
    return entry.name.endsWith(".sql") ? [path] : [];
  });
}

describe("Supabase Migration Lab Zero-AI and no-storage boundary", () => {
  it("keeps migrations and validation SQL free of AI, Storage, and attachment schema", () => {
    const files = collectSql(supabaseRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(content, `${file} must not contain ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});

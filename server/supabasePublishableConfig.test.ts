import { describe, expect, it } from "vitest";
import { DEVELOPMENT_PROJECT_REF } from "./supabaseDevelopment";

describe("Supabase Development browser configuration", () => {
  it("uses a Development publishable key and never a server secret", async () => {
    const url = process.env.VITE_SUPABASE_DEVELOPMENT_URL;
    const key = process.env.VITE_SUPABASE_DEVELOPMENT_PUBLISHABLE_KEY;

    expect(url).toBeTruthy();
    expect(key).toBeTruthy();
    expect(new URL(url!).hostname).toBe(`${DEVELOPMENT_PROJECT_REF}.supabase.co`);
    expect(key).not.toMatch(/^(service_role|sb_secret_)/i);

    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } });
    expect(response.status).toBe(200);
  });
});

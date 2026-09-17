import { describe, expect, it } from "vitest";
import worker from "../workers/src/index";

describe("Cloudflare Worker contract", () => {
  const env = { SUPABASE_URL: "https://development.supabase.co", SUPABASE_ANON_KEY: "public-test-key", ALLOWED_ORIGIN: "https://preview.example" };

  it("rejects unsupported routes without contacting Supabase", async () => {
    const response = await worker.fetch(new Request("https://preview.example/api/unknown", { method: "POST" }), env);
    expect(response.status).toBe(404);
  });

  it("requires a Supabase bearer token for allowed RPCs", async () => {
    const response = await worker.fetch(new Request("https://preview.example/api/licenses/rpc/list_operational_licenses", { method: "POST", body: "{}" }), env);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "جلسة Supabase مطلوبة" });
  });

  it("handles CORS preflight without invoking an RPC", async () => {
    const response = await worker.fetch(new Request("https://preview.example/api/licenses/rpc/list_operational_licenses", { method: "OPTIONS" }), env);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://preview.example");
  });

  it("accepts invitation RPCs only after the same bearer gate", async () => {
    const response = await worker.fetch(new Request("https://preview.example/api/licenses/rpc/create_team_invitation", { method: "POST", body: "{}" }), env);
    expect(response.status).toBe(401);
  });

  it("rejects oversized RPC payloads before forwarding them", async () => {
    const response = await worker.fetch(new Request("https://preview.example/api/licenses/rpc/list_operational_licenses", { method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" }, body: "x".repeat(70_000) }), env);
    expect(response.status).toBe(413);
  });
});

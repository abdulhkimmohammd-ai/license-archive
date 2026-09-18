import { describe, expect, it } from "vitest";

const developmentProjectRef = "qduofealtaikxhhrjxly";

describe("Supabase Development connection", () => {
  it("uses the approved Development project and accepts the server credential", async () => {
    const url = process.env.SUPABASE_DEVELOPMENT_URL;
    const key = process.env.SUPABASE_DEVELOPMENT_KEY;

    expect(url).toBeTruthy();
    expect(key).toBeTruthy();
    expect(new URL(url!).hostname).toBe(`${developmentProjectRef}.supabase.co`);

    const response = await fetch(`${url}/rest/v1/licenses?select=id&limit=1`, {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key!}`,
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toBeInstanceOf(Array);
  });
});

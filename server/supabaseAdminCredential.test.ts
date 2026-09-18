import { describe, expect, it } from "vitest";
import { createSupabaseDevelopmentAdminClient } from "./supabaseDevelopment";

describe("Supabase Development administrative credential", () => {
  it("can perform an authenticated, read-only admin health check", async () => {
    const client = createSupabaseDevelopmentAdminClient();
    const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });

    expect(error).toBeNull();
  });
});

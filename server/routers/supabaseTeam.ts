import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createSupabaseDevelopmentUserClient } from "../supabaseDevelopment";
import { publicProcedure, router } from "../_core/trpc";

const accessTokenInput = z.object({ accessToken: z.string().min(20) });
const userIdInput = accessTokenInput.extend({ userId: z.string().uuid() });
type SupabaseTeamMember = { user_id: string; display_name: string | null; email: string | null; role: "user" | "archivist" | "admin"; access_status: "pending" | "approved" | "blocked"; created_at: string };

function raiseSupabaseError(error: { message: string; code?: string | null }) {
  if (error.code === "42501") throw new TRPCError({ code: "FORBIDDEN", message: "تحتاج هذه العملية إلى مدير معتمد في Supabase Development" });
  if (error.code === "23514") throw new TRPCError({ code: "CONFLICT", message: error.message });
  if (error.code === "22023") throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إكمال إدارة الفريق في Supabase Development" });
}

export const supabaseTeamRouter = router({
  list: publicProcedure.input(accessTokenInput).query(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("list_team_members");
    if (error) raiseSupabaseError(error);
    return (data as SupabaseTeamMember[] | null ?? []).map((member) => ({
      id: String(member.user_id),
      name: member.display_name,
      email: member.email,
      role: member.role,
      accessStatus: member.access_status,
      createdAt: member.created_at,
    }));
  }),

  setRole: publicProcedure.input(userIdInput.extend({ role: z.enum(["user", "archivist", "admin"]) })).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("set_team_role", { p_user_id: input.userId, p_role: input.role });
    if (error) raiseSupabaseError(error);
    return data;
  }),

  setAccessStatus: publicProcedure.input(userIdInput.extend({ accessStatus: z.enum(["pending", "approved", "blocked"]) })).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("set_team_access_status", { p_user_id: input.userId, p_access_status: input.accessStatus });
    if (error) raiseSupabaseError(error);
    return data;
  }),
});

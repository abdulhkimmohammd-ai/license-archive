import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createSupabaseDevelopmentUserClient } from "../supabaseDevelopment";
import { publicProcedure, router } from "../_core/trpc";

const accessTokenInput = z.object({ accessToken: z.string().min(20) });

function raiseSupabaseError(error: { message: string; code?: string | null }) {
  if (error.code === "42501") throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية قراءة هذا التنبيه" });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إكمال عملية التنبيهات في Supabase Development" });
}

export const supabaseNotificationsRouter = router({
  list: publicProcedure.input(accessTokenInput.extend({ limit: z.number().int().min(1).max(100).default(50) })).query(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("list_my_notifications", { p_limit: input.limit });
    if (error) raiseSupabaseError(error);
    return data ?? [];
  }),

  markRead: publicProcedure.input(accessTokenInput.extend({ id: z.string().uuid() })).mutation(async ({ input }) => {
    const client = createSupabaseDevelopmentUserClient(input.accessToken);
    const { data, error } = await client.rpc("mark_notification_read", { p_notification_id: input.id });
    if (error) {
      if (error.code === "P0001") throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على التنبيه أو لا تملك صلاحية تعديله" });
      raiseSupabaseError(error);
    }
    return data;
  }),
});

import { eq } from "drizzle-orm";
import { z } from "zod";
import { userAccessStatusValues, users } from "../../drizzle/schema";
import { getDb, writeAuditLog } from "../db";
import { adminProcedure, router } from "../_core/trpc";

export const teamRouter = router({
  list: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("تعذر الوصول إلى قاعدة البيانات");
    return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, accessStatus: users.accessStatus, lastSignedIn: users.lastSignedIn })
      .from(users)
      .orderBy(users.createdAt);
  }),

  setRole: adminProcedure.input(z.object({
    userId: z.number().int().positive(),
    role: z.enum(["user", "archivist", "admin"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("تعذر الوصول إلى قاعدة البيانات");
    if (input.userId === ctx.user.id && input.role !== "admin") {
      throw new Error("لا يمكن للمدير إزالة صلاحية الإدارة من حسابه الحالي");
    }
    await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
    await writeAuditLog({
      actorId: ctx.user.id,
      action: "UPDATE_USER_ROLE",
      entityType: "user",
      entityId: input.userId,
      metadata: { role: input.role },
    });
    return { success: true };
  }),

  setAccessStatus: adminProcedure.input(z.object({
    userId: z.number().int().positive(),
    accessStatus: z.enum(userAccessStatusValues),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("تعذر الوصول إلى قاعدة البيانات");
    if (input.userId === ctx.user.id && input.accessStatus !== "approved") {
      throw new Error("لا يمكن للمدير حظر أو تعليق حسابه الحالي");
    }
    await db.update(users).set({ accessStatus: input.accessStatus }).where(eq(users.id, input.userId));
    await writeAuditLog({
      actorId: ctx.user.id,
      action: "UPDATE_USER_ACCESS_STATUS",
      entityType: "user",
      entityId: input.userId,
      metadata: { accessStatus: input.accessStatus },
    });
    return { success: true };
  }),
});

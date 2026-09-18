import type { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { licenses, notifications } from "../../drizzle/schema";
import { getDb } from "../db";
import { getDaysRemaining } from "../licenseStatus";
import { sdk } from "../_core/sdk";

const thresholds = [
  { days: 90, kind: "days_90" as const },
  { days: 30, kind: "days_30" as const },
  { days: 7, kind: "days_7" as const },
];

export async function licenseExpiryAlertsHandler(req: Request, res: Response) {
  try {
    const caller = await sdk.authenticateRequest(req);
    if (!caller.isCron || !caller.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database-unavailable" });
    const rows = await db.select().from(licenses).orderBy(desc(licenses.expiryDate));
    let created = 0;

    for (const license of rows) {
      if (license.status === "suspended" || license.status === "archived") continue;
      const remaining = getDaysRemaining(license.expiryDate);
      if (remaining < 0) continue;
      const existing = await db.select({ kind: notifications.kind }).from(notifications)
        .where(eq(notifications.licenseId, license.id));
      const existingKinds = new Set(existing.map(item => item.kind));
      for (const threshold of thresholds) {
        if (remaining > threshold.days) continue;
        if (existingKinds.has(threshold.kind)) continue;
        await db.insert(notifications).values({ licenseId: license.id, kind: threshold.kind });
        existingKinds.add(threshold.kind);
        created += 1;
      }
    }

    return res.json({ ok: true, created, checked: rows.length });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "unknown-error",
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}

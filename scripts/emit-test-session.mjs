import "dotenv/config";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema.ts";
import { getDb } from "../server/db.ts";
import { sdk } from "../server/_core/sdk.ts";

const db = await getDb();
if (!db) throw new Error("database unavailable");
const [admin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
if (!admin) throw new Error("admin user unavailable");
const token = await sdk.createSessionToken(admin.openId, { name: admin.name || "Administrator" });
const verified = await sdk.verifySession(token);
if (!verified?.openId || verified.openId !== admin.openId) throw new Error("session generation failed");
process.stdout.write(token);
process.exit(0);

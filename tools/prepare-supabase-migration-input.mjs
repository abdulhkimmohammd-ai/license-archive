import { readFile, writeFile } from "node:fs/promises";

const sourcePath = process.argv[2];
const migrationName = process.argv[3];
const outputPath = process.argv[4];

if (!sourcePath || !migrationName || !outputPath) {
  throw new Error("Usage: node prepare-supabase-migration-input.mjs <source.sql> <name> <output.json>");
}

const query = await readFile(sourcePath, "utf8");
await writeFile(outputPath, JSON.stringify({
  project_id: "qduofealtaikxhhrjxly",
  name: migrationName,
  query,
}));

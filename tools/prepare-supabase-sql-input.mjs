import { readFile, writeFile } from "node:fs/promises";

const sourcePath = process.argv[2];
const outputPath = process.argv[3];

if (!sourcePath || !outputPath) {
  throw new Error("Usage: node prepare-supabase-sql-input.mjs <source.sql> <output.json>");
}

const query = await readFile(sourcePath, "utf8");
await writeFile(outputPath, JSON.stringify({
  project_id: "qduofealtaikxhhrjxly",
  query,
}));

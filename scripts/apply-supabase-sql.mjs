import { readFile } from "node:fs/promises";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Missing DATABASE_URL. Example:");
  console.error("DATABASE_URL=\"postgresql://postgres:<password>@db.bkthrasarhvazjpkvndp.supabase.co:5432/postgres?sslmode=require\" npm run db:apply");
  process.exit(1);
}

const files = [
  "database/supabase_schema.sql",
  "database/supabase_app_api.sql",
  "database/supabase_seed.sql",
];

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  for (const file of files) {
    const sql = await readFile(file, "utf8");
    console.log(`Applying ${file}...`);
    await client.query(sql);
    console.log(`Applied ${file}`);
  }
} finally {
  await client.end();
}

console.log("Supabase backend is ready.");

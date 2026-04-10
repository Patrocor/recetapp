// ── RecetAPP — Script de migración Supabase ──
// Uso: node scripts/migrate.js
// Requiere .env.local con SUPABASE_DB_URL o las credenciales individuales.

require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("❌  Falta SUPABASE_DB_URL en .env.local");
  console.error('   Formato: postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres');
  console.error('   (Encuéntrala en tu proyecto Supabase → Settings → Database → Connection string → URI)');
  process.exit(1);
}

const sqlFile = path.join(__dirname, "../supabase/migrations/001_initial.sql");
const sql = fs.readFileSync(sqlFile, "utf8");

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    console.log("🔌  Conectando a Supabase…");
    await client.connect();
    console.log("✅  Conexión exitosa");
    console.log("⚙️   Ejecutando schema SQL…");
    await client.query(sql);
    console.log("✅  Schema aplicado correctamente");
  } catch (err) {
    console.error("❌  Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();

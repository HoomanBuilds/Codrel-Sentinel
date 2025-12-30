import { Pool } from "pg";
import "dotenv/config";
import { log as vectorLog } from "../../processors/issues";

export let pool: Pool;

export function initDB() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }
  
  if (pool) return;
  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  pool.query("SELECT NOW()", (err : Error | null) => {
    if (err) {
      console.error("❌ Failed to connect to Database:", err);
      process.exit(1);
    }
    vectorLog("connection", "🔌 Database Connected");
  });
}

export async function updateStatus(repoId: string, status: string) {
  const query = `
    UPDATE repositories 
    SET status = $1, updated_at = NOW() 
    WHERE id = $2
  `;

  try {
    const res = await pool.query(query, [status, repoId]);
    if (res.rowCount === 0) {
      console.warn(`⚠️ Warning: No repository found with ID ${repoId} to update status.`);
    } else {
      console.log(`🔄 Repo ${repoId} status updated to: ${status}`);
    }
  } catch (err) {
    console.error(`❌ Failed to update status for ${repoId} to ${status}:`, err);
    throw err;
  }
}

export async function markFailed(repoId: string, errMsg: string) {
  const query = `
    UPDATE repositories 
    SET status = 'FAILED', error = $1, updated_at = NOW() 
    WHERE id = $2
  `;

  try {
    await pool.query(query, [errMsg, repoId]);
    console.log(`🚫 Repo ${repoId} marked as FAILED. Reason: ${errMsg}`);
  } catch (err) {
    console.error(`❌ Failed to mark repo ${repoId} as FAILED:`, err);
  }
}

process.on("SIGTERM", async () => {
  await pool?.end();
});
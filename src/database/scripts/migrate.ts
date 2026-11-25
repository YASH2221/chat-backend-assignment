import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required to run migrations');
  }

  const useSsl = process.env['DATABASE_SSL'] === 'true' || process.env['DATABASE_SSL'] === '1';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(__dirname, '..', 'migrations');
    const entries = await fs.readdir(migrationsDir);
    const sqlFiles = entries.filter((file) => file.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const existing = await pool.query<{ filename: string }>(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [file],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        console.log(`[migrate] Skipping already applied: ${file}`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[migrate] Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err: unknown) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});

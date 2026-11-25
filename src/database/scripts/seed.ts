import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const SEED_USERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Alice Johnson',
    email: 'alice@example.com',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Bob Smith',
    email: 'bob@example.com',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Charlie Patel',
    email: 'charlie@example.com',
  },
] as const;

async function runSeed(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required to seed database');
  }

  const useSsl = process.env['DATABASE_SSL'] === 'true' || process.env['DATABASE_SSL'] === '1';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    for (const user of SEED_USERS) {
      await pool.query(
        `
        INSERT INTO users (id, name, email)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE
          SET name = EXCLUDED.name,
              updated_at = NOW();
        `,
        [user.id, user.name, user.email],
      );
    }
    console.log(`[seed] Seeded ${SEED_USERS.length} users successfully.`);
  } finally {
    await pool.end();
  }
}

runSeed().catch((err: unknown) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});

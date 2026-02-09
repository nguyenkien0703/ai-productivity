import pg from 'pg';
import { config } from 'dotenv';

config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Initialize database tables
 */
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cached_data (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      id INTEGER PRIMARY KEY DEFAULT 1,
      last_sync_at TIMESTAMP,
      status TEXT,
      errors JSONB DEFAULT '[]',
      CONSTRAINT single_row CHECK (id = 1)
    )
  `);

  // Ensure sync_meta row exists
  await pool.query(`
    INSERT INTO sync_meta (id, status) VALUES (1, 'pending')
    ON CONFLICT (id) DO NOTHING
  `);
}

/**
 * Get cached data by key
 * @param {string} key - 'github_prs' or 'jira_sprints'
 * @returns {Promise<Object|null>}
 */
export async function getCachedData(key) {
  const result = await pool.query(
    'SELECT data, updated_at FROM cached_data WHERE key = $1',
    [key]
  );
  if (result.rows.length === 0) return null;
  return {
    data: result.rows[0].data,
    updatedAt: result.rows[0].updated_at,
  };
}

/**
 * Save cached data
 * @param {string} key - 'github_prs' or 'jira_sprints'
 * @param {Object} data - Data to cache
 */
export async function setCachedData(key, data) {
  await pool.query(
    `INSERT INTO cached_data (key, data, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW()`,
    [key, JSON.stringify(data)]
  );
}

/**
 * Get sync metadata
 * @returns {Promise<Object>}
 */
export async function getSyncMeta() {
  const result = await pool.query(
    'SELECT last_sync_at, status, errors FROM sync_meta WHERE id = 1'
  );
  if (result.rows.length === 0) {
    return { lastSyncAt: null, status: 'pending', errors: [] };
  }
  const row = result.rows[0];
  return {
    lastSyncAt: row.last_sync_at,
    status: row.status,
    errors: row.errors || [],
  };
}

/**
 * Update sync metadata
 * @param {Object} meta - { status, errors }
 */
export async function updateSyncMeta(status, errors = []) {
  await pool.query(
    `UPDATE sync_meta SET last_sync_at = NOW(), status = $1, errors = $2 WHERE id = 1`,
    [status, JSON.stringify(errors)]
  );
}

export default pool;

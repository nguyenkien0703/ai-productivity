import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const DB_PATH = join(DATA_DIR, 'dashboard.db');

let db = null;

export function initializeDatabase() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Enable WAL mode for concurrent read/write
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  createTables();

  console.log('   Database initialized at', DB_PATH);
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pull_requests (
      id INTEGER PRIMARY KEY,
      number INTEGER NOT NULL,
      repo_name TEXT NOT NULL,
      title TEXT NOT NULL,
      state TEXT NOT NULL,
      user_login TEXT NOT NULL,
      created_at TEXT NOT NULL,
      merged_at TEXT,
      first_review_at TEXT,
      raw_json TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(repo_name, number)
    );

    CREATE TABLE IF NOT EXISTS sprints (
      id INTEGER PRIMARY KEY,
      board_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      complete_date TEXT,
      committed_points REAL DEFAULT 0,
      completed_points REAL DEFAULT 0,
      completion_rate REAL DEFAULT 0,
      issue_count INTEGER DEFAULT 0,
      raw_json TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      source TEXT PRIMARY KEY,
      last_sync_at TEXT NOT NULL,
      status TEXT DEFAULT 'success',
      error_msg TEXT,
      duration_ms INTEGER
    );
  `);
}

// --- Pull Requests CRUD ---

export function getAllPRs() {
  return db.prepare('SELECT * FROM pull_requests ORDER BY created_at DESC').all();
}

export function upsertPRsBatch(prs) {
  const stmt = db.prepare(`
    INSERT INTO pull_requests (id, number, repo_name, title, state, user_login, created_at, merged_at, first_review_at, raw_json, synced_at)
    VALUES (@id, @number, @repo_name, @title, @state, @user_login, @created_at, @merged_at, @first_review_at, @raw_json, datetime('now'))
    ON CONFLICT(repo_name, number) DO UPDATE SET
      title = excluded.title,
      state = excluded.state,
      merged_at = excluded.merged_at,
      first_review_at = excluded.first_review_at,
      raw_json = excluded.raw_json,
      synced_at = datetime('now')
  `);

  const insertMany = db.transaction((items) => {
    for (const pr of items) {
      stmt.run({
        id: pr.id,
        number: pr.number,
        repo_name: pr.repo_name || pr.repoName,
        title: pr.title,
        state: pr.state,
        user_login: pr.user_login || pr.user?.login || '',
        created_at: pr.created_at,
        merged_at: pr.merged_at || null,
        first_review_at: pr.first_review_at || pr.firstReviewAt || null,
        raw_json: JSON.stringify(pr),
      });
    }
  });

  insertMany(prs);
}

// --- Sprints CRUD ---

export function getAllSprints() {
  return db.prepare('SELECT * FROM sprints ORDER BY start_date ASC').all();
}

export function upsertSprintsBatch(sprints) {
  const stmt = db.prepare(`
    INSERT INTO sprints (id, board_id, name, state, start_date, end_date, complete_date, committed_points, completed_points, completion_rate, issue_count, raw_json, synced_at)
    VALUES (@id, @board_id, @name, @state, @start_date, @end_date, @complete_date, @committed_points, @completed_points, @completion_rate, @issue_count, @raw_json, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      state = excluded.state,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      complete_date = excluded.complete_date,
      committed_points = excluded.committed_points,
      completed_points = excluded.completed_points,
      completion_rate = excluded.completion_rate,
      issue_count = excluded.issue_count,
      raw_json = excluded.raw_json,
      synced_at = datetime('now')
  `);

  const insertMany = db.transaction((items) => {
    for (const sprint of items) {
      stmt.run({
        id: sprint.id,
        board_id: sprint.board_id || sprint.boardId || 0,
        name: sprint.name,
        state: sprint.state,
        start_date: sprint.start_date || sprint.startDate || null,
        end_date: sprint.end_date || sprint.endDate || null,
        complete_date: sprint.complete_date || sprint.completeDate || null,
        committed_points: sprint.committed_points || sprint.committedPoints || 0,
        completed_points: sprint.completed_points || sprint.completedPoints || 0,
        completion_rate: sprint.completion_rate || sprint.completionRate || 0,
        issue_count: sprint.issue_count || sprint.issueCount || 0,
        raw_json: JSON.stringify(sprint),
      });
    }
  });

  insertMany(sprints);
}

// --- Sync Metadata ---

export function getSyncStatus(source) {
  if (source) {
    return db.prepare('SELECT * FROM sync_metadata WHERE source = ?').get(source);
  }
  return db.prepare('SELECT * FROM sync_metadata').all();
}

export function setSyncStatus(source, status, errorMsg = null, durationMs = null) {
  db.prepare(`
    INSERT INTO sync_metadata (source, last_sync_at, status, error_msg, duration_ms)
    VALUES (?, datetime('now'), ?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET
      last_sync_at = datetime('now'),
      status = excluded.status,
      error_msg = excluded.error_msg,
      duration_ms = excluded.duration_ms
  `).run(source, status, errorMsg, durationMs);
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('   Database connection closed');
  }
}

export function getDatabase() {
  return db;
}

const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

let db;

async function initDb() {
  if (db) return db;

  db = await open({
    filename: path.join(__dirname, "..", "data.sqlite"),
    driver: sqlite3.Database
  });

  await db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      channel_id TEXT,
      status TEXT DEFAULT 'active',
      avatar TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      privacy_json TEXT DEFAULT '{"showFullName":true,"anonymousPosts":false}',
      notification_settings_json TEXT DEFAULT '{"all":true,"newIssue":true,"comment":true,"assignment":true,"status":true,"progress":true,"approval":true}',
      push_token TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      head_id TEXT,
      head_email TEXT,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channel_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      request_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      approved_by TEXT,
      approved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_avatar TEXT DEFAULT '',
      author_role TEXT DEFAULT 'User',
      channel_id TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      category TEXT,
      location TEXT,
      images_json TEXT DEFAULT '[]',
      assigned_authorities_json TEXT DEFAULT '[]',
      likes_json TEXT DEFAULT '[]',
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      progress_updates_count INTEGER DEFAULT 0,
      status_history_json TEXT DEFAULT '[]',
      audio_url TEXT,
      is_ai_refined INTEGER DEFAULT 0,
      ai_summary TEXT DEFAULT '',
      refined_by TEXT DEFAULT 'user',
      keywords_json TEXT DEFAULT '[]',
      is_voice_report INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_avatar TEXT DEFAULT '',
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progress_updates (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      authority_id TEXT NOT NULL,
      authority_name TEXT NOT NULL,
      text TEXT NOT NULL,
      images_json TEXT DEFAULT '[]',
      status TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      issue_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      screen TEXT DEFAULT 'Home',
      read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      meta_json TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      performed_by TEXT,
      target_id TEXT,
      details_json TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suspended_users (
      user_id TEXT PRIMARY KEY,
      reason TEXT,
      suspended_by TEXT,
      suspended_at INTEGER,
      unsuspend_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_limits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      day_key TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0
    );
  `);

  try {
    await db.exec("ALTER TABLE issues ADD COLUMN possible_solutions_json TEXT DEFAULT '{\"solutions\":[],\"note\":\"\"}'");
  } catch (error) {
    // Ignore when column already exists.
  }

  return db;
}

module.exports = { initDb };

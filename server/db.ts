import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, 'data', 'worldcup.db')

let db: Database.Database

export function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initDB(): void {
  const db = getDB()

  db.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      season TEXT NOT NULL,
      year INTEGER NOT NULL,
      host_country TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UPCOMING',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      short_name TEXT,
      country_code TEXT,
      fifa_ranking INTEGER,
      group_name TEXT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      statsbomb_name TEXT,
      openligadb_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      stage TEXT NOT NULL,
      group_name TEXT,
      home_team_id INTEGER REFERENCES teams(id),
      away_team_id INTEGER REFERENCES teams(id),
      home_score INTEGER,
      away_score INTEGER,
      handicap REAL,
      start_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id),
      spf JSON NOT NULL,
      score_distribution JSON NOT NULL,
      handicap JSON NOT NULL,
      goals JSON NOT NULL,
      risk_level TEXT NOT NULL,
      analysis_report TEXT,
      xg_analysis JSON,
      odds_analysis JSON,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS retrospective_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id),
      prediction_vs_actual JSON NOT NULL,
      xg_review JSON,
      key_events JSON,
      summary TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      groups_data JSON NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bracket_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      bracket_data JSON NOT NULL,
      team_probabilities JSON NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS statsbomb_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id),
      home_xg REAL,
      away_xg REAL,
      home_possession REAL,
      away_possession REAL,
      home_passes INTEGER,
      away_passes INTEGER,
      home_pass_accuracy REAL,
      away_pass_accuracy REAL,
      home_shots INTEGER,
      away_shots INTEGER,
      home_shots_on_target INTEGER,
      away_shots_on_target INTEGER,
      home_fouls INTEGER,
      away_fouls INTEGER,
      home_corners INTEGER,
      away_corners INTEGER,
      raw_events_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS backtest_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prediction_id INTEGER NOT NULL REFERENCES ai_predictions(id),
      match_id INTEGER NOT NULL REFERENCES matches(id),
      tournament_id INTEGER NOT NULL,
      actual_result TEXT,
      spf_correct INTEGER DEFAULT 0,
      score_correct INTEGER DEFAULT 0,
      handicap_correct INTEGER DEFAULT 0,
      goals_correct INTEGER DEFAULT 0,
      accuracy_score REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_name_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      statsbomb_name TEXT,
      openligadb_name TEXT,
      football_data_name TEXT,
      dongqiudi_name TEXT,
      canonical_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_ratings (
      team_id INTEGER PRIMARY KEY REFERENCES teams(id),
      rating INTEGER NOT NULL DEFAULT 1500,
      form_score REAL NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      goals_for INTEGER NOT NULL DEFAULT 0,
      goals_against INTEGER NOT NULL DEFAULT 0,
      last_results TEXT DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS data_sync_log (
      source TEXT PRIMARY KEY,
      last_update TEXT,
      status TEXT DEFAULT 'ok'
    );
  `)

  console.log('✅ Database initialized with 10 tables')
}

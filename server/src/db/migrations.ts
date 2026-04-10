import db from './connection';

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      abbreviation  TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS players (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name          TEXT    NOT NULL,
      jersey_number TEXT    NOT NULL DEFAULT '',
      positions     TEXT    NOT NULL DEFAULT '[]',
      bats          TEXT    NOT NULL DEFAULT 'R' CHECK(bats IN ('L','R','S')),
      throws        TEXT    NOT NULL DEFAULT 'R' CHECK(throws IN ('L','R')),
      active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS games (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      home_team_id    INTEGER NOT NULL REFERENCES teams(id),
      away_team_id    INTEGER NOT NULL REFERENCES teams(id),
      game_date       TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'scheduled'
                              CHECK(status IN ('scheduled','in_progress','final')),
      innings         INTEGER NOT NULL DEFAULT 9,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lineups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id       INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      team_id       INTEGER NOT NULL REFERENCES teams(id),
      batting_order INTEGER NOT NULL,
      player_id     INTEGER NOT NULL REFERENCES players(id),
      position      TEXT    NOT NULL,
      is_starter    INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS plays (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id             INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      play_index          INTEGER NOT NULL,
      inning              INTEGER NOT NULL,
      half                TEXT    NOT NULL CHECK(half IN ('top','bottom')),
      outs_before         INTEGER NOT NULL DEFAULT 0,
      batter_id           INTEGER REFERENCES players(id),
      pitcher_id          INTEGER NOT NULL REFERENCES players(id),
      offense_team_id     INTEGER NOT NULL REFERENCES teams(id),
      play_type           TEXT    NOT NULL,
      result_code         TEXT,
      runners_before      TEXT    NOT NULL DEFAULT '{}',
      runners_after       TEXT    NOT NULL DEFAULT '{}',
      outs_on_play        INTEGER NOT NULL DEFAULT 0,
      runs_on_play        INTEGER NOT NULL DEFAULT 0,
      scored_runner_ids   TEXT    NOT NULL DEFAULT '[]',
      rbi                 INTEGER NOT NULL DEFAULT 0,
      earned              INTEGER NOT NULL DEFAULT 1,
      display_text        TEXT,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS plays_game_idx ON plays(game_id, play_index);

    CREATE TABLE IF NOT EXISTS pitching_appearances (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id             INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      pitcher_id          INTEGER NOT NULL REFERENCES players(id),
      team_id             INTEGER NOT NULL REFERENCES teams(id),
      entry_play_index    INTEGER NOT NULL,
      exit_play_index     INTEGER,
      inherited_runners   TEXT    NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS leagues (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      season      TEXT    NOT NULL DEFAULT '',
      description TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS league_teams (
      league_id   INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      team_id     INTEGER NOT NULL REFERENCES teams(id)   ON DELETE CASCADE,
      PRIMARY KEY (league_id, team_id)
    );
  `);

  // Additive migrations: add new columns if they don't already exist
  const addIfMissing = (sql: string) => {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  };
  addIfMissing('ALTER TABLE players ADD COLUMN default_batting_order INTEGER NOT NULL DEFAULT 0');
  addIfMissing('ALTER TABLE players ADD COLUMN default_position TEXT NOT NULL DEFAULT \'\'');
  addIfMissing('ALTER TABLE players ADD COLUMN defensive_rating TEXT NOT NULL DEFAULT \'\'');
  addIfMissing('ALTER TABLE players ADD COLUMN stealing TEXT NOT NULL DEFAULT \'\'');
  addIfMissing('ALTER TABLE players ADD COLUMN running TEXT NOT NULL DEFAULT \'\'');

  console.log('Database migrations complete.');
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

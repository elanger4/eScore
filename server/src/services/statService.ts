import db from '../db/connection';
import { Play, BatterLine, PitcherLine, BoxScore, LineScoreTeam, PitchingAppearance, LineupEntry, Team, Game } from '../types';

// result_codes that do NOT count as an AB
const NON_AB_CODES = new Set(['BB', 'IBB', 'HBP', 'SAC', 'SF']);

function isHit(code: string | null): boolean {
  if (!code) return false;
  return ['1B', '2B', '3B', 'HR'].includes(code);
}

function isOut(play: Play): boolean {
  return play.outs_on_play > 0 && play.play_type === 'at_bat';
}

function formatIP(outs: number): string {
  const full = Math.floor(outs / 3);
  const partial = outs % 3;
  return `${full}.${partial}`;
}

export function computeBoxScore(gameId: number): BoxScore {
  const game = db.prepare(`
    SELECT g.*,
      ht.name as home_name, ht.abbreviation as home_abbr,
      at.name as away_name, at.abbreviation as away_abbr
    FROM games g
    JOIN teams ht ON ht.id = g.home_team_id
    JOIN teams at ON at.id = g.away_team_id
    WHERE g.id = ?
  `).get(gameId) as (Game & { home_name: string; home_abbr: string; away_name: string; away_abbr: string }) | undefined;

  if (!game) throw new Error('Game not found');

  const plays = db.prepare(
    'SELECT * FROM plays WHERE game_id = ? ORDER BY play_index ASC'
  ).all(gameId) as Play[];

  const awayLineup = db.prepare(
    'SELECT * FROM lineups WHERE game_id = ? AND team_id = ? ORDER BY batting_order'
  ).all(gameId, game.away_team_id) as LineupEntry[];

  const homeLineup = db.prepare(
    'SELECT * FROM lineups WHERE game_id = ? AND team_id = ? ORDER BY batting_order'
  ).all(gameId, game.home_team_id) as LineupEntry[];

  const pitchingAppearances = db.prepare(
    'SELECT * FROM pitching_appearances WHERE game_id = ? ORDER BY entry_play_index'
  ).all(gameId) as PitchingAppearance[];

  // Helper: player name lookup
  const playerCache = new Map<number, string>();
  function getPlayerName(id: number): string {
    if (!playerCache.has(id)) {
      const p = db.prepare('SELECT name FROM players WHERE id = ?').get(id) as { name: string } | undefined;
      playerCache.set(id, p?.name ?? `Player #${id}`);
    }
    return playerCache.get(id)!;
  }

  // --- Batting stats ---
  // Build per-batter accumulators from both lineups
  const buildBatterMap = (lineup: LineupEntry[]) => {
    const map = new Map<number, BatterLine>();
    for (const entry of lineup) {
      if (!map.has(entry.player_id)) {
        map.set(entry.player_id, {
          player_id: entry.player_id,
          player_name: getPlayerName(entry.player_id),
          position: entry.position,
          batting_order: entry.batting_order,
          pa: 0, ab: 0, r: 0, h: 0,
          doubles: 0, triples: 0, hr: 0,
          rbi: 0, bb: 0, so: 0, hbp: 0,
          sb: 0, cs: 0, sac: 0, sf: 0, lob: 0,
        });
      }
    }
    return map;
  };

  const awayBatters = buildBatterMap(awayLineup);
  const homeBatters = buildBatterMap(homeLineup);

  // Track runners on base per inning half for LOB calculation
  // LOB: runners on base when the inning ends (inning_end marker)
  type InningHalfKey = string; // e.g. "1-top"
  const runnersAtEnd = new Map<InningHalfKey, number>();

  // Score runner tracking: who scores gets R credited
  for (const play of plays) {
    const isAway = play.offense_team_id === game.away_team_id;
    const batterMap = isAway ? awayBatters : homeBatters;

    // Batter stats
    if (play.play_type === 'at_bat' && play.batter_id) {
      const line = batterMap.get(play.batter_id);
      if (line) {
        const code = play.result_code ?? '';
        line.pa += 1;

        if (!NON_AB_CODES.has(code)) line.ab += 1;

        if (isHit(code)) {
          line.h += 1;
          if (code === '2B') line.doubles += 1;
          if (code === '3B') line.triples += 1;
          if (code === 'HR') line.hr += 1;
        }

        line.rbi += play.rbi;

        if (code === 'BB' || code === 'IBB') line.bb += 1;
        if (code === 'K' || code === 'KL') line.so += 1;
        if (code === 'HBP') line.hbp += 1;
        if (code === 'SAC') line.sac += 1;
        if (code === 'SF') line.sf += 1;
      }
    }

    // Stolen base / caught stealing
    if (play.play_type === 'mid_pa_sb' && play.result_code) {
      const parts = play.result_code.split(':');
      const runnerId = parseInt(parts[2]);
      const line = batterMap.get(runnerId);
      if (line) line.sb += 1;
    }
    if (play.play_type === 'mid_pa_cs' && play.result_code) {
      const parts = play.result_code.split(':');
      const runnerId = parseInt(parts[2]);
      const line = batterMap.get(runnerId);
      if (line) line.cs += 1;
    }

    // Runs scored
    const scoredIds = JSON.parse(play.scored_runner_ids) as number[];
    for (const rid of scoredIds) {
      const line = batterMap.get(rid);
      if (line) line.r += 1;
    }

    // LOB tracking: count runners remaining when inning ends
    if (play.play_type === 'inning_end') {
      const key = `${play.inning}-${play.half}`;
      const runnersAfter = JSON.parse(play.runners_after) as Record<string, number | null>;
      const count = Object.values(runnersAfter).filter(v => v !== null).length;
      runnersAtEnd.set(key, count);
    }
  }

  // Distribute LOB to batters (simplified: credit to team totals only; per-batter LOB is complex)
  // We'll show per-team LOB totals instead

  // --- Pitching stats ---
  const buildPitcherLine = (app: PitchingAppearance): PitcherLine => ({
    player_id: app.pitcher_id,
    player_name: getPlayerName(app.pitcher_id),
    ip_outs: 0, bf: 0, h: 0, r: 0, er: 0,
    bb: 0, so: 0, hr: 0, wp: 0, hbp: 0,
  });

  const pitcherLines = new Map<number, PitcherLine>(); // keyed by appearance id
  for (const app of pitchingAppearances) {
    pitcherLines.set(app.id, buildPitcherLine(app));
  }

  const inheritedRunners = new Map<number, Set<number>>(); // appearance_id -> set of runner ids
  for (const app of pitchingAppearances) {
    const runners = JSON.parse(app.inherited_runners) as number[];
    inheritedRunners.set(app.id, new Set(runners));
  }

  // Find which appearance was active for a given play_index
  function getAppearanceForPlay(playIndex: number, pitcherId: number): PitchingAppearance | null {
    for (const app of pitchingAppearances) {
      if (app.pitcher_id !== pitcherId) continue;
      const entryOk = app.entry_play_index <= playIndex;
      const exitOk = app.exit_play_index === null || app.exit_play_index > playIndex;
      if (entryOk && exitOk) return app;
    }
    return null;
  }

  for (const play of plays) {
    const app = getAppearanceForPlay(play.play_index, play.pitcher_id);
    if (!app) continue;
    const line = pitcherLines.get(app.id);
    if (!line) continue;

    const code = play.result_code ?? '';

    if (play.play_type === 'at_bat') {
      line.bf += 1;
      line.ip_outs += play.outs_on_play;

      if (isHit(code)) line.h += 1;
      if (code === 'BB' || code === 'IBB') line.bb += 1;
      if (code === 'K' || code === 'KL') line.so += 1;
      if (code === 'HR') line.hr += 1;
      if (code === 'HBP') line.hbp += 1;

      // Runs: scored_runner_ids
      const scoredIds = JSON.parse(play.scored_runner_ids) as number[];
      const inherited = inheritedRunners.get(app.id) ?? new Set();
      for (const rid of scoredIds) {
        if (!inherited.has(rid)) {
          line.r += 1;
          if (play.earned) line.er += 1;
        }
      }
    }

    if (play.play_type === 'mid_pa_wp') {
      line.wp += 1;
      // Runs from wild pitches
      const scoredIds = JSON.parse(play.scored_runner_ids) as number[];
      const inherited = inheritedRunners.get(app.id) ?? new Set();
      for (const rid of scoredIds) {
        if (!inherited.has(rid)) {
          line.r += 1;
          if (play.earned) line.er += 1;
        }
      }
    }
  }

  // Merge pitcher lines by pitcher_id (if same pitcher appears multiple times, combine)
  const awayPitcherMap = new Map<number, PitcherLine>();
  const homePitcherMap = new Map<number, PitcherLine>();

  for (const app of pitchingAppearances) {
    const isAway = app.team_id === game.away_team_id;
    const map = isAway ? awayPitcherMap : homePitcherMap;
    const line = pitcherLines.get(app.id)!;

    if (map.has(app.pitcher_id)) {
      const existing = map.get(app.pitcher_id)!;
      existing.ip_outs += line.ip_outs;
      existing.bf += line.bf;
      existing.h += line.h;
      existing.r += line.r;
      existing.er += line.er;
      existing.bb += line.bb;
      existing.so += line.so;
      existing.hr += line.hr;
      existing.wp += line.wp;
      existing.hbp += line.hbp;
    } else {
      map.set(app.pitcher_id, { ...line });
    }
  }

  // --- Line score ---
  const maxInning = plays.reduce((max, p) => Math.max(max, p.inning), game.innings);
  const awayRuns: (number | null)[] = Array(maxInning).fill(null);
  const homeRuns: (number | null)[] = Array(maxInning).fill(null);

  for (const play of plays) {
    if (play.runs_on_play === 0) continue;
    const idx = play.inning - 1;
    if (play.half === 'top') {
      awayRuns[idx] = (awayRuns[idx] ?? 0) + play.runs_on_play;
    } else {
      homeRuns[idx] = (homeRuns[idx] ?? 0) + play.runs_on_play;
    }
  }

  // Fill innings that were played but scored 0
  for (const play of plays) {
    const idx = play.inning - 1;
    if (play.half === 'top' && awayRuns[idx] === null) awayRuns[idx] = 0;
    if (play.half === 'bottom' && homeRuns[idx] === null) homeRuns[idx] = 0;
  }

  const awayTotalR = awayRuns.reduce<number>((s, v) => s + (v ?? 0), 0);
  const homeTotalR = homeRuns.reduce<number>((s, v) => s + (v ?? 0), 0);

  // Total hits and errors
  const awayHits = [...awayBatters.values()].reduce((s, b) => s + b.h, 0);
  const homeHits = [...homeBatters.values()].reduce((s, b) => s + b.h, 0);

  const awayErrors = plays.filter(p => {
    const code = p.result_code ?? '';
    return p.offense_team_id !== game.away_team_id && code.startsWith('E');
  }).length;
  const homeErrors = plays.filter(p => {
    const code = p.result_code ?? '';
    return p.offense_team_id !== game.home_team_id && code.startsWith('E');
  }).length;

  const awayLineScoreData: LineScoreTeam = {
    runs: awayRuns,
    total_r: awayTotalR,
    total_h: awayHits,
    total_e: awayErrors,
  };

  const homeLineScoreData: LineScoreTeam = {
    runs: homeRuns,
    total_r: homeTotalR,
    total_h: homeHits,
    total_e: homeErrors,
  };

  // Sort batters by batting order
  const sortedAwayBatters = [...awayBatters.values()].sort((a, b) => a.batting_order - b.batting_order);
  const sortedHomeBatters = [...homeBatters.values()].sort((a, b) => a.batting_order - b.batting_order);

  const awayPitchers = [...awayPitcherMap.values()];
  const homePitchers = [...homePitcherMap.values()];

  // Add computed AVG / ERA
  const withAvg = (b: BatterLine): BatterLine => ({
    ...b,
    avg: b.ab > 0 ? (b.h / b.ab).toFixed(3).replace(/^0/, '') : '.000',
  });

  const withERA = (p: PitcherLine): PitcherLine => {
    const ip = p.ip_outs / 3;
    return {
      ...p,
      era: ip > 0 ? ((p.er * 9) / ip).toFixed(2) : '---',
    };
  };

  return {
    game: {
      ...game,
      home_team: { id: game.home_team_id, name: game.home_name, abbreviation: game.home_abbr, created_at: '' },
      away_team: { id: game.away_team_id, name: game.away_name, abbreviation: game.away_abbr, created_at: '' },
    },
    line_score: {
      innings: maxInning,
      away: awayLineScoreData,
      home: homeLineScoreData,
    },
    batting: {
      away: sortedAwayBatters.map(withAvg),
      home: sortedHomeBatters.map(withAvg),
    },
    pitching: {
      away: awayPitchers.map(withERA),
      home: homePitchers.map(withERA),
    },
  };
}

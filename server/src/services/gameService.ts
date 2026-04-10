import db from '../db/connection';
import { Play, GameState, LineupEntry, RunnerState } from '../types';

/**
 * Compute the live game state by replaying the play log.
 */
export function computeGameState(gameId: number): GameState {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as {
    id: number; home_team_id: number; away_team_id: number;
    status: string; innings: number;
  } | undefined;

  if (!game) throw new Error('Game not found');

  const plays = db.prepare(
    'SELECT * FROM plays WHERE game_id = ? ORDER BY play_index ASC'
  ).all(gameId) as Play[];

  // Load starters with player names joined.
  // batting_order=0 means "pitcher not in batting lineup" (DH rule) — sort them last.
  const lineupSql = `
    SELECT l.*, p.name as player_name, p.jersey_number,
           p.defensive_rating, p.stealing, p.running
    FROM lineups l JOIN players p ON p.id = l.player_id
    WHERE l.game_id = ? AND l.team_id = ?
    ORDER BY CASE WHEN l.batting_order = 0 THEN 9999 ELSE l.batting_order END
  `;
  const awayLineup = db.prepare(lineupSql).all(gameId, game.away_team_id) as LineupEntry[];
  const homeLineup = db.prepare(lineupSql).all(gameId, game.home_team_id) as LineupEntry[];

  // Number of batters (batting_order > 0) — used to cycle the batting position without
  // wrapping into any non-batting pitcher entry at the end of the array.
  const numAwayBatters = awayLineup.filter(e => e.batting_order > 0).length || awayLineup.length;
  const numHomeBatters = homeLineup.filter(e => e.batting_order > 0).length || homeLineup.length;

  // Apply substitutions to build live lineups
  const liveAwayLineup = [...awayLineup];
  const liveHomeLineup = [...homeLineup];

  let inning = 1;
  let half: 'top' | 'bottom' = 'top';
  let outs = 0;
  let runners: RunnerState = {};
  let homeScore = 0;
  let awayScore = 0;
  let nextBattingOrderAway = 1;
  let nextBattingOrderHome = 1;
  let awayBattingPos = 0; // index into liveAwayLineup (0-based)
  let homeBattingPos = 0;

  for (const play of plays) {
    const scored = JSON.parse(play.scored_runner_ids) as number[];
    if (play.half === 'top') {
      awayScore += play.runs_on_play;
    } else {
      homeScore += play.runs_on_play;
    }

    // Update runner state from play
    runners = JSON.parse(play.runners_after);

    // Track inning/outs progression
    if (play.outs_on_play > 0 && play.play_type !== 'inning_end') {
      outs = Math.min(3, play.outs_before + play.outs_on_play);
    }

    if (play.play_type === 'at_bat') {
      // Advance batting order pointer — cycle only within the batting entries (batting_order > 0).
      if (play.half === 'top') {
        awayBattingPos = (awayBattingPos + 1) % numAwayBatters;
        nextBattingOrderAway = liveAwayLineup[awayBattingPos]?.batting_order ?? 1;
      } else {
        homeBattingPos = (homeBattingPos + 1) % numHomeBatters;
        nextBattingOrderHome = liveHomeLineup[homeBattingPos]?.batting_order ?? 1;
      }
    }

    if (play.play_type === 'inning_end') {
      outs = 0;
      runners = {};
      if (half === 'top') {
        half = 'bottom';
      } else {
        half = 'top';
        inning += 1;
      }
    }

    if (play.play_type === 'substitution' && play.result_code) {
      applySubstitution(play.result_code, liveAwayLineup, liveHomeLineup,
        game.away_team_id, game.home_team_id, play.offense_team_id);
    }

    if (play.play_type === 'game_end') {
      inning = play.inning;
      half = play.half;
    }
  }

  // Determine current batter and pitcher
  const currentHalfLineup = half === 'top' ? liveAwayLineup : liveHomeLineup;
  const currentBattingPos = half === 'top' ? awayBattingPos : homeBattingPos;
  const currentBatter = currentHalfLineup[currentBattingPos] ?? null;

  // Current pitcher = the opposing team's pitcher in the lineup
  const pitchingLineup = half === 'top' ? liveHomeLineup : liveAwayLineup;
  const currentPitcher = pitchingLineup.find(e => e.position === 'P') ?? pitchingLineup[0] ?? null;

  return {
    game_id: gameId,
    status: game.status,
    inning,
    half,
    outs,
    runners,
    home_score: homeScore,
    away_score: awayScore,
    current_batter_id: currentBatter?.player_id ?? null,
    current_pitcher_id: currentPitcher?.player_id ?? null,
    away_lineup: liveAwayLineup,
    home_lineup: liveHomeLineup,
    next_batting_order: half === 'top' ? nextBattingOrderAway : nextBattingOrderHome,
    play_count: plays.length,
  };
}

function applySubstitution(
  resultCode: string,
  awayLineup: LineupEntry[],
  homeLineup: LineupEntry[],
  awayTeamId: number,
  homeTeamId: number,
  offenseTeamId: number,
) {
  // SUB:bat:{in_id}:{out_id}
  // SUB:pitch:{in_id}:{out_id}
  // SUB:field:{in_id}:{out_id}:{position}
  // SUB:run:{in_id}:{out_id}
  const parts = resultCode.split(':');
  if (parts[0] !== 'SUB') return;

  const subType = parts[1];
  const inId = parseInt(parts[2]);
  const outId = parseInt(parts[3]);

  // bat and run affect the offense lineup; pitch and field affect the defense lineup
  const isOffenseSub = subType === 'bat' || subType === 'run';
  const offenseLineup = offenseTeamId === awayTeamId ? awayLineup : homeLineup;
  const defenseLineup = offenseTeamId === awayTeamId ? homeLineup : awayLineup;
  const lineup = isOffenseSub ? offenseLineup : defenseLineup;

  const inPlayer = db.prepare('SELECT name, jersey_number, defensive_rating, stealing, running FROM players WHERE id = ?')
    .get(inId) as { name: string; jersey_number: string; defensive_rating: string; stealing: string; running: string } | undefined;

  const inPlayerFields = {
    player_id: inId,
    player_name: inPlayer?.name,
    jersey_number: inPlayer?.jersey_number,
    defensive_rating: inPlayer?.defensive_rating,
    stealing: inPlayer?.stealing,
    running: inPlayer?.running,
  };

  if (subType === 'bat' || subType === 'run') {
    const idx = lineup.findIndex(e => e.player_id === outId);
    if (idx === -1) return;
    lineup[idx] = { ...lineup[idx], ...inPlayerFields };
  } else if (subType === 'pitch') {
    const pitcherIdx = lineup.findIndex(e => e.position === 'P');
    if (pitcherIdx !== -1) lineup[pitcherIdx] = { ...lineup[pitcherIdx], ...inPlayerFields };
  } else if (subType === 'field') {
    const outIdx = lineup.findIndex(e => e.player_id === outId);
    if (outIdx === -1) return;
    const position = parts[4] ?? lineup[outIdx].position;
    const inIdx = lineup.findIndex(e => e.player_id === inId);
    if (inIdx !== -1 && inIdx !== outIdx) {
      // In-player is already in the lineup — swap positions
      const prevPos = lineup[inIdx].position;
      lineup[inIdx] = { ...lineup[inIdx], position };
      lineup[outIdx] = { ...lineup[outIdx], position: prevPos };
    } else if (inIdx === -1) {
      // Bench player coming in — replace the out-player's slot
      lineup[outIdx] = { ...lineup[outIdx], ...inPlayerFields, position };
    }
  }
}

export function getNextPlayIndex(gameId: number): number {
  const row = db.prepare('SELECT MAX(play_index) as max_idx FROM plays WHERE game_id = ?').get(gameId) as { max_idx: number | null };
  return (row.max_idx ?? -1) + 1;
}

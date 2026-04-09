import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { Play, PitchingAppearance, LineupEntry } from '../types';
import { computeGameState, getNextPlayIndex } from '../services/gameService';

const router = Router({ mergeParams: true });

router.get('/', (req: Request, res: Response) => {
  const plays = db.prepare(
    'SELECT * FROM plays WHERE game_id = ? ORDER BY play_index ASC'
  ).all(req.params.id) as Play[];
  res.json(plays.map(p => ({
    ...p,
    runners_before: JSON.parse(p.runners_before),
    runners_after: JSON.parse(p.runners_after),
    scored_runner_ids: JSON.parse(p.scored_runner_ids),
  })));
});

router.post('/', (req: Request, res: Response) => {
  const gameId = parseInt(req.params.id as string);
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as { id: number; home_team_id: number; away_team_id: number; status: string } | undefined;
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
  if (game.status === 'final') { res.status(400).json({ error: 'Game is already final' }); return; }

  const {
    play_type,
    batter_id,
    pitcher_id,
    result_code,
    runners_before = {},
    runners_after = {},
    outs_before,
    outs_on_play = 0,
    runs_on_play = 0,
    scored_runner_ids = [],
    inning,
    half,
    rbi = 0,
    earned = 1,
    display_text,
    offense_team_id,
  } = req.body;

  if (!play_type || !pitcher_id || inning === undefined || !half || offense_team_id === undefined) {
    res.status(400).json({ error: 'play_type, pitcher_id, inning, half, and offense_team_id are required' });
    return;
  }

  const playIndex = getNextPlayIndex(gameId);

  const insertPlay = db.prepare(`
    INSERT INTO plays (
      game_id, play_index, inning, half, outs_before,
      batter_id, pitcher_id, offense_team_id,
      play_type, result_code,
      runners_before, runners_after,
      outs_on_play, runs_on_play, scored_runner_ids,
      rbi, earned, display_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertPlay.run(
      gameId, playIndex, inning, half, outs_before ?? 0,
      batter_id ?? null, pitcher_id, offense_team_id,
      play_type, result_code ?? null,
      JSON.stringify(runners_before), JSON.stringify(runners_after),
      outs_on_play, runs_on_play, JSON.stringify(scored_runner_ids),
      rbi, earned, display_text ?? null,
    );

    // Handle substitution: create new pitching appearance if pitcher change
    if (play_type === 'substitution' && result_code?.startsWith('SUB:pitch:')) {
      const parts = result_code.split(':');
      const inPitcherId = parseInt(parts[2]);
      const defenseTeamId = offense_team_id === game.home_team_id ? game.away_team_id : game.home_team_id;

      // Close current appearance
      db.prepare(`
        UPDATE pitching_appearances SET exit_play_index = ?
        WHERE game_id = ? AND team_id = ? AND exit_play_index IS NULL
      `).run(playIndex, gameId, defenseTeamId);

      // Compute inherited runners (runners currently on base)
      const runnersOnBase = Object.values(runners_after as Record<string, number | null>)
        .filter(v => v !== null) as number[];

      // Create new appearance
      db.prepare(`
        INSERT INTO pitching_appearances (game_id, pitcher_id, team_id, entry_play_index, inherited_runners)
        VALUES (?, ?, ?, ?, ?)
      `).run(gameId, inPitcherId, defenseTeamId, playIndex + 1, JSON.stringify(runnersOnBase));

      // Update the lineup
      db.prepare(`
        UPDATE lineups SET player_id = ?
        WHERE game_id = ? AND team_id = ? AND position = 'P'
      `).run(inPitcherId, gameId, defenseTeamId);
    }
  })();

  const state = computeGameState(gameId);
  res.status(201).json({ play_index: playIndex, state });
});

router.delete('/last', (req: Request, res: Response) => {
  const gameId = parseInt(req.params.id as string);

  const lastPlay = db.prepare(
    'SELECT * FROM plays WHERE game_id = ? ORDER BY play_index DESC LIMIT 1'
  ).get(gameId) as Play | undefined;

  if (!lastPlay) { res.status(404).json({ error: 'No plays to undo' }); return; }

  db.transaction(() => {
    // If undoing a pitching change, re-open previous appearance
    if (lastPlay.play_type === 'substitution' && lastPlay.result_code?.startsWith('SUB:pitch:')) {
      const parts = lastPlay.result_code.split(':');
      const inPitcherId = parseInt(parts[2]);
      const outPitcherId = parseInt(parts[3]);
      const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as { home_team_id: number; away_team_id: number };
      const defenseTeamId = lastPlay.offense_team_id === game.home_team_id ? game.away_team_id : game.home_team_id;

      // Delete the new pitcher's appearance
      db.prepare(
        'DELETE FROM pitching_appearances WHERE game_id = ? AND pitcher_id = ? AND entry_play_index = ?'
      ).run(gameId, inPitcherId, lastPlay.play_index + 1);

      // Re-open the previous pitcher's appearance
      db.prepare(
        'UPDATE pitching_appearances SET exit_play_index = NULL WHERE game_id = ? AND pitcher_id = ? AND team_id = ?'
      ).run(gameId, outPitcherId, defenseTeamId);

      // Revert lineup
      db.prepare(
        "UPDATE lineups SET player_id = ? WHERE game_id = ? AND team_id = ? AND position = 'P'"
      ).run(outPitcherId, gameId, defenseTeamId);
    }

    db.prepare('DELETE FROM plays WHERE id = ?').run(lastPlay.id);
  })();

  const state = computeGameState(gameId);
  res.json({ undone: lastPlay.play_index, state });
});

export default router;

import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { Game, LineupEntry, Player } from '../types';
import { computeGameState, getNextPlayIndex } from '../services/gameService';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const games = db.prepare(`
    SELECT g.*,
      ht.name as home_team_name, ht.abbreviation as home_abbr,
      at.name as away_team_name, at.abbreviation as away_abbr
    FROM games g
    JOIN teams ht ON ht.id = g.home_team_id
    JOIN teams at ON at.id = g.away_team_id
    ORDER BY g.game_date DESC, g.id DESC
  `).all();
  res.json(games);
});

router.post('/', (req: Request, res: Response) => {
  const { home_team_id, away_team_id, game_date, innings = 9 } = req.body;
  if (!home_team_id || !away_team_id || !game_date) {
    res.status(400).json({ error: 'home_team_id, away_team_id, and game_date are required' });
    return;
  }
  const result = db.prepare(
    `INSERT INTO games (home_team_id, away_team_id, game_date, innings) VALUES (?, ?, ?, ?)`
  ).run(home_team_id, away_team_id, game_date, innings);
  res.status(201).json(db.prepare('SELECT * FROM games WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id', (req: Request, res: Response) => {
  const game = db.prepare(`
    SELECT g.*,
      ht.name as home_team_name, ht.abbreviation as home_abbr,
      at.name as away_team_name, at.abbreviation as away_abbr
    FROM games g
    JOIN teams ht ON ht.id = g.home_team_id
    JOIN teams at ON at.id = g.away_team_id
    WHERE g.id = ?
  `).get(req.params.id);
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
  res.json(game);
});

router.patch('/:id/start', (req: Request, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as Game | undefined;
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
  db.prepare("UPDATE games SET status = 'in_progress' WHERE id = ?").run(req.params.id);

  // Create initial pitching appearances for starting pitchers
  const awayLineup = db.prepare(
    "SELECT * FROM lineups WHERE game_id = ? AND team_id = ? AND position = 'P'"
  ).all(req.params.id, game.away_team_id) as LineupEntry[];
  const homeLineup = db.prepare(
    "SELECT * FROM lineups WHERE game_id = ? AND team_id = ? AND position = 'P'"
  ).all(req.params.id, game.home_team_id) as LineupEntry[];

  for (const entry of [...awayLineup, ...homeLineup]) {
    db.prepare(
      `INSERT INTO pitching_appearances (game_id, pitcher_id, team_id, entry_play_index)
       VALUES (?, ?, ?, 0)`
    ).run(game.id, entry.player_id, entry.team_id);
  }

  res.json(db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id));
});

router.patch('/:id/end', (req: Request, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as Game | undefined;
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
  db.prepare("UPDATE games SET status = 'final' WHERE id = ?").run(req.params.id);
  res.json(db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id);
  if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
  db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Lineups
router.get('/:id/lineups/:teamId', (req: Request, res: Response) => {
  const entries = db.prepare(
    'SELECT l.*, p.name as player_name, p.jersey_number, p.positions, p.bats, p.throws FROM lineups l JOIN players p ON p.id = l.player_id WHERE l.game_id = ? AND l.team_id = ? ORDER BY l.batting_order'
  ).all(req.params.id, req.params.teamId);
  res.json(entries);
});

router.put('/:id/lineups/:teamId', (req: Request, res: Response) => {
  const { entries } = req.body as { entries: Array<{ batting_order: number; player_id: number; position: string }> };
  if (!Array.isArray(entries)) { res.status(400).json({ error: 'entries array required' }); return; }

  const deleteExisting = db.prepare('DELETE FROM lineups WHERE game_id = ? AND team_id = ?');
  const insertEntry = db.prepare(
    'INSERT INTO lineups (game_id, team_id, batting_order, player_id, position) VALUES (?, ?, ?, ?, ?)'
  );

  db.transaction(() => {
    deleteExisting.run(req.params.id, req.params.teamId);
    for (const e of entries) {
      insertEntry.run(req.params.id, req.params.teamId, e.batting_order, e.player_id, e.position);
    }
  })();

  res.json({ ok: true });
});

// Game state
router.get('/:id/state', (req: Request, res: Response) => {
  try {
    const state = computeGameState(parseInt(req.params.id as string));
    res.json(state);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(404).json({ error: msg });
  }
});

export default router;

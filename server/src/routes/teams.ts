import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { Team, Player } from '../types';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const teams = db.prepare('SELECT * FROM teams ORDER BY name').all() as Team[];
  res.json(teams);
});

router.post('/', (req: Request, res: Response) => {
  const { name, abbreviation } = req.body;
  if (!name || !abbreviation) {
    res.status(400).json({ error: 'name and abbreviation are required' });
    return;
  }
  const result = db.prepare('INSERT INTO teams (name, abbreviation) VALUES (?, ?)').run(name, abbreviation.toUpperCase());
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid) as Team;
  res.status(201).json(team);
});

router.get('/:id', (req: Request, res: Response) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id) as Team | undefined;
  if (!team) { res.status(404).json({ error: 'Team not found' }); return; }

  const players = db.prepare(
    `SELECT * FROM players WHERE team_id = ? AND active = 1
     ORDER BY CASE WHEN default_batting_order > 0 THEN default_batting_order ELSE 9999 END, name`
  ).all(req.params.id) as Player[];

  const playersWithPositions = players.map(p => ({
    ...p,
    positions: JSON.parse(p.positions as unknown as string),
  }));

  res.json({ ...team, players: playersWithPositions });
});

router.put('/:id', (req: Request, res: Response) => {
  const { name, abbreviation } = req.body;
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id) as Team | undefined;
  if (!team) { res.status(404).json({ error: 'Team not found' }); return; }

  db.prepare('UPDATE teams SET name = ?, abbreviation = ? WHERE id = ?').run(
    name ?? team.name,
    abbreviation ? abbreviation.toUpperCase() : team.abbreviation,
    req.params.id,
  );
  res.json(db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Players sub-routes
router.get('/:teamId/players', (req: Request, res: Response) => {
  const players = db.prepare(
    'SELECT * FROM players WHERE team_id = ? ORDER BY name'
  ).all(req.params.teamId) as Player[];

  res.json(players.map(p => ({ ...p, positions: JSON.parse(p.positions as unknown as string) })));
});

router.post('/:teamId/players', (req: Request, res: Response) => {
  const { name, jersey_number, positions, bats, throws: throwsHand, defensive_rating, stealing, running } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }

  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(req.params.teamId);
  if (!team) { res.status(404).json({ error: 'Team not found' }); return; }

  const result = db.prepare(
    `INSERT INTO players (team_id, name, jersey_number, positions, bats, throws, defensive_rating, stealing, running)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.params.teamId,
    name,
    jersey_number ?? '',
    JSON.stringify(positions ?? []),
    bats ?? 'R',
    throwsHand ?? 'R',
    defensive_rating ?? '',
    stealing ?? '',
    running ?? '',
  );

  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid) as Player;
  res.status(201).json({ ...player, positions: JSON.parse(player.positions as unknown as string) });
});

// PUT /api/teams/:teamId/lineup  — save default batting order + positions
// Body: { entries: [{ player_id, batting_order, position }] }
router.put('/:teamId/lineup', (req: Request, res: Response) => {
  const { entries } = req.body as {
    entries: Array<{ player_id: number; batting_order: number; position: string }>;
  };
  if (!Array.isArray(entries)) { res.status(400).json({ error: 'entries array required' }); return; }

  const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(req.params.teamId);
  if (!team) { res.status(404).json({ error: 'Team not found' }); return; }

  const updatePlayer = db.prepare(
    'UPDATE players SET default_batting_order = ?, default_position = ? WHERE id = ? AND team_id = ?'
  );

  // First reset all players on the team
  db.prepare('UPDATE players SET default_batting_order = 0, default_position = \'\' WHERE team_id = ?')
    .run(req.params.teamId);

  db.transaction(() => {
    for (const e of entries) {
      updatePlayer.run(e.batting_order, e.position, e.player_id, req.params.teamId);
    }
  })();

  res.json({ ok: true });
});

export default router;

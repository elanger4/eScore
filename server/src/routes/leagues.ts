import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { League, Team } from '../types';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const leagues = db.prepare('SELECT * FROM leagues ORDER BY name').all() as League[];
  res.json(leagues);
});

router.post('/', (req: Request, res: Response) => {
  const { name, season = '', description = '' } = req.body;
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  const result = db.prepare(
    'INSERT INTO leagues (name, season, description) VALUES (?, ?, ?)'
  ).run(name, season, description);
  res.status(201).json(db.prepare('SELECT * FROM leagues WHERE id = ?').get(result.lastInsertRowid));
});

router.get('/:id', (req: Request, res: Response) => {
  const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id) as League | undefined;
  if (!league) { res.status(404).json({ error: 'League not found' }); return; }

  const teams = db.prepare(`
    SELECT t.* FROM teams t
    JOIN league_teams lt ON lt.team_id = t.id
    WHERE lt.league_id = ?
    ORDER BY t.name
  `).all(req.params.id) as Team[];

  res.json({ ...league, teams });
});

router.put('/:id', (req: Request, res: Response) => {
  const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id) as League | undefined;
  if (!league) { res.status(404).json({ error: 'League not found' }); return; }

  const { name, season, description } = req.body;
  db.prepare('UPDATE leagues SET name = ?, season = ?, description = ? WHERE id = ?').run(
    name ?? league.name,
    season ?? league.season,
    description ?? league.description,
    req.params.id,
  );
  res.json(db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req: Request, res: Response) => {
  const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id);
  if (!league) { res.status(404).json({ error: 'League not found' }); return; }
  db.prepare('DELETE FROM leagues WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Team membership
router.put('/:id/teams', (req: Request, res: Response) => {
  const league = db.prepare('SELECT * FROM leagues WHERE id = ?').get(req.params.id) as League | undefined;
  if (!league) { res.status(404).json({ error: 'League not found' }); return; }

  const { team_ids } = req.body as { team_ids: number[] };
  if (!Array.isArray(team_ids)) { res.status(400).json({ error: 'team_ids array required' }); return; }

  db.transaction(() => {
    db.prepare('DELETE FROM league_teams WHERE league_id = ?').run(req.params.id);
    const insert = db.prepare('INSERT INTO league_teams (league_id, team_id) VALUES (?, ?)');
    for (const teamId of team_ids) {
      insert.run(req.params.id, teamId);
    }
  })();

  res.json({ ok: true });
});

export default router;

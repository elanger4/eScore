import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { Player } from '../types';

const router = Router();

router.put('/:id', (req: Request, res: Response) => {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id) as Player | undefined;
  if (!player) { res.status(404).json({ error: 'Player not found' }); return; }

  const { name, jersey_number, positions, bats, throws: throwsHand } = req.body;

  db.prepare(
    `UPDATE players SET name = ?, jersey_number = ?, positions = ?, bats = ?, throws = ? WHERE id = ?`
  ).run(
    name ?? player.name,
    jersey_number ?? player.jersey_number,
    JSON.stringify(positions ?? JSON.parse(player.positions as unknown as string)),
    bats ?? player.bats,
    throwsHand ?? player.throws,
    req.params.id,
  );

  const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id) as Player;
  res.json({ ...updated, positions: JSON.parse(updated.positions as unknown as string) });
});

router.delete('/:id', (req: Request, res: Response) => {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(req.params.id);
  if (!player) { res.status(404).json({ error: 'Player not found' }); return; }
  // Soft delete
  db.prepare('UPDATE players SET active = 0 WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;

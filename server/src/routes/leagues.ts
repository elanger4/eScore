import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { League, Team } from '../types';
import { computeBoxScore } from '../services/statService';

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

// ── League stats: standings + batting/pitching leaders ────────────────────────
router.get('/:id/stats', (req: Request, res: Response) => {
  const leagueId = parseInt(req.params.id as string);

  const teams = db.prepare(`
    SELECT t.* FROM teams t
    JOIN league_teams lt ON lt.team_id = t.id
    WHERE lt.league_id = ?
    ORDER BY t.name
  `).all(leagueId) as Team[];

  const empty = {
    standings: [],
    games_played: 0,
    batting_leaders: { hr: [], rbi: [], avg: [], ops: [], h: [], sb: [] },
    pitching_leaders: { era: [], so: [], ip: [] },
  };
  if (teams.length === 0) { res.json(empty); return; }

  // All final games where both teams are in this league
  const leagueGames = db.prepare(`
    SELECT g.id, g.home_team_id, g.away_team_id, g.game_date
    FROM games g
    JOIN league_teams lh ON lh.team_id = g.home_team_id AND lh.league_id = ?
    JOIN league_teams la ON la.team_id = g.away_team_id AND la.league_id = ?
    WHERE g.status = 'final'
    ORDER BY g.game_date DESC, g.id DESC
  `).all(leagueId, leagueId) as { id: number; home_team_id: number; away_team_id: number; game_date: string }[];

  if (leagueGames.length === 0) { res.json({ ...empty, standings: teams.map(t => ({ team_id: t.id, team_name: t.name, team_abbr: t.abbreviation, wins: 0, losses: 0, pct: '.000', gb: '—', rs: 0, ra: 0 })) }); return; }

  const teamMap = new Map(teams.map(t => [t.id, t]));

  type BatterAgg = { player_id: number; player_name: string; team_abbr: string; pa: number; ab: number; h: number; doubles: number; triples: number; hr: number; rbi: number; bb: number; hbp: number; sb: number; sf: number; };
  type PitcherAgg = { player_id: number; player_name: string; team_abbr: string; ip_outs: number; so: number; er: number; };

  const batterMap = new Map<number, BatterAgg>();
  const pitcherMap = new Map<number, PitcherAgg>();
  const standMap = new Map<number, { wins: number; losses: number; rs: number; ra: number }>(
    teams.map(t => [t.id, { wins: 0, losses: 0, rs: 0, ra: 0 }])
  );

  for (const game of leagueGames) {
    const box = computeBoxScore(game.id);
    const homeR = box.line_score.home.total_r;
    const awayR = box.line_score.away.total_r;

    const hs = standMap.get(game.home_team_id);
    const as_ = standMap.get(game.away_team_id);
    if (hs && as_) {
      if (homeR > awayR) { hs.wins++; as_.losses++; }
      else               { as_.wins++; hs.losses++; }
      hs.rs += homeR;  hs.ra += awayR;
      as_.rs += awayR; as_.ra += homeR;
    }

    const addBatters = (batters: typeof box.batting.away, teamId: number) => {
      const abbr = teamMap.get(teamId)?.abbreviation ?? '?';
      for (const b of batters) {
        if (!batterMap.has(b.player_id)) batterMap.set(b.player_id, { player_id: b.player_id, player_name: b.player_name, team_abbr: abbr, pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, sb: 0, sf: 0 });
        const agg = batterMap.get(b.player_id)!;
        agg.pa += b.pa; agg.ab += b.ab; agg.h += b.h;
        agg.doubles += b.doubles; agg.triples += b.triples; agg.hr += b.hr;
        agg.rbi += b.rbi; agg.bb += b.bb; agg.hbp += b.hbp;
        agg.sb += b.sb; agg.sf += b.sf;
      }
    };
    addBatters(box.batting.away, game.away_team_id);
    addBatters(box.batting.home, game.home_team_id);

    const addPitchers = (pitchers: typeof box.pitching.away, teamId: number) => {
      const abbr = teamMap.get(teamId)?.abbreviation ?? '?';
      for (const p of pitchers) {
        if (!pitcherMap.has(p.player_id)) pitcherMap.set(p.player_id, { player_id: p.player_id, player_name: p.player_name, team_abbr: abbr, ip_outs: 0, so: 0, er: 0 });
        const agg = pitcherMap.get(p.player_id)!;
        agg.ip_outs += p.ip_outs; agg.so += p.so; agg.er += p.er;
      }
    };
    addPitchers(box.pitching.away, game.away_team_id);
    addPitchers(box.pitching.home, game.home_team_id);
  }

  // Standings
  const sorted = [...teams]
    .map(t => { const s = standMap.get(t.id)!; return { ...s, team_id: t.id, team_name: t.name, team_abbr: t.abbreviation }; })
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || a.team_name.localeCompare(b.team_name));

  const first = sorted[0];
  const standings = sorted.map(s => {
    const gp = s.wins + s.losses;
    const pct = gp > 0 ? s.wins / gp : 0;
    const gb = ((first.wins - s.wins) + (s.losses - first.losses)) / 2;
    return { team_id: s.team_id, team_name: s.team_name, team_abbr: s.team_abbr, wins: s.wins, losses: s.losses, pct: pct.toFixed(3).replace(/^0/, '') || '.000', gb: gb <= 0 ? '—' : (gb % 1 === 0 ? String(gb) : gb.toFixed(1)), rs: s.rs, ra: s.ra };
  });

  // Batting leaders helpers
  function topBat(arr: BatterAgg[], getValue: (b: BatterAgg) => number, n = 5) {
    return [...arr].sort((a, b) => getValue(b) - getValue(a)).slice(0, n)
      .map(b => ({ player_id: b.player_id, player_name: b.player_name, team_abbr: b.team_abbr, value: String(getValue(b)) }));
  }
  function fmtAvg(h: number, ab: number) { return ab > 0 ? (h / ab).toFixed(3).replace(/^0/, '') : '.000'; }
  function ops(b: BatterAgg) {
    const obpD = b.ab + b.bb + b.hbp + b.sf;
    const obp = obpD > 0 ? (b.h + b.bb + b.hbp) / obpD : 0;
    const slg = b.ab > 0 ? ((b.h - b.doubles - b.triples - b.hr) + 2 * b.doubles + 3 * b.triples + 4 * b.hr) / b.ab : 0;
    return obp + slg;
  }

  const allB = [...batterMap.values()];
  const qualB = allB.filter(b => b.ab >= 1);

  const batting_leaders = {
    hr:  topBat(allB, b => b.hr),
    rbi: topBat(allB, b => b.rbi),
    h:   topBat(allB, b => b.h),
    sb:  topBat(allB, b => b.sb),
    avg: [...qualB].sort((a, b) => (b.ab > 0 ? b.h / b.ab : 0) - (a.ab > 0 ? a.h / a.ab : 0)).slice(0, 5)
      .map(b => ({ player_id: b.player_id, player_name: b.player_name, team_abbr: b.team_abbr, value: fmtAvg(b.h, b.ab) })),
    ops: [...qualB].sort((a, b) => ops(b) - ops(a)).slice(0, 5)
      .map(b => ({ player_id: b.player_id, player_name: b.player_name, team_abbr: b.team_abbr, value: ops(b).toFixed(3).replace(/^0/, '') })),
  };

  // Pitching leaders
  const allP = [...pitcherMap.values()];
  const qualP = allP.filter(p => p.ip_outs >= 3);
  function era(p: PitcherAgg) { return p.ip_outs > 0 ? (p.er * 9) / (p.ip_outs / 3) : Infinity; }
  function fmtIP(outs: number) { return `${Math.floor(outs / 3)}.${outs % 3}`; }

  const pitching_leaders = {
    era: [...qualP].sort((a, b) => era(a) - era(b)).slice(0, 5)
      .map(p => ({ player_id: p.player_id, player_name: p.player_name, team_abbr: p.team_abbr, value: era(p) === Infinity ? '—' : era(p).toFixed(2) })),
    so: [...allP].sort((a, b) => b.so - a.so).slice(0, 5)
      .map(p => ({ player_id: p.player_id, player_name: p.player_name, team_abbr: p.team_abbr, value: String(p.so) })),
    ip: [...allP].sort((a, b) => b.ip_outs - a.ip_outs).slice(0, 5)
      .map(p => ({ player_id: p.player_id, player_name: p.player_name, team_abbr: p.team_abbr, value: fmtIP(p.ip_outs) })),
  };

  res.json({ standings, games_played: leagueGames.length, batting_leaders, pitching_leaders });
});

export default router;

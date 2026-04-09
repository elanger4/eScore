import { Router, Request, Response } from 'express';
import { computeBoxScore } from '../services/statService';
import { BatterLine, PitcherLine } from '../types';

const router = Router({ mergeParams: true });

router.get('/', (req: Request, res: Response) => {
  try {
    const boxScore = computeBoxScore(parseInt(req.params.id as string));
    res.json(boxScore);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(404).json({ error: msg });
  }
});

router.get('/export', (req: Request, res: Response) => {
  try {
    const boxScore = computeBoxScore(parseInt(req.params.id as string));
    const format = req.query.format as string ?? 'json';

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="boxscore-game${req.params.id}.json"`);
      res.json(boxScore);
      return;
    }

    if (format === 'csv') {
      const lines: string[] = [];

      // Line score
      lines.push('LINE SCORE');
      const innings = Array.from({ length: boxScore.line_score.innings }, (_, i) => i + 1);
      lines.push(['Team', ...innings.map(String), 'R', 'H', 'E'].join(','));

      const awayRow = [
        boxScore.game.away_team.abbreviation,
        ...boxScore.line_score.away.runs.map(v => v === null ? 'X' : String(v)),
        boxScore.line_score.away.total_r,
        boxScore.line_score.away.total_h,
        boxScore.line_score.away.total_e,
      ];
      lines.push(awayRow.join(','));

      const homeRow = [
        boxScore.game.home_team.abbreviation,
        ...boxScore.line_score.home.runs.map(v => v === null ? 'X' : String(v)),
        boxScore.line_score.home.total_r,
        boxScore.line_score.home.total_h,
        boxScore.line_score.home.total_e,
      ];
      lines.push(homeRow.join(','));

      lines.push('');
      lines.push('BATTING');
      const batHeaders = ['Team', 'Player', 'Pos', 'PA', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'SO', 'HBP', 'SAC', 'SF', 'SB', 'CS', 'AVG'];
      lines.push(batHeaders.join(','));

      const addBatters = (team: string, batters: BatterLine[]) => {
        for (const b of batters) {
          lines.push([
            team, `"${b.player_name}"`, b.position,
            b.pa, b.ab, b.r, b.h, b.doubles, b.triples, b.hr, b.rbi,
            b.bb, b.so, b.hbp, b.sac, b.sf, b.sb, b.cs, b.avg ?? '',
          ].join(','));
        }
      };

      addBatters(boxScore.game.away_team.abbreviation, boxScore.batting.away);
      addBatters(boxScore.game.home_team.abbreviation, boxScore.batting.home);

      lines.push('');
      lines.push('PITCHING');
      const pitchHeaders = ['Team', 'Player', 'IP', 'BF', 'H', 'R', 'ER', 'BB', 'SO', 'HR', 'WP', 'HBP', 'ERA'];
      lines.push(pitchHeaders.join(','));

      const addPitchers = (team: string, pitchers: PitcherLine[]) => {
        for (const p of pitchers) {
          const ip = `${Math.floor(p.ip_outs / 3)}.${p.ip_outs % 3}`;
          lines.push([
            team, `"${p.player_name}"`, ip,
            p.bf, p.h, p.r, p.er, p.bb, p.so, p.hr, p.wp, p.hbp, p.era ?? '',
          ].join(','));
        }
      };

      addPitchers(boxScore.game.away_team.abbreviation, boxScore.pitching.away);
      addPitchers(boxScore.game.home_team.abbreviation, boxScore.pitching.home);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="boxscore-game${req.params.id}.csv"`);
      res.send(lines.join('\n'));
      return;
    }

    res.status(400).json({ error: 'format must be json or csv' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(404).json({ error: msg });
  }
});

export default router;

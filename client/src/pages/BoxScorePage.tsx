import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { boxScoreApi } from '../api/boxScore';
import { BatterLine, PitcherLine, BoxScore } from '../types';
import { downloadFile } from '../lib/exporters';

function formatIP(ipOuts: number): string {
  return `${Math.floor(ipOuts / 3)}.${ipOuts % 3}`;
}

function Cell({ v, bold }: { v: string | number; bold?: boolean }) {
  const val = typeof v === 'number' && v === 0 ? '–' : v;
  return (
    <td className={`py-2 px-2 text-center font-mono tabular-nums ${bold ? 'font-bold text-white' : 'text-slate-300'}`}>
      {val}
    </td>
  );
}

function LineScore({ boxScore }: { boxScore: BoxScore }) {
  const innings = Array.from({ length: boxScore.line_score.innings }, (_, i) => i + 1);
  const { away, home } = boxScore.line_score;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-sm font-mono border-collapse">
        <thead>
          <tr className="border-b-2 border-navy-600">
            <th className="text-left pr-6 py-2.5 font-sans text-xs font-bold text-slate-400 uppercase tracking-widest">Team</th>
            {innings.map(i => (
              <th key={i} className="w-8 py-2.5 text-xs text-slate-500">{i}</th>
            ))}
            <th className="w-10 py-2.5 border-l border-navy-600 text-slate-300 font-bold">R</th>
            <th className="w-10 py-2.5 text-slate-300 font-bold">H</th>
            <th className="w-10 py-2.5 text-slate-300 font-bold">E</th>
          </tr>
        </thead>
        <tbody>
          {[
            { team: boxScore.game.away_team, data: away },
            { team: boxScore.game.home_team, data: home },
          ].map(({ team, data }) => (
            <tr key={team.id} className="border-b border-navy-700/50">
              <td className="text-left pr-6 py-3 font-black font-mono text-white tracking-widest">
                {team.abbreviation}
                <span className="ml-2 text-slate-500 font-sans font-normal text-xs tracking-normal">{team.name}</span>
              </td>
              {innings.map(i => (
                <td key={i} className="py-3 text-slate-300 tabular-nums">
                  {data.runs[i - 1] === null ? <span className="text-slate-700">–</span> : data.runs[i - 1]}
                </td>
              ))}
              <td className="py-3 border-l border-navy-600 font-black text-white text-base">{data.total_r}</td>
              <td className="py-3 font-bold text-slate-200">{data.total_h}</td>
              <td className="py-3 text-slate-400">{data.total_e}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BattingTable({ batters, teamName, abbr }: { batters: BatterLine[]; teamName: string; abbr: string }) {
  const totals = batters.reduce(
    (acc, b) => ({
      pa: acc.pa + b.pa, ab: acc.ab + b.ab, r: acc.r + b.r, h: acc.h + b.h,
      doubles: acc.doubles + b.doubles, triples: acc.triples + b.triples, hr: acc.hr + b.hr,
      rbi: acc.rbi + b.rbi, bb: acc.bb + b.bb, so: acc.so + b.so,
      hbp: acc.hbp + b.hbp, sac: acc.sac + b.sac, sf: acc.sf + b.sf,
      sb: acc.sb + b.sb, cs: acc.cs + b.cs,
    }),
    { pa: 0, ab: 0, r: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, bb: 0, so: 0, hbp: 0, sac: 0, sf: 0, sb: 0, cs: 0 },
  );
  const teamAvg = totals.ab > 0 ? (totals.h / totals.ab).toFixed(3).replace(/^0/, '') : '.000';

  const cols = ['PA', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'BB', 'SO', 'HBP', 'SAC', 'SF', 'SB', 'CS', 'AVG'];

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="font-black font-mono text-lg text-white tracking-widest">{abbr}</span>
        <span className="text-slate-400 text-sm">{teamName}</span>
        <span className="text-slate-600 text-xs">— Batting</span>
      </div>
      <div className="overflow-x-auto">
        <table className="stat-table">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 w-8">#</th>
              <th className="text-left py-2 pr-4 min-w-[140px]">Player</th>
              <th className="text-left py-2 pr-3">Pos</th>
              {cols.map(c => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {batters.map(b => (
              <tr key={b.player_id}>
                <td className="py-2 pr-3 text-slate-600 text-center font-mono text-xs">{b.batting_order}</td>
                <td className="py-2 pr-4 font-semibold text-slate-200 text-left">{b.player_name}</td>
                <td className="py-2 pr-3 text-left">
                  <span className="position-badge">{b.position}</span>
                </td>
                <Cell v={b.pa} />
                <Cell v={b.ab} />
                <Cell v={b.r} />
                <Cell v={b.h} bold />
                <Cell v={b.doubles} />
                <Cell v={b.triples} />
                <Cell v={b.hr} bold />
                <Cell v={b.rbi} bold />
                <Cell v={b.bb} />
                <Cell v={b.so} />
                <Cell v={b.hbp} />
                <Cell v={b.sac} />
                <Cell v={b.sf} />
                <Cell v={b.sb} />
                <Cell v={b.cs} />
                <td className="py-2 px-2 text-center font-mono tabular-nums text-slate-400 text-xs">{b.avg}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-2 text-right text-xs text-slate-500 font-sans font-normal pr-3">Totals</td>
              <Cell v={totals.pa} bold /><Cell v={totals.ab} bold /><Cell v={totals.r} bold />
              <Cell v={totals.h} bold /><Cell v={totals.doubles} /><Cell v={totals.triples} />
              <Cell v={totals.hr} bold /><Cell v={totals.rbi} bold /><Cell v={totals.bb} />
              <Cell v={totals.so} /><Cell v={totals.hbp} /><Cell v={totals.sac} />
              <Cell v={totals.sf} /><Cell v={totals.sb} /><Cell v={totals.cs} />
              <td className="py-2 px-2 text-center font-mono tabular-nums font-bold text-slate-300 text-xs">{teamAvg}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function PitchingTable({ pitchers, teamName, abbr }: { pitchers: PitcherLine[]; teamName: string; abbr: string }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="font-black font-mono text-lg text-white tracking-widest">{abbr}</span>
        <span className="text-slate-400 text-sm">{teamName}</span>
        <span className="text-slate-600 text-xs">— Pitching</span>
      </div>
      <div className="overflow-x-auto">
        <table className="stat-table">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 min-w-[140px]">Pitcher</th>
              {['IP', 'BF', 'H', 'R', 'ER', 'BB', 'SO', 'HR', 'WP', 'HBP', 'ERA'].map(c => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {pitchers.map(p => (
              <tr key={p.player_id}>
                <td className="py-2 pr-4 font-semibold text-slate-200 text-left">{p.player_name}</td>
                <td className="py-2 px-2 text-center font-mono tabular-nums font-bold text-white">{formatIP(p.ip_outs)}</td>
                <Cell v={p.bf} /><Cell v={p.h} /><Cell v={p.r} bold />
                <Cell v={p.er} bold /><Cell v={p.bb} /><Cell v={p.so} bold />
                <Cell v={p.hr} /><Cell v={p.wp} /><Cell v={p.hbp} />
                <td className="py-2 px-2 text-center font-mono tabular-nums text-slate-400 text-xs">{p.era}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BoxScorePage() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id!);
  const { data: boxScore, isLoading, error } = useQuery({
    queryKey: ['boxScore', gameId],
    queryFn: () => boxScoreApi.get(gameId),
  });

  if (isLoading) return <div className="p-6 text-slate-400 text-sm">Computing box score…</div>;
  if (error || !boxScore) return <div className="p-6 text-red-400">Could not load box score.</div>;

  const { away_team, home_team } = boxScore.game;
  const isLive = boxScore.game.status === 'in_progress';

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/games" className="text-sm text-slate-500 hover:text-white transition-colors">
            ← Games
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <h1 className="text-3xl font-black text-white font-mono tracking-widest">
              {away_team.abbreviation}
              <span className="text-slate-500 mx-3 font-sans text-2xl font-normal">@</span>
              {home_team.abbreviation}
            </h1>
            {isLive && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-950/60 border border-green-800 text-green-300">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <div className="text-slate-500 text-sm mt-1">
            {away_team.name} @ {home_team.name} · {boxScore.game.game_date}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-xs"
            onClick={() => downloadFile(boxScoreApi.exportUrl(gameId, 'csv'), `boxscore-game${gameId}.csv`)}
          >
            ↓ CSV
          </button>
          <button
            className="btn-secondary text-xs"
            onClick={() => downloadFile(boxScoreApi.exportUrl(gameId, 'json'), `boxscore-game${gameId}.json`)}
          >
            ↓ JSON
          </button>
          {isLive && (
            <Link to={`/games/${gameId}/score`} className="btn-primary text-xs">
              ▶ Back to Scoring
            </Link>
          )}
        </div>
      </div>

      {/* Line score */}
      <div className="card-scoreboard mb-5">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Line Score</div>
        <LineScore boxScore={boxScore} />
      </div>

      {/* Batting */}
      <div className="card mb-5 space-y-8">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Batting</div>
        <BattingTable batters={boxScore.batting.away} teamName={away_team.name} abbr={away_team.abbreviation} />
        <BattingTable batters={boxScore.batting.home} teamName={home_team.name} abbr={home_team.abbreviation} />
      </div>

      {/* Pitching */}
      <div className="card space-y-8">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pitching</div>
        <PitchingTable pitchers={boxScore.pitching.away} teamName={away_team.name} abbr={away_team.abbreviation} />
        <PitchingTable pitchers={boxScore.pitching.home} teamName={home_team.name} abbr={home_team.abbreviation} />
      </div>
    </div>
  );
}

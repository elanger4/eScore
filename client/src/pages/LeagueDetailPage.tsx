import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaguesApi } from '../api/leagues';
import { teamsApi } from '../api/teams';
import { Team, LeaderEntry } from '../types';

type Tab = 'teams' | 'standings' | 'leaders';

export default function LeagueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const leagueId = parseInt(id!);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('standings');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');

  const { data: league, isLoading } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leaguesApi.get(leagueId),
  });
  const { data: allTeams = [] } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['league-stats', leagueId],
    queryFn: () => leaguesApi.stats(leagueId),
    enabled: tab === 'standings' || tab === 'leaders',
  });

  useEffect(() => {
    if (league) { setName(league.name); setSeason(league.season); setDescription(league.description); }
  }, [league]);

  const updateLeague = useMutation({
    mutationFn: () => leaguesApi.update(leagueId, { name, season, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['league', leagueId] });
      qc.invalidateQueries({ queryKey: ['leagues'] });
      setEditing(false);
    },
  });

  const memberIds = new Set((league?.teams ?? []).map((t: Team) => t.id));

  const toggleTeam = useMutation({
    mutationFn: (teamId: number) => {
      const next = new Set(memberIds);
      if (next.has(teamId)) next.delete(teamId); else next.add(teamId);
      return leaguesApi.setTeams(leagueId, [...next]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['league', leagueId] }),
  });

  if (isLoading || !league) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/leagues" className="text-slate-500 hover:text-slate-300 text-sm mb-6 inline-flex items-center gap-1">
        ← Leagues
      </Link>

      {/* League info */}
      <div className="card mb-4">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{league.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {league.season && <span className="text-sm text-blue-400 font-medium">{league.season}</span>}
              {league.description && <span className="text-sm text-slate-500">{league.description}</span>}
              {stats && <span className="text-xs text-slate-600 font-mono">{stats.games_played} game{stats.games_played !== 1 ? 's' : ''} played</span>}
            </div>
          </div>
          <button className="btn-secondary text-xs shrink-0" onClick={() => setEditing(v => !v)}>
            {editing ? '✕ Cancel' : '✎ Edit'}
          </button>
        </div>

        {editing && (
          <div className="border-t border-navy-600 pt-4 mt-3 space-y-3">
            <div><label className="label">League Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Season</label><input className="input" value={season} onChange={e => setSeason(e.target.value)} placeholder="Spring 2025" /></div>
              <div><label className="label">Description</label><input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes" /></div>
            </div>
            <button className="btn-primary" onClick={() => updateLeague.mutate()} disabled={!name || updateLeague.isPending}>Save Changes</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-navy-700">
        {(['standings', 'leaders', 'teams'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-bold capitalize border-b-2 transition-colors -mb-px ${
              tab === t
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'leaders' ? 'Stat Leaders' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Standings ── */}
      {tab === 'standings' && (
        <div className="card">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Standings</h2>
          {statsLoading ? (
            <div className="text-slate-500 text-sm py-4 text-center">Loading…</div>
          ) : !stats || stats.standings.length === 0 ? (
            <div className="text-slate-500 text-sm py-4 text-center">No completed games yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-navy-700">
                    <th className="pb-2 pr-4">Team</th>
                    <th className="pb-2 pr-3 text-right">W</th>
                    <th className="pb-2 pr-3 text-right">L</th>
                    <th className="pb-2 pr-3 text-right">PCT</th>
                    <th className="pb-2 pr-3 text-right">GB</th>
                    <th className="pb-2 pr-3 text-right">RS</th>
                    <th className="pb-2 text-right">RA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {stats.standings.map((s, i) => (
                    <tr key={s.team_id} className={i === 0 ? 'text-white' : 'text-slate-300'}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black font-mono text-xs w-8 text-white">{s.team_abbr}</span>
                          <span className="text-slate-400 text-xs hidden sm:block">{s.team_name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold">{s.wins}</td>
                      <td className="py-2.5 pr-3 text-right">{s.losses}</td>
                      <td className="py-2.5 pr-3 text-right font-mono">{s.pct}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-400">{s.gb}</td>
                      <td className="py-2.5 pr-3 text-right text-slate-400">{s.rs}</td>
                      <td className="py-2.5 text-right text-slate-400">{s.ra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Stat Leaders ── */}
      {tab === 'leaders' && (
        <div className="space-y-5">
          {statsLoading ? (
            <div className="card text-slate-500 text-sm py-8 text-center">Loading…</div>
          ) : !stats || stats.games_played === 0 ? (
            <div className="card text-slate-500 text-sm py-8 text-center">No completed games yet.</div>
          ) : (
            <>
              {/* Batting leaders */}
              <div className="card">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Batting Leaders</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <LeaderBoard title="HR" entries={stats.batting_leaders.hr} />
                  <LeaderBoard title="RBI" entries={stats.batting_leaders.rbi} />
                  <LeaderBoard title="H" entries={stats.batting_leaders.h} />
                  <LeaderBoard title="AVG" entries={stats.batting_leaders.avg} />
                  <LeaderBoard title="OPS" entries={stats.batting_leaders.ops} />
                  <LeaderBoard title="SB" entries={stats.batting_leaders.sb} />
                </div>
              </div>

              {/* Pitching leaders */}
              <div className="card">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Pitching Leaders</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  <LeaderBoard title="ERA" entries={stats.pitching_leaders.era} />
                  <LeaderBoard title="SO" entries={stats.pitching_leaders.so} />
                  <LeaderBoard title="IP" entries={stats.pitching_leaders.ip} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Teams ── */}
      {tab === 'teams' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Teams</h2>
              <p className="text-xs text-slate-500 mt-0.5">{memberIds.size} team{memberIds.size !== 1 ? 's' : ''} in this league</p>
            </div>
          </div>
          {(allTeams as Team[]).length === 0 ? (
            <div className="text-slate-500 text-sm py-4 text-center">
              No teams exist yet. <Link to="/teams" className="text-blue-400 hover:underline">Create a team</Link> first.
            </div>
          ) : (
            <div className="space-y-2">
              {(allTeams as Team[]).map(team => {
                const isMember = memberIds.has(team.id);
                return (
                  <div
                    key={team.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      isMember ? 'border-blue-700/60 bg-blue-950/30 hover:border-blue-600' : 'border-navy-600 hover:border-navy-500'
                    }`}
                    onClick={() => toggleTeam.mutate(team.id)}
                  >
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center shrink-0 font-black font-mono text-sm text-white"
                      style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0c1930 100%)', border: '1px solid #1a3254' }}
                    >
                      {team.abbreviation}
                    </div>
                    <span className={`flex-1 font-medium ${isMember ? 'text-white' : 'text-slate-400'}`}>{team.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${isMember ? 'bg-blue-700/40 text-blue-300' : 'text-slate-600'}`}>
                      {isMember ? 'In League' : 'Add'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderBoard({ title, entries }: { title: string; entries: LeaderEntry[] }) {
  const nonZero = entries.filter(e => e.value !== '0');
  const display = nonZero.length > 0 ? nonZero : entries.slice(0, 1);
  return (
    <div>
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{title}</div>
      {display.length === 0 ? (
        <div className="text-xs text-slate-600">—</div>
      ) : (
        <ol className="space-y-1">
          {display.map((e, i) => (
            <li key={e.player_id} className="flex items-baseline gap-2 text-xs">
              <span className="text-slate-600 font-mono w-3 shrink-0">{i + 1}.</span>
              <span className="text-slate-300 truncate flex-1">{e.player_name}</span>
              <span className="text-slate-500 font-mono text-[10px] shrink-0">{e.team_abbr}</span>
              <span className="font-bold font-mono text-white shrink-0">{e.value}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

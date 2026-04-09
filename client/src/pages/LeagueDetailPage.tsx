import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaguesApi } from '../api/leagues';
import { teamsApi } from '../api/teams';
import { Team } from '../types';

export default function LeagueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const leagueId = parseInt(id!);
  const qc = useQueryClient();

  const { data: league, isLoading } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: () => leaguesApi.get(leagueId),
  });
  const { data: allTeams = [] } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });

  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState(false);

  // Sync form when league loads
  useEffect(() => {
    if (league) {
      setName(league.name);
      setSeason(league.season);
      setDescription(league.description);
    }
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
    <div className="max-w-3xl mx-auto p-6">
      {/* Back */}
      <Link to="/leagues" className="text-slate-500 hover:text-slate-300 text-sm mb-6 inline-flex items-center gap-1">
        ← Leagues
      </Link>

      {/* League info card */}
      <div className="card mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{league.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {league.season && <span className="text-sm text-blue-400 font-medium">{league.season}</span>}
              {league.description && <span className="text-sm text-slate-500">{league.description}</span>}
            </div>
          </div>
          <button
            className="btn-secondary text-xs shrink-0"
            onClick={() => setEditing(v => !v)}
          >
            {editing ? '✕ Cancel' : '✎ Edit'}
          </button>
        </div>

        {editing && (
          <div className="border-t border-navy-600 pt-4 space-y-3">
            <div>
              <label className="label">League Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Season</label>
                <input
                  className="input"
                  value={season}
                  onChange={e => setSeason(e.target.value)}
                  placeholder="Spring 2025"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <input
                  className="input"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
            </div>
            <button
              className="btn-primary"
              onClick={() => updateLeague.mutate()}
              disabled={!name || updateLeague.isPending}
            >
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Team membership */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Teams</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {memberIds.size} team{memberIds.size !== 1 ? 's' : ''} in this league
            </p>
          </div>
        </div>

        {(allTeams as Team[]).length === 0 ? (
          <div className="text-slate-500 text-sm py-4 text-center">
            No teams exist yet.{' '}
            <Link to="/teams" className="text-blue-400 hover:underline">Create a team</Link> first.
          </div>
        ) : (
          <div className="space-y-2">
            {(allTeams as Team[]).map(team => {
              const isMember = memberIds.has(team.id);
              return (
                <div
                  key={team.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    isMember
                      ? 'border-blue-700/60 bg-blue-950/30 hover:border-blue-600'
                      : 'border-navy-600 hover:border-navy-500'
                  }`}
                  onClick={() => toggleTeam.mutate(team.id)}
                >
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center shrink-0 font-black font-mono text-sm text-white"
                    style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0c1930 100%)', border: '1px solid #1a3254' }}
                  >
                    {team.abbreviation}
                  </div>
                  <span className={`flex-1 font-medium ${isMember ? 'text-white' : 'text-slate-400'}`}>
                    {team.name}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    isMember ? 'bg-blue-700/40 text-blue-300' : 'text-slate-600'
                  }`}>
                    {isMember ? 'In League' : 'Add'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

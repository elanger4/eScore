import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '../api/teams';
import { Team } from '../types';

export default function TeamsPage() {
  const qc = useQueryClient();
  const { data: teams = [], isLoading } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [abbr, setAbbr] = useState('');

  const createTeam = useMutation({
    mutationFn: () => teamsApi.create({ name, abbreviation: abbr }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); setName(''); setAbbr(''); setShowForm(false); },
  });

  const deleteTeam = useMutation({
    mutationFn: (id: number) => teamsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Teams</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your rosters</p>
        </div>
        <button
          className="btn-primary px-5"
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? '✕ Cancel' : '+ New Team'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-6 border-blue-800/50">
          <h2 className="text-base font-bold text-white mb-4">Create Team</h2>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="label">Team Name</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="New York Yankees"
                onKeyDown={e => e.key === 'Enter' && abbr && createTeam.mutate()}
              />
            </div>
            <div>
              <label className="label">Abbreviation</label>
              <input
                className="input font-mono tracking-widest uppercase"
                value={abbr}
                onChange={e => setAbbr(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="NYY"
                maxLength={4}
                onKeyDown={e => e.key === 'Enter' && name && createTeam.mutate()}
              />
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => createTeam.mutate()}
            disabled={!name || !abbr || createTeam.isPending}
          >
            Create Team
          </button>
        </div>
      )}

      {/* Team list */}
      {isLoading ? (
        <div className="text-slate-500 text-sm py-8 text-center">Loading…</div>
      ) : teams.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">⚾</div>
          <p className="text-slate-400">No teams yet.</p>
          <p className="text-slate-500 text-sm mt-1">Create your first team to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(teams as Team[]).map(team => (
            <div
              key={team.id}
              className="card flex items-center gap-4 hover:border-navy-400 transition-colors"
            >
              {/* Abbreviation badge */}
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0
                           font-black font-mono text-lg tracking-widest text-white"
                style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0c1930 100%)', border: '1px solid #1a3254' }}
              >
                {team.abbreviation}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-lg leading-tight">{team.name}</div>
                <div className="text-slate-500 text-xs font-mono mt-0.5">{team.abbreviation}</div>
              </div>

              <div className="flex gap-2 shrink-0">
                <Link
                  to={`/teams/${team.id}`}
                  className="btn-secondary text-xs"
                >
                  Manage Roster
                </Link>
                <button
                  className="btn-danger text-xs"
                  onClick={() => { if (confirm(`Delete ${team.name}?`)) deleteTeam.mutate(team.id); }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

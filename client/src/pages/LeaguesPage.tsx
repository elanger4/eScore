import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaguesApi } from '../api/leagues';
import { League } from '../types';

export default function LeaguesPage() {
  const qc = useQueryClient();
  const { data: leagues = [], isLoading } = useQuery({ queryKey: ['leagues'], queryFn: leaguesApi.list });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');

  const createLeague = useMutation({
    mutationFn: () => leaguesApi.create({ name, season, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leagues'] });
      setName(''); setSeason(''); setDescription(''); setShowForm(false);
    },
  });

  const deleteLeague = useMutation({
    mutationFn: (id: number) => leaguesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }),
  });

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Leagues</h1>
          <p className="text-slate-400 text-sm mt-1">Organize teams into leagues and seasons</p>
        </div>
        <button className="btn-primary px-5" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ New League'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card mb-6 border-blue-800/50">
          <h2 className="text-base font-bold text-white mb-4">Create League</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="label">League Name</label>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Metro Baseball League"
                autoFocus
              />
            </div>
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
            onClick={() => createLeague.mutate()}
            disabled={!name || createLeague.isPending}
          >
            Create League
          </button>
        </div>
      )}

      {/* League list */}
      {isLoading ? (
        <div className="text-slate-500 text-sm py-8 text-center">Loading…</div>
      ) : (leagues as League[]).length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-slate-400">No leagues yet.</p>
          <p className="text-slate-500 text-sm mt-1">Create a league to group teams together.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(leagues as League[]).map(league => (
            <div key={league.id} className="card flex items-center gap-4 hover:border-navy-400 transition-colors">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0 text-2xl"
                style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0c1930 100%)', border: '1px solid #1a3254' }}
              >
                🏆
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-lg leading-tight">{league.name}</div>
                <div className="flex items-center gap-3 mt-0.5">
                  {league.season && (
                    <span className="text-xs text-blue-400 font-medium">{league.season}</span>
                  )}
                  {league.description && (
                    <span className="text-xs text-slate-500 truncate">{league.description}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to={`/leagues/${league.id}`} className="btn-secondary text-xs">
                  Manage
                </Link>
                <button
                  className="btn-danger text-xs"
                  onClick={() => { if (confirm(`Delete "${league.name}"?`)) deleteLeague.mutate(league.id); }}
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

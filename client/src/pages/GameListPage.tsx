import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamesApi } from '../api/games';
import { Game } from '../types';

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  scheduled: { label: 'Scheduled', cls: 'text-slate-400 bg-navy-700 border-navy-500', dot: 'bg-slate-500' },
  in_progress: { label: 'LIVE', cls: 'text-green-300 bg-green-950/60 border-green-800', dot: 'bg-green-400' },
  final: { label: 'Final', cls: 'text-slate-400 bg-navy-800 border-navy-600', dot: 'bg-slate-600' },
};

export default function GameListPage() {
  const qc = useQueryClient();
  const { data: games = [], isLoading } = useQuery({ queryKey: ['games'], queryFn: gamesApi.list });

  const deleteGame = useMutation({
    mutationFn: (id: number) => gamesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['games'] }),
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Games</h1>
          <p className="text-slate-400 text-sm mt-1">Score and review games</p>
        </div>
        <Link to="/games/new" className="btn-primary px-5">+ New Game</Link>
      </div>

      {isLoading ? (
        <div className="text-slate-500 text-sm py-8 text-center">Loading…</div>
      ) : games.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🏟️</div>
          <p className="text-slate-400">No games yet.</p>
          <p className="text-slate-500 text-sm mt-1">Create a new game to start scoring.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(games as Game[]).map(game => {
            const cfg = STATUS_CONFIG[game.status] ?? STATUS_CONFIG.scheduled;
            return (
              <div key={game.id} className="card hover:border-navy-400 transition-colors">
                <div className="flex items-center gap-4">
                  {/* Matchup */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-black font-mono text-xl text-white tracking-wide">
                        {game.away_abbr}
                      </span>
                      <span className="text-slate-500 text-sm">@</span>
                      <span className="font-black font-mono text-xl text-white tracking-wide">
                        {game.home_abbr}
                      </span>
                    </div>
                    <div className="text-slate-500 text-xs">
                      {game.away_team_name} @ {game.home_team_name} · {game.game_date}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${game.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                    {cfg.label}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    {game.status !== 'final' && (
                      <Link
                        to={`/games/${game.id}/score`}
                        className="btn-primary text-xs"
                      >
                        {game.status === 'scheduled' ? 'Setup' : '▶ Score'}
                      </Link>
                    )}
                    <Link to={`/games/${game.id}/boxscore`} className="btn-secondary text-xs">
                      Box Score
                    </Link>
                    <button
                      className="btn-danger text-xs"
                      onClick={() => { if (confirm('Delete this game?')) deleteGame.mutate(game.id); }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

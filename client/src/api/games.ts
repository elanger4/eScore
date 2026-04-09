import { apiFetch } from './client';
import { Game, GameState, LineupEntry, Play } from '../types';

export const gamesApi = {
  list: () => apiFetch<Game[]>('/games'),
  get: (id: number) => apiFetch<Game>(`/games/${id}`),
  create: (data: { home_team_id: number; away_team_id: number; game_date: string; innings?: number }) =>
    apiFetch<Game>('/games', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/games/${id}`, { method: 'DELETE' }),
  start: (id: number) =>
    apiFetch<Game>(`/games/${id}/start`, { method: 'PATCH' }),
  end: (id: number) =>
    apiFetch<Game>(`/games/${id}/end`, { method: 'PATCH' }),

  getLineup: (gameId: number, teamId: number) =>
    apiFetch<LineupEntry[]>(`/games/${gameId}/lineups/${teamId}`),
  setLineup: (gameId: number, teamId: number, entries: Array<{ batting_order: number; player_id: number; position: string }>) =>
    apiFetch<void>(`/games/${gameId}/lineups/${teamId}`, { method: 'PUT', body: JSON.stringify({ entries }) }),

  getState: (id: number) => apiFetch<GameState>(`/games/${id}/state`),

  getPlays: (id: number) => apiFetch<Play[]>(`/games/${id}/plays`),
  addPlay: (id: number, play: Record<string, unknown>) =>
    apiFetch<{ play_index: number; state: GameState }>(`/games/${id}/plays`, {
      method: 'POST',
      body: JSON.stringify(play),
    }),
  undoLastPlay: (id: number) =>
    apiFetch<{ undone: number; state: GameState }>(`/games/${id}/plays/last`, { method: 'DELETE' }),
};

import { apiFetch } from './client';
import { Team, TeamWithPlayers, Player } from '../types';

export const teamsApi = {
  list: () => apiFetch<Team[]>('/teams'),
  get: (id: number) => apiFetch<TeamWithPlayers>(`/teams/${id}`),
  create: (data: { name: string; abbreviation: string }) =>
    apiFetch<Team>('/teams', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Team>) =>
    apiFetch<Team>(`/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/teams/${id}`, { method: 'DELETE' }),

  listPlayers: (teamId: number) =>
    apiFetch<Player[]>(`/teams/${teamId}/players`),
  createPlayer: (teamId: number, data: Omit<Player, 'id' | 'team_id' | 'active' | 'default_batting_order' | 'default_position'>) =>
    apiFetch<Player>(`/teams/${teamId}/players`, { method: 'POST', body: JSON.stringify(data) }),

  setDefaultLineup: (teamId: number, entries: Array<{ player_id: number; batting_order: number; position: string }>) =>
    apiFetch<{ ok: boolean }>(`/teams/${teamId}/lineup`, { method: 'PUT', body: JSON.stringify({ entries }) }),
};

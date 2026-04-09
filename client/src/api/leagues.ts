import { apiFetch } from './client';
import { League } from '../types';

export const leaguesApi = {
  list: () => apiFetch<League[]>('/leagues'),
  get: (id: number) => apiFetch<League>(`/leagues/${id}`),
  create: (data: { name: string; season?: string; description?: string }) =>
    apiFetch<League>('/leagues', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Pick<League, 'name' | 'season' | 'description'>>) =>
    apiFetch<League>(`/leagues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/leagues/${id}`, { method: 'DELETE' }),
  setTeams: (id: number, teamIds: number[]) =>
    apiFetch<{ ok: boolean }>(`/leagues/${id}/teams`, { method: 'PUT', body: JSON.stringify({ team_ids: teamIds }) }),
};

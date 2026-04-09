import { apiFetch } from './client';
import { Player } from '../types';

export const playersApi = {
  update: (id: number, data: Partial<Player>) =>
    apiFetch<Player>(`/players/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/players/${id}`, { method: 'DELETE' }),
};

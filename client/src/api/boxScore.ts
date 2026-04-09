import { apiFetch } from './client';
import { BoxScore } from '../types';

export const boxScoreApi = {
  get: (gameId: number) => apiFetch<BoxScore>(`/games/${gameId}/boxscore`),
  exportUrl: (gameId: number, format: 'json' | 'csv') =>
    `/api/games/${gameId}/boxscore/export?format=${format}`,
};

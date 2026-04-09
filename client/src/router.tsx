import { createBrowserRouter, Navigate } from 'react-router-dom';
import Shell from './components/layout/Shell';
import TeamsPage from './pages/TeamsPage';
import TeamDetailPage from './pages/TeamDetailPage';
import GameListPage from './pages/GameListPage';
import GameSetupPage from './pages/GameSetupPage';
import ScoringPage from './pages/ScoringPage';
import BoxScorePage from './pages/BoxScorePage';
import LeaguesPage from './pages/LeaguesPage';
import LeagueDetailPage from './pages/LeagueDetailPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/teams" replace /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:id', element: <TeamDetailPage /> },
      { path: 'games', element: <GameListPage /> },
      { path: 'games/new', element: <GameSetupPage /> },
      { path: 'games/:id/score', element: <ScoringPage /> },
      { path: 'games/:id/boxscore', element: <BoxScorePage /> },
      { path: 'leagues', element: <LeaguesPage /> },
      { path: 'leagues/:id', element: <LeagueDetailPage /> },
    ],
  },
]);

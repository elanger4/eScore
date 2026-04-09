import express from 'express';
import cors from 'cors';
import path from 'path';
import { runMigrations } from './db/migrations';
import teamsRouter from './routes/teams';
import playersRouter from './routes/players';
import gamesRouter from './routes/games';
import playsRouter from './routes/plays';
import boxScoreRouter from './routes/boxScore';
import leaguesRouter from './routes/leagues';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Run migrations on startup
runMigrations();

// API routes
app.use('/api/teams', teamsRouter);
app.use('/api/players', playersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/games/:id/plays', playsRouter);
app.use('/api/games/:id/boxscore', boxScoreRouter);
app.use('/api/leagues', leaguesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve built client in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`eScore server running on http://localhost:${PORT}`);
});

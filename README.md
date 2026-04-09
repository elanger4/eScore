# eScore

A baseball game scoring app for recording play-by-play stats during games.

## What it does

eScore lets you score a baseball game from start to finish. You set up teams and rosters, create a game, set your lineups, and then record each at-bat result as the game progresses. It tracks the game state (score, outs, base runners) and generates a full box score when the game is over.

Key features:
- **Play-by-play logging** — record at-bat results using standard notation (K, BB, 1B, GO:6-3, etc.)
- **Live scoreboard** — current inning, outs, score, and an interactive diamond showing runners on base
- **Mid-PA events** — stolen bases, caught stealing, wild pitches, passed balls, balks
- **Lineup management** — set batting order and positions, make in-game substitutions
- **Box scores** — full batting and pitching lines, line score, errors
- **Undo** — revert the last recorded play
- **Leagues & rosters** — organize teams into leagues, manage player profiles

## Tech stack

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, TanStack Query
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (via `better-sqlite3`, stored at `server/data/escore.db`)

## Getting started

```bash
npm install
npm run dev
```

This starts both the client (http://localhost:5173) and API server (http://localhost:3001) concurrently. The client proxies `/api` requests to the backend automatically.

The database is created automatically on first run — no setup needed.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run client + server in development mode |
| `npm run build` | Production build |
| `npm start` | Start production server (serves built client on port 3001) |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:migrate` | Run database migrations manually |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | — | Set to `production` to serve the built React app |

## Play notation

At-bat results use standard baseball shorthand:

| Code | Meaning |
|---|---|
| `K` / `KL` | Strikeout swinging / looking |
| `BB` / `IBB` | Walk / intentional walk |
| `HBP` | Hit by pitch |
| `1B` `2B` `3B` `HR` | Hit types |
| `GO:6-3` | Ground out (shortstop to first) |
| `FO:8` | Fly out to center |
| `GDP` | Ground into double play |
| `SAC` / `SF` | Sacrifice bunt / fly |
| `E4` | Error by second baseman |

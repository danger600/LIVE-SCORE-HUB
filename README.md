# LIVE SCORE HUB

A football platform for live match information, authorized video streams, highlights and licensed broadcasts.

## Current architecture

- Frontend: React + Vite (Vercel)
- Backend: Node.js + Express (Render)
- Match data: SportScore public API (primary)
- Video feeds: ScoreBat (optional developer token)
- Secondary data provider: API-Football (planned; optional server-side key)

## Features in progress

- Live/recent match centre with 60-second refresh
- Official video feed catalogue and embedded ScoreBat playback
- Highlights feed
- Responsive dark sports interface without advertising banners
- Visible SportScore attribution
- Licensed broadcast partner catalogue (next phase)

## Development

1. Copy `server/.env.example` to `server/.env`.
2. Install frontend dependencies: `npm install`.
3. Install backend dependencies: `npm --prefix server install`.
4. Run both apps: `npm run dev`.

Frontend: http://localhost:5173  
Backend health: http://localhost:5000/api/health

## Backend endpoints

- `GET /api/health` — service and provider configuration
- `GET /api/matches` — SportScore football match feed (server-cached)
- `GET /api/videos/live` — ScoreBat live-streams feed (requires eligible ScoreBat developer access)
- `GET /api/videos/highlights` — ScoreBat featured feed when token is configured; otherwise the free historical feed

## Provider credentials

- SportScore's documented public API does not require an API key on its public tier. Its attribution requirements apply: the UI includes a visible dofollow link to SportScore.
- Add `SCOREBAT_API_TOKEN` to the Render service environment to enable ScoreBat feeds. Keep it on the backend only. The free ScoreBat feed contains selected older matches; fresh featured/live-stream feeds require an eligible paid developer plan and consume credits.
- `API_FOOTBALL_KEY` is reserved for a future fallback integration. Never place provider keys in frontend code or Vercel's public client bundle.

## Streaming rights and availability

A video feed is not a guarantee that every match is currently live. ScoreBat's live-streams endpoint may include finished matches and replays, and playback availability is controlled by the source.

The licensed broadcast catalogue will accept only streams that the project owner or broadcast partner is authorized to distribute. Before launch, each stream must have confirmed rights, permitted territories, viewing windows and provider terms. LIVE SCORE HUB will not scrape, bypass paywalls, or redistribute unauthorized broadcasts.

## Data freshness

Scores refresh every 60 seconds. Video feeds refresh every five minutes and are cached by the backend. Provider rate limits, cache headers, account quotas and source publication schedules take priority over refresh frequency.

## Project status

The initial SportScore and ScoreBat backend routes and the expanded watch-centre UI have been committed. Render and Vercel deployments run automatically from GitHub; verify each deployment before relying on production behavior. Licensed partner management, detailed match pages, league tables, user accounts and API-Football fallback remain future implementation phases.

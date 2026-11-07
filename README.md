# LIVE SCORE HUB

A football platform for live match information, fixtures, standings, team/player data, official video highlights and licensed broadcasts.

## Architecture

- Frontend: React + Vite on Vercel
- Backend: Node.js + Express on Render
- Primary match feed: SportScore public football widget
- Secondary/fallback football data: API-Football (API-Sports)
- Official video feeds: ScoreBat Video API
- Licensed broadcasts: partner integration, enabled only after distribution rights are verified

## API endpoints

- `GET /api/health` — backend and integration configuration status
- `GET /api/matches` — SportScore match feed, with API-Football live-fixtures fallback if SportScore fails
- `GET /api/football/fixtures?live=all` — fixtures and live matches
- `GET /api/football/fixtures?date=YYYY-MM-DD&timezone=Africa/Kigali` — fixtures for the selected date across provider-supported countries and competitions
- `GET /api/football/fixtures?league=2&season=2026&next=20` — UEFA Champions League upcoming fixtures for the selected season
- `GET /api/football/leagues?season=2026&current=true` — current leagues and competitions available from the provider
- `GET /api/football/leagues?season=2026` — leagues/competitions
- `GET /api/football/standings?league=39&season=2026` — standings
- `GET /api/football/teams?league=39&season=2026` — teams
- `GET /api/football/players?team=33&season=2026` — players (provider plan limits apply)
- `GET /api/videos/highlights` — ScoreBat free historical feed or paid featured feed
- `GET /api/videos/live` — ScoreBat live-streams feed (eligible paid plan required)

## Configure provider keys on Render

Open the Render service Environment page and add these variables:

| Key | Value |
| --- | --- |
| `API_FOOTBALL_KEY` | Paste your API-Football key |
| `SCOREBAT_API_TOKEN` | Paste your ScoreBat developer token |
| `SCOREBAT_PLAN` | `free` unless you have an eligible paid ScoreBat plan |
| `LICENSED_STREAMS_CONFIGURED` | Keep `false` until a licensed broadcast partner is approved |

Never commit real keys to GitHub, paste them into frontend code, or expose them through Vite `VITE_*` variables. Keep secrets in Render Environment only.

SportScore's documented public API does not require a key on its public tier. Its visible attribution requirement is retained in the frontend. API-Football requires an API key sent server-side as `x-apisports-key`. Free-plan request quotas apply; server responses are cached for 60 seconds.

ScoreBat requires a developer token even for its free feed. Free feed content is selected older matches; live-streams and featured-feed require an eligible paid plan. The live-streams endpoint may include replays and finished matches, not only currently live broadcasts.

## Local development

1. Copy `server/.env.example` to `server/.env`.
2. Install frontend dependencies: `npm install`.
3. Install backend dependencies: `npm --prefix server install`.
4. Start frontend and backend using the scripts in the root package.

Frontend: http://localhost:5173  
Backend health: http://localhost:5000/api/health

## Streaming rights

ScoreBat video embeds are displayed using the source-provided embed URL. Licensed broadcast integrations must be added only for providers that authorize LIVE SCORE HUB to distribute their streams in the applicable territories and viewing windows. Do not scrape streams, bypass paywalls or redistribute unauthorized broadcasts.

## Deployment

GitHub commits trigger Vercel and Render deployments. Confirm both deployments complete, then test `/api/health`, `/api/matches` and provider endpoints. API keys must be added separately in Render Environment; this repository intentionally contains blank placeholders only.

## Worldwide match centre

The frontend includes a World Fixtures view that requests fixtures for the selected calendar date across the countries and competitions covered by API-Football. The Competitions view lists current competitions returned by the provider and lets visitors open a competition's upcoming fixtures. UEFA Champions League is available as a featured shortcut (provider league ID 2). Coverage, historical depth and request limits depend on the API-Football subscription; this is not a guarantee that every amateur or regional match worldwide is indexed. The frontend uses the browser's timezone for kickoff display and requests are cached by the backend.

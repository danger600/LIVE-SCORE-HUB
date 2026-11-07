# LIVE SCORE HUB

A clean, responsive football live-scores platform.

## Planned features
- Live matches, fixtures and results
- League and team filters
- Match details, events, lineups and statistics (where supported by the provider)
- Automatic refresh with visible last-updated time
- Provider attribution and API quota-aware requests
- No advertising banners

## Architecture
- Frontend: React + Vite
- Backend: Node.js + Express
- Providers: SportScore (primary), API-Football (secondary/fallback)
- API credentials belong in backend environment variables, never in browser code.

## Development
1. Copy `server/.env.example` to `server/.env` when provider credentials are available.
2. Install dependencies: `npm install`
3. Install backend dependencies: `npm --prefix server install`
4. Start both apps: `npm run dev`

Frontend: http://localhost:5173  
Backend health: http://localhost:5000/api/health

## Data freshness
The interface will refresh through the backend on a provider-aware schedule. Refresh intervals must respect provider caching rules, rate limits and live-data availability. A refresh attempt does not guarantee that a provider has published new data.

## Attribution
SportScore and API-Football names/logos/data are subject to their respective terms. Provider attribution will be displayed where required.

## Project status
Initial foundation. Provider integrations will be added only after validating the current official API documentation, authentication method, endpoints and free-tier limits.

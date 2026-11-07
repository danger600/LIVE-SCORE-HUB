import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT || 5000);
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173,https://live-score-hub-gold.vercel.app")
  .split(",").map((value) => value.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || CLIENT_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by LIVE SCORE HUB API"));
  }
}));
app.use(express.json({ limit: "32kb" }));

const cache = new Map();
async function cachedJson(key, ttlMs, fetcher) {
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return current.value;
  const value = await fetcher();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.text || body?.message || `Provider returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
function apiFootballConfigured() {
  return Boolean(process.env.API_FOOTBALL_KEY);
}
async function apiFootball(path, params = {}) {
  if (!apiFootballConfigured()) {
    const error = new Error("API-Football key is not configured.");
    error.status = 503;
    throw error;
  }
  const url = new URL(`${API_FOOTBALL_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return cachedJson(`api-football:${path}:${url.searchParams.toString()}`, 60_000, () =>
    fetchJson(url, { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY } })
  );
}

function normalizeApiFootballFixtures(data) {
  return (Array.isArray(data?.response) ? data.response : []).map((item) => {
    const fixture = item.fixture || {};
    const teams = item.teams || {};
    const goals = item.goals || {};
    const status = fixture.status || {};
    const liveCodes = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE"]);
    const isLive = liveCodes.has(status.short) || (status.elapsed !== null && status.elapsed !== undefined && !["FT", "AET", "PEN", "NS"].includes(status.short));
    return {
      id: String(fixture.id || `${teams.home?.name || "home"}-${teams.away?.name || "away"}`),
      homeTeam: teams.home?.name || "Home",
      awayTeam: teams.away?.name || "Away",
      homeScore: goals.home ?? null,
      awayScore: goals.away ?? null,
      status: isLive ? "live" : (status.short === "FT" || status.short === "AET" || status.short === "PEN" ? "finished" : "scheduled"),
      statusText: status.long || status.short || "Scheduled",
      kickoff: fixture.date || null,
      competition: item.league?.name || "Football",
      homeLogo: teams.home?.logo || null,
      awayLogo: teams.away?.logo || null,
      source: "API-Football"
    };
  });
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "live-score-hub-api",
    integrations: {
      sportscore: "available_public_feed",
      apiFootball: apiFootballConfigured() ? "configured" : "needs_api_key",
      scorebat: process.env.SCOREBAT_API_TOKEN ? "configured" : "needs_api_token",
      licensedBroadcasts: process.env.LICENSED_STREAMS_CONFIGURED === "true" ? "configured" : "partner_setup_required"
    }
  });
});

// SportScore public fixtures feed is the primary score source; API-Football is the fallback.
app.get("/api/matches", async (_req, res) => {
  try {
    const data = await cachedJson("sportscore:football:matches", 60_000, () =>
      fetchJson("https://sportscore.com/api/widget/matches/?sport=football&limit=50")
    );
    const rawMatches = Array.isArray(data?.matches) ? data.matches : [];
    const matches = rawMatches.map((match, index) => ({
      id: String(match.slug || `${match.home || "home"}-${match.away || "away"}-${match.time || index}`),
      homeTeam: match.home || "Home",
      awayTeam: match.away || "Away",
      homeScore: match.home_score ?? null,
      awayScore: match.away_score ?? null,
      status: match.status || "scheduled",
      statusText: match.status_text || match.status || "Scheduled",
      kickoff: match.time || null,
      competition: match.competition || "Football",
      homeLogo: match.home_logo || null,
      awayLogo: match.away_logo || null,
      source: "SportScore"
    }));
    res.set("Cache-Control", "public, max-age=30");
    return res.json({ source: "SportScore", matches, updated: data?.updated || new Date().toISOString() });
  } catch (_sportScoreError) {
    if (!apiFootballConfigured()) {
      return res.status(502).json({
        error: "MATCH_FEEDS_UNAVAILABLE",
        message: "The primary match feed is unavailable and API-Football fallback is not configured."
      });
    }
    try {
      const data = await apiFootball("fixtures", { live: "all" });
      const matches = normalizeApiFootballFixtures(data);
      return res.json({ source: "API-Football", matches, updated: new Date().toISOString() });
    } catch (_fallbackError) {
      return res.status(502).json({
        error: "MATCH_FEEDS_UNAVAILABLE",
        message: "Live scores are temporarily unavailable. Please try again shortly."
      });
    }
  }
});

// API-Football read-only endpoints. Only documented query parameters are forwarded.
const footballRoutes = {
  fixtures: ["live", "date", "league", "season", "team", "last", "next", "from", "to", "timezone", "status", "id"],
  leagues: ["id", "name", "country", "season", "team", "type", "current", "search", "code"],
  standings: ["league", "season", "team"],
  teams: ["id", "name", "league", "season", "country", "code", "search"],
  players: ["id", "team", "league", "season", "search", "page"]
};
for (const [resource, allowedParams] of Object.entries(footballRoutes)) {
  app.get(`/api/football/${resource}`, async (req, res) => {
    try {
      const params = {};
      for (const key of allowedParams) {
        const value = req.query[key];
        if (typeof value === "string") params[key] = value;
      }
      const data = await apiFootball(resource, params);
      res.set("Cache-Control", "public, max-age=30");
      res.json({ source: "API-Football", ...data });
    } catch (error) {
      res.status(error.status || 502).json({
        error: error.status === 503 ? "API_FOOTBALL_NOT_CONFIGURED" : "API_FOOTBALL_UNAVAILABLE",
        message: error.status === 503
          ? "Add API_FOOTBALL_KEY to the server environment to enable this endpoint."
          : "API-Football could not complete the request. Check the key, plan quota and query parameters."
      });
    }
  });
}

async function scoreBatFeed(path, cacheKey, ttlMs) {
  const token = process.env.SCOREBAT_API_TOKEN;
  if (!token) {
    const error = new Error("ScoreBat API token is not configured.");
    error.status = 503;
    throw error;
  }
  const url = new URL(`https://www.scorebat.com/video-api/v3/${path}`);
  url.searchParams.set("token", token);
  return cachedJson(cacheKey, ttlMs, () => fetchJson(url));
}

// ScoreBat's live-streams feed may contain replays/finished matches too.
app.get("/api/videos/live", async (_req, res) => {
  try {
    if (process.env.SCOREBAT_PLAN !== "paid") {
      return res.status(403).json({
        error: "SCOREBAT_PAID_PLAN_REQUIRED",
        message: "The ScoreBat live-streams endpoint requires an eligible paid developer plan."
      });
    }
    const data = await scoreBatFeed("live-streams/", "scorebat:live-streams", 60_000);
    res.json({ source: "ScoreBat", notice: "Availability depends on the rights-holder. Some entries may be replays.", matches: data.response || [] });
  } catch (error) {
    res.status(error.status || 502).json({
      error: "VIDEO_FEED_UNAVAILABLE",
      message: error.status === 503 ? "Official video feed is not configured yet." : "The official video feed is temporarily unavailable."
    });
  }
});

app.get("/api/videos/highlights", async (_req, res) => {
  try {
    const feed = process.env.SCOREBAT_PLAN === "paid" ? "featured-feed/" : "free-feed/";
    const data = await scoreBatFeed(feed, `scorebat:${feed}`, 10 * 60_000);
    res.json({
      source: "ScoreBat",
      feed: feed === "free-feed/" ? "free" : "featured",
      notice: feed === "free-feed/" ? "Free feed contains selected older matches, not current highlights." : "Featured videos are selected by ScoreBat; availability can change.",
      matches: data.response || []
    });
  } catch (error) {
    res.status(error.status || 502).json({
      error: "HIGHLIGHTS_UNAVAILABLE",
      message: error.status === 503 ? "Highlights feed is not configured yet." : "Highlights are temporarily unavailable."
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`LIVE SCORE HUB API listening on port ${port}`);
});

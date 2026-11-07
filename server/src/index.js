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

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "live-score-hub-api",
    integrations: {
      sportscore: "connected",
      scorebat: process.env.SCOREBAT_API_TOKEN ? "configured" : "not_configured",
      apiFootball: process.env.API_FOOTBALL_KEY ? "configured" : "not_configured"
    }
  });
});

// SportScore public fixtures feed. No API key is required for the documented public tier.
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
    res.json({ source: "SportScore", matches, updated: data?.updated || new Date().toISOString() });
  } catch (error) {
    res.status(502).json({
      error: "SPORTSCORE_UNAVAILABLE",
      message: "Live scores are temporarily unavailable. Please try again shortly."
    });
  }
});

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
// The UI must display the source's label and must not claim every item is live.
app.get("/api/videos/live", async (_req, res) => {
  try {
    const data = await scoreBatFeed("live-streams/", "scorebat:live-streams", 60_000);
    res.json({ source: "ScoreBat", notice: "Availability depends on the rights-holder and source. Some entries may be replays.", matches: data.response || [] });
  } catch (error) {
    res.status(error.status || 502).json({
      error: "VIDEO_FEED_UNAVAILABLE",
      message: error.status === 503
        ? "Official video feed is not configured yet."
        : "The official video feed is temporarily unavailable."
    });
  }
});

app.get("/api/videos/highlights", async (_req, res) => {
  try {
    const feed = process.env.SCOREBAT_API_TOKEN ? "featured-feed/" : "free-feed/";
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
      message: error.status === 503
        ? "Highlights feed is not configured yet."
        : "Highlights are temporarily unavailable."
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`LIVE SCORE HUB API listening on port ${port}`);
});

import { useEffect, useMemo, useState } from "react";

const API = "/api";
const REFRESH_MS = 60_000;
const VIDEO_REFRESH_MS = 5 * 60_000;

function videoItems(matches = []) {
  return matches.flatMap((match) =>
    (Array.isArray(match.videos) ? match.videos : []).map((video) => ({
      ...video,
      matchTitle: match.title || [match.homeTeam?.name, match.awayTeam?.name].filter(Boolean).join(" - "),
      competition: match.competition || "Football",
      thumbnail: match.thumbnail || null,
      date: match.date || null,
      sourceUrl: video.url
    }))
  );
}

function formatTime(value) {
  if (!value) return "Time TBC";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const [tab, setTab] = useState("matches");
  const [matches, setMatches] = useState([]);
  const [liveVideos, setLiveVideos] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [health, setHealth] = useState("Connecting");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [videoMessage, setVideoMessage] = useState("");
  const [activeVideo, setActiveVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadMatches() {
    try {
      const [healthResponse, matchResponse] = await Promise.all([
        fetch(`${API}/health`),
        fetch(`${API}/matches`)
      ]);
      const healthData = await healthResponse.json();
      const matchData = await matchResponse.json();
      setHealth(healthData.status === "ok" ? "API ONLINE" : "API OFFLINE");
      if (!matchResponse.ok) throw new Error(matchData.message || "Match data is unavailable.");
      setMatches(Array.isArray(matchData.matches) ? matchData.matches : []);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setHealth("API OFFLINE");
      setError(err.message || "Could not load match data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadVideos() {
    const [liveResult, highlightsResult] = await Promise.allSettled([
      fetch(`${API}/videos/live`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Live video feed is not configured.");
        return data;
      }),
      fetch(`${API}/videos/highlights`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || "Highlights feed is unavailable.");
        return data;
      })
    ]);

    if (liveResult.status === "fulfilled") {
      setLiveVideos(videoItems(liveResult.value.matches));
      setVideoMessage(liveResult.value.notice || "");
    } else {
      setLiveVideos([]);
      setVideoMessage(liveResult.reason?.message || "Live video feed is not configured.");
    }
    if (highlightsResult.status === "fulfilled") {
      setHighlights(videoItems(highlightsResult.value.matches));
    } else {
      setHighlights([]);
    }
  }

  useEffect(() => {
    loadMatches();
    loadVideos();
    const matchTimer = window.setInterval(loadMatches, REFRESH_MS);
    const videoTimer = window.setInterval(loadVideos, VIDEO_REFRESH_MS);
    return () => {
      window.clearInterval(matchTimer);
      window.clearInterval(videoTimer);
    };
  }, []);

  const liveMatches = useMemo(
    () => matches.filter((match) => /live|in.?play|1st half|2nd half|half time/i.test(`${match.status} ${match.statusText}`)),
    [matches]
  );
  const shownMatches = tab === "live" ? liveMatches : matches;

  function playVideo(video) {
    if (!video.sourceUrl || !/^https:\/\/www\.scorebat\.com\//i.test(video.sourceUrl)) return;
    setActiveVideo(video);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Live Score Hub home">
          <span className="brand-mark">LS</span>
          <span>LIVE SCORE <b>HUB</b></span>
        </a>
        <div className="top-status"><span className={health === "API ONLINE" ? "status-dot" : "status-dot muted"} />{health}</div>
      </header>

      <section className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">YOUR WORLD. YOUR GAME. LIVE.</p>
          <h1>Watch the game.<br /><span>Feel every moment.</span></h1>
          <p className="hero-copy">Live match centre, official video feeds, licensed broadcasts and football highlights — together in one place.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setTab("live")}>Explore live matches <span>↗</span></button>
            <button className="secondary-button" onClick={() => setTab("highlights")}>Watch highlights</button>
          </div>
          <div className="hero-meta"><span className="live-pulse" /> FOOTBALL, WITHOUT THE NOISE <span className="meta-divider">·</span> No advertising banners</div>
        </div>
        <div className="hero-visual">
          <div className="pitch-lines"><span /><span /><span /><span /></div>
          <div className="hero-ball">⚽</div>
          <div className="visual-caption"><b>THE MATCH IS ON</b><span>Scores · Streams · Highlights</span></div>
        </div>
      </section>

      <nav className="main-nav" aria-label="Main navigation">
        {[
          ["matches", "All matches"],
          ["live", "Live now"],
          ["streams", "Watch live"],
          ["highlights", "Highlights"],
          ["leagues", "Leagues"]
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? "nav-item active" : "nav-item"} onClick={() => setTab(id)}>{label}{id === "live" && liveMatches.length > 0 ? <b className="nav-count">{liveMatches.length}</b> : null}</button>
        ))}
      </nav>

      {tab === "matches" || tab === "live" ? (
        <section className="content-section">
          <div className="section-heading">
            <div><p className="eyebrow">MATCH CENTRE</p><h2>{tab === "live" ? "Live right now" : "Today's matches"}</h2></div>
            <span className="updated">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Updating scores…"}</span>
          </div>
          {error ? <div className="notice error-notice">{error} <button onClick={loadMatches}>Retry</button></div> : null}
          {loading ? <div className="empty-state">Loading live match data…</div> : shownMatches.length ? (
            <div className="match-grid">
              {shownMatches.map((match) => (
                <article className="match-card" key={match.id}>
                  <div className="match-topline"><span>{match.competition || "Football"}</span><span className={/live|in.?play/i.test(match.status) ? "live-label" : "match-status"}>{match.statusText || match.status || "Scheduled"}</span></div>
                  <div className="team-row">
                    <div className="team-name">{match.homeLogo ? <img src={match.homeLogo} alt="" /> : <span className="team-placeholder">H</span>}<b>{match.homeTeam}</b></div>
                    <strong className="score">{match.homeScore ?? "–"} <i>:</i> {match.awayScore ?? "–"}</strong>
                    <div className="team-name away">{match.awayLogo ? <img src={match.awayLogo} alt="" /> : <span className="team-placeholder">A</span>}<b>{match.awayTeam}</b></div>
                  </div>
                  <div className="match-bottom"><span>{formatTime(match.kickoff)}</span><span>Match details <b>↗</b></span></div>
                </article>
              ))}
            </div>
          ) : <div className="empty-state"><div className="football-icon">⚽</div><h3>{tab === "live" ? "No live matches found" : "No matches available"}</h3><p>Match schedules depend on the competitions and data currently published by our provider.</p></div>}
        </section>
      ) : null}

      {tab === "streams" ? (
        <section className="content-section">
          <div className="section-heading"><div><p className="eyebrow">WATCH CENTRE</p><h2>Official live video</h2></div><span className="updated">Verified source feeds</span></div>
          <div className="notice"><b>Broadcast availability varies.</b> This feed can include replays and finished matches as well as live-stream entries. We only play video sources supplied by authorized providers.</div>
          {liveVideos.length ? <div className="video-grid">{liveVideos.map((video, index) => <VideoCard key={video.id || index} video={video} onPlay={playVideo} />)}</div> : <div className="empty-state"><div className="football-icon">▶</div><h3>Official streams are not connected yet</h3><p>{videoMessage} To show current video, configure an eligible ScoreBat developer token or add a licensed broadcast partner feed.</p></div>}
          <div className="partner-panel"><p className="eyebrow">BROADCAST PARTNERS</p><h3>Your licensed streams belong here</h3><p>We will add a secure partner catalogue for streams you own or are authorized to distribute, with territory and viewing-window controls.</p><span className="coming-soon">PARTNER STREAM MANAGEMENT · NEXT PHASE</span></div>
        </section>
      ) : null}

      {tab === "highlights" ? (
        <section className="content-section">
          <div className="section-heading"><div><p className="eyebrow">VIDEO LIBRARY</p><h2>Highlights & replays</h2></div><span className="updated">Official video embeds</span></div>
          {highlights.length ? <><div className="notice">Videos are embedded from their original provider. Availability and publication time are controlled by the rights-holder.</div><div className="video-grid">{highlights.map((video, index) => <VideoCard key={video.id || index} video={video} onPlay={playVideo} />)}</div></> : <div className="empty-state"><div className="football-icon">▶</div><h3>Highlights feed not available</h3><p>Connect a ScoreBat developer plan to load current featured highlights. A free feed may contain older selected matches only.</p></div>}
        </section>
      ) : null}

      {tab === "leagues" ? (
        <section className="content-section"><div className="section-heading"><div><p className="eyebrow">FOOTBALL WORLD</p><h2>Leagues & competitions</h2></div></div><div className="empty-state"><div className="football-icon">🏆</div><h3>Competition centre is next</h3><p>League tables, fixtures, team pages and player statistics will be connected in the next data integration phase.</p></div></section>
      ) : null}

      <footer><div><b>LIVE SCORE HUB</b><span>Football, all in one place.</span></div><a href="https://sportscore.com/developers/" target="_blank" rel="noreferrer">Live scores powered by SportScore ↗</a></footer>

      {activeVideo ? <div className="player-overlay" role="dialog" aria-modal="true" aria-label="Video player" onClick={() => setActiveVideo(null)}><div className="player-modal" onClick={(event) => event.stopPropagation()}><div className="player-heading"><div><b>{activeVideo.matchTitle}</b><span>{activeVideo.title || "Official video"} · {activeVideo.competition}</span></div><button className="close-player" onClick={() => setActiveVideo(null)} aria-label="Close player">×</button></div><iframe src={activeVideo.sourceUrl} title={activeVideo.title || "Official football video"} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div></div> : null}
    </main>
  );
}

function VideoCard({ video, onPlay }) {
  return (
    <article className="video-card">
      <button className="video-thumb" onClick={() => onPlay(video)} aria-label={`Play ${video.title || video.matchTitle}`}>
        {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <span className="thumb-fallback">⚽</span>}
        <span className="play-button">▶</span>
      </button>
      <div className="video-info"><span>{video.competition}</span><b>{video.matchTitle || "Football video"}</b><small>{video.title || "Video"} · {video.date ? new Date(video.date).toLocaleDateString() : "Video available"}</small></div>
    </article>
  );
}

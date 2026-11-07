import { useEffect, useState } from "react";

const REFRESH_MS = 60_000;

export default function App() {
  const [health, setHealth] = useState("Checking API...");
  const [matches, setMatches] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [message, setMessage] = useState("Connecting to the LIVE SCORE HUB server...");

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const healthResponse = await fetch("/api/health");
        if (!healthResponse.ok) throw new Error("Backend health check failed");
        const healthData = await healthResponse.json();
        if (!active) return;
        setHealth(healthData.status === "ok" ? "API server online" : "API unavailable");

        const matchResponse = await fetch("/api/matches");
        const matchData = await matchResponse.json();
        if (!active) return;

        if (!matchResponse.ok) {
          setMatches([]);
          setMessage(matchData.message || "Live match provider is not connected yet.");
        } else {
          setMatches(Array.isArray(matchData.matches) ? matchData.matches : []);
          setMessage(matchData.matches?.length ? "" : "No live matches are currently available.");
        }
        setLastUpdated(new Date());
      } catch {
        if (!active) return;
        setHealth("API server offline");
        setMessage("Cannot reach the server. Check that the backend is running.");
      }
    }

    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Live Score Hub home">
          <span className="brand-mark">LS</span>
          <span>LIVE SCORE <b>HUB</b></span>
        </a>
        <span className="status"><i /> {health}</span>
      </header>

      <section className="hero">
        <p className="eyebrow">THE BEAUTIFUL GAME, IN REAL TIME</p>
        <h1>Every match.<br /><span>Every moment.</span></h1>
        <p className="hero-copy">Live football scores, fixtures and match information in one clean experience.</p>
        <div className="hero-meta">
          <span className="live-dot" /> LIVE MATCH CENTRE
          <span className="meta-divider">·</span>
          Auto-refresh every 60 seconds
        </div>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">MATCH CENTRE</p>
          <h2>Live matches</h2>
        </div>
        <span className="updated">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for first update"}
        </span>
      </section>

      <section className="match-list" aria-live="polite">
        {matches.length > 0 ? matches.map((match) => (
          <article className="match-card" key={match.id}>
            <span>{match.competition || "Football"}</span>
            <div className="teams">
              <strong>{match.homeTeam || "Home"}</strong>
              <b>{match.homeScore ?? "-"} : {match.awayScore ?? "-"}</b>
              <strong>{match.awayTeam || "Away"}</strong>
            </div>
            <span>{match.status || "Scheduled"}</span>
          </article>
        )) : (
          <div className="empty-state">
            <div className="football-icon">⚽</div>
            <h3>Match data integration is next</h3>
            <p>{message}</p>
          </div>
        )}
      </section>

      <footer>
        <span>LIVE SCORE HUB</span>
        <span>Independent football data experience</span>
      </footer>
    </main>
  );
}

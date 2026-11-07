import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173"
}));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "live-score-hub-api",
    integrations: {
      sportscore: "not_configured",
      apiFootball: "not_configured"
    }
  });
});

// Provider integration will be implemented after verifying the official
// provider endpoints, response formats, authentication and rate limits.
app.get("/api/matches", (_req, res) => {
  res.status(503).json({
    error: "MATCH_PROVIDERS_NOT_CONFIGURED",
    message: "Live match data integration is the next development step."
  });
});

app.listen(port, () => {
  console.log(`LIVE SCORE HUB API listening on port ${port}`);
});

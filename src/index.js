const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const searchRoutes = require("./routes/search");
const songRoutes = require("./routes/songs");
const albumRoutes = require("./routes/albums");
const artistRoutes = require("./routes/artists");
const playlistRoutes = require("./routes/playlists");
const homeRoutes = require("./routes/home");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(compression());
app.use(morgan("dev"));
app.use(express.json());

// Rate limiting — generous for personal use
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: { success: false, message: "Too many requests, slow down." },
});
app.use(limiter);

// ── Routes ──────────────────────────────────────────────────
app.use("/api/search", searchRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/home", homeRoutes);

// ── Health check ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🎵 Music API is running (YouTube Music source)",
    version: "2.0.0",
    endpoints: {
      search: "/api/search?q=<query>&type=songs|albums|artists|playlists",
      songs: {
        getById: "/api/songs/:id",
        getStreamUrl: "/api/songs/:id/stream",
        getLyrics: "/api/songs/:id/lyrics",
        getSuggestions: "/api/songs/:id/suggestions",
      },
      albums: {
        getById: "/api/albums/:id",
        search: "/api/albums/search?q=<query>",
      },
      artists: {
        getById: "/api/artists/:id",
        getSongs: "/api/artists/:id/songs",
        search: "/api/artists/search?q=<query>",
      },
      playlists: {
        getById: "/api/playlists/:id",
      },
      home: {
        trending: "/api/home/trending",
        charts: "/api/home/charts",
        newReleases: "/api/home/new-releases",
      },
    },
  });
});

// ── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Endpoint not found" });
});

// ── Error handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ success: false, message: "Internal server error", error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🎵 Music API running on http://localhost:${PORT}`);
  console.log(`📖 Docs: http://localhost:${PORT}/\n`);
});

module.exports = app;

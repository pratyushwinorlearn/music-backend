const express = require("express");
const router = express.Router();
const saavn = require("../services/youtube");

// GET /api/artists/search?q=arijit
router.get("/search", async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "Query 'q' is required" });
    const results = await saavn.search(q.trim(), "artists", parseInt(page), parseInt(limit));
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/artists/:id?page=0&songCount=20
router.get("/:id", async (req, res) => {
  try {
    const { page = 0, songCount = 20 } = req.query;
    const artist = await saavn.getArtistById(req.params.id, parseInt(page), parseInt(songCount));
    res.json({ success: true, data: artist });
  } catch (err) {
    console.error("[Artist Error]", err.message);
    res.status(err.message.includes("required") ? 400 : 500).json({
      success: false,
      message: err.message,
    });
  }
});

// GET /api/artists/:id/songs?page=0&sortBy=popularity
router.get("/:id/songs", async (req, res) => {
  try {
    const { page = 0, sortBy = "popularity" } = req.query;
    const songs = await saavn.getArtistSongs(req.params.id, parseInt(page), sortBy);
    res.json({ success: true, data: songs });
  } catch (err) {
    console.error("[Artist Songs Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const saavn = require("../services/youtube");

// GET /api/songs/:id
router.get("/:id", async (req, res) => {
  try {
    const song = await saavn.getSongById(req.params.id);
    res.json({ success: true, data: song });
  } catch (err) {
    console.error("[Song Error]", err.message);
    res.status(err.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: err.message,
    });
  }
});

// GET /api/songs/:id/stream  — returns just the stream URL
router.get("/:id/stream", async (req, res) => {
  try {
    const stream = await saavn.getSongStreamUrl(req.params.id);
    res.json({ success: true, data: stream });
  } catch (err) {
    console.error("[Stream Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/songs/:id/lyrics
router.get("/:id/lyrics", async (req, res) => {
  try {
    const lyrics = await saavn.getSongLyrics(req.params.id);
    res.json({ success: true, data: lyrics });
  } catch (err) {
    console.error("[Lyrics Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/songs/:id/suggestions
router.get("/:id/suggestions", async (req, res) => {
  try {
    const suggestions = await saavn.getSongSuggestions(req.params.id);
    res.json({ success: true, data: suggestions });
  } catch (err) {
    console.error("[Suggestions Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

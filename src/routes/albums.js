const express = require("express");
const router = express.Router();
const saavn = require("../services/youtube");

// GET /api/albums/search?q=query
router.get("/search", async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    if (!q) return res.status(400).json({ success: false, message: "Query 'q' is required" });
    const results = await saavn.search(q.trim(), "albums", parseInt(page), parseInt(limit));
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/albums/:id
router.get("/:id", async (req, res) => {
  try {
    const album = await saavn.getAlbumById(req.params.id);
    res.json({ success: true, data: album });
  } catch (err) {
    console.error("[Album Error]", err.message);
    res.status(err.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;

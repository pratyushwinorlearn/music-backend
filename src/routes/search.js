const express = require("express");
const router = express.Router();
const saavn = require("../services/youtube");

// GET /api/search?q=arijit&type=songs&page=1&limit=20
router.get("/", async (req, res) => {
  try {
    const { q, type = "songs", page = 1, limit = 20 } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Query parameter 'q' is required" });
    }
    const results = await saavn.search(q.trim(), type, parseInt(page), parseInt(limit));
    res.json({ success: true, data: results });
  } catch (err) {
    console.error("[Search Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

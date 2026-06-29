const express = require("express");
const router = express.Router();
const saavn = require("../services/saavn");

// GET /api/playlists/:id?page=0
router.get("/:id", async (req, res) => {
  try {
    const { page = 0 } = req.query;
    const playlist = await saavn.getPlaylistById(req.params.id, parseInt(page));
    res.json({ success: true, data: playlist });
  } catch (err) {
    console.error("[Playlist Error]", err.message);
    res.status(err.message.includes("not found") ? 404 : 500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const saavn = require("../services/saavn");

// GET /api/home/trending?lang=hindi,english
router.get("/trending", async (req, res) => {
  try {
    const { lang = "hindi,english" } = req.query;
    const data = await saavn.getTrending("song", lang);
    res.json({ success: true, data: data.trending });
  } catch (err) {
    console.error("[Trending Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/home/charts
router.get("/charts", async (req, res) => {
  try {
    const { lang = "hindi,english" } = req.query;
    const data = await saavn.getTrending("song", lang);
    res.json({ success: true, data: data.charts });
  } catch (err) {
    console.error("[Charts Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/home/new-releases
router.get("/new-releases", async (req, res) => {
  try {
    const { lang = "hindi,english" } = req.query;
    const data = await saavn.getTrending("album", lang);
    res.json({ success: true, data: data.newReleases });
  } catch (err) {
    console.error("[New Releases Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/home  — all sections in one call (efficient for app startup)
router.get("/", async (req, res) => {
  try {
    const { lang = "hindi,english" } = req.query;
    const data = await saavn.getTrending("song", lang);
    res.json({
      success: true,
      data: {
        trending: data.trending,
        charts: data.charts,
        newReleases: data.newReleases,
      },
    });
  } catch (err) {
    console.error("[Home Error]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

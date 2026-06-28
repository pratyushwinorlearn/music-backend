/**
 * youtube.js — Drop-in replacement for saavn.js
 * Uses youtubei.js (no API key needed) for search/metadata
 * Uses yt-dlp subprocess for stream URLs
 *
 * Same exported function signatures as saavn.js so ALL route files
 * work with zero changes (just update the require path).
 */

const { execFile } = require("child_process");
const { promisify } = require("util");
const NodeCache = require("node-cache");

const execFileAsync = promisify(execFile);
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// ── Lazy Innertube singleton ──────────────────────────────────
let _yt = null;
async function getYT() {
  if (_yt) return _yt;
  const { Innertube } = await import("youtubei.js");
  _yt = await Innertube.create({
    cache: null,
    generate_session_locally: true,
    retrieve_player: false, // metadata only; stream URLs come from yt-dlp
  });
  return _yt;
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

/** Parse "3:45" or "1:02:33" → seconds */
function parseDuration(text) {
  if (!text) return 0;
  const parts = String(text).split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parseInt(text) || 0;
}

/** Pick highest-res thumbnail from a thumbnails array */
function bestThumb(thumbnails) {
  if (!thumbnails || thumbnails.length === 0) return null;
  return thumbnails.reduce((best, t) =>
    (t.width || 0) > (best.width || 0) ? t : best
  ).url || thumbnails[0]?.url || null;
}

/** Normalise a MusicShelfItem / song result into our standard shape */
function normaliseSong(item) {
  if (!item) return null;

  // youtubei.js MusicResponsiveListItem shape
  const id = item.id || item.video_id || null;
  const name = item.title || item.name || "Unknown";
  const durationSecs =
    typeof item.duration === "object"
      ? parseDuration(item.duration?.text)
      : parseDuration(item.duration) || item.duration_seconds || 0;

  const primaryArtists = (item.artists || []).map((a) => ({
    id: a.channel_id || a.id || null,
    name: a.name || a,
  }));

  const album = item.album
    ? { id: item.album.id || null, name: item.album.name || item.album }
    : null;

  const thumb =
    bestThumb(item.thumbnail?.contents) ||
    bestThumb(item.thumbnails) ||
    null;

  return {
    id,
    name,
    duration: durationSecs,
    year: item.year || null,
    language: null, // YouTube doesn't expose language in search
    label: null,
    artists: {
      primary: primaryArtists,
      featured: [],
    },
    album,
    image: thumb,
    streamUrl: null, // fetched on demand via /stream endpoint
    quality: "varies",
    hasLyrics: false,
    playCount: item.plays || 0,
    url: id ? `https://music.youtube.com/watch?v=${id}` : null,
  };
}

/** Normalise an album */
function normaliseAlbum(item) {
  if (!item) return null;
  const id = item.id || item.playlist_id || null;
  return {
    id,
    name: item.title || item.name || "Unknown Album",
    year: item.year || null,
    type: "album",
    language: null,
    playCount: 0,
    image:
      bestThumb(item.thumbnail?.contents) ||
      bestThumb(item.thumbnails) ||
      null,
    artists: (item.artists || []).map((a) => ({
      id: a.channel_id || a.id || null,
      name: a.name || a,
    })),
    songs: (item.contents || item.songs || []).map(normaliseSong),
    songCount:
      item.song_count ||
      item.total_songs ||
      (item.contents || item.songs || []).length ||
      0,
    url: id ? `https://music.youtube.com/browse/${id}` : null,
  };
}

/** Normalise an artist */
function normaliseArtist(item) {
  if (!item) return null;
  const id = item.id || item.channel_id || null;
  return {
    id,
    name: item.name || item.title || "Unknown Artist",
    bio: item.description || null,
    followerCount: item.subscribers || null,
    fanCount: null,
    image:
      bestThumb(item.thumbnail?.contents) ||
      bestThumb(item.thumbnails) ||
      null,
    topSongs: (item.songs?.contents || item.topSongs || [])
      .slice(0, 10)
      .map(normaliseSong),
    topAlbums: (item.albums?.contents || item.topAlbums || [])
      .slice(0, 5)
      .map(normaliseAlbum),
    url: id ? `https://music.youtube.com/channel/${id}` : null,
  };
}

/** Cached wrapper around any async fn */
async function cached(key, fn, ttl = 600) {
  const hit = cache.get(key);
  if (hit !== undefined) {
    console.log(`[CACHE HIT] ${key}`);
    return hit;
  }
  const result = await fn();
  cache.set(key, result, ttl);
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  STREAM URL  (via yt-dlp subprocess)
// ═══════════════════════════════════════════════════════════════

/**
 * Get a direct audio stream URL for a YouTube video ID.
 * Requires yt-dlp installed: https://github.com/yt-dlp/yt-dlp
 * Windows: winget install yt-dlp   |   Mac: brew install yt-dlp
 */
async function resolveStreamUrl(videoId) {
  const cacheKey = `stream:${videoId}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  try {
    // yt-dlp: get best audio-only URL, no download
    // yt-dlp: get best audio-only URL, no download
    const ytdlpBin = process.env.YTDLP_PATH || "yt-dlp";
    const { stdout } = await execFileAsync(ytdlpBin, [
      "--no-playlist",
      "-f", "140", 
      "--get-url",
      "--extractor-args", "youtube:player_client=android", // <-- THIS IS THE BOT FIX
      "--cookies", "/root/music-backend/cookies.txt",      // <-- LINKS YOUR POWERSHELL SCRIPT
      `https://www.youtube.com/watch?v=${videoId}`,
    ], { timeout: 15000 });

    const url = stdout.trim().split("\n")[0];
    if (!url) throw new Error("yt-dlp returned empty URL");

    // Stream URLs expire in ~6 hours; cache for 5.5h
    cache.set(cacheKey, url, 19800);
    return url;
  } catch (err) {
    throw new Error(
      `yt-dlp failed for ${videoId}: ${err.message}. ` +
      "Make sure yt-dlp is installed: https://github.com/yt-dlp/yt-dlp/releases"
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API  (same signatures as saavn.js)
// ═══════════════════════════════════════════════════════════════

// ── SEARCH ───────────────────────────────────────────────────
async function search(query, type = "songs", page = 1, limit = 20) {
  if (!query) throw new Error("Search query is required");

  const cacheKey = `search:${type}:${query}:${page}`;
  return cached(cacheKey, async () => {
    const yt = await getYT();

    if (type === "songs" || type === "all") {
      const res = await yt.music.search(query, { type: "song" });
      const items = res.songs?.contents || res.contents || [];
      const results = items.slice((page - 1) * limit, page * limit).map(normaliseSong).filter(Boolean);
      return { type: "songs", total: items.length, page, results };
    }

    if (type === "albums") {
      const res = await yt.music.search(query, { type: "album" });
      const items = res.albums?.contents || res.contents || [];
      const results = items.slice(0, limit).map(normaliseAlbum).filter(Boolean);
      return { type: "albums", total: items.length, results };
    }

    if (type === "artists") {
      const res = await yt.music.search(query, { type: "artist" });
      const items = res.artists?.contents || res.contents || [];
      const results = items.slice(0, limit).map((a) => ({
        id: a.id || a.channel_id || null,
        name: a.name || a.title || "Unknown",
        image: bestThumb(a.thumbnail?.contents) || bestThumb(a.thumbnails),
        followerCount: a.subscribers || null,
        url: a.id ? `https://music.youtube.com/channel/${a.id}` : null,
      })).filter(Boolean);
      return { type: "artists", total: items.length, results };
    }

    if (type === "playlists") {
      const res = await yt.music.search(query, { type: "playlist" });
      const items = res.playlists?.contents || res.contents || [];
      const results = items.slice(0, limit).map((p) => ({
        id: p.id || p.playlist_id || null,
        name: p.title || p.name || "Unknown",
        songCount: p.song_count || p.total_songs || null,
        image: bestThumb(p.thumbnail?.contents) || bestThumb(p.thumbnails),
        url: p.id ? `https://music.youtube.com/browse/VL${p.id}` : null,
      })).filter(Boolean);
      return { type: "playlists", total: items.length, results };
    }

    // "all" — run song search as default
    const res = await yt.music.search(query, { type: "song" });
    const items = res.songs?.contents || res.contents || [];
    return {
      type: "all",
      songs: items.slice(0, 10).map(normaliseSong).filter(Boolean),
      albums: [],
      artists: [],
      playlists: [],
    };
  });
}

// ── SONGS ────────────────────────────────────────────────────
async function getSongById(id) {
  if (!id) throw new Error("Song ID is required");
  const cacheKey = `song:${id}`;
  return cached(cacheKey, async () => {
    const yt = await getYT();
    // Use getUpNext to get song metadata for a video ID
    const upNext = await yt.music.getUpNext(id);
    const track = upNext?.contents?.[0];
    if (!track) throw new Error("Song not found");
    return normaliseSong(track);
  });
}

async function getSongStreamUrl(id) {
  if (!id) throw new Error("Song ID is required");
  // Get metadata (for name/image) + stream URL in parallel
  const [meta, streamUrl] = await Promise.allSettled([
    getSongById(id),
    resolveStreamUrl(id),
  ]);

  const raw = meta.status === "fulfilled" ? meta.value?.name : "Unknown";
   const name = typeof raw === "object" ? raw?.text || "Unknown" : raw;
  if (streamUrl.status === "rejected") throw new Error(streamUrl.reason.message);

  return {
    id,
    streamUrl: streamUrl.value,
    quality: "bestaudio",
    name,
  };
}

async function getSongLyrics(id) {
  if (!id) throw new Error("Song ID is required");
  // youtubei.js doesn't expose lyrics directly — return null gracefully
  // You can integrate Genius API later for lyrics
  return { id, lyrics: null, snippet: "Lyrics not available (integrate Genius API for lyrics support)" };
}

async function getSongSuggestions(id) {
  if (!id) throw new Error("Song ID is required");
  const cacheKey = `suggestions:${id}`;
  return cached(cacheKey, async () => {
    const yt = await getYT();
    const upNext = await yt.music.getUpNext(id);
    return (upNext?.contents || []).slice(1, 11).map(normaliseSong).filter(Boolean);
  });
}

// ── ALBUMS ───────────────────────────────────────────────────
async function getAlbumById(id) {
  if (!id) throw new Error("Album ID is required");
  const cacheKey = `album:${id}`;
  return cached(cacheKey, async () => {
    const yt = await getYT();
    // Album IDs from YouTube Music start with MPR
    const albumId = id.startsWith("MPR") ? id : `MPR${id}`;
    const album = await yt.music.getAlbum(albumId);
    return normaliseAlbum(album);
  });
}

// ── ARTISTS ──────────────────────────────────────────────────
async function getArtistById(id, page = 0, songCount = 20) {
  if (!id) throw new Error("Artist ID is required");
  const cacheKey = `artist:${id}:${page}`;
  return cached(cacheKey, async () => {
    const yt = await getYT();
    const artist = await yt.music.getArtist(id);
    return normaliseArtist(artist);
  });
}

async function getArtistSongs(id, page = 0, sortBy = "popularity") {
  if (!id) throw new Error("Artist ID is required");
  const cacheKey = `artist:songs:${id}:${page}`;
  return cached(cacheKey, async () => {
    const yt = await getYT();
    const artist = await yt.music.getArtist(id);
    const songs = (artist?.songs?.contents || [])
      .slice(page * 20, (page + 1) * 20)
      .map(normaliseSong)
      .filter(Boolean);
    return { total: artist?.songs?.contents?.length || 0, songs };
  });
}

// ── PLAYLISTS ────────────────────────────────────────────────
async function getPlaylistById(id, page = 0) {
  if (!id) throw new Error("Playlist ID is required");
  const cacheKey = `playlist:${id}:${page}`;
  return cached(cacheKey, async () => {
    const yt = await getYT();
    const pl = await yt.music.getPlaylist(id);
    if (!pl) throw new Error("Playlist not found");

    const songs = (pl.contents || [])
      .slice(page * 50, (page + 1) * 50)
      .map(normaliseSong)
      .filter(Boolean);

    return {
      id,
      name: pl.header?.title?.text || "Playlist",
      description: pl.header?.description?.text || null,
      songCount: pl.contents?.length || songs.length,
      image: bestThumb(pl.header?.thumbnail?.contents) || null,
      songs,
      url: `https://music.youtube.com/browse/VL${id}`,
    };
  });
}

// ── HOME / TRENDING ──────────────────────────────────────────
async function getTrending(type = "song", lang = "hindi,english", page = 0) {
  const cacheKey = `trending:${lang}:${page}`;
  return cached(cacheKey, async () => {
    const yt = await getYT();
    try {
      const home = await yt.music.getHomeFeed();
      const sections = home.sections || [];

      // Flatten all song items from home feed sections
      const allSongs = [];
      const allAlbums = [];

      for (const section of sections) {
        const contents = section.contents || [];
        for (const item of contents) {
          // MusicTwoRowItem = albums/playlists, MusicResponsiveListItem = songs
          if (item.item_type === "song" || item.duration) {
            allSongs.push(normaliseSong(item));
          } else if (item.item_type === "album" || item.playlist_id?.startsWith("MPR")) {
            allAlbums.push(normaliseAlbum(item));
          }
        }
      }

      return {
        trending: allSongs.filter(Boolean).slice(0, 20),
        charts: [],
        newReleases: allAlbums.filter(Boolean).slice(0, 10),
      };
    } catch (err) {
      console.warn("[Home Feed Error]", err.message, "— falling back to search");
      // Fallback: search popular songs
      const langs = lang.split(",").map((l) => l.trim());
      const query = langs.includes("hindi")
        ? "top hindi songs 2025"
        : "top songs 2025";
      const res = await search(query, "songs", 1, 20);
      return { trending: res.results, charts: [], newReleases: [] };
    }
  }, 3600);
}

module.exports = {
  search,
  getSongById,
  getSongStreamUrl,
  getSongLyrics,
  getSongSuggestions,
  getAlbumById,
  getArtistById,
  getArtistSongs,
  getPlaylistById,
  getTrending,
};

const axios = require("axios");
const NodeCache = require("node-cache");

// Cache: TTL of 10 minutes for most data, 1 hour for home/trending
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

const SAAVN_BASE = "http://localhost:4000/api";

// Axios instance with timeout + headers
const saavnClient = axios.create({
  baseURL: SAAVN_BASE,
  timeout: 10000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json",
  },
});

// ── Helper: pick best quality stream URL ─────────────────────
function getBestStreamUrl(downloadUrls) {
  if (!downloadUrls || downloadUrls.length === 0) return null;
  // Priority: 320kbps → 160kbps → 96kbps
  const priority = ["320kbps", "160kbps", "96kbps", "48kbps"];
  for (const quality of priority) {
    const found = downloadUrls.find((d) => d.quality === quality);
    if (found?.url) return { url: found.url, quality };
  }
  return { url: downloadUrls[0].url, quality: downloadUrls[0].quality };
}

// ── Helper: normalise a song object ─────────────────────────
function normaliseSong(song) {
  if (!song) return null;
  const stream = getBestStreamUrl(song.downloadUrl);
  return {
    id: song.id,
    name: song.name,
    duration: song.duration,
    year: song.year,
    language: song.language,
    label: song.label,
    artists: {
      primary: (song.artists?.primary || []).map((a) => ({ id: a.id, name: a.name })),
      featured: (song.artists?.featured || []).map((a) => ({ id: a.id, name: a.name })),
    },
    album: song.album
      ? { id: song.album.id, name: song.album.name, url: song.album.url }
      : null,
    image: pickBestImage(song.image),
    streamUrl: stream?.url || null,
    quality: stream?.quality || null,
    hasLyrics: song.hasLyrics || false,
    playCount: song.playCount || 0,
    url: song.url,
  };
}

// ── Helper: pick highest resolution image ───────────────────
function pickBestImage(images) {
  if (!images || images.length === 0) return null;
  const priority = ["500x500", "150x150", "50x50"];
  for (const size of priority) {
    const found = images.find((img) => img.quality === size);
    if (found?.url) return found.url;
  }
  return images[images.length - 1]?.url || null;
}

// ── Helper: normalise album ──────────────────────────────────
function normaliseAlbum(album) {
  if (!album) return null;
  return {
    id: album.id,
    name: album.name,
    year: album.year,
    type: album.type,
    language: album.language,
    playCount: album.playCount,
    image: pickBestImage(album.image),
    artists: (album.artists?.primary || []).map((a) => ({ id: a.id, name: a.name })),
    songs: (album.songs || []).map(normaliseSong),
    songCount: album.songCount || (album.songs || []).length,
    url: album.url,
  };
}

// ── Helper: normalise artist ─────────────────────────────────
function normaliseArtist(artist) {
  if (!artist) return null;
  return {
    id: artist.id,
    name: artist.name,
    bio: artist.bio?.[0]?.text || null,
    followerCount: artist.followerCount,
    fanCount: artist.fanCount,
    image: pickBestImage(artist.image),
    topSongs: (artist.topSongs || []).map(normaliseSong),
    topAlbums: (artist.topAlbums || []).map(normaliseAlbum),
    url: artist.url,
  };
}

// ── Helper: cached GET request ───────────────────────────────
async function cachedGet(cacheKey, endpoint, params = {}, ttl = 600) {
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[CACHE HIT] ${cacheKey}`);
    return cached;
  }
  const response = await saavnClient.get(endpoint, { params });
  const data = response.data;
  cache.set(cacheKey, data, ttl);
  return data;
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC API METHODS
// ═══════════════════════════════════════════════════════════════

// ── SEARCH ───────────────────────────────────────────────────
async function search(query, type = "all", page = 1, limit = 20) {
  if (!query) throw new Error("Search query is required");

  if (type === "all" || type === "songs") {
    const cacheKey = `search:songs:${query}:${page}`;
    const data = await cachedGet(cacheKey, "/search/songs", { query, page, limit });
    return {
      type: "songs",
      total: data.data?.total || 0,
      page: data.data?.page || 1,
      results: (data.data?.results || []).map(normaliseSong),
    };
  }

  if (type === "albums") {
    const cacheKey = `search:albums:${query}:${page}`;
    const data = await cachedGet(cacheKey, "/search/albums", { query, page, limit });
    return {
      type: "albums",
      total: data.data?.total || 0,
      results: (data.data?.results || []).map(normaliseAlbum),
    };
  }

  if (type === "artists") {
    const cacheKey = `search:artists:${query}:${page}`;
    const data = await cachedGet(cacheKey, "/search/artists", { query, page, limit });
    return {
      type: "artists",
      total: data.data?.total || 0,
      results: (data.data?.results || []).map((a) => ({
        id: a.id,
        name: a.name,
        image: pickBestImage(a.image),
        followerCount: a.followerCount,
        url: a.url,
      })),
    };
  }

  if (type === "playlists") {
    const cacheKey = `search:playlists:${query}:${page}`;
    const data = await cachedGet(cacheKey, "/search/playlists", { query, page, limit });
    return {
      type: "playlists",
      total: data.data?.total || 0,
      results: (data.data?.results || []).map((p) => ({
        id: p.id,
        name: p.name,
        songCount: p.songCount,
        image: pickBestImage(p.image),
        url: p.url,
      })),
    };
  }

  // Global search
  const cacheKey = `search:all:${query}`;
  const data = await cachedGet(cacheKey, "/search", { query });
  return {
    type: "all",
    songs: (data.data?.songs?.results || []).map(normaliseSong),
    albums: (data.data?.albums?.results || []).map(normaliseAlbum),
    artists: (data.data?.artists?.results || []).map((a) => ({
      id: a.id,
      name: a.name,
      image: pickBestImage(a.image),
    })),
    playlists: (data.data?.playlists?.results || []).map((p) => ({
      id: p.id,
      name: p.name,
      songCount: p.songCount,
      image: pickBestImage(p.image),
    })),
  };
}

// ── SONGS ────────────────────────────────────────────────────
async function getSongById(id) {
  if (!id) throw new Error("Song ID is required");
  const cacheKey = `song:${id}`;
  const data = await cachedGet(cacheKey, `/songs/${id}`);
  const songs = data.data;
  if (!songs || songs.length === 0) throw new Error("Song not found");
  return normaliseSong(songs[0]);
}

async function getSongStreamUrl(id, quality = "best") {
  const song = await getSongById(id);
  if (!song.streamUrl) throw new Error("Stream URL not available for this song");
  return { id, streamUrl: song.streamUrl, quality: song.quality, name: song.name };
}

async function getSongLyrics(id) {
  if (!id) throw new Error("Song ID is required");
  const cacheKey = `lyrics:${id}`;
  const data = await cachedGet(cacheKey, `/songs/${id}/lyrics`, {}, 3600);
  return { id, lyrics: data.data?.lyrics || null, snippet: data.data?.snippet || null };
}

async function getSongSuggestions(id) {
  if (!id) throw new Error("Song ID is required");
  const cacheKey = `suggestions:${id}`;
  const data = await cachedGet(cacheKey, `/songs/${id}/suggestions`, { limit: 10 });
  return (data.data || []).map(normaliseSong);
}

// ── ALBUMS ───────────────────────────────────────────────────
async function getAlbumById(id) {
  if (!id) throw new Error("Album ID is required");
  const cacheKey = `album:${id}`;
  const data = await cachedGet(cacheKey, `/albums`, { id });
  return normaliseAlbum(data.data);
}

// ── ARTISTS ──────────────────────────────────────────────────
async function getArtistById(id, page = 0, songCount = 20) {
  if (!id) throw new Error("Artist ID is required");
  const cacheKey = `artist:${id}:${page}`;
  const data = await cachedGet(cacheKey, `/artists/${id}`, { page, songCount, sortBy: "popularity", sortOrder: "desc" });
  return normaliseArtist(data.data);
}

async function getArtistSongs(id, page = 0, sortBy = "popularity") {
  if (!id) throw new Error("Artist ID is required");
  const cacheKey = `artist:songs:${id}:${page}:${sortBy}`;
  const data = await cachedGet(cacheKey, `/artists/${id}/songs`, { page, sortBy, sortOrder: "desc" });
  return {
    total: data.data?.total || 0,
    songs: (data.data?.songs || []).map(normaliseSong),
  };
}

// ── PLAYLISTS ────────────────────────────────────────────────
async function getPlaylistById(id, page = 0) {
  if (!id) throw new Error("Playlist ID is required");
  const cacheKey = `playlist:${id}:${page}`;
  const data = await cachedGet(cacheKey, `/playlists`, { id, page, limit: 50 });
  const pl = data.data;
  if (!pl) throw new Error("Playlist not found");
  return {
    id: pl.id,
    name: pl.name,
    description: pl.description,
    songCount: pl.songCount,
    image: pickBestImage(pl.image),
    songs: (pl.songs || []).map(normaliseSong),
    url: pl.url,
  };
}

// ── HOME / TRENDING ─────────────────────────────────────────
async function getTrending(type = "song", lang = "hindi,english", page = 0) {
  const cacheKey = `trending:${type}:${lang}:${page}`;
  try {
    const data = await cachedGet(cacheKey, "/modules", { language: lang }, 3600);
    const modules = data.data;
    if (!modules) return { trending: [], charts: [], newReleases: [] };

    const trending = (modules.trending?.songs || []).map(normaliseSong).slice(0, 20);
    const charts = (modules.charts || []).map((c) => ({
      id: c.id,
      name: c.title || c.name,
      image: pickBestImage(c.image),
      type: c.type,
    })).slice(0, 10);
    const newReleases = (modules.albums || []).map(normaliseAlbum).slice(0, 10);

    return { trending, charts, newReleases };
  } catch (err) {
    // Fallback: search popular Hindi songs
    const fallback = await search("top hindi songs 2024", "songs", 1, 20);
    return { trending: fallback.results, charts: [], newReleases: [] };
  }
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

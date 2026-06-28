# 🎵 Music Streaming Backend API

A personal music streaming backend powered by the JioSaavn unofficial API. Built with Node.js + Express. Runs locally or on Railway.

---

## 🚀 Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (auto-restarts on file changes)
npm run dev

# 3. Or start production server
npm start
```

Server runs on **http://localhost:3000**

---

## 📡 API Endpoints

### Base URL
- **Local:** `http://localhost:3000`
- **Railway:** `https://your-app.railway.app`

---

### 🔍 Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=<query>&type=songs` | Search songs |
| GET | `/api/search?q=<query>&type=albums` | Search albums |
| GET | `/api/search?q=<query>&type=artists` | Search artists |
| GET | `/api/search?q=<query>&type=playlists` | Search playlists |

**Query Params:**
- `q` (required) — search query
- `type` — `songs` | `albums` | `artists` | `playlists` | `all` (default: `songs`)
- `page` — page number (default: 1)
- `limit` — results per page (default: 20)

**Example:**
```
GET /api/search?q=arijit+singh&type=songs&page=1&limit=10
```

---

### 🎵 Songs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/songs/:id` | Get full song info + stream URL |
| GET | `/api/songs/:id/stream` | Get stream URL only |
| GET | `/api/songs/:id/lyrics` | Get song lyrics |
| GET | `/api/songs/:id/suggestions` | Get 10 similar songs |

**Song Object:**
```json
{
  "id": "abc123",
  "name": "Tum Hi Ho",
  "duration": 261,
  "year": "2013",
  "language": "hindi",
  "artists": {
    "primary": [{ "id": "xyz", "name": "Arijit Singh" }]
  },
  "album": { "id": "alb123", "name": "Aashiqui 2" },
  "image": "https://c.saavncdn.com/...-500x500.jpg",
  "streamUrl": "https://aac.saavncdn.com/...320.mp4",
  "quality": "320kbps",
  "hasLyrics": true
}
```

---

### 💿 Albums

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/albums/:id` | Get album with all songs |
| GET | `/api/albums/search?q=<query>` | Search albums |

---

### 🎤 Artists

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/artists/:id` | Get artist info + top songs |
| GET | `/api/artists/:id/songs?page=0` | Get all artist songs (paginated) |
| GET | `/api/artists/search?q=<query>` | Search artists |

---

### 📋 Playlists

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/playlists/:id` | Get playlist with all songs |

---

### 🏠 Home / Trending

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/home` | All sections (trending + charts + new releases) |
| GET | `/api/home/trending?lang=hindi,english` | Trending songs |
| GET | `/api/home/charts` | Top charts |
| GET | `/api/home/new-releases` | New album releases |

**Lang options:** `hindi`, `english`, `punjabi`, `tamil`, `telugu`, `kannada`, `marathi`, `bengali`

---

## ☁️ Deploy to Railway (Free, Accessible Anywhere)

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Set environment variable: `PORT=3000`
5. Done! Get your public URL from Railway dashboard

Your app will be accessible from your phone on mobile data anywhere.

---

## 💻 Local Access from Phone (Same WiFi)

1. Run `npm run dev` on your PC
2. Find your PC's local IP:
   - Windows: run `ipconfig` → look for IPv4 Address (e.g., `192.168.1.5`)
3. On your phone, use: `http://192.168.1.5:3000`

---

## 🗂️ Project Structure

```
src/
├── index.js              # Express app + server
├── services/
│   └── saavn.js          # JioSaavn API wrapper + caching
└── routes/
    ├── search.js          # /api/search
    ├── songs.js           # /api/songs
    ├── albums.js          # /api/albums
    ├── artists.js         # /api/artists
    ├── playlists.js       # /api/playlists
    └── home.js            # /api/home
```

---

## ⚡ Features
- **In-memory caching** — 10 min for songs/search, 1 hour for trending (fast repeated requests)
- **320kbps quality** — always picks highest available bitrate
- **Rate limiting** — 200 req/min (plenty for personal use)
- **Compression** — gzip responses for faster mobile loading
- **CORS enabled** — works from any frontend/app
- **Auto-retry** — nodemon restarts on crash in dev

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment |
| `DEFAULT_LANG` | `hindi,english` | Default language for home |

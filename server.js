require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/star-library';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ── In-Memory Cache ──────────────────────────────────────────────────────
const cache = {
  stars: {
    data: null,
    timestamp: 0,
    ttl: 60_000, // 60 seconds
  },
};

function getCached(key) {
  const entry = cache[key];
  if (!entry.data) return null;
  if (Date.now() - entry.timestamp > entry.ttl) return null; // expired
  return entry.data;
}

function setCache(key, data) {
  const entry = cache[key];
  entry.data = data;
  entry.timestamp = Date.now();
}

function invalidateCache(key) {
  const entry = cache[key];
  if (entry) entry.data = null;
}

// ── MongoDB Connection (non-blocking) ──────────────────────────────────────

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5000,   // fail fast if Atlas is unreachable
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

let mongoConnected = false;

function connectMongo() {
  mongoose
    .connect(MONGODB_URI, MONGO_OPTIONS)
    .then(() => {
      mongoConnected = true;
      console.log('Connected to MongoDB');
    })
    .catch((err) => {
      mongoConnected = false;
      console.error('MongoDB connection error:', err.message);
      console.log('App will run in offline mode — API calls will return fallback data');
    });
}

mongoose.connection.on('disconnected', () => {
  mongoConnected = false;
  console.log('MongoDB disconnected — running in offline mode');
});

mongoose.connection.on('reconnected', () => {
  mongoConnected = true;
  console.log('MongoDB reconnected');
});

connectMongo();

// ── Define Schemas ─────────────────────────────────────────────────────────

const movieSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  videoTitle: { type: String, required: true },
  siteName: { type: String, required: true },
  videoUrl: { type: String, default: '' },
  previewVideoUrl: { type: String, default: '' },
  images: { type: String, default: '' },
  albumImages: { type: String, default: '' },
  favoriteImages: { type: String, default: '' },
  starNames: [String],
});

const starSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  pictureUrl: { type: String, default: '' },
  movies: [movieSchema],
});

const Star = mongoose.model('Star', starSchema);

// ── Helper Functions ───────────────────────────────────────────────────────

function normalizeStarName(name) {
  return String(name || '').trim();
}

function normalizeStarKey(name) {
  return normalizeStarName(name).toLowerCase();
}

function splitCommaSeparated(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeStarName).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map(normalizeStarName)
    .filter(Boolean);
}

function uniqueByNormalizedName(names) {
  const seen = new Set();
  return names.filter((name) => {
    const key = normalizeStarKey(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createMovieId() {
  return Date.now() + Math.floor(Math.random() * 1000000);
}

async function findStarByName(name) {
  const targetKey = normalizeStarKey(name);
  if (!targetKey) return null;
  const allStars = getCached('stars') || [];
  return allStars.find((star) => normalizeStarKey(star.name) === targetKey) || null;
}

async function ensureStarByName(name) {
  const normalizedName = normalizeStarName(name);
  if (!normalizedName) return null;
  const existingStar = await findStarByName(normalizedName);
  if (existingStar) return existingStar;
  const newStar = new Star({
    id: Date.now() + Math.floor(Math.random() * 1000000),
    name: normalizedName,
    pictureUrl: '',
    movies: [],
  });
  const saved = await newStar.save();
  invalidateCache('stars');
  return saved;
}

function isObjectIdString(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

async function getStarByParam(param) {
  if (isObjectIdString(param)) return await Star.findById(param);
  const asNumber = Number(param);
  if (!Number.isNaN(asNumber)) return await Star.findOne({ id: asNumber });
  return await Star.findOne({ id: param });
}

// ── Middleware: DB connectivity guard ───────────────────────────────────────

function requireDB(req, res, next) {
  if (!mongoConnected) {
    return res.status(503).json({
      error: 'Database not connected',
      message:
        'The server is starting up or the database is unavailable. Try again in a few seconds.',
    });
  }
  next();
}

// ── Health Check (must respond fast, no DB needed) ─────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: mongoConnected ? 'ok' : 'degraded',
    mongo: mongoConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: mongoConnected ? 'ok' : 'degraded',
    mongo: mongoConnected ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// ── API Endpoints ──────────────────────────────────────────────────────────

app.get('/api/stars', requireDB, async (_req, res) => {
  try {
    // Check cache first
    const cached = getCached('stars');
    if (cached) {
      return res.json(cached);
    }

    const stars = await Star.find().lean();

    // Update cache with the fresh data
    setCache('stars', stars);

    res.json(stars);
  } catch (error) {
    console.error('Error reading stars:', error);
    res.status(500).json({ error: 'Failed to read stars' });
  }
});

app.post('/api/stars', requireDB, async (req, res) => {
  try {
    const name = normalizeStarName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Star name is required' });

    const newStar = new Star({
      id: Date.now() + Math.floor(Math.random() * 1000000),
      name,
      pictureUrl: normalizeStarName(req.body.pictureUrl) || '',
      movies: [],
    });

    const savedStar = await newStar.save();
    invalidateCache('stars');
    res.status(201).json(savedStar);
  } catch (error) {
    console.error('Error adding star:', error);
    res.status(500).json({ error: 'Failed to add star' });
  }
});

app.put('/api/stars/:starId', requireDB, async (req, res) => {
  try {
    const star = await getStarByParam(req.params.starId);
    if (!star) return res.status(404).json({ error: 'Star not found' });

    const name = normalizeStarName(req.body.name);
    const pictureUrl = normalizeStarName(req.body.pictureUrl);
    if (!name) return res.status(400).json({ error: 'Star name is required' });
    if (!pictureUrl) return res.status(400).json({ error: 'Picture URL is required' });

    star.name = name;
    star.pictureUrl = pictureUrl;
    const updatedStar = await star.save();
    invalidateCache('stars');
    res.json(updatedStar);
  } catch (error) {
    console.error('Error updating star:', error);
    res.status(500).json({ error: 'Failed to update star' });
  }
});

app.post('/api/stars/:starId/movies', requireDB, async (req, res) => {
  try {
    const star = await getStarByParam(req.params.starId);
    if (!star) return res.status(404).json({ error: 'Star not found' });

    const videoTitle = normalizeStarName(req.body.videoTitle);
    const siteName = normalizeStarName(req.body.siteName);
    if (!videoTitle || !siteName) {
      return res.status(400).json({ error: 'Video title and site name are required' });
    }

    const starNames = uniqueByNormalizedName([
      star.name,
      ...splitCommaSeparated(req.body.starNames || req.body.movieStars || req.body.stars),
    ]);

    const movieId = req.body.id || createMovieId();
    const moviePayload = {
      id: movieId,
      videoTitle,
      siteName,
      videoUrl: req.body.videoUrl || '',
      previewVideoUrl: req.body.previewVideoUrl || '',
      images: req.body.images || '',
      albumImages: req.body.albumImages || '',
      favoriteImages: req.body.favoriteImages || '',
      starNames: [star.name],
    };

    star.movies.push(moviePayload);

    const otherStarNames = starNames.filter(
      (name) => normalizeStarKey(name) !== normalizeStarKey(star.name)
    );
    for (const starName of otherStarNames) {
      const otherStar = await ensureStarByName(starName);
      if (otherStar) {
        const movieCopy = { ...moviePayload, id: createMovieId(), starNames: [otherStar.name] };
        otherStar.movies.push(movieCopy);
        await otherStar.save();
      }
    }

    const updatedStar = await star.save();
    invalidateCache('stars');
    const primaryMovie = updatedStar.movies[updatedStar.movies.length - 1];

    res.status(201).json({ movie: primaryMovie, starsUpdated: starNames });
  } catch (error) {
    console.error('Error adding movie:', error);
    res.status(500).json({ error: 'Failed to add movie' });
  }
});

app.put('/api/stars/:starId/movies/:movieIndex', requireDB, async (req, res) => {
  try {
    const star = await getStarByParam(req.params.starId);
    if (!star) return res.status(404).json({ error: 'Star not found' });

    const movieIndex = parseInt(req.params.movieIndex, 10);
    if (Number.isNaN(movieIndex) || movieIndex < 0 || movieIndex >= star.movies.length) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const videoTitle = normalizeStarName(req.body.videoTitle);
    const siteName = normalizeStarName(req.body.siteName);
    if (!videoTitle || !siteName) {
      return res.status(400).json({ error: 'Video title and site name are required' });
    }

    const movieId = star.movies[movieIndex].id || req.body.id || createMovieId();
    const updatedMovie = {
      id: movieId,
      videoTitle,
      siteName,
      videoUrl: req.body.videoUrl || '',
      previewVideoUrl: req.body.previewVideoUrl || '',
      images: req.body.images || '',
      albumImages: req.body.albumImages || '',
      favoriteImages: req.body.favoriteImages || '',
      starNames: [star.name],
    };

    star.movies[movieIndex] = updatedMovie;
    const savedStar = await star.save();
    invalidateCache('stars');
    res.json(savedStar.movies[movieIndex]);
  } catch (error) {
    console.error('Error updating movie:', error);
    res.status(500).json({ error: 'Failed to update movie' });
  }
});

app.delete('/api/stars/:starId', requireDB, async (req, res) => {
  try {
    const param = req.params.starId;
    let star;
    if (isObjectIdString(param)) {
      star = await Star.findByIdAndDelete(param);
    } else {
      const asNumber = Number(param);
      star = await Star.findOneAndDelete({ id: asNumber });
    }

    if (!star) return res.status(404).json({ error: 'Star not found' });

    invalidateCache('stars');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting star:', error);
    res.status(500).json({ error: 'Failed to delete star' });
  }
});

// ── Album endpoints ───────────────────────────────────────────────────────

app.patch('/api/stars/:starId/movies/:movieIndex/album', requireDB, async (req, res) => {
  try {
    const star = await getStarByParam(req.params.starId);
    if (!star) return res.status(404).json({ error: 'Star not found' });

    const movieIndex = parseInt(req.params.movieIndex, 10);
    if (Number.isNaN(movieIndex) || movieIndex < 0 || movieIndex >= star.movies.length) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const movie = star.movies[movieIndex];

    if (req.body.albumImages !== undefined) {
      movie.albumImages = String(req.body.albumImages);
    }
    if (req.body.favoriteImages !== undefined) {
      movie.favoriteImages = String(req.body.favoriteImages);
    }

    const savedStar = await star.save();
    invalidateCache('stars');
    res.json({ albumImages: movie.albumImages, favoriteImages: movie.favoriteImages });
  } catch (error) {
    console.error('Error updating album:', error);
    res.status(500).json({ error: 'Failed to update album' });
  }
});

app.delete('/api/stars/:starId/movies/:movieIndex', requireDB, async (req, res) => {
  try {
    const star = await getStarByParam(req.params.starId);
    if (!star) return res.status(404).json({ error: 'Star not found' });

    const movieIndex = parseInt(req.params.movieIndex, 10);
    if (Number.isNaN(movieIndex) || movieIndex < 0 || movieIndex >= star.movies.length) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    star.movies.splice(movieIndex, 1);
    await star.save();
    invalidateCache('stars');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting movie:', error);
    res.status(500).json({ error: 'Failed to delete movie' });
  }
});

// ── SPA fallback: serve index.html for unmatched non-API routes ────────────

app.get('*', (req, res) => {
  // Don't serve index.html for API routes (they'd return HTML instead of JSON)
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Global error handler ───────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
});

// ── Start server ───────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log('Serving Star Library application...');
});

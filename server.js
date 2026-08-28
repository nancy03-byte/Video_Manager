require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/star-library';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* -------------------------------------------------------------------------- */
/*                                    Cache                                   */
/* -------------------------------------------------------------------------- */

const cache = {
  stars: {
    data: null,
    timestamp: 0,
    ttl: 60000,
  },
};

function getCached(key) {
  const entry = cache[key];
  if (!entry || !entry.data) return null;

  if (Date.now() - entry.timestamp > entry.ttl) {
    entry.data = null;
    return null;
  }

  return entry.data;
}

function setCache(key, data) {
  if (!cache[key]) return;

  cache[key].data = data;
  cache[key].timestamp = Date.now();
}

function invalidateCache(key) {
  if (cache[key]) {
    cache[key].data = null;
  }
}

/* -------------------------------------------------------------------------- */
/*                              MongoDB Connection                            */
/* -------------------------------------------------------------------------- */

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
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
      console.log(
        'App will run in offline mode — API calls will return fallback data'
      );
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

/* -------------------------------------------------------------------------- */
/*                                   Schemas                                  */
/* -------------------------------------------------------------------------- */

const movieSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  videoTitle: { type: String, required: true },
  siteName: { type: String, required: true },
  videoUrl: { type: String, default: '' },
  previewVideoUrl: { type: String, default: '' },
  images: { type: String, default: '' },
  albumUrl: { type: String, default: '' },
  albumImages: { type: String, default: '' },
  favoriteImages: { type: String, default: '' },
  isFavorite: { type: Boolean, default: false },
  starNames: [String],
});

const starSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  pictureUrl: { type: String, default: '' },
  movies: [movieSchema],
});

const Star = mongoose.model('Star', starSchema);

/* -------------------------------------------------------------------------- */
/*                               Helper Functions                             */
/* -------------------------------------------------------------------------- */

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

  const allStars = getCached('stars') || (await Star.find().lean());

  return (
    allStars.find((star) => normalizeStarKey(star.name) === targetKey) || null
  );
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
  return (
    typeof value === 'string' &&
    /^[0-9a-fA-F]{24}$/.test(value)
  );
}

async function getStarByParam(param) {
  if (isObjectIdString(param)) {
    return await Star.findById(param);
  }

  const asNumber = Number(param);

  if (!Number.isNaN(asNumber)) {
    return await Star.findOne({ id: asNumber });
  }

  return await Star.findOne({ id: param });
}

/* -------------------------------------------------------------------------- */
/*                              Database Middleware                           */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                               Health Endpoints                             */
/* -------------------------------------------------------------------------- */

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
  /* -------------------------------------------------------------------------- */
/*                               API Endpoints                                */
/* -------------------------------------------------------------------------- */

// Get all stars
app.get('/api/stars', requireDB, async (_req, res) => {
  try {
    const cached = getCached('stars');

    if (cached) {
      return res.json(cached);
    }

    const stars = await Star.find().lean();

    setCache('stars', stars);

    res.json(stars);
  } catch (error) {
    console.error('Error reading stars:', error);
    res.status(500).json({ error: 'Failed to read stars' });
  }
});

// Add star
app.post('/api/stars', requireDB, async (req, res) => {
  try {
    const name = normalizeStarName(req.body.name);

    if (!name) {
      return res.status(400).json({
        error: 'Star name is required',
      });
    }

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
    res.status(500).json({
      error: 'Failed to add star',
    });
  }
});

// Update star
app.put('/api/stars/:starId', requireDB, async (req, res) => {
  try {
    const star = await getStarByParam(req.params.starId);

    if (!star) {
      return res.status(404).json({
        error: 'Star not found',
      });
    }

    const name = normalizeStarName(req.body.name);
    const pictureUrl = normalizeStarName(req.body.pictureUrl);

    if (!name) {
      return res.status(400).json({
        error: 'Star name is required',
      });
    }

    if (!pictureUrl) {
      return res.status(400).json({
        error: 'Picture URL is required',
      });
    }

    star.name = name;
    star.pictureUrl = pictureUrl;

    const updatedStar = await star.save();

    invalidateCache('stars');

    res.json(updatedStar);
  } catch (error) {
    console.error('Error updating star:', error);
    res.status(500).json({
      error: 'Failed to update star',
    });
  }
});

// Delete star
app.delete('/api/stars/:starId', requireDB, async (req, res) => {
  try {
    const param = req.params.starId;

    let star;

    if (isObjectIdString(param)) {
      star = await Star.findByIdAndDelete(param);
    } else {
      const asNumber = Number(param);
      star = await Star.findOneAndDelete({
        id: asNumber,
      });
    }

    if (!star) {
      return res.status(404).json({
        error: 'Star not found',
      });
    }

    invalidateCache('stars');

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting star:', error);
    res.status(500).json({
      error: 'Failed to delete star',
    });
  }
});

// Add movie
app.post('/api/stars/:starId/movies', requireDB, async (req, res) => {
  try {
    const star = await getStarByParam(req.params.starId);

    if (!star) {
      return res.status(404).json({
        error: 'Star not found',
      });
    }

    const videoTitle = normalizeStarName(req.body.videoTitle);
    const siteName = normalizeStarName(req.body.siteName);

    if (!videoTitle || !siteName) {
      return res.status(400).json({
        error: 'Video title and site name are required',
      });
    }

    const starNames = uniqueByNormalizedName([
      star.name,
      ...splitCommaSeparated(
        req.body.starNames ||
        req.body.movieStars ||
        req.body.stars
      ),
    ]);

    const moviePayload = {
      id: req.body.id || createMovieId(),
      videoTitle,
      siteName,
      videoUrl: req.body.videoUrl || '',
      previewVideoUrl: req.body.previewVideoUrl || '',
      images: req.body.images || '',
      albumUrl: req.body.albumUrl || '',
      albumImages: req.body.albumImages || '',
      favoriteImages: req.body.favoriteImages || '',
      isFavorite: req.body.isFavorite === true || req.body.isFavorite === 'true',
      starNames: [star.name],
    };

    // Add movie to primary star
    star.movies.push(moviePayload);

    // Duplicate to every selected co-star
    const otherStars = starNames.filter(
      (name) =>
        normalizeStarKey(name) !==
        normalizeStarKey(star.name)
    );

    for (const name of otherStars) {
      const otherStar = await ensureStarByName(name);

      if (!otherStar) continue;

      otherStar.movies.push({
        ...moviePayload,
        id: createMovieId(),
        starNames: [otherStar.name],
      });

      await otherStar.save();
    }

    const savedStar = await star.save();

    invalidateCache('stars');

    res.status(201).json({
      movie: savedStar.movies[savedStar.movies.length - 1],
      starsUpdated: starNames,
    });

  } catch (error) {
    console.error('Error adding movie:', error);

    res.status(500).json({
      error: 'Failed to add movie',
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                              Update Movie                                  */
/* -------------------------------------------------------------------------- */

app.put('/api/stars/:starId/movies/:movieIndex', requireDB, async (req, res) => {
  try {
    const star = await getStarByParam(req.params.starId);

    if (!star) {
      return res.status(404).json({
        error: 'Star not found',
      });
    }

    const movieIndex = parseInt(req.params.movieIndex, 10);

    if (
      Number.isNaN(movieIndex) ||
      movieIndex < 0 ||
      movieIndex >= star.movies.length
    ) {
      return res.status(404).json({
        error: 'Movie not found',
      });
    }

    const videoTitle = normalizeStarName(req.body.videoTitle);
    const siteName = normalizeStarName(req.body.siteName);

    if (!videoTitle || !siteName) {
      return res.status(400).json({
        error: 'Video title and site name are required',
      });
    }

    const movieId =
      star.movies[movieIndex].id ||
      req.body.id ||
      createMovieId();

    star.movies[movieIndex] = {
      id: movieId,
      videoTitle,
      siteName,
      videoUrl: req.body.videoUrl || '',
      previewVideoUrl: req.body.previewVideoUrl || '',
      images: req.body.images || '',
      albumUrl:
        req.body.albumUrl !== undefined
          ? String(req.body.albumUrl)
          : star.movies[movieIndex].albumUrl || '',
      albumImages:
        req.body.albumImages !== undefined
          ? String(req.body.albumImages)
          : star.movies[movieIndex].albumImages || '',
      favoriteImages:
        req.body.favoriteImages !== undefined
          ? String(req.body.favoriteImages)
          : star.movies[movieIndex].favoriteImages || '',
      isFavorite:
        req.body.isFavorite !== undefined
          ? req.body.isFavorite === true || req.body.isFavorite === 'true'
          : Boolean(star.movies[movieIndex].isFavorite),
      starNames: [star.name],
    };

    const savedStar = await star.save();

    invalidateCache('stars');

    res.json(savedStar.movies[movieIndex]);
  } catch (error) {
    console.error('Error updating movie:', error);

    res.status(500).json({
      error: 'Failed to update movie',
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                              Album Endpoints                               */
/* -------------------------------------------------------------------------- */

app.patch(
  '/api/stars/:starId/movies/:movieIndex/album',
  requireDB,
  async (req, res) => {
    try {
      const star = await getStarByParam(req.params.starId);

      if (!star) {
        return res.status(404).json({
          error: 'Star not found',
        });
      }

      const movieIndex = parseInt(req.params.movieIndex, 10);

      if (
        Number.isNaN(movieIndex) ||
        movieIndex < 0 ||
        movieIndex >= star.movies.length
      ) {
        return res.status(404).json({
          error: 'Movie not found',
        });
      }

      const movie = star.movies[movieIndex];

      if (req.body.albumImages !== undefined) {
        movie.albumImages = String(req.body.albumImages);
      }

      if (req.body.favoriteImages !== undefined) {
        movie.favoriteImages = String(req.body.favoriteImages);
      }

      await star.save();

      invalidateCache('stars');

      res.json({
        albumImages: movie.albumImages,
        favoriteImages: movie.favoriteImages,
      });

    } catch (error) {
      console.error('Error updating album:', error);

      res.status(500).json({
        error: 'Failed to update album',
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                              Delete Movie                                  */
/* -------------------------------------------------------------------------- */

app.delete(
  '/api/stars/:starId/movies/:movieIndex',
  requireDB,
  async (req, res) => {
    try {
      const star = await getStarByParam(req.params.starId);

      if (!star) {
        return res.status(404).json({
          error: 'Star not found',
        });
      }

      const movieIndex = parseInt(req.params.movieIndex, 10);

      if (
        Number.isNaN(movieIndex) ||
        movieIndex < 0 ||
        movieIndex >= star.movies.length
      ) {
        return res.status(404).json({
          error: 'Movie not found',
        });
      }

      star.movies.splice(movieIndex, 1);

      await star.save();

      invalidateCache('stars');

      res.json({
        success: true,
      });

    } catch (error) {
      console.error('Error deleting movie:', error);

      res.status(500).json({
        error: 'Failed to delete movie',
      });
    }
  }
);
/* -------------------------------------------------------------------------- */
/*                          Image Download Proxy                              */
/* -------------------------------------------------------------------------- */

app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error('Unsupported protocol');
  } catch (_) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
      },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Album page returned HTTP ${upstream.status}`,
      });
    }
    res.type('html').send(await upstream.text());
  } catch (error) {
    console.error('Error proxying album page:', error);
    res.status(502).json({ error: 'Failed to fetch album page' });
  }
});

app.get('/api/resolve-video', async (req, res) => {
  const { url } = req.query;
  let pageUrl;
  try {
    pageUrl = new URL(url);
    if (pageUrl.protocol !== 'http:' && pageUrl.protocol !== 'https:') {
      throw new Error('Unsupported protocol');
    }
  } catch (_) {
    return res.status(400).json({ error: 'Invalid video page URL' });
  }

  try {
    const upstream = await fetch(pageUrl.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `${pageUrl.protocol}//${pageUrl.host}/`,
      },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Video page returned HTTP ${upstream.status}` });
    }

    const html = await upstream.text();
    const videoUrl = chooseBestVideoUrl(extractVideoUrls(html, pageUrl.toString()));
    if (!videoUrl) {
      return res.status(404).json({ error: 'No playable video source found on the page' });
    }
    res.json({ videoUrl });
  } catch (error) {
    console.error('Error resolving video page:', error);
    res.status(502).json({ error: 'Failed to fetch video page' });
  }
});

function extractVideoUrls(html, pageUrl) {
  const candidates = new Set();
  const addCandidate = (value) => {
    if (!value) return;
    const cleaned = value.replace(/\\(["'])/g, '$1').replace(/\\\//g, '/');
    try {
      const absoluteUrl = new URL(cleaned, pageUrl).toString();
      if (/\.(?:mp4|webm|ogg|m3u8)(?:[?#].*)?$/i.test(absoluteUrl)) {
        candidates.add(absoluteUrl);
      }
    } catch (_) {
      // Ignore malformed values embedded in page scripts.
    }
  };

  const sourceAttributePattern = /<(?:source|video)[^>]+(?:src|data-src|data-video)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = sourceAttributePattern.exec(html)) !== null) addCandidate(match[1]);

  const quotedUrlPattern = /["']((?:https?:)?\\?\/\\?\/[^"']+\.(?:mp4|webm|ogg|m3u8)(?:\?[^"']*)?)["']/gi;
  while ((match = quotedUrlPattern.exec(html)) !== null) addCandidate(match[1]);

  const plainUrlPattern = /https?:\/\/[^"'\\s<>]+\.(?:mp4|webm|ogg|m3u8)(?:\?[^"'\\s<>]*)?/gi;
  while ((match = plainUrlPattern.exec(html)) !== null) addCandidate(match[0]);

  return Array.from(candidates);
}

function chooseBestVideoUrl(urls) {
  return urls.sort((left, right) => {
    const score = (url) => {
      if (/(?:1080p|1080|1920x1080|fullhd)/i.test(url)) return 4;
      if (/(?:720p|720|1280x720|hd)/i.test(url)) return 3;
      if (/(?:480p|480|854x480)/i.test(url)) return 2;
      if (/(?:360p|360|640x360)/i.test(url)) return 1;
      return 0;
    };
    return score(right) - score(left);
  })[0] || null;
}

// Streams a remote image back to the browser with a Content-Disposition
// header so the browser downloads it directly instead of navigating to it.
// Fetching server-side sidesteps browser CORS restrictions on the image host.
app.get('/api/download-image', async (req, res) => {
  const { url, filename } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Unsupported protocol');
    }
  } catch (_) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      headers: {
        // Some image hosts reject requests without a browser-like UA/referer
        'User-Agent': 'Mozilla/5.0 (compatible; StarLibraryDownloader/1.0)',
      },
    });

    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status || 502).json({ error: 'Failed to fetch image' });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const safeName =
      (filename && String(filename).replace(/[\\/:*?"<>|\r\n]+/g, '_')) ||
      parsedUrl.pathname.split('/').pop() ||
      'image';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    const reader = upstream.body.getReader();
    res.on('close', () => {
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    console.error('Error proxying image download:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download image' });
    } else {
      res.end();
    }
  }
});

/* -------------------------------------------------------------------------- */
/*                              SPA Fallback                                  */
/* -------------------------------------------------------------------------- */

app.get('*', (req, res) => {
  // Don't return index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'Not found',
    });
  }

  res.sendFile(path.join(__dirname, 'index.html'));
});

/* -------------------------------------------------------------------------- */
/*                           Global Error Handler                             */
/* -------------------------------------------------------------------------- */

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV !== 'production'
      ? { detail: err.message }
      : {}),
  });
});

/* -------------------------------------------------------------------------- */
/*                               Start Server                                 */
/* -------------------------------------------------------------------------- */

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log('Serving Star Library application...');
});
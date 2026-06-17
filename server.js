require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/star-library';
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x400?text=Image+Not+Found';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

// Define Schemas
const movieSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    videoTitle: { type: String, required: true },
    siteName: { type: String, required: true },
    videoUrl: { type: String, default: '' },
    previewVideoUrl: { type: String, default: '' },
    images: { type: String, default: '' },
    starNames: [String]
});

const starSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    pictureUrl: { type: String, default: PLACEHOLDER_IMAGE },
    movies: [movieSchema]
});

const Star = mongoose.model('Star', starSchema);


// Helper Functions
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
        if (!key || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function createMovieId() {
    return Date.now() + Math.floor(Math.random() * 1000000);
}

async function findStarByName(name) {
    const targetKey = normalizeStarKey(name);
    if (!targetKey) {
        return null;
    }
    
    const allStars = await Star.find();
    return allStars.find((star) => normalizeStarKey(star.name) === targetKey) || null;
}

async function ensureStarByName(name) {
    const normalizedName = normalizeStarName(name);
    if (!normalizedName) {
        return null;
    }

    const existingStar = await findStarByName(normalizedName);
    if (existingStar) {
        return existingStar;
    }

    const newStar = new Star({
        id: Date.now() + Math.floor(Math.random() * 1000000),
        name: normalizedName,
        pictureUrl: PLACEHOLDER_IMAGE,
        movies: []
    });
    
    return await newStar.save();
}

function isObjectIdString(value) {
    return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

async function getStarByParam(param) {
    // Accept either MongoDB _id (ObjectId) or numeric `id` used by the client
    if (isObjectIdString(param)) {
        return await Star.findById(param);
    }

    const asNumber = Number(param);
    if (!Number.isNaN(asNumber)) {
        return await Star.findOne({ id: asNumber });
    }

    return await Star.findOne({ id: param });
}


// API Endpoints
app.get('/api/stars', async (req, res) => {
    try {
        const stars = await Star.find();
        res.json(stars);
    } catch (error) {
        console.error('Error reading stars:', error);
        res.status(500).json({ error: 'Failed to read stars' });
    }
});

app.post('/api/stars', async (req, res) => {
    try {
        const name = normalizeStarName(req.body.name);
        if (!name) {
            return res.status(400).json({ error: 'Star name is required' });
        }

        const newStar = new Star({
            id: Date.now() + Math.floor(Math.random() * 1000000),
            name,
            pictureUrl: normalizeStarName(req.body.pictureUrl) || PLACEHOLDER_IMAGE,
            movies: []
        });

        const savedStar = await newStar.save();
        res.status(201).json(savedStar);
    } catch (error) {
        console.error('Error adding star:', error);
        res.status(500).json({ error: 'Failed to add star' });
    }
});

app.put('/api/stars/:starId', async (req, res) => {
    try {
        const star = await getStarByParam(req.params.starId);

        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        const name = normalizeStarName(req.body.name);
        const pictureUrl = normalizeStarName(req.body.pictureUrl);

        if (!name) {
            return res.status(400).json({ error: 'Star name is required' });
        }

        if (!pictureUrl) {
            return res.status(400).json({ error: 'Picture URL is required' });
        }

        star.name = name;
        star.pictureUrl = pictureUrl;
        const updatedStar = await star.save();

        res.json(updatedStar);
    } catch (error) {
        console.error('Error updating star:', error);
        res.status(500).json({ error: 'Failed to update star' });
    }
});

app.post('/api/stars/:starId/movies', async (req, res) => {
    try {
        const star = await getStarByParam(req.params.starId);

        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        const videoTitle = normalizeStarName(req.body.videoTitle);
        const siteName = normalizeStarName(req.body.siteName);

        if (!videoTitle || !siteName) {
            return res.status(400).json({ error: 'Video title and site name are required' });
        }

        const starNames = uniqueByNormalizedName([
            star.name,
            ...splitCommaSeparated(req.body.starNames || req.body.movieStars || req.body.stars)
        ]);

        const movieId = req.body.id || createMovieId();
        const moviePayload = {
            id: movieId,
            videoTitle,
            siteName,
            videoUrl: req.body.videoUrl || '',
            previewVideoUrl: req.body.previewVideoUrl || '',
            images: req.body.images || '',
            starNames: [star.name]
        };

        // Save to primary star
        star.movies.push(moviePayload);

        // Save to other stars mentioned
        const otherStarNames = starNames.filter(name => normalizeStarKey(name) !== normalizeStarKey(star.name));
        for (const starName of otherStarNames) {
            const otherStar = await ensureStarByName(starName);
            if (otherStar) {
                const movieCopy = {
                    ...moviePayload,
                    id: createMovieId(),
                    starNames: [otherStar.name]
                };
                otherStar.movies.push(movieCopy);
                await otherStar.save();
            }
        }

        const updatedStar = await star.save();
        const primaryMovie = updatedStar.movies[updatedStar.movies.length - 1];

        res.status(201).json({
            movie: primaryMovie,
            starsUpdated: starNames
        });
    } catch (error) {
        console.error('Error adding movie:', error);
        res.status(500).json({ error: 'Failed to add movie' });
    }
});

app.put('/api/stars/:starId/movies/:movieIndex', async (req, res) => {
    try {
        const star = await getStarByParam(req.params.starId);

        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

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
            starNames: [star.name]
        };

        star.movies[movieIndex] = updatedMovie;
        const savedStar = await star.save();

        res.json(savedStar.movies[movieIndex]);
    } catch (error) {
        console.error('Error updating movie:', error);
        res.status(500).json({ error: 'Failed to update movie' });
    }
});

app.delete('/api/stars/:starId', async (req, res) => {
    try {
        const param = req.params.starId;
        let star;
        if (isObjectIdString(param)) {
            star = await Star.findByIdAndDelete(param);
        } else {
            const asNumber = Number(param);
            star = await Star.findOneAndDelete({ id: asNumber });
        }

        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting star:', error);
        res.status(500).json({ error: 'Failed to delete star' });
    }
});

app.delete('/api/stars/:starId/movies/:movieIndex', async (req, res) => {
    try {
        const star = await getStarByParam(req.params.starId);

        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        const movieIndex = parseInt(req.params.movieIndex, 10);
        if (Number.isNaN(movieIndex) || movieIndex < 0 || movieIndex >= star.movies.length) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        star.movies.splice(movieIndex, 1);
        await star.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting movie:', error);
        res.status(500).json({ error: 'Failed to delete movie' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Serving Star Library application...');
});

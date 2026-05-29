const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x400?text=Image+Not+Found';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function readDataFile() {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

function writeDataFile(jsonData) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(jsonData, null, 2));
}

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

function createStarProfile(name) {
    return {
        id: Date.now() + Math.floor(Math.random() * 1000000),
        name: normalizeStarName(name),
        pictureUrl: PLACEHOLDER_IMAGE,
        movies: []
    };
}

function findStarById(jsonData, starId) {
    return jsonData.stars.find((star) => String(star.id) === String(starId));
}

function findStarByName(jsonData, name) {
    const targetKey = normalizeStarKey(name);
    if (!targetKey) {
        return null;
    }

    return jsonData.stars.find((star) => normalizeStarKey(star.name) === targetKey) || null;
}

function ensureStarByName(jsonData, name) {
    const normalizedName = normalizeStarName(name);
    if (!normalizedName) {
        return null;
    }

    const existingStar = findStarByName(jsonData, normalizedName);
    if (existingStar) {
        return existingStar;
    }

    const newStar = createStarProfile(normalizedName);
    jsonData.stars.push(newStar);
    return newStar;
}

function buildMoviePayload(body, movieId, starNames) {
    return {
        id: movieId,
        videoTitle: body.videoTitle,
        siteName: body.siteName,
        videoUrl: body.videoUrl || '',
        previewVideoUrl: body.previewVideoUrl || '',
        images: body.images || '',
        starNames
    };
}

function syncMovieAcrossStars(jsonData, moviePayload, starNames) {
    const targets = uniqueByNormalizedName(starNames)
        .map((name) => ensureStarByName(jsonData, name))
        .filter(Boolean);

    targets.forEach((star) => {
        const existingMovieIndex = star.movies.findIndex((movie) => String(movie.id) === String(moviePayload.id));
        const movieCopy = {
            ...moviePayload,
            starNames: [...moviePayload.starNames]
        };

        if (existingMovieIndex >= 0) {
            star.movies[existingMovieIndex] = movieCopy;
        } else {
            star.movies.push(movieCopy);
        }
    });

    return targets;
}

app.get('/api/stars', (req, res) => {
    try {
        const jsonData = readDataFile();
        res.json(jsonData.stars);
    } catch (error) {
        console.error('Error reading data.json:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/stars', (req, res) => {
    try {
        const jsonData = readDataFile();

        const name = normalizeStarName(req.body.name);
        if (!name) {
            return res.status(400).json({ error: 'Star name is required' });
        }

        const newStar = {
            id: Date.now(),
            name,
            pictureUrl: normalizeStarName(req.body.pictureUrl),
            movies: []
        };

        jsonData.stars.push(newStar);
        writeDataFile(jsonData);

        res.status(201).json(newStar);
    } catch (error) {
        console.error('Error adding star:', error);
        res.status(500).json({ error: 'Failed to add star' });
    }
});

app.put('/api/stars/:starId', (req, res) => {
    try {
        const jsonData = readDataFile();
        const star = findStarById(jsonData, req.params.starId);

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
        writeDataFile(jsonData);

        res.json(star);
    } catch (error) {
        console.error('Error updating star:', error);
        res.status(500).json({ error: 'Failed to update star' });
    }
});

app.post('/api/stars/:starId/movies', (req, res) => {
    try {
        const jsonData = readDataFile();
        const currentStar = findStarById(jsonData, req.params.starId);

        if (!currentStar) {
            return res.status(404).json({ error: 'Star not found' });
        }

        const videoTitle = normalizeStarName(req.body.videoTitle);
        const siteName = normalizeStarName(req.body.siteName);

        if (!videoTitle || !siteName) {
            return res.status(400).json({ error: 'Video title and site name are required' });
        }

        const movieId = req.body.id || Date.now() + Math.floor(Math.random() * 1000000);
        const starNames = uniqueByNormalizedName([
            currentStar.name,
            ...splitCommaSeparated(req.body.starNames || req.body.movieStars || req.body.stars)
        ]);

        const moviePayload = buildMoviePayload(req.body, movieId, starNames);
        const updatedStars = syncMovieAcrossStars(jsonData, moviePayload, starNames);

        writeDataFile(jsonData);

        res.status(201).json({
            movie: moviePayload,
            starsUpdated: updatedStars.map((star) => ({ id: star.id, name: star.name }))
        });
    } catch (error) {
        console.error('Error adding movie:', error);
        res.status(500).json({ error: 'Failed to add movie' });
    }
});

app.put('/api/stars/:starId/movies/:movieIndex', (req, res) => {
    try {
        const jsonData = readDataFile();
        const star = findStarById(jsonData, req.params.starId);

        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        const movieIndex = parseInt(req.params.movieIndex, 10);
        if (Number.isNaN(movieIndex) || movieIndex < 0 || movieIndex >= star.movies.length) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        const existingMovie = star.movies[movieIndex];
        const videoTitle = normalizeStarName(req.body.videoTitle);
        const siteName = normalizeStarName(req.body.siteName);

        if (!videoTitle || !siteName) {
            return res.status(400).json({ error: 'Video title and site name are required' });
        }

        const movieId = existingMovie.id || req.body.id || Date.now() + Math.floor(Math.random() * 1000000);
        const updatedMovie = buildMoviePayload(req.body, movieId, existingMovie.starNames || [star.name]);
        const starNames = uniqueByNormalizedName(updatedMovie.starNames.length > 0 ? updatedMovie.starNames : [star.name]);
        updatedMovie.starNames = starNames;

        jsonData.stars.forEach((candidateStar) => {
            const targetIndex = candidateStar.movies.findIndex((movie) => String(movie.id) === String(movieId));
            if (targetIndex >= 0) {
                candidateStar.movies[targetIndex] = {
                    ...updatedMovie,
                    starNames: [...starNames]
                };
            }
        });

        star.movies[movieIndex] = updatedMovie;
        writeDataFile(jsonData);

        res.json(updatedMovie);
    } catch (error) {
        console.error('Error updating movie:', error);
        res.status(500).json({ error: 'Failed to update movie' });
    }
});

function removeStarById(starId) {
    const jsonData = readDataFile();
    const starIndex = jsonData.stars.findIndex((star) => String(star.id) === String(starId));

    if (starIndex === -1) {
        return null;
    }

    const removedStar = jsonData.stars.splice(starIndex, 1)[0];
    writeDataFile(jsonData);
    return removedStar;
}

app.delete('/api/stars/:starId', (req, res) => {
    try {
        const removedStar = removeStarById(req.params.starId);

        if (!removedStar) {
            return res.status(404).json({ error: 'Star not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting star:', error);
        res.status(500).json({ error: 'Failed to delete star' });
    }
});

app.delete('/api/stars/:starId/movies/:movieIndex', (req, res) => {
    try {
        const jsonData = readDataFile();
        const star = findStarById(jsonData, req.params.starId);

        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        const movieIndex = parseInt(req.params.movieIndex, 10);
        if (Number.isNaN(movieIndex) || movieIndex < 0 || movieIndex >= star.movies.length) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        const removedMovie = star.movies[movieIndex];
        star.movies.splice(movieIndex, 1);

        if (removedMovie && removedMovie.id) {
            jsonData.stars.forEach((candidateStar) => {
                if (String(candidateStar.id) === String(star.id)) {
                    return;
                }

                candidateStar.movies = candidateStar.movies.filter((movie) => String(movie.id) !== String(removedMovie.id));
            });
        }

        writeDataFile(jsonData);

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

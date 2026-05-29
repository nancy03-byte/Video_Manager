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
    return normalizeStoredData(JSON.parse(data));
}

function writeDataFile(jsonData) {
    const normalizedData = normalizeStoredData(jsonData);
    fs.writeFileSync(DATA_FILE, JSON.stringify(normalizedData, null, 2));
}

function normalizeStoredData(jsonData) {
    const sourceStars = Array.isArray(jsonData?.stars) ? jsonData.stars : [];
    const normalizedStars = sourceStars.map((star) => ({
        ...star,
        name: normalizeStarName(star.name),
        pictureUrl: normalizeStarName(star.pictureUrl),
        movies: []
    }));

    const starLookup = new Map(
        normalizedStars.map((star) => [normalizeStarKey(star.name), star])
    );

    const seenMovies = new Map();

    sourceStars.forEach((star) => {
        const ownerStar = starLookup.get(normalizeStarKey(star.name));
        if (!ownerStar) {
            return;
        }

        const sourceMovies = Array.isArray(star.movies) ? star.movies : [];
        sourceMovies.forEach((movie) => {
            const declaredStarNames = uniqueByNormalizedName([
                star.name,
                ...splitCommaSeparated(movie.starNames)
            ]);

            const targetStarNames = declaredStarNames.length > 1
                ? declaredStarNames
                : [star.name];

            const sourceSignature = String(movie.id || `${movie.videoTitle || ''}|${movie.siteName || ''}|${movie.videoUrl || ''}|${movie.previewVideoUrl || ''}|${movie.images || ''}`);

            targetStarNames.forEach((targetStarName, index) => {
                const targetKey = normalizeStarKey(targetStarName);
                const targetStar = starLookup.get(targetKey);
                if (!targetStar) {
                    return;
                }

                const dedupeKey = `${sourceSignature}::${targetKey}`;
                if (seenMovies.has(dedupeKey)) {
                    return;
                }

                seenMovies.set(dedupeKey, true);

                const movieCopy = {
                    ...movie,
                    id: index === 0 && targetKey === normalizeStarKey(star.name) && movie.id
                        ? movie.id
                        : createMovieId(),
                    starNames: [targetStar.name]
                };

                targetStar.movies.push(movieCopy);
            });
        });
    });

    return {
        ...jsonData,
        stars: normalizedStars
    };
}

function createMovieId() {
    return Date.now() + Math.floor(Math.random() * 1000000);
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

function createMovieCopy(moviePayload, movieId, starName) {
    return {
        ...moviePayload,
        id: movieId,
        starNames: [starName]
    };
}

function saveMovieToStars(jsonData, moviePayload, starNames) {
    const targets = uniqueByNormalizedName(starNames)
        .map((name) => ensureStarByName(jsonData, name))
        .filter(Boolean);

    const movieCopies = targets.map((star, index) => {
        const movieId = index === 0 ? moviePayload.id : Date.now() + Math.floor(Math.random() * 1000000) + index;
        const movieCopy = createMovieCopy(moviePayload, movieId, star.name);
        star.movies.push(movieCopy);
        return movieCopy;
    });

    return movieCopies;
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

        const starNames = uniqueByNormalizedName([
            currentStar.name,
            ...splitCommaSeparated(req.body.starNames || req.body.movieStars || req.body.stars)
        ]);

        const moviePayload = buildMoviePayload(
            req.body,
            req.body.id || Date.now() + Math.floor(Math.random() * 1000000),
            [currentStar.name]
        );
        const movieCopies = saveMovieToStars(jsonData, moviePayload, starNames);
        const primaryMovie = movieCopies[0] || moviePayload;

        writeDataFile(jsonData);

        res.status(201).json({
            movie: primaryMovie,
            starsUpdated: starNames
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
        const updatedMovie = buildMoviePayload(req.body, movieId, [star.name]);

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

        star.movies.splice(movieIndex, 1);

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

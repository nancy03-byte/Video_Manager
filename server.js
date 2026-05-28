const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// GET all stars
app.get('/api/stars', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);
        res.json(jsonData.stars);
    } catch (error) {
        console.error('Error reading data.json:', error);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// POST - Add new star
app.post('/api/stars', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);

        const newStar = {
            id: Date.now(),
            name: req.body.name,
            pictureUrl: req.body.pictureUrl,
            movies: []
        };

        jsonData.stars.push(newStar);
        fs.writeFileSync(DATA_FILE, JSON.stringify(jsonData, null, 2));

        res.json(newStar);
    } catch (error) {
        console.error('Error adding star:', error);
        res.status(500).json({ error: 'Failed to add star' });
    }
});

// POST - Add movie to star
app.post('/api/stars/:starId/movies', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);

        const star = jsonData.stars.find(s => s.id == req.params.starId);
        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        if (!req.body.videoTitle || !req.body.siteName) {
            return res.status(400).json({ error: 'Video title and site name are required' });
        }

        const newMovie = {
            videoTitle: req.body.videoTitle,
            siteName: req.body.siteName,
            videoUrl: req.body.videoUrl || '',
            previewVideoUrl: req.body.previewVideoUrl || '',
            images: req.body.images || ''
        };

        star.movies.push(newMovie);
        fs.writeFileSync(DATA_FILE, JSON.stringify(jsonData, null, 2));

        res.json(newMovie);
    } catch (error) {
        console.error('Error adding movie:', error);
        res.status(500).json({ error: 'Failed to add movie' });
    }
});

// PUT - Update movie in star
app.put('/api/stars/:starId/movies/:movieIndex', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);

        const star = jsonData.stars.find(s => s.id == req.params.starId);
        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        const movieIndex = parseInt(req.params.movieIndex, 10);
        if (Number.isNaN(movieIndex) || movieIndex < 0 || movieIndex >= star.movies.length) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        if (!req.body.videoTitle || !req.body.siteName) {
            return res.status(400).json({ error: 'Video title and site name are required' });
        }

        star.movies[movieIndex] = {
            videoTitle: req.body.videoTitle,
            siteName: req.body.siteName,
            videoUrl: req.body.videoUrl || '',
            previewVideoUrl: req.body.previewVideoUrl || '',
            images: req.body.images || ''
        };

        fs.writeFileSync(DATA_FILE, JSON.stringify(jsonData, null, 2));

        res.json(star.movies[movieIndex]);
    } catch (error) {
        console.error('Error updating movie:', error);
        res.status(500).json({ error: 'Failed to update movie' });
    }
});

function removeStarById(starId) {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const jsonData = JSON.parse(data);
    const starIndex = jsonData.stars.findIndex(star => star.id == starId);

    if (starIndex === -1) {
        return null;
    }

    const removedStar = jsonData.stars.splice(starIndex, 1)[0];
    fs.writeFileSync(DATA_FILE, JSON.stringify(jsonData, null, 2));
    return removedStar;
}

// DELETE - Delete star
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

// DELETE - Delete movie from star
app.delete('/api/stars/:starId/movies/:movieIndex', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);

        const star = jsonData.stars.find(s => s.id == req.params.starId);
        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        const movieIndex = parseInt(req.params.movieIndex, 10);
        if (Number.isNaN(movieIndex) || movieIndex < 0 || movieIndex >= star.movies.length) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        star.movies.splice(movieIndex, 1);
        fs.writeFileSync(DATA_FILE, JSON.stringify(jsonData, null, 2));

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

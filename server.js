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

// DELETE - Delete movie from star
app.delete('/api/stars/:starId/movies/:movieIndex', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const jsonData = JSON.parse(data);

        const star = jsonData.stars.find(s => s.id == req.params.starId);
        if (!star) {
            return res.status(404).json({ error: 'Star not found' });
        }

        star.movies.splice(req.params.movieIndex, 1);
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

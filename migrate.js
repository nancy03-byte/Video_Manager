/**
 * Migration Script: Migrate data from data.json to MongoDB
 * 
 * Usage:
 *   node migrate.js
 * 
 * Make sure to:
 * 1. Create .env file with MONGODB_URI set to your MongoDB connection string
 * 2. Run: npm install (to install dependencies)
 * 3. Run this script: node migrate.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/star-library';
const DATA_FILE = path.join(__dirname, 'data.json');
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/300x400?text=Image+Not+Found';

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('✓ Connected to MongoDB');
}).catch((err) => {
    console.error('✗ MongoDB connection error:', err);
    process.exit(1);
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

async function migrateData() {
    try {
        console.log('\n📦 Starting Migration...\n');

        // Check if data.json exists
        if (!fs.existsSync(DATA_FILE)) {
            console.log('⚠️  data.json not found. Skipping migration.');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Read data.json
        console.log('📖 Reading data.json...');
        const jsonData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const stars = Array.isArray(jsonData?.stars) ? jsonData.stars : [];

        if (stars.length === 0) {
            console.log('⚠️  No stars found in data.json');
            await mongoose.connection.close();
            process.exit(0);
        }

        // Clear existing data
        console.log('🗑️  Clearing existing MongoDB data...');
        await Star.deleteMany({});

        // Migrate stars
        console.log(`📝 Migrating ${stars.length} stars...\n`);

        for (const star of stars) {
            const newStar = new Star({
                id: star.id || Date.now() + Math.floor(Math.random() * 1000000),
                name: normalizeStarName(star.name),
                pictureUrl: normalizeStarName(star.pictureUrl) || PLACEHOLDER_IMAGE,
                movies: star.movies || []
            });

            await newStar.save();
            console.log(`  ✓ ${newStar.name} (${newStar.movies.length} movies)`);
        }

        console.log(`\n✅ Migration completed successfully!`);
        console.log(`   Total stars migrated: ${stars.length}`);
        console.log(`   Total movies: ${stars.reduce((sum, star) => sum + (star.movies?.length || 0), 0)}`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('✗ Migration failed:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Run migration
migrateData();

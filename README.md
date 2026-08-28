# Star Library Application

A small vanilla JavaScript application for managing stars, movies, favorite movies, and image albums.

## Features

### Home Page (`index.html`)
- **Display Stars**: View all stars with their pictures and names
- **Filter by Name**: Use dropdown to filter by specific star
- **Filter by Multiple Selection**: Use checkboxes to select multiple stars
- **Add New Star**: Click "Add Star" button to add new stars with name and picture URL
- **Reset Filters**: Clear all filters to view all stars
- **Favorite Movies**: View movies marked as favorites across all stars

### Star Detail Page (`detail.html`)
- **Star Information**: View detailed information about selected star
- **Movie List**: See all movies associated with the star
- **Video Preview**: YouTube video thumbnails (if video is from YouTube)
- **Watch Links**: Direct links to watch videos on their respective sites
- **Add Movie**: Add new movies with video title, site name, and video URL
- **Album URL**: Fetch image URLs from an optional album page
- **Favorite Movie**: Mark or unmark a movie as a favorite
- **Delete Movie**: Remove movies from the list

### Album Page (`album/album.html`)
- **Album Viewer**: Browse, edit, and download album links
- **Image Favorites**: Mark individual album images as favorites
- **Smart Loading**: Cache album images locally with IndexedDB

## Project Structure

```
├── index.html          # Home page markup
├── script.js           # Home page behavior
├── detail.html         # Star detail markup
├── detail.js           # Star and movie behavior
├── album/              # Album page markup, behavior, and styles
├── styles.css          # Shared page styles
├── image-loader.js     # Shared image loading and URL helpers
├── album-store.js      # IndexedDB image cache
├── server.js           # Express API and static file server
├── data.json           # Local seed data
├── migrate.js          # Optional MongoDB migration script
├── .env.example        # Environment variable template
└── README.md           # Project documentation
```

## Setup & Installation

### Prerequisites
- Node.js installed on your computer ([Download](https://nodejs.org/))

### Installation Steps

1. **Navigate to project folder:**
   ```bash
   cd c:\Users\mayur\Desktop\Video-Manager\video manager\Video_Manager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   
   The server will run at: `http://localhost:3000`

4. **Open the app:**
   - Open your browser and go to `http://localhost:3000`
   - Configure `MONGODB_URI` in a local `.env` file before making changes.

## How to Use

### Adding a Star

1. Click the "**+ Add Star**" button in the top-right corner
2. Enter the star's name and picture URL
3. Click "Add Star" to save
4. Changes are saved to MongoDB when it is available.

### Filtering Stars

1. Use the **"Filter by Name"** dropdown to select a specific star
2. Use **Checkboxes** to filter by multiple stars
3. Click **"Reset Filters"** to clear all filters and view all stars

### Viewing Star Details

1. Click on any star card (image or name) to view their details
2. View the star's information and all associated movies

### Adding Movies

1. On the star detail page, click the "**+ Add Movie**" button
2. Enter:
   - **Video Title**: Name of the movie/video
   - **Site Name**: Where the video is hosted (e.g., YouTube, Netflix)
   - **Video URL**: Direct link to the video
   - **Album URL**: Optional page URL used to extract album image links
3. Click "Add Movie" to save
4. Changes are saved to MongoDB when it is available.

### Deleting Movies

1. On the star detail page, click the "**Delete**" button on any movie card
2. Confirm the deletion
3. Changes are saved to MongoDB when it is available.

## Data Storage

### With MongoDB configured (Recommended)
- All data is saved directly to MongoDB.
- Data persists between sessions
- Set `MONGODB_URI` in `.env`.

### Without MongoDB (Fallback)
- Data is saved to **browser's localStorage**
- Data persists only in that browser
- Data is lost if you clear browser data
- Changes are not synchronized to MongoDB

## Starting & Stopping the Server

### Start Server:
```bash
npm start
```

### Stop Server:
Press `Ctrl + C` in the terminal

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js with Express.js
- **Data Storage**: MongoDB with localStorage fallback
- **API Communication**: Fetch API

## Features Highlights

✨ **Responsive Design**: Works on desktop, tablet, and mobile devices
🎨 **Beautiful UI**: Modern gradient background with smooth animations
🔍 **Advanced Filtering**: Combine dropdown and checkbox filters
📱 **Video Integration**: YouTube thumbnail preview support
💾 **Automatic Saving**: Data automatically saved to MongoDB when configured
🚀 **Fallback Mode**: Works without server (uses localStorage)

## Troubleshooting

### Server won't start
```bash
# Make sure you're in the correct directory
cd c:\Users\mayur\Desktop\Video-Manager\video manager\Video_Manager

# Reinstall dependencies
npm install

# Try starting again
npm start
```

### Port 3000 already in use
```bash
# Edit server.js and change PORT = 3000 to another number like 3001
# Or kill the process using port 3000
```

### Changes not saving
- Make sure MongoDB is reachable and `MONGODB_URI` is set in `.env`.
- Check the browser console for errors (F12 → Console)
- If MongoDB is unavailable, changes save to localStorage only

### Movies not showing
- Make sure MongoDB is reachable
- Restart the server after changing environment variables

## Browser Compatibility

Works on all modern browsers that support:
- ES6 JavaScript
- CSS Grid & Flexbox
- Fetch API
- LocalStorage API

## API Endpoints (Backend)

If you want to integrate with other applications:

- `GET /api/stars` - Get all stars
- `POST /api/stars` - Add new star
- `POST /api/stars/:starId/movies` - Add movie to star
- `DELETE /api/stars/:starId/movies/:movieIndex` - Delete movie

## Future Enhancements

Possible improvements:
- Edit existing stars/movies
- Star ratings and reviews
- Search functionality
- User authentication
- Database integration (MongoDB, MySQL)
- Image upload instead of URLs

---

**Enjoy managing your star library!** ⭐


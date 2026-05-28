# Star Library Application

A web application to manage a library of stars (actors/actresses) and their movies with filtering and search capabilities.

## Features

### Home Page (`index.html`)
- **Display Stars**: View all stars with their pictures and names
- **Filter by Name**: Use dropdown to filter by specific star
- **Filter by Multiple Selection**: Use checkboxes to select multiple stars
- **Add New Star**: Click "Add Star" button to add new stars with name and picture URL
- **Reset Filters**: Clear all filters to view all stars

### Star Detail Page (`detail.html`)
- **Star Information**: View detailed information about selected star
- **Movie List**: See all movies associated with the star
- **Video Preview**: YouTube video thumbnails (if video is from YouTube)
- **Watch Links**: Direct links to watch videos on their respective sites
- **Add Movie**: Add new movies with video title, site name, and video URL
- **Delete Movie**: Remove movies from the list

## Project Structure

```
├── index.html          # Home page
├── detail.html         # Star detail page
├── script.js           # Home page logic
├── detail.js           # Detail page logic
├── styles.css          # All styling
├── server.js           # Backend server (Node.js/Express)
├── package.json        # Project dependencies
├── data.json           # Data storage file
└── README.md           # This file
```

## Setup & Installation

### Prerequisites
- Node.js installed on your computer ([Download](https://nodejs.org/))

### Installation Steps

1. **Navigate to project folder:**
   ```bash
   cd c:\Users\mayur\Desktop\Video-Manager\Video_Manager
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
   - The app will now automatically save all changes to `data.json`

## How to Use

### Adding a Star

1. Click the "**+ Add Star**" button in the top-right corner
2. Enter the star's name and picture URL
3. Click "Add Star" to save
4. ✅ Changes are **automatically saved** to `data.json`

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
3. Click "Add Movie" to save
4. ✅ Changes are **automatically saved** to `data.json`

### Deleting Movies

1. On the star detail page, click the "**Delete**" button on any movie card
2. Confirm the deletion
3. ✅ Changes are **automatically saved** to `data.json`

## Data Storage

### With Server Running ⭐ (Recommended)
- All data is saved directly to **`data.json`**
- Data persists between sessions
- No additional configuration needed

### Without Server Running (Fallback)
- Data is saved to **browser's localStorage**
- Data persists only in that browser
- Data is lost if you clear browser data
- Changes are **NOT** saved to `data.json`

## Starting & Stopping the Server

### Start Server:
```bash
npm start
```

### Stop Server:
Press `Ctrl + C` in the terminal

## Sample Data

The application comes with 3 default stars in `data.json`:
- Tom Hanks (with 2 movies)
- Meryl Streep
- Leonardo DiCaprio (with 1 movie)

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js with Express.js
- **Data Storage**: JSON file
- **API Communication**: Fetch API

## Features Highlights

✨ **Responsive Design**: Works on desktop, tablet, and mobile devices
🎨 **Beautiful UI**: Modern gradient background with smooth animations
🔍 **Advanced Filtering**: Combine dropdown and checkbox filters
📱 **Video Integration**: YouTube thumbnail preview support
💾 **Automatic Saving**: Data automatically saved to `data.json`
🚀 **Fallback Mode**: Works without server (uses localStorage)

## Troubleshooting

### Server won't start
```bash
# Make sure you're in the correct directory
cd c:\Users\mayur\Desktop\Video-Manager\Video_Manager

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

### Changes not saving to data.json
- Make sure the server is running (`npm start`)
- Check the browser console for errors (F12 → Console)
- If server isn't running, changes save to localStorage only

### Movies not showing
- Make sure `data.json` exists in the project folder
- Restart the server after manual edits to `data.json`

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


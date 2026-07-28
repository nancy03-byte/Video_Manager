# Smart Image Loading System

## Overview

This system optimizes image loading for large albums (1GB+) by:

1. **Loading favorites first** - Favorite images load before other album images
2. **Caching in IndexedDB** - Images are stored in the browser for offline access and faster reloads
3. **Sequential loading** - Remaining images load in the background without blocking the UI
4. **Persistent storage** - On page refresh, cached images load immediately while fetching new ones

## Architecture

### Components

#### `album-store.js`
- Core IndexedDB wrapper for persisting image blobs
- Functions:
  - `storeImageBlob(url, blob, batchId)` - Save image blob to storage
  - `getImageBlob(url)` - Retrieve cached blob
  - `hasImageBlob(url)` - Check if image is cached
  - `clearBatch(batchId)` - Clear all images in an album
  - `getBatchSize(batchId)` - Get total cache size for an album
  - `resolveImageUrl(url, batchId)` - Smart URL resolution (cached → network)

#### `image-loader.js`
- High-level smart loading orchestration
- Key functions:
  - `fetchAndCacheImage(url, batchId)` - Fetch & cache a single image
  - `loadImagesSmartly(allImages, favoriteImages, batchId, callbacks)` - Main loading function
  - `getLoadingStatus(urls)` - Check what's cached vs not
  - `getBatchCacheSizeMB(batchId)` - Get cache size in MB

### Flow

```
User opens album
    ↓
renderGrid() - Shows placeholders for all images
    ↓
startSmartImageLoading()
    ├─ Load all favorite images in parallel
    │  └─ Update img src when loaded
    └─ Load other images sequentially
       └─ Update img src when loaded
       └─ Recover from cache on refresh
```

## Usage

### Album Page (`album.html`)

**Initialization** happens automatically in `DOMContentLoaded`:

```javascript
// album.js
document.addEventListener('DOMContentLoaded', async () => {
    // ... data loading ...
    
    // Create batch ID for this album
    batchId = `star_${starId}_movie_${movieIndex}`;
    
    // Track loading state
    imageLoadingState = {};
    loadingProgress = { loaded: 0, total: 0 };
    
    // Render grid with placeholders
    renderGrid();
    
    // Start smart loading
    startSmartImageLoading();
});
```

### Main Page (`index.html`)

Star images load in priority order:
1. Check if cached → use cached blob
2. If not cached → fetch and cache
3. Fall back to original URL if error

```javascript
// script.js - renderStars()
loadStarImagePriority(star.id, star.pictureUrl, starCard);
```

## Image Flow for Albums

### First Visit
```
Album loads (all images marked as 'loading')
    ↓
Favorites load (parallel) → img.src = blob URL → loading indicator removed
    ↓
Others load (sequential) → img.src = blob URL → loading indicator removed
    ↓
All images cached in IndexedDB
```

### Second Visit (Page Refresh)
```
Album loads (all images marked as 'loading')
    ↓
Check IndexedDB for each image
    ↓
Cached images appear immediately with blob URLs
    ↓
Background: Fetch any new/updated images
```

## Browser Storage

### IndexedDB Schema
```javascript
Database: AlbumImagesDB
Store: albumImages
Keys: url (primary), batchId (index), timestamp (index)

Record: {
    url: "https://example.com/image.jpg",
    blob: Blob(...),
    timestamp: 1234567890,
    batchId: "star_5_movie_2"
}
```

### Storage Limits
- Most browsers: 50-80% of available disk space
- Typical: 50GB+ on desktop, 10GB+ on mobile
- No single-entry size limit

### Cleanup
```javascript
// Clear all images for an album
await clearBatch(`star_${starId}_movie_${movieIndex}`);

// Clear all cached images
await clearAll();

// Check size
const sizeInMB = await getBatchCacheSizeMB(batchId);
```

## Loading States

Each image has a state tracked in `imageLoadingState`:

```javascript
'loading'  → Image fetch in progress
'loaded'   → Image successfully loaded
'cached'   → Image retrieved from IndexedDB
'error'    → Image failed to load
```

UI updates automatically:
- **Loading**: Spinner indicator visible
- **Loaded**: Loading indicator removed
- **Error**: Warning icon displayed

## Progress Tracking

Access loading progress at any time:

```javascript
// In loadImagesSmartly callbacks
onProgress: ({ loaded, total, isFavorite }) => {
    console.log(`${loaded}/${total} images loaded`);
    console.log(`Priority: ${isFavorite ? 'favorites' : 'others'}`);
}
```

Current progress stored in:
```javascript
loadingProgress = { loaded: 0, total: 0 }
```

## Performance

### Benefits
- **Favorites fast**: Prioritize starred images (usually < 5% of album)
- **Offline-ready**: Cached images work without network
- **Resume on refresh**: No need to re-download
- **Large albums**: 1GB+ handled without memory issues

### Example
- 1000 image album (1GB total)
- 50 favorites
- First load: Favorites appear in ~2s, rest load in background
- Refresh: All cached images appear instantly
- Next session: Favorites prioritized, others background

## API Reference

### loadImagesSmartly()
```javascript
await loadImagesSmartly(
    allImages,      // string[] - all URLs
    favoriteImages, // string[] - subset of all images
    batchId,        // string - album identifier
    {
        onFavoriteLoaded: (result) => {},  // called for each favorite
        onImageLoaded: (result) => {},     // called for each non-favorite
        onProgress: (status) => {},        // periodic updates
        onError: (error) => {}             // called on failures
    }
);
```

### Result Objects
```javascript
{
    url: "https://...",     // image URL
    blob: Blob | null,      // fetched blob (null if error)
    cached: boolean,        // was image from cache?
    error?: string,         // error message if failed
}
```

## Customization

### Change batch ID format
```javascript
// Default: `star_${starId}_movie_${movieIndex}`
// Custom: `album_${year}_${month}`
batchId = `album_2024_03`;
```

### Adjust loading order
```javascript
// In image-loader.js, loadImagesSmartly()
// Modify favoriteImages separation logic to use custom priority
```

### Add progress bar
```javascript
// In album.js, updateLoadingProgress()
const percent = (loaded / total) * 100;
progressBar.style.width = percent + '%';
```

## Troubleshooting

### Images not loading
1. Check browser console for errors
2. Verify URLs are accessible
3. Check IndexedDB quota with DevTools
4. Test with `clearAll()` to reset cache

### Slow loading
1. Check network bandwidth
2. Reduce image sizes on server
3. Limit concurrent requests (currently unlimited)
4. Check system storage space

### Storage full
```javascript
// Check all batches
const allBatches = await getAllBatchSizes();
// Clear old batches
await clearBatch('star_1_movie_5');
```

## Integration with Detail Page

The detail page (`detail.html`) can also benefit from smart loading when previewing albums:

```javascript
// Load thumbnail from cache
const thumb = await getImageBlob(firstAlbumImage);
if (thumb) {
    movieCard.style.backgroundImage = `url(${URL.createObjectURL(thumb)})`;
}
```

## Future Enhancements

- [ ] Implement image compression before caching
- [ ] Add manual cache management UI
- [ ] Progressive image loading (blur→sharp)
- [ ] Batch parallel loading limits
- [ ] Cache expiration policies
- [ ] Sync cache across tabs
- [ ] Background sync for updates

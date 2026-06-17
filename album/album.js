// ── Album Viewer, Editor & Slideshow Manager ──────────────────────────────
// URL params: starId, movieIndex
// Uses albumImages + favoriteImages from the movie record

const API_URL = '/api';

// ── Cache ─────────────────────────────────────────────────────────────────
const ALBUM_CACHE = {
  data: null,
  timestamp: 0,
  staleAge: 30_000,
};

function getAlbumCached() {
  if (ALBUM_CACHE.data && (Date.now() - ALBUM_CACHE.timestamp) < ALBUM_CACHE.staleAge) {
    return ALBUM_CACHE.data;
  }
  return null;
}

function setAlbumCache(data) {
  ALBUM_CACHE.data = data;
  ALBUM_CACHE.timestamp = Date.now();
}

// ── State ─────────────────────────────────────────────────────────────────
let star = null;
let movie = null;
let movieIndex = -1;
let starId = 0;
let images = [];           // all album image URLs
let favoriteImages = [];   // URLs flagged as favorites
let starsData = [];

// Slideshow state
let slideshowTimer = null;
let slideshowCurrent = 0;
let slideshowPlaying = false;

// DOM refs
const albumGrid = document.getElementById('albumGrid');
const albumTitle = document.getElementById('albumTitle');
const albumBackBtn = document.getElementById('albumBackBtn');
const albumColumnsSelect = document.getElementById('albumColumnsSelect');
const albumSlideshowBtn = document.getElementById('albumSlideshowBtn');
const editRawUrlsBtn = document.getElementById('editRawUrlsBtn');

// Lightbox
const lightbox = document.getElementById('albumLightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCounter = document.getElementById('lightboxCounter');
let lightboxIndex = -1;

// Edit Raw Modal
const editRawModal = document.getElementById('editRawModal');
const closeRawModal = document.getElementById('closeRawModal');
const editRawForm = document.getElementById('editRawForm');
const rawAlbumUrls = document.getElementById('rawAlbumUrls');

// Slideshow
const slideshowEl = document.getElementById('albumSlideshow');
const slideshowClose = document.getElementById('slideshowClose');
const slideshowImage = document.getElementById('slideshowImage');
const slideshowPrev = document.getElementById('slideshowPrev');
const slideshowNext = document.getElementById('slideshowNext');
const slideshowPlayPause = document.getElementById('slideshowPlayPause');
const slideshowCounter = document.getElementById('slideshowCounter');

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    starId = Number(params.get('starId'));
    movieIndex = Number(params.get('movieIndex'));

    if (!starId || isNaN(movieIndex)) {
        albumGrid.innerHTML = '<div class="empty-state"><p>Invalid album link.</p></div>';
        return;
    }

    await loadData();
    if (!star || !star.movies[movieIndex]) {
        albumGrid.innerHTML = '<div class="empty-state"><p>Movie not found.</p></div>';
        return;
    }

    movie = star.movies[movieIndex];
    albumTitle.textContent = `${movie.videoTitle || 'Album'} — Album`;

    // Load images from albumImages (fall back to images)
    const rawImages = splitCommaSeparated(movie.albumImages || movie.images || '');
    images = rawImages;
    favoriteImages = splitCommaSeparated(movie.favoriteImages || '');

    if (images.length === 0) {
        albumGrid.innerHTML = '<div class="empty-state"><p>No images for this movie.</p></div>';
        return;
    }

    // Restore column preference
    const savedCols = localStorage.getItem('albumColumns') || '4';
    albumColumnsSelect.value = savedCols;
    albumColumnsSelect.addEventListener('change', () => {
        const cols = albumColumnsSelect.value;
        albumGrid.style.setProperty('--album-cols', cols);
        localStorage.setItem('albumColumns', cols);
    });
    albumGrid.style.setProperty('--album-cols', savedCols);

    // Back button
    albumBackBtn.addEventListener('click', () => {
        window.location.href = `../detail.html?starId=${starId}`;
    });

    // Edit raw URLs
    editRawUrlsBtn.addEventListener('click', openEditRawModal);
    closeRawModal.addEventListener('click', () => editRawModal.classList.remove('show'));
    editRawForm.addEventListener('submit', handleEditRawSave);
    window.addEventListener('click', (e) => {
        if (e.target === editRawModal) editRawModal.classList.remove('show');
    });

    // Slideshow
    albumSlideshowBtn.addEventListener('click', launchSlideshow);
    slideshowClose.addEventListener('click', closeSlideshow);
    slideshowPrev.addEventListener('click', slideshowGoPrev);
    slideshowNext.addEventListener('click', slideshowGoNext);
    slideshowPlayPause.addEventListener('click', toggleSlideshowPlay);
    document.addEventListener('keydown', handleKeydown);

    // Lightbox
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', showPrevLightbox);
    lightboxNext.addEventListener('click', showNextLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    renderGrid();
});

// ── Data Loading ──────────────────────────────────────────────────────────

async function loadData() {
    const cached = getAlbumCached();
    if (cached) {
        starsData = cached;
        star = starsData.find(s => s.id === starId);
        return;
    }

    const saved = localStorage.getItem('starsData');
    if (saved) {
        try {
            starsData = JSON.parse(saved);
            setAlbumCache(starsData);
            star = starsData.find(s => s.id === starId);
            if (star) return;
        } catch (_) {}
    }

    try {
        const res = await fetch(`${API_URL}/stars`);
        if (res.ok) {
            starsData = await res.json();
            setAlbumCache(starsData);
            localStorage.setItem('starsData', JSON.stringify(starsData));
            star = starsData.find(s => s.id === starId);
            return;
        }
    } catch (_) {}

    try {
        const res = await fetch('../data.json');
        const data = await res.json();
        starsData = data.stars || [];
        setAlbumCache(starsData);
        star = starsData.find(s => s.id === starId);
    } catch (_) {
        starsData = [];
    }
}

function splitCommaSeparated(value) {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
}

// ── Persistence ───────────────────────────────────────────────────────────

async function saveAlbumData() {
    // Update in-memory
    if (star && movieIndex >= 0) {
        star.movies[movieIndex].albumImages = images.join(',');
        star.movies[movieIndex].favoriteImages = favoriteImages.join(',');
    }

    // Sync to localStorage
    localStorage.setItem('starsData', JSON.stringify(starsData));

    // Sync to server
    try {
        await fetch(`${API_URL}/stars/${starId}/movies/${movieIndex}/album`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                albumImages: images.join(','),
                favoriteImages: favoriteImages.join(',')
            })
        });
    } catch (_) {
        // Offline is fine — localStorage is updated
    }
}

// ── Grid Rendering ────────────────────────────────────────────────────────

function renderGrid() {
    albumGrid.innerHTML = '';

    images.forEach((url, index) => {
        const isFavorite = favoriteImages.includes(url);
        const item = document.createElement('div');
        item.className = 'album-item';
        item.dataset.index = index;

        // Image
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Image ${index + 1}`;
        img.loading = 'lazy';

        img.onload = () => {
            if (img.naturalWidth > img.naturalHeight) {
                item.classList.add('item-landscape');
            } else if (img.naturalHeight > img.naturalWidth) {
                item.classList.add('item-portrait');
            } else {
                item.classList.add('item-square');
            }
        };

        img.onclick = () => openLightbox(index);

        // Overlay with actions
        const overlay = document.createElement('div');
        overlay.className = 'album-item-overlay';

        // Favorite toggle
        const favBtn = document.createElement('button');
        favBtn.className = `album-fav-btn${isFavorite ? ' is-favorite' : ''}`;
        favBtn.innerHTML = isFavorite ? '❤️' : '🤍';
        favBtn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(index);
        });
        overlay.appendChild(favBtn);

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'album-del-btn';
        delBtn.innerHTML = '🗑';
        delBtn.title = 'Delete image';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteImage(index);
        });
        overlay.appendChild(delBtn);

        // Upload new image button (placed on each item for per-position upload)
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'album-upload-btn';
        uploadBtn.innerHTML = '⬆';
        uploadBtn.title = 'Upload image here';
        uploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            addImage(index);
        });
        overlay.appendChild(uploadBtn);

        // Index label
        const idxLabel = document.createElement('span');
        idxLabel.className = 'album-idx-label';
        idxLabel.textContent = `${index + 1}`;
        overlay.appendChild(idxLabel);

        item.appendChild(img);
        item.appendChild(overlay);
        albumGrid.appendChild(item);
    });

    // Add-image button at the end
    const addItem = document.createElement('div');
    addItem.className = 'album-item album-add-item';
    addItem.innerHTML = `
        <div class="album-add-placeholder">
            <span class="album-add-icon">+</span>
            <span class="album-add-text">Add Image</span>
        </div>
    `;
    addItem.addEventListener('click', () => addImage());
    albumGrid.appendChild(addItem);

    updateSlideshowButton();
}

// ── Favorite Toggle ───────────────────────────────────────────────────────

function toggleFavorite(index) {
    const url = images[index];
    if (!url) return;

    const pos = favoriteImages.indexOf(url);
    if (pos >= 0) {
        favoriteImages.splice(pos, 1);
    } else {
        favoriteImages.push(url);
    }

    saveAlbumData();
    renderGrid();
}

// ── Delete Image ──────────────────────────────────────────────────────────

function deleteImage(index) {
    if (!confirm(`Delete image ${index + 1}?`)) return;
    const url = images[index];
    images.splice(index, 1);

    // Also remove from favorites
    const favPos = favoriteImages.indexOf(url);
    if (favPos >= 0) favoriteImages.splice(favPos, 1);

    saveAlbumData();
    renderGrid();
}

// ── Add Image ─────────────────────────────────────────────────────────────

function addImage(afterIndex) {
    const url = prompt('Enter image URL:');
    if (!url || !url.trim()) return;

    const trimmed = url.trim();
    if (typeof afterIndex === 'number') {
        images.splice(afterIndex + 1, 0, trimmed);
    } else {
        images.push(trimmed);
    }

    saveAlbumData();
    renderGrid();
}

// ── Edit Raw URLs ─────────────────────────────────────────────────────────

function openEditRawModal() {
    rawAlbumUrls.value = images.join(',\n');
    editRawModal.classList.add('show');
}

function handleEditRawSave(e) {
    e.preventDefault();
    const raw = rawAlbumUrls.value;
    images = splitCommaSeparated(raw);

    // Clean up favorites — remove any that no longer exist
    favoriteImages = favoriteImages.filter(url => images.includes(url));

    saveAlbumData();
    editRawModal.classList.remove('show');
    renderGrid();
}

// ── Lightbox ──────────────────────────────────────────────────────────────

function openLightbox(index) {
    lightboxIndex = index;
    updateLightboxImage();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    lightboxIndex = -1;
}

function showPrevLightbox() {
    if (images.length === 0) return;
    lightboxIndex = (lightboxIndex - 1 + images.length) % images.length;
    updateLightboxImage();
}

function showNextLightbox() {
    if (images.length === 0) return;
    lightboxIndex = (lightboxIndex + 1) % images.length;
    updateLightboxImage();
}

function updateLightboxImage() {
    if (lightboxIndex < 0 || lightboxIndex >= images.length) return;
    lightboxImage.src = images[lightboxIndex];
    lightboxImage.alt = `Image ${lightboxIndex + 1}`;
    const multi = images.length > 1;
    lightboxPrev.style.display = multi ? '' : 'none';
    lightboxNext.style.display = multi ? '' : 'none';
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${images.length}`;
}

// ── Slideshow ─────────────────────────────────────────────────────────────

function launchSlideshow() {
    // Only cycle through favorites
    const slides = getFavoritesForSlideshow();
    if (slides.length === 0) {
        alert('No favorite images to show. Click the heart icons on images to mark them as favorites first.');
        return;
    }

    slideshowCurrent = 0;
    slideshowPlaying = true;
    showSlideshowImage(slides);
    startSlideshowTimer(slides);
    slideshowEl.classList.add('active');
    document.body.style.overflow = 'hidden';
    slideshowPlayPause.textContent = '⏸ Pause';
}

function getFavoritesForSlideshow() {
    // Only return images that are in the favorites list
    return images.filter(url => favoriteImages.includes(url));
}

function showSlideshowImage(slides) {
    if (slides.length === 0) return;
    slideshowImage.src = slides[slideshowCurrent];
    slideshowImage.alt = `Slide ${slideshowCurrent + 1}`;
    slideshowCounter.textContent = `${slideshowCurrent + 1} / ${slides.length}`;
}

function startSlideshowTimer(slides) {
    stopSlideshowTimer();
    if (slides.length <= 1) return;
    slideshowTimer = setInterval(() => {
        if (!slideshowPlaying) return;
        slideshowCurrent = (slideshowCurrent + 1) % slides.length;
        showSlideshowImage(slides);
    }, 3000);
}

function stopSlideshowTimer() {
    if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
    }
}

function closeSlideshow() {
    slideshowEl.classList.remove('active');
    document.body.style.overflow = '';
    stopSlideshowTimer();
    slideshowPlaying = false;
}

function slideshowGoPrev() {
    const slides = getFavoritesForSlideshow();
    if (slides.length === 0) return;
    slideshowCurrent = (slideshowCurrent - 1 + slides.length) % slides.length;
    showSlideshowImage(slides);
    if (slideshowPlaying) {
        stopSlideshowTimer();
        startSlideshowTimer(slides);
    }
}

function slideshowGoNext() {
    const slides = getFavoritesForSlideshow();
    if (slides.length === 0) return;
    slideshowCurrent = (slideshowCurrent + 1) % slides.length;
    showSlideshowImage(slides);
    if (slideshowPlaying) {
        stopSlideshowTimer();
        startSlideshowTimer(slides);
    }
}

function toggleSlideshowPlay() {
    slideshowPlaying = !slideshowPlaying;
    slideshowPlayPause.textContent = slideshowPlaying ? '⏸ Pause' : '▶ Play';
    const slides = getFavoritesForSlideshow();
    if (slideshowPlaying) {
        startSlideshowTimer(slides);
    } else {
        stopSlideshowTimer();
    }
}

function updateSlideshowButton() {
    const favoritesCount = getFavoritesForSlideshow().length;
    albumSlideshowBtn.textContent = favoritesCount > 0
        ? `▶ Launch Slideshow (${favoritesCount})`
        : '▶ Launch Slideshow';
}

// ── Keyboard Handling ─────────────────────────────────────────────────────

function handleKeydown(e) {
    // Slideshow keys take priority
    if (slideshowEl.classList.contains('active')) {
        if (e.key === 'Escape') { closeSlideshow(); return; }
        if (e.key === 'ArrowLeft') { slideshowGoPrev(); return; }
        if (e.key === 'ArrowRight') { slideshowGoNext(); return; }
        if (e.key === ' ') { e.preventDefault(); toggleSlideshowPlay(); return; }
    }

    // Lightbox keys
    if (lightbox.classList.contains('active')) {
        if (e.key === 'Escape') { closeLightbox(); return; }
        if (e.key === 'ArrowLeft') { showPrevLightbox(); return; }
        if (e.key === 'ArrowRight') { showNextLightbox(); return; }
    }
}

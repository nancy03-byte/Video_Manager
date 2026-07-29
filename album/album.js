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
let albumControlsBound = false;

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
const viewFavoritesLinksBtn = document.getElementById('viewFavoritesLinksBtn');
const blurToggleBtn = document.getElementById('blurToggleBtn');
const addWebpageBtn = document.getElementById('addWebpageBtn');
const addWebpageModal = document.getElementById('addWebpageModal');
const closeWebpageModal = document.getElementById('closeWebpageModal');
const addWebpageForm = document.getElementById('addWebpageForm');
const webpageLinksInput = document.getElementById('webpageLinksInput');

// Lightbox
const lightbox = document.getElementById('albumLightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxFrame = document.getElementById('lightboxFrame');
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
const favoritesLinksModal = document.getElementById('favoritesLinksModal');
const closeFavoritesLinksModal = document.getElementById('closeFavoritesLinksModal');
const favoritesLinksText = document.getElementById('favoritesLinksText');

// Slideshow
const slideshowEl = document.getElementById('albumSlideshow');
const slideshowClose = document.getElementById('slideshowClose');
const slideshowImage = document.getElementById('slideshowImage');
const slideshowPrev = document.getElementById('slideshowPrev');
const slideshowNext = document.getElementById('slideshowNext');
const slideshowPlayPause = document.getElementById('slideshowPlayPause');
const slideshowCounter = document.getElementById('slideshowCounter');

// ── Favorites Strip DOM ──────────────────────────────────────────────────
const favoritesStrip = document.getElementById('favoritesStrip');
const favoritesStripItems = document.getElementById('favoritesStripItems');
const favoritesStripCount = document.getElementById('favoritesStripCount');

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    initBlurToggle();
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
    images = rawImages.map(normalizeAlbumEntry).filter(Boolean);
    favoriteImages = splitCommaSeparated(movie.favoriteImages || '');

    bindAlbumControls();

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

    renderGrid();
});

function bindAlbumControls() {
    if (albumControlsBound) return;

    editRawUrlsBtn.addEventListener('click', openEditRawModal);
    closeRawModal.addEventListener('click', () => editRawModal.classList.remove('show'));
    editRawForm.addEventListener('submit', handleEditRawSave);
    viewFavoritesLinksBtn.addEventListener('click', openFavoritesLinksModal);
    closeFavoritesLinksModal.addEventListener('click', () => favoritesLinksModal.classList.remove('show'));
    window.addEventListener('click', (e) => {
        if (e.target === editRawModal) editRawModal.classList.remove('show');
        if (e.target === favoritesLinksModal) favoritesLinksModal.classList.remove('show');
    });

    addWebpageBtn.addEventListener('click', () => {
        webpageLinksInput.value = '';
        addWebpageModal.classList.add('show');
    });
    closeWebpageModal.addEventListener('click', () => addWebpageModal.classList.remove('show'));
    addWebpageForm.addEventListener('submit', handleAddWebpageLinks);
    window.addEventListener('click', (e) => {
        if (e.target === addWebpageModal) addWebpageModal.classList.remove('show');
    });

    albumSlideshowBtn.addEventListener('click', launchSlideshow);
    slideshowClose.addEventListener('click', closeSlideshow);
    slideshowPrev.addEventListener('click', slideshowGoPrev);
    slideshowNext.addEventListener('click', slideshowGoNext);
    slideshowPlayPause.addEventListener('click', toggleSlideshowPlay);
    document.addEventListener('keydown', handleKeydown);

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', showPrevLightbox);
    lightboxNext.addEventListener('click', showNextLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    albumControlsBound = true;
}

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

function initBlurToggle() {
    const savedState = localStorage.getItem('blurMode') === 'on';
    applyBlur(savedState);
    blurToggleBtn?.addEventListener('click', () => {
        applyBlur(!document.body.classList.contains('blur-active'));
    });
}

function applyBlur(enabled) {
    document.body.classList.toggle('blur-active', enabled);
    if (blurToggleBtn) {
        blurToggleBtn.textContent = enabled ? 'Blur On' : 'Blur Off';
    }
    localStorage.setItem('blurMode', enabled ? 'on' : 'off');
}

function splitCommaSeparated(value) {
    if (!value) return [];
    return String(value)
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);
}

function extractImageUrlsFromHtml(html) {
    if (!html) return [];
    const urls = [];
    const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
        const src = match[1].trim();
        if (src) urls.push(src);
    }
    return urls;
}

function normalizeOriginalCandidate(url) {
    if (!url) return null;
    if (url.includes('vipr')) {
        return url.replace('/th/', '/i/');
    }
    if (url.includes('imx')) {
        return url.replace('/t/', '/i/');
    }
    return url;
}

async function resolveOriginalImageUrl(pageUrl) {
    const normalized = normalizeOriginalCandidate(pageUrl);
    if (!normalized) return null;

    try {
        const response = await fetch(`/api/proxy?url=${encodeURIComponent(pageUrl)}`);
        if (!response.ok) return normalized;
        const html = await response.text();
        const urls = extractImageUrlsFromHtml(html);
        for (const url of urls) {
            const candidate = normalizeOriginalCandidate(url);
            if (candidate) {
                return candidate;
            }
        }
        return normalized;
    } catch (_) {
        return normalized;
    }
}

function isWebpageEntry(entry) {
    return typeof entry === 'string' && entry.startsWith('webpage:');
}

function getEntryValue(entry) {
    if (isWebpageEntry(entry)) {
        return entry.replace(/^webpage:/, '');
    }
    return entry;
}

function normalizeAlbumEntry(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('webpage:')) return trimmed;

    if (trimmed.includes('<a') && trimmed.includes('<img')) {
        return extractImageUrlsFromHtml(trimmed).map((src) => src.trim()).filter(Boolean);
    }

    const isLikelyWebpage = /^https?:\/\//i.test(trimmed) && !/\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:[?#].*)?$/i.test(trimmed);
    return isLikelyWebpage ? `webpage:${trimmed}` : trimmed;
}

function formatAlbumEntryForInput(entry) {
    return getEntryValue(entry);
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

    images.forEach((entry, index) => {
        const url = getEntryValue(entry);
        const isFavorite = favoriteImages.includes(entry);
        const isWebpage = isWebpageEntry(entry);
        const item = document.createElement('div');
        item.className = `album-item${isWebpage ? ' album-webpage-item' : ''}`;
        item.dataset.index = index;

        let mediaEl = null;

        if (isWebpage) {
            mediaEl = document.createElement('iframe');
            mediaEl.src = url;
            mediaEl.title = `Webpage ${index + 1}`;
            mediaEl.loading = 'lazy';
            mediaEl.setAttribute('referrerpolicy', 'no-referrer');
        } else {
            mediaEl = document.createElement('img');
            mediaEl.src = url;
            mediaEl.alt = `Image ${index + 1}`;
            mediaEl.loading = 'lazy';

            mediaEl.onload = () => {
                if (mediaEl.naturalWidth > mediaEl.naturalHeight) {
                    item.classList.add('item-landscape');
                } else if (mediaEl.naturalHeight > mediaEl.naturalWidth) {
                    item.classList.add('item-portrait');
                } else {
                    item.classList.add('item-square');
                }
            };
        }

        // Click on item itself opens lightbox
        item.onclick = (e) => {
            // Only open lightbox if not clicking a button in the overlay
            if (!e.target.closest('.album-fav-btn') && !e.target.closest('.album-del-btn') && !e.target.closest('.album-upload-btn') && !e.target.closest('.album-original-btn')) {
                openLightbox(index);
            }
        };

        // Overlay with actions
        const overlay = document.createElement('div');
        overlay.className = 'album-item-overlay';

        // Original image button
        const originalBtn = document.createElement('button');
        originalBtn.className = 'album-original-btn';
        originalBtn.innerHTML = '🔎';
        originalBtn.title = 'Open original image in viewer';
        originalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openOriginalImageInLightbox(index);
        });
        overlay.appendChild(originalBtn);

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

        item.appendChild(mediaEl);
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

    renderFavoritesStrip();
    updateSlideshowButton();
}

// ── Favorites Strip Rendering ─────────────────────────────────────────────

function handleAddWebpageLinks(e) {
    e.preventDefault();
    const raw = webpageLinksInput.value;
    if (!raw || !raw.trim()) return;

    const parsedEntries = splitCommaSeparated(raw)
        .flatMap((value) => normalizeAlbumEntry(value))
        .filter(Boolean);

    if (parsedEntries.length === 0) return;

    images = images.concat(parsedEntries);
    saveAlbumData();
    addWebpageModal.classList.remove('show');
    renderGrid();
}

function renderFavoritesStrip() {
    favoritesStripItems.innerHTML = '';

    if (favoriteImages.length === 0) {
        favoritesStrip.hidden = true;
        return;
    }

    favoritesStrip.hidden = false;
    favoritesStripCount.textContent = favoriteImages.length;

    favoriteImages.forEach((favoriteEntry, idx) => {
        const item = document.createElement('div');
        item.className = 'favorites-strip-item';

        const entry = favoriteEntry;
        const url = getEntryValue(entry);
        const isWebpage = isWebpageEntry(entry);
        const img = document.createElement(isWebpage ? 'iframe' : 'img');
        if (isWebpage) {
            img.src = url;
            img.title = `Favorite ${idx + 1}`;
            img.setAttribute('referrerpolicy', 'no-referrer');
        } else {
            img.src = url;
            img.alt = `Favorite ${idx + 1}`;
            img.loading = 'lazy';
        }

        // Click on the image opens the lightbox at the corresponding grid index
        const gridIndex = images.indexOf(entry);
        item.addEventListener('click', () => {
            if (gridIndex >= 0) openLightbox(gridIndex);
        });

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'favorites-strip-remove';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove from favorites';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (gridIndex >= 0) {
                const pos = favoriteImages.indexOf(entry);
                if (pos >= 0) favoriteImages.splice(pos, 1);
                saveAlbumData();
                renderGrid();
            }
        });

        item.appendChild(img);
        item.appendChild(removeBtn);
        favoritesStripItems.appendChild(item);
    });
}

// ── Favorite Toggle ───────────────────────────────────────────────────────

function toggleFavorite(index) {
    const entry = images[index];
    if (!entry) return;

    const pos = favoriteImages.indexOf(entry);
    if (pos >= 0) {
        favoriteImages.splice(pos, 1);
    } else {
        favoriteImages.push(entry);
    }

    saveAlbumData();
    renderGrid();
}

// ── Delete Image ──────────────────────────────────────────────────────────

function deleteImage(index) {
    if (!confirm(`Delete item ${index + 1}?`)) return;
    const entry = images[index];
    images.splice(index, 1);

    // Also remove from favorites
    const favPos = favoriteImages.indexOf(entry);
    if (favPos >= 0) favoriteImages.splice(favPos, 1);

    saveAlbumData();
    renderGrid();
}

// ── Add Image ─────────────────────────────────────────────────────────────

function addImage(afterIndex) {
    const url = prompt('Enter image URL or webpage URL:');
    if (!url || !url.trim()) return;

    const trimmed = normalizeAlbumEntry(url.trim());
    if (!trimmed) return;

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
    rawAlbumUrls.value = images.map(formatAlbumEntryForInput).join('\n');
    editRawModal.classList.add('show');
}

function openFavoritesLinksModal() {
    favoritesLinksText.value = favoriteImages.map((entry) => getEntryValue(entry)).join('\n');
    favoritesLinksModal.classList.add('show');
}

function handleEditRawSave(e) {
    e.preventDefault();
    const raw = rawAlbumUrls.value;
    images = splitCommaSeparated(raw).map(normalizeAlbumEntry).filter(Boolean);

    // Clean up favorites — remove any that no longer exist
    favoriteImages = favoriteImages.filter(url => images.includes(url));

    saveAlbumData();
    editRawModal.classList.remove('show');
    renderGrid();
}

// ── Lightbox ──────────────────────────────────────────────────────────────

function refreshLightboxCounter() {
    const multi = images.length > 1;
    lightboxPrev.style.display = multi ? '' : 'none';
    lightboxNext.style.display = multi ? '' : 'none';
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${images.length}`;
}

function openLightbox(index) {
    lightboxIndex = index;
    updateLightboxImage();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function openOriginalImageInLightbox(index) {
    if (index < 0 || index >= images.length) return;

    lightboxIndex = index;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    refreshLightboxCounter();

    const entry = images[index];
    const src = getEntryValue(entry);

    if (!lightboxImage) return;

    lightboxImage.hidden = false;
    lightboxImage.alt = 'Original image';
    lightboxImage.src = '';

    resolveOriginalImageUrl(src)
        .then((originalUrl) => {
            if (lightboxIndex !== index) return;
            lightboxImage.src = originalUrl || src;
        })
        .catch(() => {
            if (lightboxIndex === index) {
                lightboxImage.src = src;
            }
        });
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
    const entry = images[lightboxIndex];
    const isWebpage = isWebpageEntry(entry);
    const src = getEntryValue(entry);
    if (isWebpage) {
        lightboxImage.hidden = true;
        lightboxFrame.hidden = false;
        lightboxFrame.src = src;
        lightboxFrame.title = `Webpage ${lightboxIndex + 1}`;
    } else {
        lightboxImage.hidden = false;
        lightboxFrame.hidden = true;
        lightboxFrame.src = '';
        lightboxImage.src = src;
        lightboxImage.alt = `Image ${lightboxIndex + 1}`;
    }
    refreshLightboxCounter();
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

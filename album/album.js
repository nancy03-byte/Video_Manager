// ── Album Viewer ──────────────────────────────────────────────────────────
// URL params: starId, movieIndex
// images are read from localStorage starsData -> star[starId] -> movies[movieIndex] -> images

const API_URL = '/api';

// DOM refs
const albumGrid = document.getElementById('albumGrid');
const albumTitle = document.getElementById('albumTitle');
const albumBackBtn = document.getElementById('albumBackBtn');
const albumColumnsSelect = document.getElementById('albumColumnsSelect');
const lightbox = document.getElementById('albumLightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');
const lightboxCounter = document.getElementById('lightboxCounter');

let images = [];
let currentImageIndex = -1;

// ── Init ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const starId = Number(params.get('starId'));
    const movieIndex = Number(params.get('movieIndex'));

    if (!starId || isNaN(movieIndex)) {
        albumGrid.innerHTML = '<div class="empty-state"><p>Invalid album link.</p></div>';
        return;
    }

    // Load data
    let starsData = await loadStarsData();
    const star = starsData.find(s => s.id === starId);
    if (!star || !star.movies[movieIndex]) {
        albumGrid.innerHTML = '<div class="empty-state"><p>Movie not found.</p></div>';
        return;
    }

    const movie = star.movies[movieIndex];
    albumTitle.textContent = movie.videoTitle || 'Album';

    // Parse images
    images = splitCommaSeparated(movie.images);
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

    // Render grid
    renderGrid();

    // Lightbox events
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', showPrev);
    lightboxNext.addEventListener('click', showNext);
    document.addEventListener('keydown', handleKeydown);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
});

// ── Data Loading ──────────────────────────────────────────────────────────

async function loadStarsData() {
    try {
        const res = await fetch(`${API_URL}/stars`);
        if (res.ok) return await res.json();
    } catch (_) { /* fall through */ }

    const saved = localStorage.getItem('starsData');
    if (saved) return JSON.parse(saved);

    try {
        const res = await fetch('../data.json');
        const data = await res.json();
        return data.stars || [];
    } catch (_) {
        return [];
    }
}

function splitCommaSeparated(value) {
    if (!value) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
}

// ── Grid Rendering ────────────────────────────────────────────────────────

function renderGrid() {
    albumGrid.innerHTML = '';

    images.forEach((url, index) => {
        const item = document.createElement('div');
        item.className = 'album-item';

        // Determine image orientation on load
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Image ${index + 1}`;
        img.loading = 'lazy';

        img.onload = () => {
            // Set orientation class based on natural dimensions
            if (img.naturalWidth > img.naturalHeight) {
                img.classList.add('img-landscape');
                item.classList.add('item-landscape');
            } else if (img.naturalHeight > img.naturalWidth) {
                img.classList.add('img-portrait');
                item.classList.add('item-portrait');
            } else {
                img.classList.add('img-square');
                item.classList.add('item-square');
            }
        };

        img.onclick = () => openLightbox(index);

        item.appendChild(img);
        albumGrid.appendChild(item);
    });
}

// ── Lightbox ──────────────────────────────────────────────────────────────

function openLightbox(index) {
    currentImageIndex = index;
    updateLightboxImage();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    currentImageIndex = -1;
}

function showPrev() {
    if (images.length === 0) return;
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
    updateLightboxImage();
}

function showNext() {
    if (images.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % images.length;
    updateLightboxImage();
}

function updateLightboxImage() {
    if (currentImageIndex < 0 || currentImageIndex >= images.length) return;

    lightboxImage.src = images[currentImageIndex];
    lightboxImage.alt = `Image ${currentImageIndex + 1}`;

    // Show/hide nav buttons based on image count
    const multi = images.length > 1;
    lightboxPrev.style.display = multi ? '' : 'none';
    lightboxNext.style.display = multi ? '' : 'none';

    // Update counter with glass effect styling
    lightboxCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
}

function handleKeydown(e) {
    if (!lightbox.classList.contains('active')) return;

    if (e.key === 'Escape') {
        closeLightbox();
    } else if (e.key === 'ArrowLeft') {
        showPrev();
    } else if (e.key === 'ArrowRight') {
        showNext();
    }
}

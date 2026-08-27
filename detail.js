// ── Shared Cache ─────────────────────────────────────────────────────
const DETAIL_CACHE = {
  data: null,
  timestamp: 0,
  staleAge: 30_000,
};

function getDetailCached() {
  if (DETAIL_CACHE.data && (Date.now() - DETAIL_CACHE.timestamp) < DETAIL_CACHE.staleAge) {
    return DETAIL_CACHE.data;
  }
  return null;
}

function setDetailCache(data) {
  DETAIL_CACHE.data = data;
  DETAIL_CACHE.timestamp = Date.now();
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
// ──────────────────────────────────────────────────────────────────────────

const API_URL = '/api';

// DOM Elements
const backBtn = document.getElementById('backBtn');
const blurToggleBtn = document.getElementById('blurToggleBtn');
const addMovieBtn = document.getElementById('addMovieBtn');
const editStarBtn = document.getElementById('editStarBtn');
const deleteStarBtn = document.getElementById('deleteStarBtn');
const addMovieModal = document.getElementById('addMovieModal');
const closeMovieModal = document.getElementById('closeMovieModal');
const addMovieForm = document.getElementById('addMovieForm');
const movieModalTitle = document.getElementById('movieModalTitle');
const editStarModal = document.getElementById('editStarModal');
const closeEditStarModal = document.getElementById('closeEditStarModal');
const editStarForm = document.getElementById('editStarForm');
const movieSearchInput = document.getElementById('movieSearchInput');
const movieSiteFilter = document.getElementById('movieSiteFilter');
const movieSortSelect = document.getElementById('movieSortSelect');
const resetMovieFiltersBtn = document.getElementById('resetMovieFiltersBtn');
const starImage = document.getElementById('starImage');
const starNameElement = document.getElementById('starName');
const starTitle = document.getElementById('starTitle');
const movieCount = document.getElementById('movieCount');
const toggleSlideshowsBtn = document.getElementById('toggleSlideshowsBtn');
const movieColumnsSelect = document.getElementById('movieColumnsSelect');
const movieImagesToggleOriginalBtn = document.getElementById('movieImagesToggleOriginalBtn');
const moviesGrid = document.getElementById('moviesGrid');

// Images tab DOM
const moviesTabBtn = document.getElementById('moviesTabBtn');
const imagesTabBtn = document.getElementById('imagesTabBtn');
const moviesSectionActions = document.getElementById('moviesSectionActions');
const imagesSectionActions = document.getElementById('imagesSectionActions');
const imagesGrid = document.getElementById('imagesGrid');
const imagesToggleOriginalBtn = document.getElementById('imagesToggleOriginalBtn');
const imagesColumnsSelect = document.getElementById('imagesColumnsSelect');

// Images lightbox DOM
const imagesLightbox = document.getElementById('imagesLightbox');
const imagesLightboxImage = document.getElementById('imagesLightboxImage');
const imagesLightboxClose = document.getElementById('imagesLightboxClose');
const imagesLightboxPrev = document.getElementById('imagesLightboxPrev');
const imagesLightboxNext = document.getElementById('imagesLightboxNext');
const imagesLightboxCounter = document.getElementById('imagesLightboxCounter');
const imagesLightboxFavBtn = document.getElementById('imagesLightboxFavBtn');
const imagesLightboxGotoBtn = document.getElementById('imagesLightboxGotoBtn');

// Album config DOM
const albumConfigDetails = document.getElementById('albumConfigDetails');
const albumSourceHtml = document.getElementById('albumSourceHtml');
const albumBaseUrl = document.getElementById('albumBaseUrl');
const albumConfigPreview = document.getElementById('albumConfigPreview');
const albumConfigCount = document.getElementById('albumConfigCount');
const albumConfigResult = document.getElementById('albumConfigResult');
const albumConfigPreviewBtn = document.getElementById('albumConfigPreviewBtn');

// Global state
let currentStar = null;
let starsData = [];
let filteredMovies = [];
let slideShowIntervals = {};
let areSlideshowsPaused = false;
let editingMovieIndex = null;
let movieSiteFilterDropdown = null;
let movieImagesShowOriginal = false;

// Images tab state
let currentTab = 'movies';
let favoriteEntries = [];        // [{ entry, movieIndex, movieTitle }]
let imagesShowOriginal = false;
let imagesLightboxIndex = -1;
const imagesOriginalUrlCache = new Map();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const starId = parseInt(params.get('starId'));

    initBlurToggle();
    setupMovieFilterDropdown();
    setupMovieColumns();
    setupImagesColumns();
    await loadData();
    loadStarDetails(starId);
    setupEventListeners();
});

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

function setupEventListeners() {
    backBtn.addEventListener('click', goBack);
    addMovieBtn.addEventListener('click', openAddMovieModal);
    editStarBtn.addEventListener('click', openEditStarModal);
    deleteStarBtn.addEventListener('click', deleteStar);
    closeMovieModal.addEventListener('click', () => closeMovieModalDialog());
    closeEditStarModal.addEventListener('click', () => closeEditStarModalDialog());
    addMovieForm.addEventListener('submit', handleSaveMovie);
    editStarForm.addEventListener('submit', handleEditStar);
    document.getElementById('movieImages').addEventListener('blur', (event) => addTrailingComma(event.target));
    document.getElementById('videoUrl').addEventListener('blur', (event) => addTrailingComma(event.target));
    document.getElementById('movieImages').addEventListener('keydown', handleCommaFieldEnter);
    document.getElementById('videoUrl').addEventListener('keydown', handleCommaFieldEnter);
    movieSearchInput.addEventListener('input', debounce(applyMovieFilters, 250));
    movieSortSelect.addEventListener('change', applyMovieFilters);
    resetMovieFiltersBtn.addEventListener('click', resetMovieFilters);
    toggleSlideshowsBtn.addEventListener('click', toggleAllSlideshows);
    movieColumnsSelect.addEventListener('change', updateMovieColumns);
    movieImagesToggleOriginalBtn.addEventListener('click', async () => {
        movieImagesShowOriginal = !movieImagesShowOriginal;
        movieImagesToggleOriginalBtn.textContent = movieImagesShowOriginal
            ? '🖼 Original Images'
            : '🖼 Preview Images';
        await refreshMovieThumbnailImages();
    });
    window.addEventListener('click', (e) => {
        if (e.target === addMovieModal) closeMovieModalDialog();
        if (e.target === editStarModal) closeEditStarModalDialog();
    });

    // Album config events
    albumSourceHtml.addEventListener('input', onAlbumConfigChange);
    albumBaseUrl.addEventListener('input', onAlbumConfigChange);
    albumConfigPreviewBtn.addEventListener('click', handleAlbumConfigPreview);

    // Tabs
    moviesTabBtn.addEventListener('click', () => switchTab('movies'));
    imagesTabBtn.addEventListener('click', () => switchTab('images'));

    // Images tab controls
    imagesToggleOriginalBtn.addEventListener('click', async () => {
        imagesShowOriginal = !imagesShowOriginal;
        imagesToggleOriginalBtn.textContent = imagesShowOriginal
            ? '🖼 Original Images'
            : '🖼 Preview Images';
        await refreshImagesGridThumbnails();
    });

    imagesColumnsSelect.addEventListener('change', () => {
        const cols = imagesColumnsSelect.value;
        imagesGrid.style.setProperty('--album-cols', cols);
        localStorage.setItem('detailImagesColumns', cols);
    });

    // Images lightbox
    imagesLightboxClose.addEventListener('click', closeImagesLightbox);
    imagesLightboxPrev.addEventListener('click', showPrevImagesLightbox);
    imagesLightboxNext.addEventListener('click', showNextImagesLightbox);
    imagesLightboxFavBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFavoriteEntry(imagesLightboxIndex);
    });
    imagesLightbox.addEventListener('click', (e) => {
        if (e.target === imagesLightbox) closeImagesLightbox();
    });
    document.addEventListener('keydown', handleImagesLightboxKeydown);
}

function onAlbumConfigChange() {
    // If source has content and base URL is empty, highlight the base URL field
    const source = albumSourceHtml.value.trim();
    const base = albumBaseUrl.value.trim();
    if (source && !base) {
        albumBaseUrl.classList.add('field-highlight-required');
    } else {
        albumBaseUrl.classList.remove('field-highlight-required');
    }
    // Hide preview when input changes
    albumConfigPreview.hidden = true;
}

function handleAlbumConfigPreview() {
    const sourceHtml = albumSourceHtml.value;
    const baseUrl = albumBaseUrl.value.trim();

    if (!sourceHtml) {
        alert('Please paste the source HTML first.');
        return;
    }
    if (!baseUrl) {
        alert('Target Base URL is required when Source HTML is provided.');
        albumBaseUrl.focus();
        return;
    }

    const urls = parseAlbumImages(sourceHtml, baseUrl);
    if (urls.length === 0) {
        alert('No image IDs found in the HTML. Make sure it contains href="https://imx.to/i/XXXXX" patterns.');
        albumConfigPreview.hidden = true;
        return;
    }

    albumConfigCount.textContent = urls.length;
    albumConfigResult.textContent = urls.join(',\n');
    albumConfigPreview.hidden = false;
}

function parseAlbumImages(sourceHtml, baseUrl) {
    if (!sourceHtml || !baseUrl) return [];
    const ids = [];
    const regex = /href="https:\/\/imx\.to\/i\/([a-zA-Z0-9]+)"/g;
    let match;
    while ((match = regex.exec(sourceHtml)) !== null) {
        const id = match[1];
        const baseNormalized = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        ids.push(`${baseNormalized}${id}.jpg`);
    }
    return ids;
}

function setupMovieFilterDropdown() {
    movieSiteFilterDropdown = createCheckboxDropdown(movieSiteFilter, {
        title: "Filter by Site",
        emptyLabel: "All Sites"
    });
    document.addEventListener("click", handleDocumentClick);
}

function handleDocumentClick(event) {
    if (!event.target.closest(".checkbox-dropdown")) {
        closeAllDropdowns();
    }
}

function createCheckboxDropdown(selectElement, { title, emptyLabel }) {
    if (!selectElement || !selectElement.parentElement) {
        return null;
    }

    const group = selectElement.parentElement;
    const label = group.querySelector(`label[for="${selectElement.id}"]`);

    const root = document.createElement("div");
    root.className = "checkbox-dropdown";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "checkbox-dropdown-trigger";
    button.id = `${selectElement.id}-trigger`;

    const titleSpan = document.createElement("span");
    titleSpan.className = "checkbox-dropdown-title";
    titleSpan.textContent = title;

    const summarySpan = document.createElement("span");
    summarySpan.className = "checkbox-dropdown-summary";
    summarySpan.textContent = emptyLabel;

    const caretSpan = document.createElement("span");
    caretSpan.className = "checkbox-dropdown-caret";
    caretSpan.setAttribute("aria-hidden", "true");
    caretSpan.textContent = "v";

    button.append(titleSpan, summarySpan, caretSpan);

    const panel = document.createElement("div");
    panel.className = "checkbox-dropdown-menu";
    panel.hidden = true;

    root.append(button, panel);
    group.insertBefore(root, selectElement);
    selectElement.remove();

    if (label) {
        label.htmlFor = button.id;
    }

    const state = {
        id: selectElement.id,
        title,
        emptyLabel,
        root,
        button,
        summarySpan,
        panel,
        selected: new Set(),
        options: [],
        isOpen: false
    };

    button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleDropdown(state);
    });

    panel.addEventListener("click", (event) => {
        event.stopPropagation();
    });

    return state;
}

function toggleDropdown(state, forceOpen) {
    if (!state) return;
    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : !state.isOpen;
    state.isOpen = nextOpen;
    state.panel.hidden = !nextOpen;
    state.root.classList.toggle("is-open", nextOpen);
    state.button.setAttribute("aria-expanded", String(nextOpen));
}

function closeAllDropdowns() {
    if (movieSiteFilterDropdown) closeDropdown(movieSiteFilterDropdown);
}

function closeDropdown(state) {
    if (!state) return;
    state.isOpen = false;
    state.panel.hidden = true;
    state.root.classList.remove("is-open");
    state.button.setAttribute("aria-expanded", "false");
}

function setDropdownOptions(state, options) {
    if (!state) return;
    state.options = options;
    const validValues = new Set(options.map((option) => option.value));
    state.selected = new Set(Array.from(state.selected).filter((value) => validValues.has(value)));
    renderDropdown(state);
}

function renderDropdown(state) {
    if (!state) return;

    const sortedOptions = [...state.options].sort((left, right) => {
        const leftSelected = state.selected.has(left.value);
        const rightSelected = state.selected.has(right.value);
        if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
        return left.label.localeCompare(right.label);
    });

    state.panel.innerHTML = "";

    if (sortedOptions.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "checkbox-dropdown-empty";
        emptyState.textContent = "No options";
        state.panel.appendChild(emptyState);
        updateDropdownSummary(state);
        return;
    }

    const actions = document.createElement("div");
    actions.className = "checkbox-dropdown-actions";
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "Clear";
    clearButton.disabled = state.selected.size === 0;
    clearButton.addEventListener("click", () => {
        state.selected.clear();
        renderDropdown(state);
        applyMovieFilters();
    });
    actions.appendChild(clearButton);
    state.panel.appendChild(actions);

    sortedOptions.forEach((option) => {
        const optionLabel = document.createElement("label");
        optionLabel.className = "checkbox-dropdown-option";
        if (state.selected.has(option.value)) {
            optionLabel.classList.add("is-selected");
        }
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = option.value;
        checkbox.checked = state.selected.has(option.value);
        const text = document.createElement("span");
        text.className = "checkbox-dropdown-option-label";
        text.textContent = option.label;
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                state.selected.add(option.value);
            } else {
                state.selected.delete(option.value);
            }
            renderDropdown(state);
            applyMovieFilters();
        });
        optionLabel.append(checkbox, text);
        state.panel.appendChild(optionLabel);
    });

    updateDropdownSummary(state);
}

function updateDropdownSummary(state) {
    if (!state) return;
    const selectedCount = state.selected.size;
    if (selectedCount === 0) {
        state.summarySpan.textContent = state.emptyLabel;
    } else {
        const selectedLabels = state.options
            .filter((option) => state.selected.has(option.value))
            .map((option) => option.label);
        const visibleLabels = selectedLabels.slice(0, 2).join(", ");
        const remainingCount = selectedCount - 2;
        state.summarySpan.textContent = remainingCount > 0
            ? `${visibleLabels} +${remainingCount}`
            : visibleLabels;
    }
    state.root.classList.toggle("has-selection", selectedCount > 0);
}

function setupMovieColumns() {
    const savedColumns = localStorage.getItem('movieColumnsPerRow') || movieColumnsSelect.value;
    movieColumnsSelect.value = savedColumns;
    updateMovieColumns();
}

function updateMovieColumns() {
    const columns = Number(movieColumnsSelect.value) || 5;
    const boundedColumns = Math.min(Math.max(columns, 2), 6);
    movieColumnsSelect.value = String(boundedColumns);
    moviesGrid.style.setProperty('--movies-per-row', boundedColumns);
    localStorage.setItem('movieColumnsPerRow', String(boundedColumns));
}

// ── Images Tab ────────────────────────────────────────────────────────────

function setupImagesColumns() {
    const savedColumns = localStorage.getItem('detailImagesColumns') || imagesColumnsSelect.value;
    imagesColumnsSelect.value = savedColumns;
    imagesGrid.style.setProperty('--album-cols', savedColumns);
}

function switchTab(tab) {
    currentTab = tab;
    moviesTabBtn.classList.toggle('active', tab === 'movies');
    imagesTabBtn.classList.toggle('active', tab === 'images');
    moviesGrid.hidden = tab !== 'movies';
    imagesGrid.hidden = tab !== 'images';
    moviesSectionActions.hidden = tab !== 'movies';
    imagesSectionActions.hidden = tab !== 'images';

    if (tab === 'images') {
        renderImagesTab();
    }
}

function collectFavoriteEntries() {
    const entries = [];
    (currentStar?.movies || []).forEach((movie, movieIndex) => {
        splitCommaSeparated(movie.favoriteImages).forEach((entry) => {
            entries.push({ entry, movieIndex, movieTitle: movie.videoTitle || 'Untitled' });
        });
    });
    return entries;
}

function renderImagesTab() {
    favoriteEntries = collectFavoriteEntries();
    renderImagesGrid();
}

function renderImagesGrid() {
    imagesGrid.innerHTML = '';

    if (favoriteEntries.length === 0) {
        imagesGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>No favorite images yet. Star images from any movie\'s album to see them here.</p></div>';
        return;
    }

    favoriteEntries.forEach((favEntry, index) => {
        const { entry, movieIndex, movieTitle } = favEntry;
        const isWebpage = isWebpageEntry(entry);
        const url = getEntryValue(entry);

        const item = document.createElement('div');
        item.className = `album-item${isWebpage ? ' album-webpage-item' : ''}`;
        item.dataset.index = index;

        const mediaEl = document.createElement(isWebpage ? 'iframe' : 'img');
        if (isWebpage) {
            mediaEl.src = url;
            mediaEl.title = movieTitle;
            mediaEl.loading = 'lazy';
            mediaEl.setAttribute('referrerpolicy', 'no-referrer');
        } else {
            mediaEl.src = url;
            mediaEl.alt = movieTitle;
            mediaEl.loading = 'lazy';
            mediaEl.dataset.url = url;
        }
        item.appendChild(mediaEl);

        item.addEventListener('click', (e) => {
            if (e.target.closest('.album-item-overlay')) return;
            openOriginalInImagesLightbox(index);
        });

        const overlay = document.createElement('div');
        overlay.className = 'album-item-overlay';

        // View original
        const originalBtn = document.createElement('button');
        originalBtn.className = 'album-original-btn';
        originalBtn.innerHTML = '🔎';
        originalBtn.title = 'Open original image in viewer';
        originalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openOriginalInImagesLightbox(index);
        });
        overlay.appendChild(originalBtn);

        // Download
        if (!isWebpage) {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'album-download-btn';
            downloadBtn.innerHTML = '⬇';
            downloadBtn.title = 'Download original image';
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadOriginalImage(url, `${movieTitle}-image-${index + 1}`, downloadBtn);
            });
            overlay.appendChild(downloadBtn);
        }

        // Remove from favorites
        const favBtn = document.createElement('button');
        favBtn.className = 'album-fav-btn is-favorite';
        favBtn.innerHTML = '❤️';
        favBtn.title = 'Remove from favorites';
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeFavoriteEntry(index);
        });
        overlay.appendChild(favBtn);

        // Go to this movie's full album
        const gotoBtn = document.createElement('button');
        gotoBtn.className = 'album-goto-btn';
        gotoBtn.innerHTML = '📁';
        gotoBtn.title = `Open full album — ${movieTitle}`;
        gotoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAlbum(movieIndex);
        });
        overlay.appendChild(gotoBtn);

        const label = document.createElement('span');
        label.className = 'album-movie-label';
        label.textContent = movieTitle;
        label.title = movieTitle;
        overlay.appendChild(label);

        item.appendChild(overlay);
        imagesGrid.appendChild(item);
    });

    if (imagesShowOriginal) refreshImagesGridThumbnails();
}

async function refreshImagesGridThumbnails() {
    const imgs = imagesGrid.querySelectorAll('.album-item img[data-url]');
    for (const img of imgs) {
        const previewUrl = img.dataset.url;
        if (!imagesShowOriginal) {
            img.src = previewUrl;
            continue;
        }
        try {
            let original = imagesOriginalUrlCache.get(previewUrl);
            if (!original) {
                original = await resolveOriginalImageUrl(previewUrl);
                imagesOriginalUrlCache.set(previewUrl, original);
            }
            img.src = original || previewUrl;
        } catch {
            img.src = previewUrl;
        }
    }
}

async function removeFavoriteEntry(index) {
    const favEntry = favoriteEntries[index];
    if (!favEntry) return;
    const movie = currentStar.movies[favEntry.movieIndex];
    if (!movie) return;

    const favList = splitCommaSeparated(movie.favoriteImages);
    const pos = favList.indexOf(favEntry.entry);
    if (pos >= 0) favList.splice(pos, 1);
    movie.favoriteImages = favList.join(',');

    saveData();

    try {
        await fetch(`${API_URL}/stars/${currentStar.id}/movies/${favEntry.movieIndex}/album`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favoriteImages: movie.favoriteImages })
        });
    } catch (_) {
        // Offline is fine — localStorage is already updated
    }

    favoriteEntries = collectFavoriteEntries();
    renderImagesGrid();

    if (imagesLightbox.classList.contains('active')) {
        if (favoriteEntries.length === 0) {
            closeImagesLightbox();
        } else {
            imagesLightboxIndex = Math.min(imagesLightboxIndex, favoriteEntries.length - 1);
            updateImagesLightboxImage();
        }
    }
}

// ── Images Lightbox ──────────────────────────────────────────────────────

function openOriginalInImagesLightbox(index) {
    if (index < 0 || index >= favoriteEntries.length) return;

    imagesLightboxIndex = index;
    imagesLightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    refreshImagesLightboxCounter();
    updateImagesLightboxGotoBtn();

    const { entry } = favoriteEntries[index];
    const isWebpage = isWebpageEntry(entry);
    const src = getEntryValue(entry);

    imagesLightboxFavBtn.hidden = isWebpage;

    imagesLightboxImage.hidden = false;
    imagesLightboxImage.alt = 'Original image';
    imagesLightboxImage.src = '';

    resolveOriginalImageUrl(src)
        .then((originalUrl) => {
            if (imagesLightboxIndex !== index) return;
            imagesLightboxImage.src = originalUrl || src;
        })
        .catch(() => {
            if (imagesLightboxIndex === index) {
                imagesLightboxImage.src = src;
            }
        });
}

function updateImagesLightboxImage() {
    if (imagesLightboxIndex < 0 || imagesLightboxIndex >= favoriteEntries.length) return;
    const index = imagesLightboxIndex;
    const { entry } = favoriteEntries[index];
    const isWebpage = isWebpageEntry(entry);
    const src = getEntryValue(entry);

    imagesLightboxFavBtn.hidden = isWebpage;
    imagesLightboxImage.src = '';

    resolveOriginalImageUrl(src)
        .then((originalUrl) => {
            if (imagesLightboxIndex !== index) return;
            imagesLightboxImage.src = originalUrl || src;
        })
        .catch(() => {
            if (imagesLightboxIndex === index) {
                imagesLightboxImage.src = src;
            }
        });

    refreshImagesLightboxCounter();
    updateImagesLightboxGotoBtn();
}

function showPrevImagesLightbox() {
    if (favoriteEntries.length === 0) return;
    imagesLightboxIndex = (imagesLightboxIndex - 1 + favoriteEntries.length) % favoriteEntries.length;
    updateImagesLightboxImage();
}

function showNextImagesLightbox() {
    if (favoriteEntries.length === 0) return;
    imagesLightboxIndex = (imagesLightboxIndex + 1) % favoriteEntries.length;
    updateImagesLightboxImage();
}

function closeImagesLightbox() {
    imagesLightbox.classList.remove('active');
    document.body.style.overflow = '';
    imagesLightboxIndex = -1;
}

function refreshImagesLightboxCounter() {
    const multi = favoriteEntries.length > 1;
    imagesLightboxPrev.style.display = multi ? '' : 'none';
    imagesLightboxNext.style.display = multi ? '' : 'none';
    imagesLightboxCounter.textContent = `${imagesLightboxIndex + 1} / ${favoriteEntries.length}`;
}

function updateImagesLightboxGotoBtn() {
    if (imagesLightboxIndex < 0 || imagesLightboxIndex >= favoriteEntries.length) return;
    const { movieIndex, movieTitle } = favoriteEntries[imagesLightboxIndex];
    imagesLightboxGotoBtn.title = `Open full album — ${movieTitle}`;
    imagesLightboxGotoBtn.onclick = () => openAlbum(movieIndex);
}

function handleImagesLightboxKeydown(e) {
    if (!imagesLightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeImagesLightbox();
    if (e.key === 'ArrowLeft') showPrevImagesLightbox();
    if (e.key === 'ArrowRight') showNextImagesLightbox();
}

async function loadData() {
    try {
        const response = await fetch(`${API_URL}/stars`);
        if (response.ok) {
            starsData = await response.json();
            localStorage.setItem('starsData', JSON.stringify(starsData));
            return;
        }
    } catch (error) {
        console.log('Server not running, loading from localStorage...');
    }
    await loadFromLocalStorage();
}

async function loadFromLocalStorage() {
    const savedData = localStorage.getItem('starsData');
    if (savedData) {
        starsData = JSON.parse(savedData);
        return;
    }
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        starsData = data.stars;
        localStorage.setItem('starsData', JSON.stringify(starsData));
    } catch (error) {
        console.error('Error loading data.json:', error);
        starsData = [];
    }
}

function loadStarDetails(starId) {
    currentStar = starsData.find(star => star.id === starId);
    if (!currentStar) {
        alert('Star not found!');
        window.location.href = 'index.html';
        return;
    }
    starTitle.textContent = currentStar.name;
    starNameElement.textContent = currentStar.name;
    starImage.src = currentStar.pictureUrl;
    starImage.onerror = () => {
        starImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='300'%3E%3Crect fill='%23ddd' width='100%25' height='100%25'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.1em' fill='%23666' font-family='sans-serif' font-size='18'%3EImage Not Found%3C/text%3E%3C/svg%3E";
    };
    updateMovieCount();
    populateMovieFilters();
    applyMovieFilters();
}

function updateMovieCount() {
    movieCount.textContent = `${currentStar.movies.length} movie${currentStar.movies.length !== 1 ? 's' : ''}`;
}

function splitCommaSeparated(value) {
    return value ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
}

function normalizeNameList(values) {
    const seen = new Set();
    return values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value) => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function getMovieStarNames(movieStarsValue) {
    return normalizeNameList([
        currentStar?.name || '',
        ...splitCommaSeparated(movieStarsValue)
    ]);
}

function createLocalStarIfNeeded(name) {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return null;
    let star = starsData.find((candidate) => candidate.name.toLowerCase() === normalizedName.toLowerCase());
    if (star) return star;
    star = {
        id: Date.now() + Math.floor(Math.random() * 1000000),
        name: normalizedName,
        pictureUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400'%3E%3Crect fill='%23ddd' width='100%25' height='100%25'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.1em' fill='%23666' font-family='sans-serif' font-size='18'%3EImage Not Found%3C/text%3E%3C/svg%3E",
        movies: []
    };
    starsData.push(star);
    return star;
}

function applyMovieToLocalProfiles(moviePayload, starNames) {
    const uniqueNames = normalizeNameList(starNames);
    uniqueNames.forEach((name) => {
        const star = createLocalStarIfNeeded(name);
        if (!star) return;
        const movieCopy = { ...moviePayload, starNames: [name] };
        const existingMovieIndex = star.movies.findIndex((movie) => String(movie.id) === String(moviePayload.id));
        if (existingMovieIndex >= 0) {
            star.movies[existingMovieIndex] = movieCopy;
        } else {
            star.movies.push(movieCopy);
        }
    });
}

function getSingleUrl(value) {
    return value ? String(value).trim() : '';
}

function addTrailingComma(inputElement) {
    const value = inputElement.value.trim();
    inputElement.value = value && !value.endsWith(',') ? `${value},` : value;
}

function handleCommaFieldEnter(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addTrailingComma(event.target);
    event.target.selectionStart = event.target.value.length;
    event.target.selectionEnd = event.target.value.length;
}

function getMovieSiteValues(movies) {
    const sites = Array.isArray(movies)
        ? movies.map(movie => movie.siteName || movie.siteNameLink || movie.siteUrl || '').filter(Boolean)
        : [];
    return Array.from(new Set(sites));
}

function getMovieSiteFilterValues(movies) {
    return getMovieSiteValues(movies).map(normalizeSiteFilterValue).filter(Boolean);
}

function getMovieSearchText(movie) {
    return [
        movie.videoTitle || '',
        movie.siteName || '',
        extractDomainName(movie.siteName || movie.siteNameLink || movie.siteUrl || '')
    ].join(' ').toLowerCase();
}

function getMovieOriginalIndex(movie) {
    return currentStar.movies.indexOf(movie);
}

function extractDomainName(value) {
    if (!value) return 'Site';
    try {
        const normalizedValue = value.includes('://') ? value : `https://${value}`;
        const urlObj = new URL(normalizedValue);
        const hostname = urlObj.hostname.replace(/^www\./i, '');
        const parts = hostname.split('.').filter(Boolean);
        const domainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || hostname;
        return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
    } catch (error) {
        const cleanValue = value.replace(/^www\./i, '');
        const parts = cleanValue.split('.').filter(Boolean);
        const domainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || cleanValue;
        return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
    }
}

function normalizeSiteFilterValue(value) {
    if (!value) return '';
    const trimmedValue = String(value).trim();
    if (!trimmedValue) return '';
    try {
        const normalizedValue = trimmedValue.includes('://') ? trimmedValue : `https://${trimmedValue}`;
        const urlObj = new URL(normalizedValue);
        return urlObj.hostname.replace(/^www\./i, '').toLowerCase();
    } catch (error) {
        return trimmedValue.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].trim().toLowerCase();
    }
}

function getLinkValue(url) {
    return url.includes('://') ? url : `https://${url}`;
}

function populateMovieFilters() {
    const siteOptionsByValue = new Map();
    getMovieSiteValues(currentStar.movies).forEach(site => {
        const value = normalizeSiteFilterValue(site);
        if (value && !siteOptionsByValue.has(value)) {
            siteOptionsByValue.set(value, extractDomainName(site));
        }
    });
    const siteOptions = Array.from(siteOptionsByValue.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    setDropdownOptions(movieSiteFilterDropdown, siteOptions);
}

function sortMovies(movies) {
    const sortValue = movieSortSelect?.value || 'insertion-asc';
    const sortedMovies = [...movies];
    const compareText = (left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' });

    sortedMovies.sort((leftMovie, rightMovie) => {
        const leftIndex = getMovieOriginalIndex(leftMovie);
        const rightIndex = getMovieOriginalIndex(rightMovie);

        if (sortValue === 'insertion-desc') return rightIndex - leftIndex;

        if (sortValue === 'title-asc' || sortValue === 'title-desc') {
            const leftTitle = leftMovie.videoTitle || '';
            const rightTitle = rightMovie.videoTitle || '';
            const result = compareText(leftTitle, rightTitle) || (leftIndex - rightIndex);
            return sortValue === 'title-desc' ? -result : result;
        }

        if (sortValue === 'site-asc' || sortValue === 'site-desc') {
            const leftSite = extractDomainName(leftMovie.siteName || leftMovie.siteNameLink || leftMovie.siteUrl || '');
            const rightSite = extractDomainName(rightMovie.siteName || rightMovie.siteNameLink || rightMovie.siteUrl || '');
            const result = compareText(leftSite, rightSite) || compareText(leftMovie.videoTitle || '', rightMovie.videoTitle || '') || (leftIndex - rightIndex);
            return sortValue === 'site-desc' ? -result : result;
        }

        return leftIndex - rightIndex;
    });

    return sortedMovies;
}

function applyMovieFilters() {
    const selectedSites = new Set(movieSiteFilterDropdown?.selected || []);
    const searchTerm = movieSearchInput.value.trim().toLowerCase();

    filteredMovies = currentStar.movies.filter(movie => {
        const matchesSearch = !searchTerm || getMovieSearchText(movie).includes(searchTerm);
        const matchesSites =
            selectedSites.size === 0 ||
            getMovieSiteFilterValues([movie]).some(site => selectedSites.has(site));
        return matchesSearch && matchesSites;
    });

    filteredMovies = sortMovies(filteredMovies);
    renderMovies();
}

function resetMovieFilters() {
    movieSearchInput.value = '';
    movieSortSelect.value = 'insertion-asc';
    if (movieSiteFilterDropdown) {
        movieSiteFilterDropdown.selected.clear();
        renderDropdown(movieSiteFilterDropdown);
    }
    applyMovieFilters();
}

// ── Thumbnail resolution ───────────────────────────────────────────────────
const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='180'%3E%3Crect fill='%23ddd' width='100%25' height='100%25'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.1em' fill='%23666' font-family='sans-serif' font-size='16'%3ENo Preview%3C/text%3E%3C/svg%3E";

const THUMBNAIL_CACHE = new Map();

function resolveThumbnail(movie) {
    const cacheKey = movie.id;
    const cached = THUMBNAIL_CACHE.get(cacheKey);
    if (cached) return cached;

    // If movie has favorite album images, use those first for the thumbnail slideshow
    const favImages = splitCommaSeparated(movie.favoriteImages);
    if (favImages.length > 0) {
        const result = { type: 'images', urls: favImages };
        THUMBNAIL_CACHE.set(cacheKey, result);
        return result;
    }

    const rawImages = splitCommaSeparated(movie.images);
    if (rawImages.length > 0) {
        const result = { type: 'images', urls: rawImages };
        THUMBNAIL_CACHE.set(cacheKey, result);
        return result;
    }

    const previewUrl = getSingleUrl(movie.previewVideoUrl);
    if (previewUrl) {
        const result = { type: 'preview', url: previewUrl };
        THUMBNAIL_CACHE.set(cacheKey, result);
        return result;
    }

    if (currentStar?.pictureUrl) {
        const result = { type: 'profile', url: currentStar.pictureUrl };
        THUMBNAIL_CACHE.set(cacheKey, result);
        return result;
    }

    const result = { type: 'placeholder' };
    THUMBNAIL_CACHE.set(cacheKey, result);
    return result;
}

function createThumbnailHTML(movieIndex, resolved, previewUrl) {
    if (resolved.type === 'images') {
        const slidesHTML = resolved.urls.map((url, i) => `
            <div class="slide${i === 0 ? ' active' : ''}" style="opacity: ${i === 0 ? '1' : '0'};">
                <img src="${url}" data-preview-url="${url}" alt="Movie image ${i + 1}">
            </div>
        `).join('');

        const hasPreview = Boolean(previewUrl);
        const videoHTML = hasPreview ? `
            <video class="preview-video-element" muted loop playsinline preload="metadata">
                <source src="${previewUrl}" type="video/mp4">
            </video>
        ` : '';

        return `
            <div class="movie-thumbnail image-slideshow${hasPreview ? ' has-preview' : ''}" data-movie-index="${movieIndex}" data-has-images="true" data-has-preview="${hasPreview}">
                <div class="slideshow-container">
                    ${slidesHTML}
                </div>
                ${videoHTML}
            </div>
        `;
    }

    if (resolved.type === 'preview') {
        return `
            <div class="movie-thumbnail preview-video" data-movie-index="${movieIndex}" data-has-images="false" data-has-preview="true">
                <video class="preview-video-element preview-video-autoplay" muted loop playsinline autoplay preload="metadata">
                    <source src="${resolved.url}" type="video/mp4">
                </video>
            </div>
        `;
    }

    const imgSrc = resolved.type === 'profile' ? resolved.url : PLACEHOLDER_SVG;
    return `
        <div class="movie-thumbnail generic-video" data-movie-index="${movieIndex}" data-has-images="false" data-has-preview="false">
            <img src="${imgSrc}" alt="Thumbnail" style="width:100%;height:100%;object-fit:cover;">
        </div>
    `;
}

async function refreshMovieThumbnailImages() {
    const images = moviesGrid.querySelectorAll('.movie-thumbnail img[data-preview-url]');

    for (const image of images) {
        const previewUrl = image.dataset.previewUrl;
        if (!movieImagesShowOriginal) {
            image.src = previewUrl;
            continue;
        }

        try {
            let originalUrl = imagesOriginalUrlCache.get(previewUrl);
            if (!originalUrl) {
                originalUrl = await resolveOriginalImageUrl(previewUrl);
                imagesOriginalUrlCache.set(previewUrl, originalUrl);
            }
            image.src = originalUrl || previewUrl;
        } catch {
            image.src = previewUrl;
        }
    }
}

function createFixedButtonRow(className, buttonsHTML, placeholderLabel) {
    return `
        <div class="movie-buttons-row fixed-row ${className}">
            ${buttonsHTML || `<button class="btn-placeholder" type="button" disabled aria-disabled="true">${placeholderLabel}</button>`}
        </div>
    `;
}

function createSitePreviewButtonRow(siteButtonHTML, previewButtonHTML) {
    return `
        <div class="movie-buttons-row fixed-row site-preview-row">
            ${siteButtonHTML}
            ${previewButtonHTML || '<button class="btn-placeholder" type="button" disabled aria-disabled="true">Preview</button>'}
        </div>
    `;
}

async function renderMovies() {
    stopAllSlideshows();
    moviesGrid.innerHTML = '';

    const movies = Array.isArray(filteredMovies) ? filteredMovies : [];
    updateSlideshowsButton(movies);

    if (movies.length === 0) {
        moviesGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>No movies match the current filters.</p></div>';
        return;
    }

    const cardPromises = movies.map(async (movie) => {
        const movieIndex = currentStar.movies.indexOf(movie);
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';

        const watchUrls = splitCommaSeparated(movie.videoUrl);
        const siteLink = getLinkValue(movie.siteName || '');
        const siteDomain = extractDomainName(movie.siteName || movie.siteNameLink || movie.siteUrl || '');
        const rawPreviewUrl = getSingleUrl(movie.previewVideoUrl);
        const resolved = await resolveThumbnail(movie);

        // Album images from albumImages field, fallback to regular images
        const albumImages = splitCommaSeparated(movie.albumImages || movie.images);

        const siteLinks = splitCommaSeparated(movie.siteName || movie.siteUrl || movie.siteNameLink || '')
            .map((value) => getLinkValue(value))
            .filter(Boolean)
            .slice(0, 2);

        const siteButtonsHTML = siteLinks.length > 0
            ? siteLinks.map((link) => `<button class="btn-site" data-open-url="${link}">${extractDomainName(link)}</button>`).join('')
            : `<button class="btn-site" data-open-url="${siteLink}">${siteDomain}</button>`;

        // Row 2: Site + Preview buttons
        const sitePreviewHTML = `
            <div class="movie-buttons-row site-preview-row">
                ${siteButtonsHTML}
                ${rawPreviewUrl ? `<button class="btn-preview" data-open-url="${rawPreviewUrl}">Preview</button>` : '<button class="btn-placeholder" disabled>Preview</button>'}
            </div>
        `;

        // Row 3: Video buttons (max 2) + Album button with count
        const videoButtonsHTML = watchUrls.length > 0
            ? watchUrls.slice(0, 2).map(url => `<button class="btn-watch" data-open-url="${url}">Video</button>`).join('')
            : '<button class="btn-placeholder" disabled>Video</button>';

        const albumLabel = albumImages.length > 0
            ? `Album (${albumImages.length})`
            : 'Open Album';

        const actionsRowHTML = `
            <div class="movie-buttons-row video-album-row">
                ${videoButtonsHTML}
                <button class="btn-album" data-album-index="${movieIndex}">${albumLabel}</button>
            </div>
        `;

        // Row 4: Edit + Delete
        const editDeleteRowHTML = `
            <div class="movie-buttons-row edit-delete-row">
                <button class="btn btn-favorite ${movie.isFavorite ? 'is-favorite' : ''}" data-favorite-index="${movieIndex}">${movie.isFavorite ? '❤️ Favorite' : '🤍 Favorite'}</button>
                <button class="btn-edit" data-edit-index="${movieIndex}">Edit</button>
                <button class="btn-delete-movie" data-delete-index="${movieIndex}">Delete</button>
            </div>
        `;

        movieCard.innerHTML = `
            ${createThumbnailHTML(movieIndex, resolved, rawPreviewUrl)}
            <div class="movie-info">
                <h4>${movie.videoTitle}</h4>
                ${sitePreviewHTML}
                ${actionsRowHTML}
                ${editDeleteRowHTML}
            </div>
        `;

        movieCard.querySelectorAll('[data-open-url]').forEach(button => {
            button.addEventListener('click', () => openInNewTab(button.dataset.openUrl));
        });

        const previewVideo = movieCard.querySelector('.preview-video-element');
        const hasImages = resolved.type === 'images';

        if (previewVideo && !hasImages) {
            playPreviewVideo(previewVideo);
        }

        if (previewVideo && hasImages && rawPreviewUrl) {
            movieCard.addEventListener('mouseenter', () => {
                stopSlideshow(movieIndex);
                playPreviewVideo(previewVideo);
            });
            movieCard.addEventListener('mouseleave', () => {
                pausePreviewVideo(previewVideo);
                if (!areSlideshowsPaused) {
                    startSlideshow(movieIndex);
                }
            });
        }

        movieCard.querySelector('[data-album-index]')?.addEventListener('click', () => openAlbum(movieIndex));
        movieCard.querySelector('[data-edit-index]')?.addEventListener('click', () => editMovie(movieIndex));
        movieCard.querySelector('[data-delete-index]')?.addEventListener('click', () => deleteMovie(movieIndex));
        movieCard.querySelector('[data-favorite-index]')?.addEventListener('click', () => toggleMovieFavorite(movieIndex));

        if (hasImages && resolved.urls.length > 1) {
            setTimeout(() => startSlideshow(movieIndex), 100);
        }

        return movieCard;
    });

    const cards = await Promise.all(cardPromises);
    cards.forEach(card => moviesGrid.appendChild(card));
    if (movieImagesShowOriginal) await refreshMovieThumbnailImages();
}

async function toggleMovieFavorite(index) {
    const movie = currentStar?.movies?.[index];
    if (!movie) return;
    const wasFavorite = movie.isFavorite === true || movie.isFavorite === 'true';
    movie.isFavorite = !wasFavorite;
    saveData();

    try {
        const response = await fetch(`${API_URL}/stars/${currentStar.id}/movies/${index}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movie)
        });
        if (!response.ok) throw new Error('Server error');
    } catch (_) {
        // localStorage remains the fallback when the server is unavailable
    }

    applyMovieFilters();
}

function startSlideshow(movieIndex) {
    if (areSlideshowsPaused || slideShowIntervals[movieIndex]) return;
    slideShowIntervals[movieIndex] = setInterval(() => {
        const movieCard = document.querySelector(`[data-movie-index="${movieIndex}"]`);
        if (!movieCard) { stopSlideshow(movieIndex); return; }
        const slides = movieCard.querySelectorAll('.slide');
        if (slides.length <= 1) return;
        const activeSlide = movieCard.querySelector('.slide.active') || slides[0];
        const currentIndex = Array.from(slides).indexOf(activeSlide);
        const nextIndex = (currentIndex + 1) % slides.length;
        activeSlide.classList.remove('active');
        activeSlide.style.opacity = '0';
        slides[nextIndex].classList.add('active');
        slides[nextIndex].style.opacity = '1';
    }, 3000);
}

function stopSlideshow(movieIndex) {
    if (slideShowIntervals[movieIndex]) {
        clearInterval(slideShowIntervals[movieIndex]);
        delete slideShowIntervals[movieIndex];
    }
}

function stopAllSlideshows() {
    Object.keys(slideShowIntervals).forEach(movieIndex => stopSlideshow(movieIndex));
}

function startAllSlideshows() {
    document.querySelectorAll('.movie-thumbnail.image-slideshow').forEach(thumbnail => {
        const movieIndex = Number(thumbnail.dataset.movieIndex);
        const slides = thumbnail.querySelectorAll('.slide');
        if (!Number.isNaN(movieIndex) && slides.length > 1) {
            startSlideshow(movieIndex);
        }
    });
}

function toggleAllSlideshows() {
    areSlideshowsPaused = !areSlideshowsPaused;
    if (areSlideshowsPaused) {
        stopAllSlideshows();
    } else {
        startAllSlideshows();
    }
    updateSlideshowsButton();
}

function updateSlideshowsButton(movies = filteredMovies) {
    const hasMultipleImageMovie = Array.isArray(movies)
        && movies.some(movie => splitCommaSeparated(movie.images).length > 1);
    toggleSlideshowsBtn.hidden = !hasMultipleImageMovie;
    toggleSlideshowsBtn.disabled = !hasMultipleImageMovie;
    toggleSlideshowsBtn.textContent = areSlideshowsPaused ? 'Start Slides' : 'Stop Slides';
    toggleSlideshowsBtn.classList.toggle('is-paused', areSlideshowsPaused);
}

function playPreviewVideo(videoElement) {
    if (!videoElement) return;
    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
    }
}

function pausePreviewVideo(videoElement) {
    if (!videoElement) return;
    videoElement.pause();
    videoElement.currentTime = 0;
}

// Open album page for a movie
function openAlbum(movieIndex) {
    const movie = currentStar.movies[movieIndex];
    if (!movie) return;
    window.location.href = `album/album.html?starId=${currentStar.id}&movieIndex=${movieIndex}`;
}

function openInNewTab(url) {
    window.open(url, '_blank');
}

// Open add movie modal
function openAddMovieModal() {
    editingMovieIndex = null;
    movieModalTitle.textContent = 'Add New Movie';
    document.getElementById('siteName').value = getLastMovieSiteName();
    if (currentStar) {
        document.getElementById('movieStars').value = currentStar.name;
    }
    document.getElementById('movieTitle').value = '';
    document.getElementById('videoUrl').value = '';
    document.getElementById('previewVideoUrl').value = '';
    document.getElementById('movieImages').value = '';
    albumSourceHtml.value = '';
    albumBaseUrl.value = '';
    albumConfigPreview.hidden = true;
    albumConfigDetails.removeAttribute('open');
    addMovieModal.classList.add('show');
}

function getLastMovieSiteName() {
    const movies = Array.isArray(currentStar?.movies) ? currentStar.movies : [];
    for (let index = movies.length - 1; index >= 0; index--) {
        const siteName = movies[index]?.siteName?.trim();
        if (siteName) return siteName;
    }
    return '';
}

function openEditStarModal() {
    document.getElementById('editStarName').value = currentStar.name;
    document.getElementById('editStarPictureUrl').value = currentStar.pictureUrl;
    editStarModal.classList.add('show');
}

function closeMovieModalDialog() {
    addMovieModal.classList.remove('show');
    addMovieForm.reset();
    editingMovieIndex = null;
    document.getElementById('movieStars').value = '';
    movieModalTitle.textContent = 'Add New Movie';
    albumConfigPreview.hidden = true;
}

function closeEditStarModalDialog() {
    editStarModal.classList.remove('show');
    editStarForm.reset();
}

// ── Core: Handle Save Movie (unified) ──────────────────────────────────────
async function handleSaveMovie(e) {
    e.preventDefault();

    const videoTitle = document.getElementById('movieTitle').value.trim();
    const siteName = document.getElementById('siteName').value.trim();
    const videoUrlInput = document.getElementById('videoUrl');
    const movieImagesInput = document.getElementById('movieImages');
    const movieStarsInput = document.getElementById('movieStars');
    const previewVideoUrl = document.getElementById('previewVideoUrl').value.trim();
    const isEditing = editingMovieIndex !== null;
    const existingMovie = isEditing ? currentStar?.movies?.[editingMovieIndex] : null;

    addTrailingComma(videoUrlInput);
    addTrailingComma(movieImagesInput);

    const videoUrl = videoUrlInput.value.trim();
    const movieImages = movieImagesInput.value.trim();
    const starNames = getMovieStarNames(movieStarsInput.value);

    if (!videoTitle) { alert('Video Title is required!'); return; }
    if (!siteName) { alert('Site Name is required!'); return; }

    // ── Album processing ───────────────────────────────────────────────
    const sourceHtml = albumSourceHtml.value;
    const baseUrl = albumBaseUrl.value.trim();

    let albumImagesString = '';
    let hasAlbumConfig = false;

    if (sourceHtml && baseUrl) {
        const parsed = parseAlbumImages(sourceHtml, baseUrl);
        if (parsed.length > 0) {
            albumImagesString = parsed.join(',');
            hasAlbumConfig = true;
        }
    } else if (sourceHtml && !baseUrl) {
        alert('Target Base URL is required when Source HTML is provided.');
        albumBaseUrl.focus();
        return;
    }

    // If both empty but this is a movie edit, preserve existing albumImages
    if (!sourceHtml && !baseUrl && isEditing && currentStar?.movies?.[editingMovieIndex]?.albumImages) {
        albumImagesString = currentStar.movies[editingMovieIndex].albumImages;
    }

    const moviePayload = {
        id: existingMovie?.id || Date.now() + Math.floor(Math.random() * 1000000),
        videoTitle,
        siteName,
        videoUrl,
        previewVideoUrl,
        images: movieImages,
        albumImages: albumImagesString,
        favoriteImages: isEditing ? (existingMovie?.favoriteImages || '') : '',
        isFavorite: isEditing
            ? (existingMovie?.isFavorite === true || existingMovie?.isFavorite === 'true')
            : false,
        starNames: isEditing ? [currentStar.name] : starNames
    };

    try {
        const response = await fetch(
            isEditing
                ? `${API_URL}/stars/${currentStar.id}/movies/${editingMovieIndex}`
                : `${API_URL}/stars/${currentStar.id}/movies`,
            {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(moviePayload)
            }
        );
        if (!response.ok) throw new Error('Server error');
        await loadData();
    } catch (error) {
        console.log('Server not running, saving to localStorage only...');
        if (isEditing) {
            currentStar.movies[editingMovieIndex] = { ...existingMovie, ...moviePayload, starNames: [currentStar.name] };
        } else {
            applyMovieToLocalProfiles(moviePayload, starNames);
        }
        saveData();
    }

    // Reload fresh data
    await loadData();
    currentStar = starsData.find(s => s.id === currentStar?.id);
    if (!currentStar) {
        closeMovieModalDialog();
        window.location.href = 'index.html';
        return;
    }

    // ── Redirect to album page if we just created album images ──────────
    if (hasAlbumConfig) {
        // Find the movie we just saved
        const savedMovie = currentStar.movies.find(m => String(m.id) === String(moviePayload.id));
        let savedMovieIndex = -1;
        if (savedMovie) {
            savedMovieIndex = currentStar.movies.indexOf(savedMovie);
        } else {
            // Fallback: last movie
            savedMovieIndex = currentStar.movies.length - 1;
        }

        closeMovieModalDialog();

        if (savedMovieIndex >= 0) {
            // Update local data before redirect
            localStorage.setItem('starsData', JSON.stringify(starsData));
            window.location.href = `album/album.html?starId=${currentStar.id}&movieIndex=${savedMovieIndex}`;
            return;
        }
    }

    // Normal flow: just refresh the view
    closeMovieModalDialog();
    loadStarDetails(currentStar.id);
    updateMovieCount();
    populateMovieFilters();
    applyMovieFilters();
    if (currentTab === 'images') renderImagesTab();
}

// Handle edit star
async function handleEditStar(e) {
    e.preventDefault();

    const name = document.getElementById('editStarName').value.trim();
    const pictureUrl = document.getElementById('editStarPictureUrl').value.trim();

    if (!name) { alert('Star name is required!'); return; }
    if (!pictureUrl) { alert('Picture URL is required!'); return; }

    currentStar.name = name;
    currentStar.pictureUrl = pictureUrl;

    try {
        const response = await fetch(`${API_URL}/stars/${currentStar.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, pictureUrl })
        });
        if (!response.ok) throw new Error('Server error');
    } catch (error) {
        console.log('Server not running or update failed, saving to localStorage only...');
    }

    saveData();
    closeEditStarModalDialog();
    starTitle.textContent = name;
    starNameElement.textContent = name;
    starImage.src = pictureUrl;
    populateMovieFilters();
}

// Edit movie
function editMovie(index) {
    editingMovieIndex = index;
    const movie = currentStar.movies[index];
    movieModalTitle.textContent = 'Edit Movie';
    document.getElementById('movieTitle').value = movie.videoTitle;
    document.getElementById('siteName').value = movie.siteName;
    document.getElementById('videoUrl').value = movie.videoUrl || '';
    document.getElementById('previewVideoUrl').value = movie.previewVideoUrl || '';
    document.getElementById('movieImages').value = movie.images || '';
    document.getElementById('movieStars').value = currentStar.name;

    // Pre-fill album config from existing albumImages if present
    albumSourceHtml.value = '';
    albumBaseUrl.value = '';
    albumConfigPreview.hidden = true;
    // Show the album section on edit if it had album images
    if (movie.albumImages) {
        albumConfigDetails.setAttribute('open', '');
        // Show existing album image count as informational
        const existingCount = splitCommaSeparated(movie.albumImages).length;
        if (existingCount > 0) {
            // We don't set the fields, but we show it as open so user knows album exists
        }
    }

    addMovieModal.classList.add('show');
}

// Delete movie
async function deleteMovie(index) {
    if (confirm('Are you sure you want to delete this movie?')) {
        try {
            const response = await fetch(`${API_URL}/stars/${currentStar.id}/movies/${index}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                currentStar.movies.splice(index, 1);
                saveData();
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            console.log('Server not running, deleting from localStorage only...');
            currentStar.movies.splice(index, 1);
            saveData();
        }
        updateMovieCount();
        populateMovieFilters();
        applyMovieFilters();
        if (currentTab === 'images') renderImagesTab();
    }
}

function saveData() {
    localStorage.setItem('starsData', JSON.stringify(starsData));
}

// Delete star
async function deleteStar() {
    if (!confirm(`Are you sure you want to delete "${currentStar.name}" and all their movies?`)) return;

    try {
        const response = await fetch(`${API_URL}/stars/${currentStar.id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Server error');
    } catch (error) {
        console.log('Server not running or delete failed, updating localStorage only...');
    }

    starsData = starsData.filter(star => star.id !== currentStar.id);
    saveData();
    window.location.href = 'index.html';
}

function goBack() {
    window.location.href = 'index.html';
}
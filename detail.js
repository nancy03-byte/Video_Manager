// API Base URL
const API_URL = 'http://localhost:3000/api';

// DOM Elements
const backBtn = document.getElementById('backBtn');
const addMovieBtn = document.getElementById('addMovieBtn');
const editStarBtn = document.getElementById('editStarBtn');
const deleteStarBtn = document.getElementById('deleteStarBtn');
const addMovieModal = document.getElementById('addMovieModal');
const closeMovieModal = document.getElementById('closeMovieModal');
const addMovieForm = document.getElementById('addMovieForm');
const editStarModal = document.getElementById('editStarModal');
const closeEditStarModal = document.getElementById('closeEditStarModal');
const editStarForm = document.getElementById('editStarForm');
const movieSiteFilter = document.getElementById('movieSiteFilter');
const resetMovieFiltersBtn = document.getElementById('resetMovieFiltersBtn');
const starImage = document.getElementById('starImage');
const starNameElement = document.getElementById('starName');
const starTitle = document.getElementById('starTitle');
const movieCount = document.getElementById('movieCount');
const moviesGrid = document.getElementById('moviesGrid');

// Global data
let currentStar = null;
let starsData = [];
let filteredMovies = [];
let slideShowIntervals = {};
let editingMovieIndex = null;
let movieSiteFilterDropdown = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const starId = parseInt(params.get('starId'));

    setupMovieFilterDropdown();
    await loadData();
    loadStarDetails(starId);
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    backBtn.addEventListener('click', goBack);
    addMovieBtn.addEventListener('click', openAddMovieModal);
    editStarBtn.addEventListener('click', openEditStarModal);
    deleteStarBtn.addEventListener('click', deleteStar);
    closeMovieModal.addEventListener('click', () => closeMovieModalDialog());
    closeEditStarModal.addEventListener('click', () => closeEditStarModalDialog());
    addMovieForm.addEventListener('submit', handleAddMovie);
    editStarForm.addEventListener('submit', handleEditStar);
    resetMovieFiltersBtn.addEventListener('click', resetMovieFilters);
    window.addEventListener('click', (e) => {
        if (e.target === addMovieModal) closeMovieModalDialog();
        if (e.target === editStarModal) closeEditStarModalDialog();
    });
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
    if (!state) {
        return;
    }

    const nextOpen = typeof forceOpen === "boolean" ? forceOpen : !state.isOpen;
    state.isOpen = nextOpen;
    state.panel.hidden = !nextOpen;
    state.root.classList.toggle("is-open", nextOpen);
    state.button.setAttribute("aria-expanded", String(nextOpen));
}

function closeAllDropdowns() {
    if (movieSiteFilterDropdown) {
        closeDropdown(movieSiteFilterDropdown);
    }
}

function closeDropdown(state) {
    if (!state) {
        return;
    }

    state.isOpen = false;
    state.panel.hidden = true;
    state.root.classList.remove("is-open");
    state.button.setAttribute("aria-expanded", "false");
}

function setDropdownOptions(state, options) {
    if (!state) {
        return;
    }

    state.options = options;
    const validValues = new Set(options.map((option) => option.value));
    state.selected = new Set(Array.from(state.selected).filter((value) => validValues.has(value)));
    renderDropdown(state);
}

function renderDropdown(state) {
    if (!state) {
        return;
    }

    const sortedOptions = [...state.options].sort((left, right) => {
        const leftSelected = state.selected.has(left.value);
        const rightSelected = state.selected.has(right.value);

        if (leftSelected !== rightSelected) {
            return leftSelected ? -1 : 1;
        }

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
    if (!state) {
        return;
    }

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

// Load from localStorage fallback
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

// Load star details
function loadStarDetails(starId) {
    currentStar = starsData.find(star => star.id === starId);

    if (!currentStar) {
        alert('Star not found!');
        window.location.href = 'index.html';
        return;
    }

    // Update header and info
    starTitle.textContent = currentStar.name;
    starNameElement.textContent = currentStar.name;
    starImage.src = currentStar.pictureUrl;
    starImage.onerror = () => {
        starImage.src = 'https://via.placeholder.com/250x300?text=Image+Not+Found';
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

function getSingleUrl(value) {
    return value ? String(value).trim() : '';
}

function getMovieSiteValues(movies) {
    const sites = Array.isArray(movies)
        ? movies
            .map(movie => movie.siteName || movie.siteNameLink || movie.siteUrl || '')
            .filter(Boolean)
        : [];

    return Array.from(new Set(sites));
}

function getMovieSiteFilterValues(movies) {
    return getMovieSiteValues(movies)
        .map(normalizeSiteFilterValue)
        .filter(Boolean);
}

// Utility: Extract domain name from URL or plain domain
function extractDomainName(value) {
    if (!value) {
        return 'Site';
    }

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
    if (!value) {
        return '';
    }

    const trimmedValue = String(value).trim();
    if (!trimmedValue) {
        return '';
    }

    try {
        const normalizedValue = trimmedValue.includes('://') ? trimmedValue : `https://${trimmedValue}`;
        const urlObj = new URL(normalizedValue);
        return urlObj.hostname.replace(/^www\./i, '').toLowerCase();
    } catch (error) {
        return trimmedValue
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./i, '')
            .split('/')[0]
            .trim()
            .toLowerCase();
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

function applyMovieFilters() {
    const selectedSites = new Set(movieSiteFilterDropdown?.selected || []);

    filteredMovies = currentStar.movies.filter(movie => {
        const matchesSites =
            selectedSites.size === 0 ||
            getMovieSiteFilterValues([movie]).some(site => selectedSites.has(site));

        return matchesSites;
    });

    renderMovies();
}

function resetMovieFilters() {
    if (movieSiteFilterDropdown) {
        movieSiteFilterDropdown.selected.clear();
        renderDropdown(movieSiteFilterDropdown);
    }
    applyMovieFilters();
}

function createThumbnail(movie, index) {
    const images = splitCommaSeparated(movie.images);
    const previewUrl = getSingleUrl(movie.previewVideoUrl);
    const hasImages = images.length > 0;
    const hasPreview = Boolean(previewUrl);

    if (hasImages) {
        const slidesHTML = images.map((img, imgIndex) => `
            <div class="slide ${imgIndex === 0 ? 'active' : ''}" style="opacity: ${imgIndex === 0 ? '1' : '0'};">
                <img src="${img}" alt="Movie image ${imgIndex + 1}" onerror="this.src='https://via.placeholder.com/300x180?text=Image+Not+Found'">
            </div>
        `).join('');

        const previewVideoHTML = hasPreview ? `
            <video class="preview-video-element" muted loop playsinline preload="metadata">
                <source src="${previewUrl}" type="video/mp4">
            </video>
        ` : '';

        return `
            <div class="movie-thumbnail image-slideshow${hasPreview ? ' has-preview' : ''}" data-movie-index="${index}" data-has-images="true" data-has-preview="${hasPreview}">
                <div class="slideshow-container">
                    ${slidesHTML}
                    ${previewVideoHTML}
                </div>
            </div>
        `;
    }

    if (hasPreview) {
        return `
            <div class="movie-thumbnail preview-video" data-movie-index="${index}" data-has-images="false" data-has-preview="true">
                <video class="preview-video-element preview-video-autoplay" muted loop playsinline autoplay preload="metadata">
                    <source src="${previewUrl}" type="video/mp4">
                </video>
            </div>
        `;
    }

    return `
        <div class="movie-thumbnail generic-video" data-movie-index="${index}" data-has-images="false" data-has-preview="false">
            <div class="video-icon">▶</div>
            <div class="video-text">No Preview</div>
        </div>
    `;
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

function renderMovies() {
    moviesGrid.innerHTML = '';

    const movies = Array.isArray(filteredMovies) ? filteredMovies : [];

    if (movies.length === 0) {
        moviesGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>No movies match the selected site filter.</p></div>';
        return;
    }

    movies.forEach((movie, index) => {
        const movieIndex = currentStar.movies.indexOf(movie);
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';

        const images = splitCommaSeparated(movie.images);
        const watchUrls = splitCommaSeparated(movie.videoUrl);
        const siteLink = getLinkValue(movie.siteName || '');
        const siteDomain = extractDomainName(movie.siteName || movie.siteNameLink || movie.siteUrl || '');
        const previewUrl = getSingleUrl(movie.previewVideoUrl);

        const sitePreviewButtonsHTML = createSitePreviewButtonRow(
            `<button class="btn-site" data-open-url="${siteLink}">${siteDomain}</button>`,
            previewUrl ? `<button class="btn-preview" data-open-url="${previewUrl}">Preview</button>` : ''
        );

        const watchButtonsHTML = createFixedButtonRow(
            'video-button-row',
            watchUrls.length > 0
                ? watchUrls.map(url => `<button class="btn-watch" data-open-url="${url}">Video</button>`).join('')
                : '',
            'Video'
        );

        const actionButtonsHTML = `
            <div class="movie-buttons-row action-buttons-row fixed-row">
                <button class="btn-edit" data-edit-index="${movieIndex}">Edit</button>
                <button class="btn-delete-movie" data-delete-index="${movieIndex}">Delete</button>
            </div>
        `;

        movieCard.innerHTML = `
            ${createThumbnail(movie, movieIndex)}
            <div class="movie-info">
                <h4>${movie.videoTitle}</h4>
                ${images.length > 0 ? `<p><strong>Images:</strong> ${images.length} image${images.length !== 1 ? 's' : ''}</p>` : '<p class="movie-info-placeholder">&nbsp;</p>'}
                ${sitePreviewButtonsHTML}
                ${watchButtonsHTML}
                ${actionButtonsHTML}
            </div>
        `;

        movieCard.querySelectorAll('[data-open-url]').forEach(button => {
            button.addEventListener('click', () => openInNewTab(button.dataset.openUrl));
        });

        const previewVideo = movieCard.querySelector('.preview-video-element');
        if (previewVideo) {
            const hasImages = images.length > 0;
            if (!hasImages) {
                playPreviewVideo(previewVideo);
            }
            movieCard.addEventListener('mouseenter', () => {
                if (hasImages) {
                    stopSlideshow(movieIndex);
                    playPreviewVideo(previewVideo);
                }
            });
            movieCard.addEventListener('mouseleave', () => {
                if (hasImages) {
                    pausePreviewVideo(previewVideo);
                    startSlideshow(movieIndex);
                }
            });
        }

        movieCard.querySelector('[data-edit-index]')?.addEventListener('click', () => editMovie(movieIndex));
        movieCard.querySelector('[data-delete-index]')?.addEventListener('click', () => deleteMovie(movieIndex));

        if (images.length > 1) {
            setTimeout(() => startSlideshow(movieIndex), 100);
        }

        moviesGrid.appendChild(movieCard);
    });
}

// Start auto-rotating slideshow
function startSlideshow(movieIndex) {
    if (slideShowIntervals[movieIndex]) {
        return;
    }

    slideShowIntervals[movieIndex] = setInterval(() => {
        const movieCard = document.querySelector(`[data-movie-index="${movieIndex}"]`);
        if (!movieCard) {
            stopSlideshow(movieIndex);
            return;
        }

        const slides = movieCard.querySelectorAll('.slide');
        if (slides.length <= 1) {
            return;
        }

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

function playPreviewVideo(videoElement) {
    if (!videoElement) {
        return;
    }

    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
    }
}

function pausePreviewVideo(videoElement) {
    if (!videoElement) {
        return;
    }

    videoElement.pause();
    videoElement.currentTime = 0;
}

// Open URL in new tab
function openInNewTab(url) {
    window.open(url, '_blank');
}

// Extract YouTube video ID
function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
}

// Open add movie modal
function openAddMovieModal() {
    addMovieModal.classList.add('show');
}

// Open edit star modal
function openEditStarModal() {
    document.getElementById('editStarName').value = currentStar.name;
    document.getElementById('editStarPictureUrl').value = currentStar.pictureUrl;
    editStarModal.classList.add('show');
}

// Close modal
function closeMovieModalDialog() {
    addMovieModal.classList.remove('show');
    addMovieForm.reset();
    editingMovieIndex = null;
    addMovieModal.querySelector('.modal-content h2').textContent = 'Add New Movie';
}

function closeEditStarModalDialog() {
    editStarModal.classList.remove('show');
    editStarForm.reset();
}

// Handle add movie
async function handleAddMovie(e) {
    e.preventDefault();

    const videoTitle = document.getElementById('movieTitle').value.trim();
    const siteName = document.getElementById('siteName').value.trim();
    const videoUrl = document.getElementById('videoUrl').value.trim();
    const previewVideoUrl = document.getElementById('previewVideoUrl').value.trim();
    const movieImages = document.getElementById('movieImages').value.trim();

    if (!videoTitle) {
        alert('Video Title is required!');
        return;
    }
    if (!siteName) {
        alert('Site Name is required!');
        return;
    }

    const moviePayload = {
        videoTitle,
        siteName,
        videoUrl,
        previewVideoUrl,
        images: movieImages
    };

    const isEditing = editingMovieIndex !== null;

    if (isEditing) {
        currentStar.movies[editingMovieIndex] = moviePayload;
    } else {
        currentStar.movies.push(moviePayload);
    }

    try {
        const response = await fetch(
            isEditing
                ? `${API_URL}/stars/${currentStar.id}/movies/${editingMovieIndex}`
                : `${API_URL}/stars/${currentStar.id}/movies`,
            {
                method: isEditing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(moviePayload)
            }
        );

        if (!response.ok) {
            throw new Error('Server error');
        }
    } catch (error) {
        console.log('Server not running or update failed, saving to localStorage only...');
    }

    saveData();
    closeMovieModalDialog();
    updateMovieCount();
    populateMovieFilters();
    applyMovieFilters();
}

// Handle edit star
async function handleEditStar(e) {
    e.preventDefault();

    const name = document.getElementById('editStarName').value.trim();
    const pictureUrl = document.getElementById('editStarPictureUrl').value.trim();

    if (!name) {
        alert('Star name is required!');
        return;
    }
    if (!pictureUrl) {
        alert('Picture URL is required!');
        return;
    }

    currentStar.name = name;
    currentStar.pictureUrl = pictureUrl;

    try {
        const response = await fetch(`${API_URL}/stars/${currentStar.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, pictureUrl })
        });

        if (!response.ok) {
            throw new Error('Server error');
        }
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

    document.getElementById('movieTitle').value = movie.videoTitle;
    document.getElementById('siteName').value = movie.siteName;
    document.getElementById('videoUrl').value = movie.videoUrl || '';
    document.getElementById('previewVideoUrl').value = movie.previewVideoUrl || '';
    document.getElementById('movieImages').value = movie.images || '';

    addMovieModal.querySelector('.modal-content h2').textContent = 'Edit Movie';
    openAddMovieModal();
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
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('starsData', JSON.stringify(starsData));
}

// Delete star
async function deleteStar() {
    if (!confirm(`Are you sure you want to delete "${currentStar.name}" and all their movies?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/stars/${currentStar.id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Server error');
        }
    } catch (error) {
        console.log('Server not running or delete failed, updating localStorage only...');
    }

    starsData = starsData.filter(star => star.id !== currentStar.id);
    saveData();
    window.location.href = 'index.html';
}

// Go back to home
function goBack() {
    window.location.href = 'index.html';
}

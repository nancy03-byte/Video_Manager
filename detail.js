// API Base URL
const API_URL = 'http://localhost:3000/api';

// DOM Elements
const backBtn = document.getElementById('backBtn');
const addMovieBtn = document.getElementById('addMovieBtn');
const deleteStarBtn = document.getElementById('deleteStarBtn');
const addMovieModal = document.getElementById('addMovieModal');
const closeMovieModal = document.getElementById('closeMovieModal');
const addMovieForm = document.getElementById('addMovieForm');
const starImage = document.getElementById('starImage');
const starNameElement = document.getElementById('starName');
const starTitle = document.getElementById('starTitle');
const movieCount = document.getElementById('movieCount');
const moviesGrid = document.getElementById('moviesGrid');

// Global data
let currentStar = null;
let starsData = [];
let slideShowIntervals = {};
let editingMovieIndex = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const starId = parseInt(params.get('starId'));

    await loadData();
    loadStarDetails(starId);
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    backBtn.addEventListener('click', goBack);
    addMovieBtn.addEventListener('click', openAddMovieModal);
    deleteStarBtn.addEventListener('click', deleteStar);
    closeMovieModal.addEventListener('click', closeModal);
    addMovieForm.addEventListener('submit', handleAddMovie);
    window.addEventListener('click', (e) => {
        if (e.target === addMovieModal) closeModal();
    });
}

// Load data from API or localStorage
async function loadData() {
    try {
        // Try to load from API first (if server is running)
        const response = await fetch(`${API_URL}/stars`);
        if (response.ok) {
            starsData = await response.json();
            localStorage.setItem('starsData', JSON.stringify(starsData));
        } else {
            loadFromLocalStorage();
        }
    } catch (error) {
        console.log('Server not running, loading from localStorage...');
        loadFromLocalStorage();
    }
}

// Load from localStorage fallback
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('starsData');
    if (savedData) {
        starsData = JSON.parse(savedData);
    } else {
        try {
            fetch('data.json')
                .then(res => res.json())
                .then(data => {
                    starsData = data.stars;
                    localStorage.setItem('starsData', JSON.stringify(starsData));
                });
        } catch (error) {
            console.error('Error loading data.json:', error);
        }
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
    movieCount.textContent = `${currentStar.movies.length} movie${currentStar.movies.length !== 1 ? 's' : ''}`;

    renderMovies();
}

// Utility: Extract domain name from URL
function extractDomainName(url) {
    try {
        const urlObj = new URL(url);
        let domain = urlObj.hostname.replace('www.', '');
        domain = domain.split('.')[0]; // Get first part before TLD
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (e) {
        return 'Site';
    }
}

// Render movies grid
function renderMovies() {
    moviesGrid.innerHTML = '';

    if (currentStar.movies.length === 0) {
        moviesGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>No movies added yet. Click "Add Movie" to get started!</p></div>';
        return;
    }

    currentStar.movies.forEach((movie, index) => {
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';

        // Parse images
        const images = movie.images ? movie.images.split(',').map(img => img.trim()).filter(img => img) : [];

        // Parse URLs
        const previewUrls = movie.previewVideoUrl ? movie.previewVideoUrl.split(',').map(url => url.trim()).filter(url => url) : [];
        const watchUrls = movie.videoUrl ? movie.videoUrl.split(',').map(url => url.trim()).filter(url => url) : [];

        // Extract site name for button
        const siteDomain = extractDomainName(movie.siteName.includes('http') ? movie.siteName : `https://${movie.siteName}`);

        // Build thumbnail HTML
        let thumbnailHTML = '';
        if (images.length > 0) {
            let slidesHTML = images.map((img, imgIndex) => `
                <div class="slide ${imgIndex === 0 ? 'active' : ''}" style="opacity: ${imgIndex === 0 ? '1' : '0'};">
                    <img src="${img}" alt="Movie image ${imgIndex + 1}" onerror="this.src='https://via.placeholder.com/300x180?text=Image+Not+Found'">
                </div>
            `).join('');

            thumbnailHTML = `
                <div class="movie-thumbnail image-slideshow" data-movie-index="${index}">
                    <div class="slideshow-container">
                        ${slidesHTML}
                        <div class="video-preview-overlay">
                            <div class="video-icon">▶</div>
                            <div class="video-text">Play Video</div>
                        </div>
                    </div>
                </div>
            `;

            setTimeout(() => startSlideshow(index), 100);
        } else {
            thumbnailHTML = `
                <div class="movie-thumbnail generic-video">
                    <div class="video-icon">▶</div>
                    <div class="video-text">${siteDomain}</div>
                </div>
            `;
        }

        // Build buttons HTML
        let buttonsHTML = `
            <div class="movie-buttons-row site-button-row">
                <button class="btn-site" onclick="openInNewTab('${movie.siteName.includes('http') ? movie.siteName : 'https://' + movie.siteName}')">${siteDomain}</button>
            </div>
        `;

        // Add preview video buttons
        if (previewUrls.length > 0) {
            buttonsHTML += '<div class="movie-buttons-row">';
            previewUrls.forEach(url => {
                const domain = extractDomainName(url);
                buttonsHTML += `<button class="btn-preview" onclick="openInNewTab('${url}')">Preview: ${domain}</button>`;
            });
            buttonsHTML += '</div>';
        }

        // Add watch video buttons
        if (watchUrls.length > 0) {
            buttonsHTML += '<div class="movie-buttons-row">';
            watchUrls.forEach(url => {
                const domain = extractDomainName(url);
                buttonsHTML += `<button class="btn-watch" onclick="openInNewTab('${url}')">Watch: ${domain}</button>`;
            });
            buttonsHTML += '</div>';
        }

        // Add edit/delete buttons
        buttonsHTML += `
            <div class="movie-buttons-row action-buttons-row">
                <button class="btn-edit" onclick="editMovie(${index})">Edit</button>
                <button class="btn-delete-movie" onclick="deleteMovie(${index})">Delete</button>
            </div>
        `;

        movieCard.innerHTML = `
            ${thumbnailHTML}
            <div class="movie-info">
                <h4>${movie.videoTitle}</h4>
                ${images.length > 0 ? `<p><strong>Images:</strong> ${images.length} image${images.length !== 1 ? 's' : ''}</p>` : ''}
                ${buttonsHTML}
            </div>
        `;
        moviesGrid.appendChild(movieCard);
    });
}

// Start auto-rotating slideshow
function startSlideshow(movieIndex) {
    // Clear existing interval if any
    if (slideShowIntervals[movieIndex]) {
        clearInterval(slideShowIntervals[movieIndex]);
    }

    // Auto-rotate every 3 seconds
    slideShowIntervals[movieIndex] = setInterval(() => {
        const movieCard = document.querySelector(`[data-movie-index="${movieIndex}"]`);
        if (movieCard) {
            const slides = movieCard.querySelectorAll('.slide');
            const activeSlide = movieCard.querySelector('.slide.active');
            const currentIndex = Array.from(slides).indexOf(activeSlide);
            const nextIndex = (currentIndex + 1) % slides.length;
            
            activeSlide.classList.remove('active');
            activeSlide.style.opacity = '0';
            
            slides[nextIndex].classList.add('active');
            slides[nextIndex].style.opacity = '1';
        }
    }, 3000);
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

// Close modal
function closeModal() {
    addMovieModal.classList.remove('show');
    addMovieForm.reset();
    editingMovieIndex = null;
    document.querySelector('.modal-content h2').textContent = 'Add New Movie';
}

// Handle add movie
async function handleAddMovie(e) {
    e.preventDefault();

    const videoTitle = document.getElementById('movieTitle').value.trim();
    const siteName = document.getElementById('siteName').value.trim();
    const videoUrl = document.getElementById('videoUrl').value.trim();
    const previewVideoUrl = document.getElementById('previewVideoUrl').value.trim();
    const movieImages = document.getElementById('movieImages').value.trim();

    // Validation
    if (!videoTitle) {
        alert('Video Title is required!');
        return;
    }
    if (!siteName) {
        alert('Site Name is required!');
        return;
    }

    if (editingMovieIndex !== null) {
        // Update existing movie
        currentStar.movies[editingMovieIndex] = {
            videoTitle,
            siteName,
            videoUrl,
            previewVideoUrl,
            images: movieImages
        };
        editingMovieIndex = null;
        document.querySelector('.modal-content h2').textContent = 'Add New Movie';
    } else {
        // Add new movie
        const newMovie = {
            videoTitle,
            siteName,
            videoUrl,
            previewVideoUrl,
            images: movieImages
        };
        currentStar.movies.push(newMovie);
    }

    try {
        // Try to send to API (if server is running)
        const response = await fetch(`${API_URL}/stars/${currentStar.id}/movies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentStar.movies[editingMovieIndex !== null ? editingMovieIndex : currentStar.movies.length - 1])
        });

        if (response.ok) {
            saveData();
        }
    } catch (error) {
        console.log('Server not running, saving to localStorage only...');
        saveData();
    }

    closeModal();
    movieCount.textContent = `${currentStar.movies.length} movie${currentStar.movies.length !== 1 ? 's' : ''}`;
    renderMovies();
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

    document.querySelector('.modal-content h2').textContent = 'Edit Movie';
    openAddMovieModal();
}

// Delete movie
async function deleteMovie(index) {
    if (confirm('Are you sure you want to delete this movie?')) {
        try {
            // Try to send delete request to API (if server is running)
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
            // Fallback to localStorage if server not running
            console.log('Server not running, deleting from localStorage only...');
            currentStar.movies.splice(index, 1);
            saveData();
        }

        movieCount.textContent = `${currentStar.movies.length} movie${currentStar.movies.length !== 1 ? 's' : ''}`;
        renderMovies();
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
        // Remove from array
        starsData = starsData.filter(star => star.id !== currentStar.id);
        saveData();
        
        // Go back to home
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error deleting star:', error);
        alert('Failed to delete star');
    }
}

// Go back to home
function goBack() {
    window.location.href = 'index.html';
}

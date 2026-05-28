// Data file path
const DATA_FILE = 'data.json';

// DOM Elements
const starsGrid = document.getElementById('starsGrid');
const nameFilter = document.getElementById('nameFilter');
const checkboxContainer = document.getElementById('checkboxContainer');
const addStarBtn = document.getElementById('addStarBtn');
const addStarModal = document.getElementById('addStarModal');
const closeAddModal = document.getElementById('closeAddModal');
const addStarForm = document.getElementById('addStarForm');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// Global data
let starsData = [];
let filteredStars = [];
let selectedCheckboxes = new Set();

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    addStarBtn.addEventListener('click', openAddModal);
    closeAddModal.addEventListener('click', closeModal);
    addStarForm.addEventListener('submit', handleAddStar);
    nameFilter.addEventListener('change', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    window.addEventListener('click', (e) => {
        if (e.target === addStarModal) closeModal();
    });
}

// API Base URL
const API_URL = 'http://localhost:3000/api';

// Load data from JSON
async function loadData() {
    try {
        // Try to load from API first (if server is running)
        const response = await fetch(`${API_URL}/stars`);
        if (response.ok) {
            starsData = await response.json();
            saveData(); // Also save to localStorage
        } else {
            loadFromLocalStorage();
        }
    } catch (error) {
        console.log('Server not running, loading from localStorage...');
        loadFromLocalStorage();
    }

    renderStars();
    populateFilters();
}

// Load from localStorage fallback
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('starsData');
    if (savedData) {
        starsData = JSON.parse(savedData);
    } else {
        // Load from data.json
        fetch('data.json')
            .then(res => res.json())
            .then(data => {
                starsData = data.stars;
                saveData();
            })
            .catch(error => {
                console.error('Error loading data.json:', error);
                starsData = [];
            });
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('starsData', JSON.stringify(starsData));
}

// Render stars grid
function renderStars() {
    starsGrid.innerHTML = '';

    if (filteredStars.length === 0 && starsData.length > 0) {
        filteredStars = [...starsData];
    }

    if (filteredStars.length === 0) {
        starsGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p>No stars found. Add a new star to get started!</p></div>';
        return;
    }

    filteredStars.forEach(star => {
        const starCard = document.createElement('div');
        starCard.className = 'star-card';
        starCard.innerHTML = `
            <img src="${star.pictureUrl}" alt="${star.name}" class="star-card-image" onerror="this.src='https://via.placeholder.com/300x400?text=Image+Not+Found'">
            <div class="star-card-content">
                <h3>${star.name}</h3>
                <p>${star.movies.length} movies</p>
            </div>
        `;
        starCard.addEventListener('click', () => goToStarDetail(star.id));
        starsGrid.appendChild(starCard);
    });
}

// Populate filter dropdowns and checkboxes
function populateFilters() {
    // Clear existing options and checkboxes
    nameFilter.innerHTML = '<option value="">All Stars</option>';
    checkboxContainer.innerHTML = '';

    // Add options to dropdown and checkboxes
    starsData.forEach(star => {
        // Add to dropdown
        const option = document.createElement('option');
        option.value = star.id;
        option.textContent = star.name;
        nameFilter.appendChild(option);

        // Add checkbox
        const checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'checkbox-wrapper';
        checkboxWrapper.innerHTML = `
            <input type="checkbox" id="checkbox-${star.id}" value="${star.id}">
            <label for="checkbox-${star.id}">${star.name}</label>
        `;
        checkboxContainer.appendChild(checkboxWrapper);

        const checkbox = checkboxWrapper.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedCheckboxes.add(star.id);
            } else {
                selectedCheckboxes.delete(star.id);
            }
            applyFilters();
        });
    });
}

// Apply filters
function applyFilters() {
    const selectedName = nameFilter.value;

    filteredStars = starsData.filter(star => {
        // If dropdown is selected, filter by dropdown
        if (selectedName) {
            return star.id == selectedName;
        }
        // If checkboxes are selected, filter by checkboxes
        if (selectedCheckboxes.size > 0) {
            return selectedCheckboxes.has(star.id);
        }
        // Otherwise show all
        return true;
    });

    renderStars();
}

// Reset filters
function resetFilters() {
    nameFilter.value = '';
    selectedCheckboxes.clear();
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    filteredStars = [...starsData];
    renderStars();
}

// Open add star modal
function openAddModal() {
    addStarModal.classList.add('show');
}

// Close modal
function closeModal() {
    addStarModal.classList.remove('show');
    addStarForm.reset();
}

// Handle add star
async function handleAddStar(e) {
    e.preventDefault();

    const name = document.getElementById('starName').value;
    const pictureUrl = document.getElementById('starPictureUrl').value;

    try {
        // Try to send to API (if server is running)
        const response = await fetch(`${API_URL}/stars`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, pictureUrl })
        });

        if (response.ok) {
            const newStar = await response.json();
            starsData.push(newStar);
            saveData();
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        // Fallback to localStorage if server not running
        console.log('Server not running, saving to localStorage only...');
        const newStar = {
            id: Date.now(),
            name: name,
            pictureUrl: pictureUrl,
            movies: []
        };
        starsData.push(newStar);
        saveData();
    }

    closeModal();
    populateFilters();
    resetFilters();
}

// Go to star detail page
function goToStarDetail(starId) {
    window.location.href = `detail.html?starId=${starId}`;
}

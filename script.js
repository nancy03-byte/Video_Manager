// Data file path
const DATA_FILE = "data.json";

// DOM Elements
const starsGrid = document.getElementById("starsGrid");
const searchInput = document.getElementById("searchInput");
const starFilterMount = document.getElementById("starFilter");
const siteFilterMount = document.getElementById("siteFilter");
const addStarBtn = document.getElementById("addStarBtn");
const addStarModal = document.getElementById("addStarModal");
const closeAddModal = document.getElementById("closeAddModal");
const addStarForm = document.getElementById("addStarForm");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

// Global data
let starsData = [];
let filteredStars = [];
const filterDropdowns = { star: null, site: null };

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
    setupFilterDropdowns();
    await loadData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    addStarBtn.addEventListener("click", openAddModal);
    closeAddModal.addEventListener("click", closeModal);
    addStarForm.addEventListener("submit", handleAddStar);
    searchInput.addEventListener("input", applyFilters);
    resetFiltersBtn.addEventListener("click", resetFilters);

    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("click", (e) => {
        if (e.target === addStarModal) closeModal();
    });
}

// API Base URL (use relative path so deployed site calls its backend)
const API_URL = '/api';

function setupFilterDropdowns() {
    filterDropdowns.star = createCheckboxDropdown(starFilterMount, {
        title: "Filter by Stars",
        emptyLabel: "All Stars"
    });

    filterDropdowns.site = createCheckboxDropdown(siteFilterMount, {
        title: "Filter by Site",
        emptyLabel: "All Sites"
    });
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
    Object.values(filterDropdowns).forEach((state) => closeDropdown(state));
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

// Load data from JSON
async function loadData() {
    try {
        const response = await fetch(`${API_URL}/stars`);
        if (response.ok) {
            starsData = await response.json();
            saveData();
        } else {
            await loadFromLocalStorage();
        }
    } catch (error) {
        console.log("Server not running, loading from localStorage...");
        await loadFromLocalStorage();
    }

    filteredStars = [...starsData];
    populateFilters();
    renderStars();
}

// Load from localStorage fallback
async function loadFromLocalStorage() {
    const savedData = localStorage.getItem("starsData");
    if (savedData) {
        starsData = JSON.parse(savedData);
        return;
    }

    try {
        const response = await fetch(DATA_FILE);
        const data = await response.json();
        starsData = data.stars;
        saveData();
    } catch (error) {
        console.error("Error loading data.json:", error);
        starsData = [];
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem("starsData", JSON.stringify(starsData));
}

function getStarSiteValues(star) {
    const sites = Array.isArray(star.movies)
        ? star.movies
            .map((movie) => movie.siteName || movie.siteNameLink || movie.siteUrl || "")
            .filter(Boolean)
        : [];

    return Array.from(new Set(sites));
}

function getStarSiteFilterValues(star) {
    return getStarSiteValues(star)
        .map(normalizeSiteFilterValue)
        .filter(Boolean);
}

function getSelectedValuesFromDropdown(state) {
    return Array.from(state?.selected || []);
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
        applyFilters();
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
            applyFilters();
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

function getSelectedValues(selectElement) {
    return Array.from(selectElement.selectedOptions).map((option) => option.value);
}

function populateFilters() {
    const starOptions = [...starsData]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((star) => ({
            value: String(star.id),
            label: star.name
        }));

    setDropdownOptions(filterDropdowns.star, starOptions);

    const siteOptionsByValue = new Map();
    starsData
        .flatMap((star) => getStarSiteValues(star))
        .forEach((site) => {
            const value = normalizeSiteFilterValue(site);
            if (value && !siteOptionsByValue.has(value)) {
                siteOptionsByValue.set(value, extractDomainName(site));
            }
        });

    const siteOptions = Array.from(siteOptionsByValue.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label));

    setDropdownOptions(filterDropdowns.site, siteOptions);
}

// Render stars grid
function renderStars() {
    starsGrid.innerHTML = "";

    if (filteredStars.length === 0) {
        starsGrid.innerHTML =
            '<div class="empty-state" style="grid-column: 1/-1;"><p>No stars found. Add a new star to get started!</p></div>';
        return;
    }

    filteredStars.forEach((star) => {
        const starCard = document.createElement("div");
        starCard.className = "star-card";
        starCard.innerHTML = `
            <img src="${star.pictureUrl}" alt="${star.name}" class="star-card-image" onerror='this.src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27400%27%3E%3Crect fill=%27%23ddd%27 width=%27100%25%27 height=%27100%25%27/%3E%3Ctext x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.1em%27 fill=%27%23666%27 font-family=%27sans-serif%27 font-size=%2718%27%3EImage Not Found%3C/text%3E%3C/svg%3E"'>
            <div class="star-card-content">
                <h3>${star.name}</h3>
                <p>${star.movies.length} movies</p>
            </div>
        `;
        starCard.addEventListener("click", () => goToStarDetail(star.id));
        starsGrid.appendChild(starCard);
    });
}

// Apply filters
function applyFilters() {
    const selectedStarIds = new Set(getSelectedValuesFromDropdown(filterDropdowns.star));
    const selectedSites = new Set(getSelectedValuesFromDropdown(filterDropdowns.site));
    const searchTerm = searchInput.value.trim().toLowerCase();

    filteredStars = starsData.filter((star) => {
        const matchesSearch = !searchTerm || star.name.toLowerCase().includes(searchTerm);
        const matchesStars = selectedStarIds.size === 0 || selectedStarIds.has(String(star.id));
        const matchesSites =
            selectedSites.size === 0 ||
            getStarSiteFilterValues(star).some((site) => selectedSites.has(site));

        return matchesSearch && matchesStars && matchesSites;
    });

    renderStars();
}

// Reset filters
function resetFilters() {
    searchInput.value = "";
    if (filterDropdowns.star) {
        filterDropdowns.star.selected.clear();
        renderDropdown(filterDropdowns.star);
    }
    if (filterDropdowns.site) {
        filterDropdowns.site.selected.clear();
        renderDropdown(filterDropdowns.site);
    }
    filteredStars = [...starsData];
    renderStars();
}

// Open add star modal
function openAddModal() {
    addStarModal.classList.add("show");
}

// Close modal
function closeModal() {
    addStarModal.classList.remove("show");
    addStarForm.reset();
}

// Handle add star
async function handleAddStar(e) {
    e.preventDefault();

    const name = document.getElementById("starName").value;
    const pictureUrl = document.getElementById("starPictureUrl").value;

    try {
        const response = await fetch(`${API_URL}/stars`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, pictureUrl })
        });

        if (response.ok) {
            const newStar = await response.json();
            starsData.push(newStar);
            saveData();
        } else {
            throw new Error("Server error");
        }
    } catch (error) {
        console.log("Server not running, saving to localStorage only...");
        const newStar = {
            id: Date.now(),
            name,
            pictureUrl,
            movies: []
        };
        starsData.push(newStar);
        saveData();
    }

    closeModal();
    populateFilters();
    resetFilters();
}

// Utility: Extract domain name from URL or plain domain
function extractDomainName(value) {
    if (!value) {
        return "Site";
    }

    try {
        const normalizedValue = value.includes("://") ? value : `https://${value}`;
        const urlObj = new URL(normalizedValue);
        const hostname = urlObj.hostname.replace(/^www\./i, "");
        const parts = hostname.split(".").filter(Boolean);
        const domainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || hostname;
        return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
    } catch (error) {
        const cleanValue = value.replace(/^www\./i, "");
        const parts = cleanValue.split(".").filter(Boolean);
        const domainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || cleanValue;
        return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
    }
}

function normalizeSiteFilterValue(value) {
    if (!value) {
        return "";
    }

    const trimmedValue = String(value).trim();
    if (!trimmedValue) {
        return "";
    }

    try {
        const normalizedValue = trimmedValue.includes("://") ? trimmedValue : `https://${trimmedValue}`;
        const urlObj = new URL(normalizedValue);
        return urlObj.hostname.replace(/^www\./i, "").toLowerCase();
    } catch (error) {
        return trimmedValue
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "")
            .split("/")[0]
            .trim()
            .toLowerCase();
    }
}

// Go to star detail page
function goToStarDetail(starId) {
    window.location.href = `detail.html?starId=${starId}`;
}

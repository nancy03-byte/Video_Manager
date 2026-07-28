// ═══════════════════════════════════════════════════════════════════════════
// Smart Image Loader — Sequential loading with IndexedDB caching
// - Load favorites first
// - Load remaining images in background sequence
// - Cache as blobs in IndexedDB (handles 1GB+ albums)
// - Recover from cache on page refresh
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch and cache a single image blob
 * @param {string} url - Image URL
 * @param {string} batchId - Album identifier (e.g., "starId_movieIndex")
 * @returns {Promise<{url, blob, cached}>}
 */
async function fetchAndCacheImage(url, batchId) {
  try {
    // Check if already cached
    const cachedBlob = await getImageBlob(url);
    if (cachedBlob) {
      return { url, blob: cachedBlob, cached: true };
    }

    // Fetch from network
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const blob = await response.blob();
    
    // Store in IndexedDB
    await storeImageBlob(url, blob, batchId);
    
    return { url, blob, cached: false };
  } catch (error) {
    console.error(`Failed to load image: ${url}`, error);
    return { url, blob: null, error: error.message, cached: false };
  }
}

/**
 * Create object URL from blob for img.src
 * @param {Blob} blob
 * @returns {string} blob URL
 */
function createBlobUrl(blob) {
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/**
 * Prepare an image for rendering by either using cached blob or network URL
 * @param {string} url - Original image URL
 * @returns {Promise<string>} - Either blob URL (if cached) or original URL
 */
async function getImageSource(url) {
  const blob = await getImageBlob(url);
  if (blob) {
    return createBlobUrl(blob);
  }
  return url;
}

/**
 * Smart load sequence: favorites first, then others in background
 * @param {string[]} allImages - All image URLs
 * @param {string[]} favoriteImages - Favorite URLs (subset of allImages)
 * @param {string} batchId - Album identifier
 * @param {Object} callbacks - {onFavoriteLoaded, onImageLoaded, onProgress, onError}
 */
async function loadImagesSmartly(allImages, favoriteImages, batchId, callbacks = {}) {
  const {
    onFavoriteLoaded = () => {},
    onImageLoaded = () => {},
    onProgress = () => {},
    onError = () => {}
  } = callbacks;

  const loadedUrls = new Set();
  const totalImages = allImages.length;
  let loadedCount = 0;

  // Separate favorites and others, preserving order
  const favoritesInOrder = favoriteImages.filter(f => allImages.includes(f));
  const otherImages = allImages.filter(url => !favoritesInOrder.includes(url));

  // Load favorites first — sequentially to avoid parallel fetch failures
  for (const url of favoritesInOrder) {
    const result = await fetchAndCacheImage(url, batchId);

    // If fetch produced a blob -> cached/network success
    if (result.blob) {
      loadedUrls.add(url);
      loadedCount++;
      onFavoriteLoaded({ url, ...result });
      onProgress({ loaded: loadedCount, total: totalImages, isFavorite: true });
      if (result.error) onError({ url, ...result });
      continue;
    }

    // Fetch failed (likely CORS or network). Fall back to waiting for the <img> to load in the DOM.
    onFavoriteLoaded({ url, ...result });
    try {
      await waitForImageToDisplay(url);
      loadedUrls.add(url);
      loadedCount++;
      onProgress({ loaded: loadedCount, total: totalImages, isFavorite: true });
    } catch (err) {
      onProgress({ loaded: loadedCount, total: totalImages, isFavorite: true });
      onError({ url, error: err && err.message ? err.message : 'display-failed' });
    }
  }

  // Load others sequentially (one-at-a-time). Wait for either a successful fetch (200) or the
  // image element to finish loading before moving to next image.
  for (const url of otherImages) {
    const result = await fetchAndCacheImage(url, batchId);

    if (result.blob) {
      loadedUrls.add(url);
      loadedCount++;
      onImageLoaded({ url, ...result });
      onProgress({ loaded: loadedCount, total: totalImages, isFavorite: false });
      if (result.error) onError({ url, ...result });
      continue;
    }

    // Fetch failed — wait for DOM image load as fallback
    onImageLoaded({ url, ...result });
    try {
      await waitForImageToDisplay(url);
      loadedUrls.add(url);
      loadedCount++;
      onProgress({ loaded: loadedCount, total: totalImages, isFavorite: false });
    } catch (err) {
      onProgress({ loaded: loadedCount, total: totalImages, isFavorite: false });
      onError({ url, error: err && err.message ? err.message : 'display-failed' });
    }
  }

  return {
    loadedCount,
    totalImages,
    successCount: loadedUrls.size,
    allUrls: allImages,
    loadedUrls: Array.from(loadedUrls)
  };
}

/**
 * Wait until the image element for `url` finishes loading (or errors).
 * Falls back to creating a temporary Image() if DOM element not present.
 * @param {string} url
 * @param {number} timeoutMs
 */
function waitForImageToDisplay(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = (img, onload, onerror, timer) => {
      if (img && onload) img.removeEventListener('load', onload);
      if (img && onerror) img.removeEventListener('error', onerror);
      if (timer) clearTimeout(timer);
    };

    const finalize = (ok, err) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };

    const imgEl = document.querySelector(`img[data-url="${url}"]`);

    const timer = setTimeout(() => {
      cleanup(targetImg, onload, onerror, timer);
      finalize(false, new Error('timeout'));
    }, timeoutMs);

    let targetImg = imgEl;

    const onload = () => {
      cleanup(targetImg, onload, onerror, timer);
      finalize(true);
    };

    const onerror = () => {
      cleanup(targetImg, onload, onerror, timer);
      finalize(false, new Error('img-error'));
    };

    if (targetImg) {
      if (targetImg.complete && targetImg.naturalWidth > 0) {
        cleanup(targetImg, onload, onerror, timer);
        finalize(true);
        return;
      }
      targetImg.addEventListener('load', onload);
      targetImg.addEventListener('error', onerror);
      return;
    }

    // No DOM img exists yet — create a temporary one to confirm load
    targetImg = new Image();
    targetImg.addEventListener('load', onload);
    targetImg.addEventListener('error', onerror);
    targetImg.src = url;
  });
}

/**
 * Get loading status: which images are cached vs not
 * @param {string[]} urls - Image URLs to check
 * @returns {Promise<Object>} - {cached: [], notCached: []}
 */
async function getLoadingStatus(urls) {
  const status = { cached: [], notCached: [] };
  
  for (const url of urls) {
    const isCached = await hasImageBlob(url);
    if (isCached) {
      status.cached.push(url);
    } else {
      status.notCached.push(url);
    }
  }
  
  return status;
}

const IMAGE_BLUR_STORAGE_KEY = 'star-library-image-blur';

function initImageBlurControls() {
  const buttons = Array.from(document.querySelectorAll('[data-blur-images-toggle]'));
  if (!buttons.length) return;

  const applyBlurState = (enabled) => {
    document.body.classList.toggle('images-blurred', enabled);

    buttons.forEach((button) => {
      button.classList.toggle('is-active', enabled);
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? '☀️ Unblur Images' : '🌫️ Blur Images';
    });
  };

  try {
    const savedState = localStorage.getItem(IMAGE_BLUR_STORAGE_KEY) === 'true';
    applyBlurState(savedState);
  } catch (error) {
    console.warn('Unable to read image blur preference:', error);
    applyBlurState(false);
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextState = !document.body.classList.contains('images-blurred');
      try {
        localStorage.setItem(IMAGE_BLUR_STORAGE_KEY, String(nextState));
      } catch (error) {
        console.warn('Unable to save image blur preference:', error);
      }
      applyBlurState(nextState);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initImageBlurControls, { once: true });
} else {
  initImageBlurControls();
}

/**
 * Clear all cached images for a batch (album)
 * @param {string} batchId
 */
async function clearBatchCache(batchId) {
  return withStore('readwrite', (store) => {
    const index = store.index('batchId');
    const range = IDBKeyRange.only(batchId);
    const request = index.openCursor(range);
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  });
}

/**
 * Get cache size for a batch in MB
 * @param {string} batchId
 * @returns {Promise<number>} Size in MB
 */
async function getBatchCacheSizeMB(batchId) {
  const bytes = await getBatchSize(batchId);
  return (bytes / (1024 * 1024)).toFixed(2);
}

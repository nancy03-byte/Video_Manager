// ═══════════════════════════════════════════════════════════════════════════
// Album Image Store — IndexedDB-based persistent storage for large albums.
// Handles 1GB+ albums using chunked blob storage.
// ═══════════════════════════════════════════════════════════════════════════

const DB_NAME = 'AlbumImagesDB';
const DB_VERSION = 1;
const STORE_NAME = 'albumImages';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('batchId', 'batchId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function withStore(mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result;
    try {
      result = callback(store);
    } catch (e) {
      reject(e);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Store a fetched image blob in IndexedDB.
 * @param {string} url - The original image URL (used as key)
 * @param {Blob} blob - The image blob data
 * @param {string} [batchId] - Optional batch identifier (e.g. album movie index)
 */
async function storeImageBlob(url, blob, batchId) {
  return withStore('readwrite', (store) => {
    store.put({ url, blob, timestamp: Date.now(), batchId: batchId || '' });
  });
}

/**
 * Retrieve an image blob from IndexedDB by URL.
 * @param {string} url
 * @returns {Promise<Blob|null>}
 */
async function getImageBlob(url) {
  return withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(url);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Check if an image URL exists in IndexedDB.
 */
async function hasImageBlob(url) {
  const blob = await getImageBlob(url);
  return blob !== null;
}

/**
 * Get total size estimate of stored images for a batch.
 * @param {string} batchId
 * @returns {Promise<number>} size in bytes
 */
async function getBatchSize(batchId) {
  return withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const index = store.index('batchId');
      const range = IDBKeyRange.only(batchId);
      const req = index.openCursor(range);
      let total = 0;
      req.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          total += cursor.value.blob ? cursor.value.blob.size : 0;
          cursor.continue();
        } else {
          resolve(total);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Delete a single image blob.
 */
async function deleteImageBlob(url) {
  return withStore('readwrite', (store) => {
    store.delete(url);
  });
}

/**
 * Clear all stored blobs for a given batch.
 */
async function clearBatch(batchId) {
  return withStore('readwrite', (store) => {
    const index = store.index('batchId');
    const range = IDBKeyRange.only(batchId);
    const req = index.openCursor(range);
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
  });
}

/**
 * Clear ALL stored blobs.
 */
async function clearAll() {
  return withStore('readwrite', (store) => {
    store.clear();
  });
}

/**
 * Try to get an image URL from IndexedDB first. If absent, fetch it,
 * store it, and return a blob URL for display.
 * @param {string} url
 * @param {string} [batchId]
 * @returns {Promise<{source: string, objectUrl?: string, blob?: Blob}>}
 */
async function resolveImageUrl(url, batchId) {
  // 1. Check IndexedDB
  const blob = await getImageBlob(url);
  if (blob) {
    const objectUrl = URL.createObjectURL(blob);
    return { source: 'idb', objectUrl, blob };
  }

  // 2. Not in IDB — try Service Worker cache
  if ('caches' in window) {
    const cache = await caches.open('star-library-images-v3').catch(() => null);
    if (cache) {
      const cachedResponse = await cache.match(url);
      if (cachedResponse && cachedResponse.ok) {
        const cachedBlob = await cachedResponse.blob();
        // Store it in IDB for persistence
        await storeImageBlob(url, cachedBlob, batchId);
        const objectUrl = URL.createObjectURL(cachedBlob);
        return { source: 'sw-cache', objectUrl, blob: cachedBlob };
      }
    }
  }

  // 3. Fetch from network
  try {
    const response = await fetch(url, { mode: 'no-cors', cache: 'force-cache' });
    const fetchedBlob = await response.blob();
    await storeImageBlob(url, fetchedBlob, batchId);
    const objectUrl = URL.createObjectURL(fetchedBlob);
    return { source: 'network', objectUrl, blob: fetchedBlob };
  } catch (_err) {
    return { source: 'error' };
  }
}

// ── Exports ───────────────────────────────────────────────────────────────
window.AlbumStore = {
  storeImageBlob,
  getImageBlob,
  hasImageBlob,
  resolveImageUrl,
  deleteImageBlob,
  clearBatch,
  clearAll,
  getBatchSize,
};

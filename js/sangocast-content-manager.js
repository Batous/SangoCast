/**
 * SANGOCAST Content Manager
 * Hybrid Data Layer for Scripture Clock
 * 
 * Manages three data sources with intelligent fallbacks:
 * 1. Embedded data (channels.json - always available)
 * 2. Cached data (localStorage/IndexedDB - from previous sessions)
 * 3. Live data (API - when online)
 * 
 * @version 1.0
 * @author SANGOCAST Team
 */

class ContentManager {
  /**
   * Configuration constants
   * @private
   */
  static CONFIG = {
    // Storage limits
    LOCALSTORAGE_LIMIT: 5 * 1024 * 1024,      // 5 MB
    INDEXEDDB_LIMIT: 50 * 1024 * 1024,        // 50 MB
    
    // Cache retention
    CACHE_RETENTION_DAYS: 30,                  // Keep last 30 days
    PURGE_AFTER_DAYS: 60,                      // Delete after 60 days
    BIBLE_CALENDAR_RETENTION_DAYS: 365,       // Exception: Bible calendars kept 1 year
    
    // API settings
    API_TIMEOUT: 10000,                        // 10 seconds
    API_BASE_URL: '/api',                      // Configure your API endpoint
    
    // Storage keys
    STORAGE_PREFIX: 'sangocast_',
    CACHE_INDEX_KEY: 'sangocast_cache_index',
    EMBEDDED_DATA_KEY: 'sangocast_embedded',
    
    // IndexedDB
    DB_NAME: 'SangocastDB',
    DB_VERSION: 1,
    STORE_NAME: 'content'
  };

  /**
   * Data source priorities
   * @private
   */
  static SOURCE = {
    LIVE: 'live',
    CACHED: 'cached',
    EMBEDDED: 'embedded'
  };

  /**
   * Initialize ContentManager
   */
  constructor() {
    this.db = null;
    this.embeddedData = null;
    this.cacheIndex = null;
    this.initialized = false;
    this.initPromise = this._initialize();
  }

  /**
   * Initialize storage systems and load embedded data
   * @private
   * @returns {Promise<void>}
   */
  async _initialize() {
    try {
      console.log('🚀 Initializing ContentManager...');

      // Initialize IndexedDB
      await this._initIndexedDB();

      // Load embedded data
      await this._loadEmbeddedData();

      // Load cache index
      this._loadCacheIndex();

      // Initial cleanup
      await this.clearOldCache();

      this.initialized = true;
      console.log('✅ ContentManager initialized successfully');
      
      // Log storage stats
      const stats = await this.getStorageStats();
      console.log('📊 Storage Stats:', stats);

    } catch (error) {
      console.error('❌ ContentManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize IndexedDB
   * @private
   * @returns {Promise<void>}
   */
  async _initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        ContentManager.CONFIG.DB_NAME,
        ContentManager.CONFIG.DB_VERSION
      );

      request.onerror = () => {
        console.warn('⚠️ IndexedDB not available, falling back to localStorage');
        resolve(); // Continue without IndexedDB
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('✅ IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(ContentManager.CONFIG.STORE_NAME)) {
          const objectStore = db.createObjectStore(
            ContentManager.CONFIG.STORE_NAME,
            { keyPath: 'id' }
          );
          
          // Create indexes
          objectStore.createIndex('channelId', 'channelId', { unique: false });
          objectStore.createIndex('dateTime', 'dateTime', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('isBibleCalendar', 'isBibleCalendar', { unique: false });
        }
      };
    });
  }

  /**
   * Load embedded data from channels.json
   * @private
   * @returns {Promise<void>}
   */
  async _loadEmbeddedData() {
    try {
      // First check if embedded data is in localStorage (for offline-first apps)
      const stored = localStorage.getItem(ContentManager.CONFIG.EMBEDDED_DATA_KEY);
      
      if (stored) {
        this.embeddedData = JSON.parse(stored);
        console.log('📦 Loaded embedded data from localStorage');
        return;
      }

      // Otherwise, fetch channels.json
      const response = await fetch('/channels.json', {
        cache: 'force-cache' // Use browser cache for embedded data
      });

      if (!response.ok) {
        throw new Error(`Failed to load channels.json: ${response.status}`);
      }

      this.embeddedData = await response.json();
      
      // Store for future offline use
      try {
        localStorage.setItem(
          ContentManager.CONFIG.EMBEDDED_DATA_KEY,
          JSON.stringify(this.embeddedData)
        );
      } catch (e) {
        console.warn('⚠️ Could not cache embedded data:', e.message);
      }

      console.log('📦 Loaded embedded data from channels.json');

    } catch (error) {
      console.error('❌ Failed to load embedded data:', error);
      this.embeddedData = { channels: [] }; // Empty fallback
    }
  }

  /**
   * Load cache index from localStorage
   * @private
   */
  _loadCacheIndex() {
    try {
      const stored = localStorage.getItem(ContentManager.CONFIG.CACHE_INDEX_KEY);
      this.cacheIndex = stored ? JSON.parse(stored) : {};
      console.log(`📇 Loaded cache index (${Object.keys(this.cacheIndex).length} entries)`);
    } catch (error) {
      console.warn('⚠️ Failed to load cache index:', error);
      this.cacheIndex = {};
    }
  }

  /**
   * Save cache index to localStorage
   * @private
   */
  _saveCacheIndex() {
    try {
      localStorage.setItem(
        ContentManager.CONFIG.CACHE_INDEX_KEY,
        JSON.stringify(this.cacheIndex)
      );
    } catch (error) {
      console.warn('⚠️ Failed to save cache index:', error);
    }
  }

  /**
   * Generate unique cache key
   * @private
   * @param {string} channelId - Channel identifier
   * @param {string|Date} dateTime - Date/time for content
   * @returns {string} Cache key
   */
  _getCacheKey(channelId, dateTime) {
    const dateStr = dateTime instanceof Date 
      ? dateTime.toISOString().split('T')[0]
      : dateTime;
    return `${channelId}_${dateStr}`;
  }

  /**
   * Get content from the appropriate source
   * Main entry point for content retrieval
   * 
   * @param {string} channelId - Channel identifier (e.g., "daily-verse", "sermon-calendar")
   * @param {string|Date} dateTime - Date/time for content
   * @param {Object} options - Optional configuration
   * @param {boolean} options.forceOnline - Force online fetch even if cached
   * @param {boolean} options.noCache - Skip cache update
   * @returns {Promise<Object>} Content object with metadata
   * 
   * @example
   * const content = await contentManager.getContent('daily-verse', new Date());
   * console.log(content.data.verse, content.source); // "John 3:16", "cached"
   */
  async getContent(channelId, dateTime, options = {}) {
    await this.initPromise; // Ensure initialization is complete

    const { forceOnline = false, noCache = false } = options;
    const cacheKey = this._getCacheKey(channelId, dateTime);

    console.log(`📖 Getting content: ${channelId} @ ${dateTime}`);

    try {
      // STRATEGY 1: Try ONLINE if network is available (and not cached or forced)
      if (window.SangocastNetworkManager?.getStatus().isOnline) {
        if (forceOnline || !this._isCacheValid(cacheKey)) {
          try {
            console.log('🌐 Attempting live fetch...');
            const liveData = await this._fetchLive(channelId, dateTime);
            
            // Cache the result (unless noCache option)
            if (!noCache) {
              await this.updateCache(channelId, dateTime, liveData);
            }
            
            return {
              data: liveData,
              source: ContentManager.SOURCE.LIVE,
              timestamp: Date.now(),
              cached: false
            };
          } catch (error) {
            console.warn('⚠️ Live fetch failed, falling back:', error.message);
            // Continue to fallback strategy
          }
        }
      }

      // STRATEGY 2: Try CACHED data
      console.log('💾 Checking cache...');
      const cachedData = await this._fetchCached(cacheKey);
      
      if (cachedData) {
        console.log('✅ Cache hit!');
        return {
          data: cachedData.data,
          source: ContentManager.SOURCE.CACHED,
          timestamp: cachedData.timestamp,
          cached: true,
          age: Date.now() - cachedData.timestamp
        };
      }

      // STRATEGY 3: Fallback to EMBEDDED data
      console.log('📦 Loading from embedded data...');
      const embeddedData = this._fetchEmbedded(channelId, dateTime);
      
      if (embeddedData) {
        console.log('✅ Embedded data found');
        return {
          data: embeddedData,
          source: ContentManager.SOURCE.EMBEDDED,
          timestamp: Date.now(),
          cached: false
        };
      }

      // ALL SOURCES FAILED
      throw new Error(`No content available for ${channelId} @ ${dateTime}`);

    } catch (error) {
      console.error('❌ Content retrieval failed:', error);
      
      // Return friendly error object
      return {
        data: null,
        source: 'error',
        error: error.message,
        timestamp: Date.now(),
        cached: false,
        fallbackMessage: this._getFallbackMessage(channelId)
      };
    }
  }

  /**
   * Fetch content from live API
   * @private
   * @param {string} channelId - Channel identifier
   * @param {string|Date} dateTime - Date/time for content
   * @returns {Promise<Object>} Live content data
   */
  async _fetchLive(channelId, dateTime) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      ContentManager.CONFIG.API_TIMEOUT
    );

    try {
      const dateStr = dateTime instanceof Date
        ? dateTime.toISOString().split('T')[0]
        : dateTime;

      const url = `${ContentManager.CONFIG.API_BASE_URL}/content/${channelId}/${dateStr}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Network timeout');
      }
      
      throw error;
    }
  }

  /**
   * Fetch content from cache (IndexedDB or localStorage)
   * @private
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object|null>} Cached content or null
   */
  async _fetchCached(cacheKey) {
    // Try IndexedDB first (preferred for larger data)
    if (this.db) {
      try {
        const data = await this._getFromIndexedDB(cacheKey);
        if (data) return data;
      } catch (error) {
        console.warn('⚠️ IndexedDB fetch failed:', error.message);
      }
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(
        ContentManager.CONFIG.STORAGE_PREFIX + cacheKey
      );
      
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('⚠️ localStorage fetch failed:', error.message);
    }

    return null;
  }

  /**
   * Get data from IndexedDB
   * @private
   * @param {string} key - Storage key
   * @returns {Promise<Object|null>}
   */
  _getFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [ContentManager.CONFIG.STORE_NAME],
        'readonly'
      );
      
      const objectStore = transaction.objectStore(ContentManager.CONFIG.STORE_NAME);
      const request = objectStore.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Fetch content from embedded data
   * @private
   * @param {string} channelId - Channel identifier
   * @param {string|Date} dateTime - Date/time for content
   * @returns {Object|null} Embedded content or null
   */
  _fetchEmbedded(channelId, dateTime) {
    if (!this.embeddedData || !this.embeddedData.channels) {
      return null;
    }

    const channel = this.embeddedData.channels.find(c => c.id === channelId);
    
    if (!channel || !channel.content) {
      return null;
    }

    // For date-based content, find matching date
    const dateStr = dateTime instanceof Date
      ? dateTime.toISOString().split('T')[0]
      : dateTime;

    // Try exact match first
    let content = channel.content.find(c => c.date === dateStr);
    
    // Fallback: Use default/fallback content if available
    if (!content && channel.defaultContent) {
      content = channel.defaultContent;
    }

    return content || null;
  }

  /**
   * Check if cache entry is still valid
   * @private
   * @param {string} cacheKey - Cache key
   * @returns {boolean} True if cache is valid
   */
  _isCacheValid(cacheKey) {
    const entry = this.cacheIndex[cacheKey];
    
    if (!entry) return false;

    const age = Date.now() - entry.timestamp;
    const maxAge = entry.isBibleCalendar
      ? ContentManager.CONFIG.BIBLE_CALENDAR_RETENTION_DAYS * 24 * 60 * 60 * 1000
      : ContentManager.CONFIG.CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    return age < maxAge;
  }

  /**
   * Update cache with new content
   * 
   * @param {string} channelId - Channel identifier
   * @param {string|Date} dateTime - Date/time for content
   * @param {Object} data - Content data to cache
   * @param {Object} options - Cache options
   * @param {boolean} options.isBibleCalendar - Flag for extended retention
   * @returns {Promise<boolean>} Success status
   * 
   * @example
   * await contentManager.updateCache('daily-verse', new Date(), verseData, {
   *   isBibleCalendar: true // Keep for 1 year instead of 30 days
   * });
   */
  async updateCache(channelId, dateTime, data, options = {}) {
    const cacheKey = this._getCacheKey(channelId, dateTime);
    const { isBibleCalendar = false } = options;

    const cacheEntry = {
      id: cacheKey,
      channelId,
      dateTime: dateTime instanceof Date ? dateTime.toISOString() : dateTime,
      data,
      timestamp: Date.now(),
      isBibleCalendar
    };

    try {
      // Try IndexedDB first
      if (this.db) {
        await this._saveToIndexedDB(cacheEntry);
        console.log(`💾 Cached to IndexedDB: ${cacheKey}`);
      } else {
        // Fallback to localStorage
        await this._saveToLocalStorage(cacheKey, cacheEntry);
        console.log(`💾 Cached to localStorage: ${cacheKey}`);
      }

      // Update cache index
      this.cacheIndex[cacheKey] = {
        timestamp: cacheEntry.timestamp,
        isBibleCalendar,
        channelId
      };
      this._saveCacheIndex();

      return true;

    } catch (error) {
      console.error('❌ Cache update failed:', error);
      return false;
    }
  }

  /**
   * Save data to IndexedDB
   * @private
   * @param {Object} data - Data to save
   * @returns {Promise<void>}
   */
  _saveToIndexedDB(data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [ContentManager.CONFIG.STORE_NAME],
        'readwrite'
      );
      
      const objectStore = transaction.objectStore(ContentManager.CONFIG.STORE_NAME);
      const request = objectStore.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save data to localStorage
   * @private
   * @param {string} key - Storage key
   * @param {Object} data - Data to save
   * @returns {Promise<void>}
   */
  async _saveToLocalStorage(key, data) {
    try {
      const serialized = JSON.stringify(data);
      
      // Check size before saving
      if (serialized.length > ContentManager.CONFIG.LOCALSTORAGE_LIMIT) {
        throw new Error('Data exceeds localStorage limit');
      }

      localStorage.setItem(
        ContentManager.CONFIG.STORAGE_PREFIX + key,
        serialized
      );

    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        // Storage full - try to free up space
        console.warn('⚠️ Storage quota exceeded, clearing old cache...');
        await this.clearOldCache();
        
        // Retry save
        localStorage.setItem(
          ContentManager.CONFIG.STORAGE_PREFIX + key,
          JSON.stringify(data)
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Clear old cached content
   * Removes entries older than retention period
   * Exception: Bible calendars are kept longer
   * 
   * @returns {Promise<Object>} Cleanup statistics
   * 
   * @example
   * const stats = await contentManager.clearOldCache();
   * console.log(`Removed ${stats.removed} old entries`);
   */
  async clearOldCache() {
    console.log('🧹 Clearing old cache...');

    const now = Date.now();
    let removed = 0;
    let kept = 0;

    for (const [cacheKey, entry] of Object.entries(this.cacheIndex)) {
      const age = now - entry.timestamp;
      
      // Determine max age based on content type
      const maxAge = entry.isBibleCalendar
        ? ContentManager.CONFIG.BIBLE_CALENDAR_RETENTION_DAYS * 24 * 60 * 60 * 1000
        : ContentManager.CONFIG.PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000;

      if (age > maxAge) {
        // Remove from storage
        await this._deleteFromStorage(cacheKey);
        
        // Remove from index
        delete this.cacheIndex[cacheKey];
        
        removed++;
      } else {
        kept++;
      }
    }

    // Save updated index
    this._saveCacheIndex();

    console.log(`✅ Cache cleanup complete: removed ${removed}, kept ${kept}`);

    return { removed, kept, timestamp: now };
  }

  /**
   * Delete entry from storage
   * @private
   * @param {string} cacheKey - Cache key
   * @returns {Promise<void>}
   */
  async _deleteFromStorage(cacheKey) {
    // Delete from IndexedDB
    if (this.db) {
      try {
        await this._deleteFromIndexedDB(cacheKey);
      } catch (error) {
        console.warn('⚠️ IndexedDB delete failed:', error.message);
      }
    }

    // Delete from localStorage
    try {
      localStorage.removeItem(ContentManager.CONFIG.STORAGE_PREFIX + cacheKey);
    } catch (error) {
      console.warn('⚠️ localStorage delete failed:', error.message);
    }
  }

  /**
   * Delete from IndexedDB
   * @private
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  _deleteFromIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [ContentManager.CONFIG.STORE_NAME],
        'readwrite'
      );
      
      const objectStore = transaction.objectStore(ContentManager.CONFIG.STORE_NAME);
      const request = objectStore.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage statistics
   * 
   * @returns {Promise<Object>} Storage usage information
   * 
   * @example
   * const stats = await contentManager.getStorageStats();
   * console.log(`Using ${stats.usedMB}MB of ${stats.limitMB}MB`);
   */
  async getStorageStats() {
    const stats = {
      localStorage: {
        used: 0,
        limit: ContentManager.CONFIG.LOCALSTORAGE_LIMIT,
        available: 0,
        entries: 0
      },
      indexedDB: {
        used: 0,
        limit: ContentManager.CONFIG.INDEXEDDB_LIMIT,
        available: 0,
        entries: 0
      },
      cache: {
        totalEntries: Object.keys(this.cacheIndex).length,
        bibleCalendarEntries: 0,
        regularEntries: 0,
        oldestEntry: null,
        newestEntry: null
      }
    };

    // Calculate localStorage usage
    let localStorageSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(ContentManager.CONFIG.STORAGE_PREFIX)) {
        const value = localStorage.getItem(key);
        localStorageSize += key.length + (value ? value.length : 0);
        stats.localStorage.entries++;
      }
    }
    stats.localStorage.used = localStorageSize;
    stats.localStorage.available = stats.localStorage.limit - localStorageSize;

    // Calculate IndexedDB usage (approximate)
    if (this.db) {
      try {
        const count = await this._countIndexedDBEntries();
        stats.indexedDB.entries = count;
        // Rough estimate: 10KB per entry
        stats.indexedDB.used = count * 10 * 1024;
        stats.indexedDB.available = stats.indexedDB.limit - stats.indexedDB.used;
      } catch (error) {
        console.warn('⚠️ Could not calculate IndexedDB usage:', error);
      }
    }

    // Analyze cache index
    let oldest = Infinity;
    let newest = 0;

    for (const entry of Object.values(this.cacheIndex)) {
      if (entry.isBibleCalendar) {
        stats.cache.bibleCalendarEntries++;
      } else {
        stats.cache.regularEntries++;
      }

      if (entry.timestamp < oldest) oldest = entry.timestamp;
      if (entry.timestamp > newest) newest = entry.timestamp;
    }

    stats.cache.oldestEntry = oldest === Infinity ? null : new Date(oldest);
    stats.cache.newestEntry = newest === 0 ? null : new Date(newest);

    return stats;
  }

  /**
   * Count entries in IndexedDB
   * @private
   * @returns {Promise<number>}
   */
  _countIndexedDBEntries() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [ContentManager.CONFIG.STORE_NAME],
        'readonly'
      );
      
      const objectStore = transaction.objectStore(ContentManager.CONFIG.STORE_NAME);
      const request = objectStore.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get fallback message for when all sources fail
   * @private
   * @param {string} channelId - Channel identifier
   * @returns {string} User-friendly error message
   */
  _getFallbackMessage(channelId) {
    const messages = {
      'daily-verse': 'Unable to load today\'s verse. Please check your connection and try again.',
      'sermon-calendar': 'Unable to load sermon schedule. Please check your connection and try again.',
      'bible-calendar': 'Unable to load Bible reading plan. Please check your connection and try again.',
      'default': 'Unable to load content. Please check your connection and try again.'
    };

    return messages[channelId] || messages.default;
  }

  /**
   * Clear all cached data (for testing/reset)
   * 
   * @returns {Promise<boolean>} Success status
   * 
   * @example
   * await contentManager.clearAllCache(); // Fresh start
   */
  async clearAllCache() {
    console.log('🗑️ Clearing all cache...');

    try {
      // Clear IndexedDB
      if (this.db) {
        const transaction = this.db.transaction(
          [ContentManager.CONFIG.STORE_NAME],
          'readwrite'
        );
        const objectStore = transaction.objectStore(ContentManager.CONFIG.STORE_NAME);
        await new Promise((resolve, reject) => {
          const request = objectStore.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      // Clear localStorage entries
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(ContentManager.CONFIG.STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear cache index
      this.cacheIndex = {};
      this._saveCacheIndex();

      console.log('✅ All cache cleared');
      return true;

    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      return false;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentManager;
}

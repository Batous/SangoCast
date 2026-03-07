/**
 * SANGOCAST BIBLE LOOKUP MODULE v5
 * Compatible with storage-adapter-FIXED.js and sangocast-universal-bible-converter-v2.js
 * Production-ready with robust error handling and indexing
 */

const SangocastBibleLookup = (() => {
  'use strict';

  // ========================================
  // CONFIGURATION
  // ========================================
  
  const BASE_PATH = (() => {
    if (typeof window !== 'undefined') {
      return window.location.origin + '/';
    }
    return '';
  })();

  const CONFIG = {
    CACHE_KEY: 'sangocast_bible_cache',
    CACHE_MAX_SIZE: 50,
    CACHE_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days
    STORAGE_PREFIX: 'sangocast_bible_',
    BIBLE_PATHS: {},
    BASE_PATH: BASE_PATH
  };

  // State
  let bibles = {};           // Loaded Bible data
  let loadingPromises = {};  // Ongoing load operations
  let cache = null;          // Lookup cache
  let storage = null;        // Storage adapter

  console.log('[BibleLookup] v5 initializing...');

  // ========================================
  // STORAGE INITIALIZATION
  // ========================================
  
  function initStorage() {
    if (typeof SangocastStorage !== 'undefined') {
      storage = new SangocastStorage({ prefix: 'sangocast_' });
      console.log('[BibleLookup] Using SangocastStorage');
    } else if (typeof localStorage !== 'undefined') {
      // Fallback to localStorage
      storage = {
        async getItem(key) { 
          const val = localStorage.getItem(key);
          return val !== null ? val : null;
        },
        async setItem(key, val) { 
          localStorage.setItem(key, val); 
          return true; 
        },
        async removeItem(key) { 
          localStorage.removeItem(key); 
          return true; 
        },
        async getJSON(key) { 
          const val = localStorage.getItem(key);
          if (!val) return null;
          try {
            return JSON.parse(val);
          } catch {
            return null;
          }
        },
        async setJSON(key, obj) {
          try {
            localStorage.setItem(key, JSON.stringify(obj));
            return true;
          } catch {
            return false;
          }
        }
      };
      console.log('[BibleLookup] Using localStorage fallback');
    } else {
      // No storage available
      storage = {
        async getItem() { return null; },
        async setItem() { return false; },
        async removeItem() { return false; },
        async getJSON() { return null; },
        async setJSON() { return false; }
      };
      console.warn('[BibleLookup] No storage available');
    }
  }

  initStorage();

  // ========================================
  // BIBLE REGISTRATION
  // ========================================
  
  function registerBible(code, path) {
    let fullPath;
    
    if (path.startsWith('http://') || path.startsWith('https://')) {
      fullPath = path;
    } else if (path.startsWith('/')) {
      fullPath = CONFIG.BASE_PATH + path.substring(1);
    } else {
      fullPath = CONFIG.BASE_PATH + path;
    }
    
    CONFIG.BIBLE_PATHS[code.toUpperCase()] = fullPath;
    console.log(`[BibleLookup] Registered: ${code} → ${fullPath}`);
  }

  // ========================================
  // BOOK NAME NORMALIZATION
  // ========================================

  const BOOK_VARIATIONS = {
    "Genesis": ["gen", "genese", "genèse"],
    "Exodus": ["exo", "exode"],
    "Leviticus": ["lev", "lévitique", "levitique"],
    "Numbers": ["num", "nombres"],
    "Deuteronomy": ["deu", "deutéronome", "deuteronome"],
    "Joshua": ["jos", "josué", "josue"],
    "Judges": ["jdg", "juges"],
    "Ruth": ["rut"],
    "1 Samuel": ["1sa", "1 sam", "1samuel"],
    "2 Samuel": ["2sa", "2 sam", "2samuel"],
    "1 Kings": ["1ki", "1 rois", "1rois"],
    "2 Kings": ["2ki", "2 rois", "2rois"],
    "1 Chronicles": ["1ch", "1 chr", "1chroniques"],
    "2 Chronicles": ["2ch", "2 chr", "2chroniques"],
    "Ezra": ["ezr", "esdras"],
    "Nehemiah": ["neh", "néhémie", "nehemie"],
    "Esther": ["est"],
    "Job": ["job"],
    "Psalms": ["psa", "ps", "psaume", "psaumes"],
    "Proverbs": ["pro", "proverbes"],
    "Ecclesiastes": ["ecc", "ecclésiaste", "ecclesiaste"],
    "Song of Solomon": ["sos", "cantique", "cantiques"],
    "Isaiah": ["isa", "ésaïe", "esaie"],
    "Jeremiah": ["jer", "jérémie", "jeremie"],
    "Lamentations": ["lam"],
    "Ezekiel": ["eze", "ézéchiel", "ezechiel"],
    "Daniel": ["dan"],
    "Hosea": ["hos", "osée", "osee"],
    "Joel": ["joe", "joël"],
    "Amos": ["amo"],
    "Obadiah": ["oba", "abdias"],
    "Jonah": ["jon", "jonas"],
    "Micah": ["mic", "michée", "michee"],
    "Nahum": ["nah"],
    "Habakkuk": ["hab", "habacuc"],
    "Zephaniah": ["zep", "sophonie"],
    "Haggai": ["hag", "aggée", "aggee"],
    "Zechariah": ["zec", "zacharie"],
    "Malachi": ["mal", "malachie"],
    "Matthew": ["mat", "mt", "matthieu"],
    "Mark": ["mrk", "mk", "marc"],
    "Luke": ["luk", "lk", "luc"],
    "John": ["joh", "jn", "jean"],
    "Acts": ["act", "actes"],
    "Romans": ["rom", "romains"],
    "1 Corinthians": ["1co", "1 cor", "1corinthiens"],
    "2 Corinthians": ["2co", "2 cor", "2corinthiens"],
    "Galatians": ["gal", "galates"],
    "Ephesians": ["eph", "éphésiens", "ephesiens"],
    "Philippians": ["php", "philippiens"],
    "Colossians": ["col", "colossiens"],
    "1 Thessalonians": ["1th", "1 thess", "1thessaloniciens"],
    "2 Thessalonians": ["2th", "2 thess", "2thessaloniciens"],
    "1 Timothy": ["1ti", "1 tim", "1timothée", "1timothee"],
    "2 Timothy": ["2ti", "2 tim", "2timothée", "2timothee"],
    "Titus": ["tit", "tite"],
    "Philemon": ["phm", "philémon"],
    "Hebrews": ["heb", "hébreux", "hebreux"],
    "James": ["jas", "jacques"],
    "1 Peter": ["1pe", "1 pierre", "1pierre"],
    "2 Peter": ["2pe", "2 pierre", "2pierre"],
    "1 John": ["1jo", "1 jean", "1jean"],
    "2 John": ["2jo", "2 jean", "2jean"],
    "3 John": ["3jo", "3 jean", "3jean"],
    "Jude": ["jud", "jude"],
    "Revelation": ["rev", "apocalypse"]
  };

  const bookMap = new Map();

  function buildBookMap() {
    // Add canonical names
    for (const canonical of Object.keys(BOOK_VARIATIONS)) {
      bookMap.set(canonical.toLowerCase(), canonical);
      
      // Add variations
      for (const variant of BOOK_VARIATIONS[canonical]) {
        bookMap.set(variant.toLowerCase(), canonical);
        // Without accents
        const noAccent = variant.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (noAccent !== variant.toLowerCase()) {
          bookMap.set(noAccent, canonical);
        }
      }
    }
  }

  function getCanonicalBookName(input) {
    if (!input) return input;
    const normalized = input.toLowerCase().trim();
    return bookMap.get(normalized) || input;
  }

  buildBookMap();

  // ========================================
  // BOOK INDEXING (O(1) Lookup)
  // ========================================

  function buildBookIndex(bible) {
    if (!bible || !bible.books) return;
    
    bible._index = {};
    for (const book of bible.books) {
      if (book.name) {
        bible._index[book.name] = book;
      }
    }
    console.log(`[BibleLookup] Indexed ${bible.books.length} books`);
  }

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  async function initCache() {
    try {
      if (storage && storage.getJSON) {
        cache = await storage.getJSON(CONFIG.CACHE_KEY) || {};
      } else if (storage) {
        const stored = await storage.getItem(CONFIG.CACHE_KEY);
        cache = stored ? JSON.parse(stored) : {};
      } else {
        cache = {};
      }
    } catch (error) {
      console.warn('[BibleLookup] Cache init failed:', error);
      cache = {};
    }
  }

  async function saveCache() {
    try {
      if (!cache) cache = {};
      
      // Limit cache size
      const entries = Object.entries(cache);
      if (entries.length > CONFIG.CACHE_MAX_SIZE) {
        const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        cache = Object.fromEntries(sorted.slice(0, CONFIG.CACHE_MAX_SIZE));
      }
      
      if (storage.setJSON) {
        await storage.setJSON(CONFIG.CACHE_KEY, cache);
      } else if (storage.setItem) {
        await storage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cache));
      }
    } catch (error) {
      console.warn('[BibleLookup] Cache save failed:', error);
    }
  }

  function getCacheKey(reference) {
    const { version, book, chapter, verses } = reference;
    return `${version}:${book}:${chapter}:${verses.join('|')}`;
  }

  function getCachedResult(cacheKey) {
    if (!cache) return null;
    
    const entry = cache[cacheKey];
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > CONFIG.CACHE_TTL) {
      delete cache[cacheKey];
      return null;
    }
    
    return entry.result;
  }

  // ========================================
  // BIBLE LOADING
  // ========================================

  function isBibleLoaded(version) {
    return bibles[version.toUpperCase()] !== undefined;
  }

  async function loadBible(version) {
    version = version.toUpperCase();

    // Return cached in memory
    if (isBibleLoaded(version)) {
      return bibles[version];
    }

    // Return existing promise if loading
    if (loadingPromises[version]) {
      return loadingPromises[version];
    }

    const storageKey = CONFIG.STORAGE_PREFIX + version;
    
    // Try to load from persistent storage first
    try {
      let stored = null;
      if (storage.getJSON) {
        stored = await storage.getJSON(storageKey);
      } else if (storage.getItem) {
        const json = await storage.getItem(storageKey);
        stored = json ? JSON.parse(json) : null;
      }
      
      if (stored && stored.books && Array.isArray(stored.books)) {
        console.log(`[BibleLookup] ${version} loaded from storage`);
        
        if (!stored._index) {
          buildBookIndex(stored);
        }
        
        bibles[version] = stored;
        return stored;
      }
    } catch (error) {
      console.warn(`[BibleLookup] Storage read error for ${version}:`, error);
    }

    // Load from network
    const filepath = CONFIG.BIBLE_PATHS[version];
    if (!filepath) {
      const available = Object.keys(CONFIG.BIBLE_PATHS).join(', ');
      throw new Error(`Bible "${version}" not registered. Available: ${available}`);
    }

    console.log(`[BibleLookup] Loading ${version} from ${filepath}...`);
    
    loadingPromises[version] = fetch(filepath)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const rawData = await response.json();
        
        // Auto-conversion with SangocastBibleConverter
        let convertedData;
        
        if (typeof SangocastBibleConverter !== 'undefined') {
          console.log(`[BibleLookup] Auto-converting ${version}...`);
          convertedData = await SangocastBibleConverter.convert(rawData, version);
        } else {
          console.warn('[BibleLookup] Converter not available, assuming SangoCast format');
          convertedData = rawData;
        }
        
        // Validate structure
        if (!convertedData.books || !Array.isArray(convertedData.books)) {
          throw new Error('Invalid Bible structure: missing books array');
        }
        
        if (convertedData.books.length === 0) {
          throw new Error('Invalid Bible structure: empty books array');
        }
        
        // Build index
        buildBookIndex(convertedData);
        
        console.log(`[BibleLookup] ${version} loaded (${convertedData.books.length} books)`);
        bibles[version] = convertedData;
        
        // Save to storage
        try {
          if (storage.setJSON) {
            await storage.setJSON(storageKey, convertedData);
          } else if (storage.setItem) {
            await storage.setItem(storageKey, JSON.stringify(convertedData));
          }
          console.log(`[BibleLookup] ${version} saved to storage`);
        } catch (e) {
          console.warn(`[BibleLookup] Storage save failed:`, e);
        }
        
        delete loadingPromises[version];
        return convertedData;
      })
      .catch(error => {
        delete loadingPromises[version];
        console.error(`[BibleLookup] Failed to load ${version}:`, error);
        throw new Error(`Failed to load ${version}: ${error.message}`);
      });

    return loadingPromises[version];
  }

  // ========================================
  // VERSE SEARCH
  // ========================================

  function findVerse(bible, book, chapter, verseNum) {
    try {
      if (!bible || !bible.books) {
        return { error: 'Invalid Bible structure' };
      }

      // Find book using index or linear search
      let bookData = bible._index ? bible._index[book] : null;
      if (!bookData) {
        bookData = bible.books.find(b => b.name === book);
      }
      
      if (!bookData) {
        return { error: `Book "${book}" not found` };
      }

      // Find chapter
      const chapterData = bookData.chapters.find(c => c.chapter === chapter);
      if (!chapterData) {
        return { error: `Chapter ${chapter} not found in ${book}` };
      }

      // Find verse
      const verseData = chapterData.verses.find(v => v.verse === verseNum);
      if (!verseData) {
        return { error: `Verse ${verseNum} not found in ${book} ${chapter}` };
      }

      return { text: verseData.text };
      
    } catch (error) {
      return { error: `Search error: ${error.message}` };
    }
  }

  async function lookupVerse(reference) {
    try {
      // Validate input
      if (!reference || typeof reference !== 'object') {
        return { error: 'Invalid reference: expected object' };
      }
      
      const { version, book, chapter, verses } = reference;
      
      if (!version || !book || !chapter || !Array.isArray(verses) || verses.length === 0) {
        return { error: 'Invalid reference parameters: requires version, book, chapter, and verses array' };
      }

      const canonicalBook = getCanonicalBookName(book);

      // Check cache
      const cacheKey = getCacheKey({ version, book: canonicalBook, chapter, verses });
      const cachedResult = getCachedResult(cacheKey);
      if (cachedResult) {
        console.log('[BibleLookup] Cache hit for', cacheKey);
        return cachedResult;
      }

      // Load Bible
      let bible;
      try {
        bible = await loadBible(version);
      } catch (loadError) {
        return { error: loadError.message };
      }

      // Lookup verses
      const verseTexts = [];
      const errors = [];

      for (const verseNum of verses) {
        const result = findVerse(bible, canonicalBook, chapter, verseNum);
        
        if (result.error) {
          errors.push(result.error);
        } else {
          verseTexts.push(result.text);
        }
      }

      if (errors.length > 0) {
        return { error: errors[0] };
      }

      // Build result
      const referenceStr = verses.length === 1 
        ? `${canonicalBook} ${chapter}:${verses[0]}`
        : `${canonicalBook} ${chapter}:${verses[0]}-${verses[verses.length - 1]}`;

      const result = {
        reference: referenceStr,
        text: verseTexts.join(' '),
        version: version.toUpperCase(),
        book: canonicalBook,
        chapter: chapter,
        verses: verses
      };

      // Save to cache
      if (!cache) cache = {};
      cache[cacheKey] = { result: result, timestamp: Date.now() };
      await saveCache();

      return result;

    } catch (error) {
      console.error('[BibleLookup] Error:', error);
      return { error: error.message || 'Unknown error' };
    }
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  initCache();

  console.log(`[BibleLookup] v5 initialized`);

  // ========================================
  // PUBLIC API
  // ========================================

  return {
    lookupVerse,
    loadBible,
    isBibleLoaded,
    getCanonicalBookName,
    registerBible,
    getAvailableBibles: () => Object.keys(CONFIG.BIBLE_PATHS),
    clearCache: async () => {
      cache = {};
      if (storage && storage.removeItem) {
        await storage.removeItem(CONFIG.CACHE_KEY);
      }
      console.log('[BibleLookup] Cache cleared');
    },
    clearStorage: async (version) => {
      if (version) {
        const key = CONFIG.STORAGE_PREFIX + version.toUpperCase();
        if (storage && storage.removeItem) {
          await storage.removeItem(key);
        }
        delete bibles[version.toUpperCase()];
        console.log(`[BibleLookup] Storage cleared for ${version}`);
      } else {
        // Clear all Bible storage
        if (storage && storage.keys) {
          const keys = await storage.keys(CONFIG.STORAGE_PREFIX);
          for (const key of keys) {
            await storage.removeItem(key);
          }
        }
        bibles = {};
        console.log('[BibleLookup] All Bible storage cleared');
      }
    }
  };
})();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SangocastBibleLookup;
} else if (typeof window !== 'undefined') {
  window.SangocastBibleLookup = SangocastBibleLookup;
}
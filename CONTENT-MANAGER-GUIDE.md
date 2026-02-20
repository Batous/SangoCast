# 📚 SANGOCAST Content Manager - Integration Guide

**Hybrid Data Layer for Scripture Clock** - v1.0

---

## 🎯 What It Does

The ContentManager is your **single source of truth** for all content in SANGOCAST. It intelligently manages three data sources and automatically chooses the best one:

```
┌─────────────────────────────────────────────────────┐
│  User requests content                              │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐                                    │
│  │ getContent()│                                    │
│  └──────┬──────┘                                    │
│         │                                            │
│         ├─→ 🌐 LIVE (if online) ─────→ Cache it    │
│         │                                            │
│         ├─→ 💾 CACHED (if valid) ──→ Return        │
│         │                                            │
│         └─→ 📦 EMBEDDED (fallback) ─→ Return       │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Step 1: Include the Files

```html
<!-- Network Manager (v3.2 STABLE) -->
<script src="sangocast-network-manager-v3.2.js"></script>

<!-- Content Manager -->
<script src="sangocast-content-manager.js"></script>
```

### Step 2: Initialize

```javascript
// Initialize Content Manager
const contentManager = new ContentManager();

// Wait for initialization
await contentManager.initPromise;

console.log('✅ Content Manager ready!');
```

### Step 3: Get Content

```javascript
// Get today's verse
const result = await contentManager.getContent('daily-verse', new Date());

console.log(result.data.verse);     // The verse text
console.log(result.source);         // 'live', 'cached', or 'embedded'
console.log(result.cached);         // true/false
```

---

## 📖 Core API

### `getContent(channelId, dateTime, options)`

Main method to retrieve content.

```javascript
/**
 * @param {string} channelId - Channel identifier
 * @param {string|Date} dateTime - Date for content
 * @param {Object} options - Optional settings
 * @param {boolean} options.forceOnline - Force live fetch
 * @param {boolean} options.noCache - Don't cache the result
 * @returns {Promise<Object>} Content with metadata
 */

// Example 1: Basic usage
const content = await contentManager.getContent('daily-verse', new Date());

// Example 2: Force online (refresh)
const fresh = await contentManager.getContent(
  'daily-verse',
  new Date(),
  { forceOnline: true }
);

// Example 3: Specific date
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const old = await contentManager.getContent('daily-verse', yesterday);
```

**Return Value:**
```javascript
{
  data: {
    verse: "For God so loved the world...",
    reference: "John 3:16",
    translation: "NIV"
  },
  source: "cached",        // 'live', 'cached', or 'embedded'
  timestamp: 1708124523000,
  cached: true,
  age: 3600000             // ms since cached (if applicable)
}
```

---

### `updateCache(channelId, dateTime, data, options)`

Manually update cache (usually automatic).

```javascript
/**
 * @param {string} channelId - Channel identifier
 * @param {string|Date} dateTime - Date for content
 * @param {Object} data - Content to cache
 * @param {Object} options - Cache options
 * @param {boolean} options.isBibleCalendar - Extended retention
 * @returns {Promise<boolean>} Success status
 */

// Example: Cache with extended retention
await contentManager.updateCache(
  'bible-reading-plan',
  new Date(),
  bibleData,
  { isBibleCalendar: true }  // Kept for 1 year instead of 30 days
);
```

---

### `clearOldCache()`

Remove expired content (runs automatically on init).

```javascript
/**
 * @returns {Promise<Object>} Cleanup statistics
 */

const stats = await contentManager.clearOldCache();
console.log(`Removed ${stats.removed} old entries`);
console.log(`Kept ${stats.kept} valid entries`);
```

---

### `getStorageStats()`

Get detailed storage information.

```javascript
/**
 * @returns {Promise<Object>} Storage usage stats
 */

const stats = await contentManager.getStorageStats();

console.log('localStorage:', stats.localStorage.used, 'bytes');
console.log('IndexedDB:', stats.indexedDB.entries, 'entries');
console.log('Cache entries:', stats.cache.totalEntries);
console.log('Bible calendars:', stats.cache.bibleCalendarEntries);
```

**Return Value:**
```javascript
{
  localStorage: {
    used: 45678,
    limit: 5242880,
    available: 5197202,
    entries: 12
  },
  indexedDB: {
    used: 102400,
    limit: 52428800,
    available: 52326400,
    entries: 15
  },
  cache: {
    totalEntries: 27,
    bibleCalendarEntries: 5,
    regularEntries: 22,
    oldestEntry: Date,
    newestEntry: Date
  }
}
```

---

### `clearAllCache()`

Nuclear option - clear everything (for testing/reset).

```javascript
/**
 * @returns {Promise<boolean>} Success status
 */

await contentManager.clearAllCache();
console.log('All cache cleared!');
```

---

## 🎨 Integration Patterns

### Pattern 1: Simple Scripture Display

```javascript
async function showTodaysVerse() {
  try {
    const result = await contentManager.getContent('daily-verse', new Date());
    
    if (result.data) {
      document.getElementById('verse').textContent = result.data.verse;
      document.getElementById('reference').textContent = result.data.reference;
      
      // Show source indicator
      const sourceIcon = {
        'live': '🌐 Live',
        'cached': '💾 Cached',
        'embedded': '📦 Default'
      };
      document.getElementById('source').textContent = sourceIcon[result.source];
    } else {
      // Handle error
      showError(result.fallbackMessage);
    }
  } catch (error) {
    showError('Unable to load content');
  }
}
```

### Pattern 2: Refresh Button

```javascript
async function refreshContent() {
  // Check if online first
  const networkStatus = SangocastNetworkManager.getStatus();
  
  if (!networkStatus.isOnline) {
    alert('You are offline. Showing cached content.');
    return;
  }

  // Force fresh fetch
  showLoading(true);
  
  const result = await contentManager.getContent(
    'daily-verse',
    new Date(),
    { forceOnline: true }
  );
  
  showLoading(false);
  displayContent(result);
}
```

### Pattern 3: Calendar View (Multiple Dates)

```javascript
async function loadWeekView() {
  const today = new Date();
  const promises = [];

  // Load 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    promises.push(
      contentManager.getContent('daily-verse', date)
    );
  }

  const results = await Promise.all(promises);
  
  results.forEach((result, index) => {
    displayDayContent(index, result);
  });
}
```

### Pattern 4: Preloading (Background Cache)

```javascript
async function preloadUpcomingContent() {
  console.log('🔄 Preloading upcoming content...');
  
  // Only preload if online
  if (!SangocastNetworkManager.getStatus().isOnline) {
    console.log('⚠️ Offline, skipping preload');
    return;
  }

  const today = new Date();
  
  // Preload next 7 days
  for (let i = 1; i <= 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    try {
      await contentManager.getContent(
        'daily-verse',
        date,
        { forceOnline: true }  // Fetch and cache
      );
      
      console.log(`✅ Preloaded day +${i}`);
      
      // Small delay to avoid hammering API
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.warn(`⚠️ Failed to preload day +${i}:`, error.message);
    }
  }
  
  console.log('✅ Preload complete');
}

// Run preload when app goes online
SangocastNetworkManager.addChangeListener((status) => {
  if (status.isOnline) {
    preloadUpcomingContent();
  }
});
```

### Pattern 5: Error Handling

```javascript
async function loadContentSafely(channelId, date) {
  try {
    const result = await contentManager.getContent(channelId, date);
    
    if (result.data) {
      // Success
      return result.data;
    } else {
      // All sources failed
      console.error('Content not available:', result.error);
      
      // Show user-friendly message
      showMessage(result.fallbackMessage, 'warning');
      
      return null;
    }
  } catch (error) {
    // Unexpected error
    console.error('Unexpected error:', error);
    showMessage('Something went wrong. Please try again.', 'error');
    return null;
  }
}
```

---

## 🔧 Configuration

### API Endpoint

Set your API base URL:

```javascript
// Before initialization
ContentManager.CONFIG.API_BASE_URL = 'https://your-api.com/v1';

// Then initialize
const contentManager = new ContentManager();
```

### Cache Retention

Customize retention periods:

```javascript
// Keep regular content for 60 days instead of 30
ContentManager.CONFIG.CACHE_RETENTION_DAYS = 60;

// Keep Bible calendars for 2 years
ContentManager.CONFIG.BIBLE_CALENDAR_RETENTION_DAYS = 730;

// Purge after 90 days instead of 60
ContentManager.CONFIG.PURGE_AFTER_DAYS = 90;
```

### Storage Limits

Adjust storage limits if needed:

```javascript
// Increase localStorage limit (if browser allows)
ContentManager.CONFIG.LOCALSTORAGE_LIMIT = 10 * 1024 * 1024; // 10 MB

// Increase IndexedDB limit
ContentManager.CONFIG.INDEXEDDB_LIMIT = 100 * 1024 * 1024; // 100 MB
```

### API Timeout

Change request timeout:

```javascript
// Increase timeout for slow connections
ContentManager.CONFIG.API_TIMEOUT = 15000; // 15 seconds
```

---

## 📦 Embedded Data Format

Your `channels.json` should follow this structure:

```json
{
  "channels": [
    {
      "id": "daily-verse",
      "name": "Daily Verse",
      "description": "Verse of the day",
      "content": [
        {
          "date": "2026-02-20",
          "verse": "For God so loved the world...",
          "reference": "John 3:16",
          "translation": "NIV"
        }
      ],
      "defaultContent": {
        "verse": "Trust in the Lord...",
        "reference": "Proverbs 3:5",
        "translation": "NIV"
      }
    },
    {
      "id": "sermon-calendar",
      "name": "Sermon Schedule",
      "content": [
        {
          "date": "2026-02-20",
          "title": "Walking in Faith",
          "speaker": "Pastor John",
          "time": "10:00 AM",
          "description": "..."
        }
      ]
    }
  ]
}
```

**Key Points:**
- Each channel has an `id` (used in `getContent()`)
- `content` array holds date-specific content
- `defaultContent` is fallback if no match found
- Date format: `YYYY-MM-DD`

---

## 🎯 Cache Strategy Explained

### Three-Tier System

```
┌──────────────────────────────────────────────┐
│ TIER 1: LIVE (Online Only)                  │
│ • Fresh from API                             │
│ • Automatically cached                       │
│ • Requires network                           │
├──────────────────────────────────────────────┤
│ TIER 2: CACHED (Offline-Ready)              │
│ • IndexedDB (preferred, 50MB limit)          │
│ • localStorage (fallback, 5MB limit)         │
│ • Valid for 30 days (365 for Bible cals)    │
├──────────────────────────────────────────────┤
│ TIER 3: EMBEDDED (Always Available)         │
│ • From channels.json                         │
│ • Bundled with app                           │
│ • Never expires                              │
└──────────────────────────────────────────────┘
```

### Retention Rules

| Content Type | Retention | Purge After | Notes |
|--------------|-----------|-------------|-------|
| Regular | 30 days | 60 days | Verses, sermons |
| Bible Calendar | 365 days | Never* | Reading plans |

*Bible calendars are only purged if explicitly cleared or storage is full

### Storage Priority

1. **IndexedDB** (preferred)
   - Larger capacity (50MB)
   - Better performance
   - Structured storage

2. **localStorage** (fallback)
   - Smaller capacity (5MB)
   - Synchronous
   - Simple key-value

### Auto-Cleanup

Cleanup runs:
- On initialization
- When storage quota exceeded
- Manual trigger: `clearOldCache()`

---

## 🐛 Troubleshooting

### Issue: Content not loading

**Check 1: Network Status**
```javascript
const status = SangocastNetworkManager.getStatus();
console.log('Online:', status.isOnline);
```

**Check 2: Cache Status**
```javascript
const stats = await contentManager.getStorageStats();
console.log('Cache entries:', stats.cache.totalEntries);
```

**Check 3: Embedded Data**
```javascript
// Check if channels.json loaded
console.log(contentManager.embeddedData);
```

---

### Issue: Storage quota exceeded

**Solution 1: Clear old cache**
```javascript
await contentManager.clearOldCache();
```

**Solution 2: Reduce retention**
```javascript
ContentManager.CONFIG.CACHE_RETENTION_DAYS = 15; // Shorter retention
```

**Solution 3: Clear all**
```javascript
await contentManager.clearAllCache(); // Nuclear option
```

---

### Issue: Slow performance

**Cause**: Too many cache entries in localStorage

**Solution**: IndexedDB should handle it, but if needed:
```javascript
// Check storage stats
const stats = await contentManager.getStorageStats();

if (stats.localStorage.entries > 100) {
  // Too many in localStorage, force cleanup
  await contentManager.clearOldCache();
}
```

---

### Issue: Bible calendars being purged

**Check**: Make sure `isBibleCalendar` flag is set:
```javascript
await contentManager.updateCache(
  'bible-reading',
  date,
  data,
  { isBibleCalendar: true }  // IMPORTANT!
);
```

---

## 📊 Monitoring & Analytics

### Track Cache Hit Rate

```javascript
let cacheHits = 0;
let cacheMisses = 0;

async function getContentAndTrack(channelId, date) {
  const result = await contentManager.getContent(channelId, date);
  
  if (result.source === 'cached') {
    cacheHits++;
  } else if (result.source === 'live') {
    cacheMisses++;
  }
  
  const hitRate = (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(1);
  console.log(`Cache hit rate: ${hitRate}%`);
  
  return result;
}
```

### Monitor Storage Growth

```javascript
setInterval(async () => {
  const stats = await contentManager.getStorageStats();
  
  console.log('Storage snapshot:', {
    localStorageMB: (stats.localStorage.used / 1024 / 1024).toFixed(2),
    indexedDBEntries: stats.indexedDB.entries,
    cacheEntries: stats.cache.totalEntries
  });
}, 60000); // Every minute
```

---

## ✅ Production Checklist

Before deploying:

- [ ] Set correct `API_BASE_URL`
- [ ] Create and test `channels.json`
- [ ] Test offline functionality
- [ ] Test storage limits
- [ ] Test cache expiration
- [ ] Test error scenarios
- [ ] Monitor storage usage
- [ ] Set appropriate retention periods
- [ ] Test Bible calendar exception
- [ ] Verify IndexedDB fallback

---

## 🎓 Best Practices

### DO:
✅ Use `isBibleCalendar: true` for scripture reading plans  
✅ Preload upcoming content when online  
✅ Monitor storage usage regularly  
✅ Handle errors gracefully with fallbacks  
✅ Show source indicator to users (live/cached/embedded)  
✅ Implement refresh button for manual updates  
✅ Test offline scenarios thoroughly  

### DON'T:
❌ Call `getContent()` repeatedly for same data (cache it in memory)  
❌ Ignore the `source` field (user should know where data is from)  
❌ Store sensitive data (everything is accessible client-side)  
❌ Exceed storage quotas (monitor with `getStorageStats()`)  
❌ Skip error handling (network can fail anytime)  
❌ Forget to set `isBibleCalendar` for Bible content  

---

**Version**: 1.0  
**Compatible With**: Network Manager v3.2 STABLE  
**Status**: Production Ready ✅

---

*"Do not store up for yourselves treasures on earth... but store them intelligently in IndexedDB with proper fallbacks." - Modern Proverbs*

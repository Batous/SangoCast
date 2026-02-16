# SANGOCAST Network Manager - Integration Guide

## 🚀 Quick Start

### 1. Include the Script
```html
<script src="sangocast-network-manager.js"></script>
```

### 2. Add UI Indicator
```html
<div id="network-mode-indicator"></div>
```

### 3. Initialize (Auto-initializes on DOM load)
```javascript
// Optionally listen for initialization
SangocastNetworkManager.init().then(() => {
  console.log('Network manager ready!');
});
```

---

## 📡 Network Modes Explained

### 🔵 AUTO Mode (Recommended)
- **What it does**: Automatically detects the best mode based on:
  - Connection speed (fast/medium/slow)
  - Connection type (WiFi/cellular)
  - Battery level and charging status
  - Device capabilities
- **Best for**: Most users - set it and forget it

### 🟢 ONLINE_LIVE Mode
- **Fetch interval**: Every 1 hour
- **Triggers**: Fast WiFi + Device plugged in
- **Best for**: Desktop users with stable connections
- **Data usage**: ~24 requests/day

### 🟡 ONLINE_SMART Mode
- **Fetch interval**: Every 6 hours
- **Triggers**: Mobile data OR slow connection OR low battery
- **Best for**: Mobile users, limited data plans
- **Data usage**: ~4 requests/day

### 🔴 OFFLINE Mode
- **Fetch interval**: None
- **Triggers**: No internet connection
- **Best for**: Airplane mode, no connectivity
- **Data usage**: 0 (uses cached content only)

---

## 🔧 API Reference

### Core Functions

#### `init()`
Initialize the network manager
```javascript
await SangocastNetworkManager.init();
// Returns: true on success, false on error
```

#### `detectNetworkMode()`
Manually detect network conditions
```javascript
const mode = await SangocastNetworkManager.detectNetworkMode();
console.log(mode.name); // 'ONLINE_LIVE', 'ONLINE_SMART', or 'OFFLINE'
```

#### `setMode(modeName)`
Manually set network mode
```javascript
SangocastNetworkManager.setMode('ONLINE_SMART');
// Options: 'AUTO', 'ONLINE_LIVE', 'ONLINE_SMART', 'OFFLINE'
```

#### `getCurrentMode()`
Get currently active mode
```javascript
const mode = SangocastNetworkManager.getCurrentMode();
console.log(mode.name);        // e.g., 'ONLINE_LIVE'
console.log(mode.fetchInterval); // e.g., 3600000 (1 hour in ms)
```

#### `getFetchInterval()`
Get fetch interval for current mode
```javascript
const interval = SangocastNetworkManager.getFetchInterval();
// Returns: milliseconds or null for offline mode
```

#### `isOnline()`
Check if currently online
```javascript
if (SangocastNetworkManager.isOnline()) {
  fetchNewScripture();
}
```

#### `getStatus()`
Get comprehensive status
```javascript
const status = SangocastNetworkManager.getStatus();
console.log(status);
/* Returns:
{
  currentMode: 'AUTO',
  detectedMode: 'ONLINE_LIVE',
  activeMode: 'ONLINE_LIVE',
  isOnline: true,
  connectionSpeed: 'fast',
  batteryLevel: 0.85,
  batteryCharging: true,
  fetchInterval: 3600000,
  lastCheck: '1708124523000'
}
*/
```

#### `forceRecheck()`
Force immediate network recheck
```javascript
const status = await SangocastNetworkManager.forceRecheck();
```

---

## 🎯 Event Listeners

### Add Listener
```javascript
SangocastNetworkManager.addChangeListener((status) => {
  console.log('Network mode changed:', status.mode);
  console.log('Is online:', status.isOnline);
  console.log('Fetch interval:', status.fetchInterval);
  
  // Update your fetch schedule
  updateFetchSchedule(status.fetchInterval);
});
```

### Remove Listener
```javascript
function myListener(status) {
  console.log('Mode changed:', status);
}

SangocastNetworkManager.addChangeListener(myListener);
// Later...
SangocastNetworkManager.removeChangeListener(myListener);
```

---

## 💾 Integration with Your Scripture Clock

### Example: Adaptive Fetch Strategy

```javascript
// Initialize your app
async function initSangocast() {
  // Initialize network manager
  await SangocastNetworkManager.init();
  
  // Listen for mode changes
  SangocastNetworkManager.addChangeListener(handleModeChange);
  
  // Start fetch cycle
  startFetchCycle();
}

// Handle mode changes
function handleModeChange(status) {
  console.log(`📡 Mode changed to ${status.mode}`);
  
  if (status.mode === 'OFFLINE') {
    // Use cached content
    loadCachedScripture();
  } else {
    // Restart fetch cycle with new interval
    startFetchCycle();
  }
}

// Smart fetch cycle
function startFetchCycle() {
  // Clear any existing interval
  if (window.fetchInterval) {
    clearInterval(window.fetchInterval);
  }
  
  const interval = SangocastNetworkManager.getFetchInterval();
  
  if (!interval) {
    console.log('⚠️ Offline mode - using cache only');
    return;
  }
  
  // Fetch immediately
  fetchScripture();
  
  // Set up recurring fetch
  window.fetchInterval = setInterval(() => {
    if (SangocastNetworkManager.isOnline()) {
      fetchScripture();
    }
  }, interval);
  
  console.log(`✅ Fetch cycle started: every ${interval / 3600000} hour(s)`);
}

// Fetch scripture with network awareness
async function fetchScripture() {
  try {
    if (!SangocastNetworkManager.isOnline()) {
      console.log('📴 Offline - loading from cache');
      return loadCachedScripture();
    }
    
    console.log('🌐 Fetching fresh scripture...');
    const response = await fetch('https://your-api.com/scripture');
    const data = await response.json();
    
    // Cache the data
    localStorage.setItem('cached_scripture', JSON.stringify(data));
    localStorage.setItem('cache_timestamp', Date.now());
    
    // Display the data
    displayScripture(data);
    
  } catch (error) {
    console.error('❌ Fetch failed:', error);
    // Fallback to cache
    loadCachedScripture();
  }
}

// Load from cache
function loadCachedScripture() {
  const cached = localStorage.getItem('cached_scripture');
  if (cached) {
    displayScripture(JSON.parse(cached));
  } else {
    displayError('No cached content available');
  }
}
```

---

## 🎨 UI Integration

### Minimal Indicator
```html
<div id="network-mode-indicator" 
     style="display: flex; align-items: center; gap: 8px;">
</div>
```

### Settings Panel
```html
<div id="network-settings-panel" style="display: none;">
  <h3>Network Settings</h3>
  <div id="current-mode-info"></div>
  
  <label>
    <input type="radio" name="mode" value="AUTO" checked 
           onchange="SangocastNetworkManager.setMode('AUTO')">
    Auto Mode
  </label>
  
  <label>
    <input type="radio" name="mode" value="ONLINE_LIVE" 
           onchange="SangocastNetworkManager.setMode('ONLINE_LIVE')">
    Live Mode (1 hour)
  </label>
  
  <label>
    <input type="radio" name="mode" value="ONLINE_SMART" 
           onchange="SangocastNetworkManager.setMode('ONLINE_SMART')">
    Smart Mode (6 hours)
  </label>
  
  <label>
    <input type="radio" name="mode" value="OFFLINE" 
           onchange="SangocastNetworkManager.setMode('OFFLINE')">
    Offline Mode
  </label>
  
  <button onclick="SangocastNetworkManager.forceRecheck()">
    Recheck Network
  </button>
</div>
```

---

## 🔍 Detection Logic

### Connection Speed Test
1. Downloads a ~50KB Google logo image
2. Measures time:
   - **Fast**: < 1 second
   - **Medium**: 1-3 seconds
   - **Slow**: > 3 seconds

### Battery Optimization
- If battery < 20% AND not charging → SMART mode
- If charging + fast WiFi → LIVE mode

### Connection Type Detection
Uses Network Information API when available:
- **WiFi/Ethernet** + Fast → LIVE mode
- **Cellular** → SMART mode
- **Unknown** → SMART mode (conservative)

---

## ⚙️ Configuration

### Customize Settings
```javascript
// After loading the script, before init()
SangocastNetworkManager.CONFIG = {
  PING_TIMEOUT: 3000,        // Reduce timeout to 3 seconds
  RECHECK_INTERVAL: 600000,  // Recheck every 10 minutes
};
```

### Custom Fetch Intervals
```javascript
// Modify mode definitions
SangocastNetworkManager.MODES.ONLINE_LIVE.fetchInterval = 1800000; // 30 minutes
SangocastNetworkManager.MODES.ONLINE_SMART.fetchInterval = 43200000; // 12 hours
```

---

## 🐛 Troubleshooting

### Indicator Not Showing
```javascript
// Check if element exists
const indicator = document.getElementById('network-mode-indicator');
if (!indicator) {
  console.error('Add <div id="network-mode-indicator"></div> to your HTML');
}
```

### Mode Not Updating
```javascript
// Force recheck
await SangocastNetworkManager.forceRecheck();

// Check status
console.log(SangocastNetworkManager.getStatus());
```

### Listeners Not Firing
```javascript
// Verify listener was added
SangocastNetworkManager.addChangeListener((status) => {
  console.log('Mode changed:', status);
});

// Manually trigger mode change to test
SangocastNetworkManager.setMode('ONLINE_SMART');
```

---

## 📊 Performance Tips

1. **Use AUTO mode** for most users
2. **Cache aggressively** - store fetched content locally
3. **Respect fetch intervals** - don't override with manual fetches
4. **Handle offline gracefully** - always have cached fallback
5. **Monitor battery** - respect low-power modes

---

## 🔒 Privacy & Security

- ✅ All detection happens locally (no external analytics)
- ✅ Only pings Google's favicon (1KB) for connectivity test
- ✅ Battery API requires user permission (handled by browser)
- ✅ No user data transmitted
- ✅ Mode preference stored in localStorage only

---

## 📱 Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Basic Detection | ✅ | ✅ | ✅ | ✅ |
| Speed Test | ✅ | ✅ | ✅ | ✅ |
| Battery API | ✅ | ❌ | ❌ | ✅ |
| Connection API | ✅ | ❌ | ❌ | ✅ |

*Note: Graceful fallbacks for unsupported features*

---

## 🎓 Best Practices

### DO:
- ✅ Use AUTO mode by default
- ✅ Provide manual mode override
- ✅ Cache all fetched content
- ✅ Show clear network status to user
- ✅ Handle offline scenario gracefully

### DON'T:
- ❌ Fetch more frequently than recommended
- ❌ Ignore offline mode
- ❌ Assume network is always available
- ❌ Skip error handling

---

## 📞 Support

For issues or questions:
1. Check browser console for error messages
2. Verify HTML elements exist (indicator, settings panel)
3. Test with `SangocastNetworkManager.getStatus()`
4. Force recheck with `forceRecheck()`

---

## 📄 License

MIT License - Free to use in your SANGOCAST projects!

---

**Built for SANGOCAST Scripture Clock** ⏰
Making scripture accessible, even offline.

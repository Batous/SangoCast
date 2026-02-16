/**
 * SANGOCAST Network Manager
 * Intelligent network detection and mode selection system
 * Optimizes data usage based on connection quality and device status
 */

const SangocastNetworkManager = (() => {
  'use strict';

  // Configuration
  const CONFIG = {
    PING_URL: 'https://www.google.com/favicon.ico',
    PING_TIMEOUT: 5000,
    SPEED_TEST_URL: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png',
    STORAGE_KEY: 'sangocast_network_mode',
    LAST_CHECK_KEY: 'sangocast_last_check',
    RECHECK_INTERVAL: 300000, // 5 minutes
  };

  // Network modes
  const MODES = {
    ONLINE_LIVE: {
      name: 'ONLINE_LIVE',
      label: 'Live Mode',
      icon: '🟢',
      fetchInterval: 3600000, // 1 hour
      description: 'Fast connection, real-time updates',
      color: '#10b981'
    },
    ONLINE_SMART: {
      name: 'ONLINE_SMART',
      label: 'Smart Mode',
      icon: '🟡',
      fetchInterval: 21600000, // 6 hours
      description: 'Optimized for mobile data',
      color: '#f59e0b'
    },
    OFFLINE: {
      name: 'OFFLINE',
      label: 'Offline Mode',
      icon: '🔴',
      fetchInterval: null,
      description: 'Using cached content only',
      color: '#ef4444'
    },
    AUTO: {
      name: 'AUTO',
      label: 'Auto Mode',
      icon: '🔵',
      fetchInterval: null,
      description: 'Automatically adapts to conditions',
      color: '#3b82f6'
    }
  };

  // State
  let currentMode = MODES.AUTO;
  let detectedMode = MODES.OFFLINE;
  let isOnline = navigator.onLine;
  let connectionSpeed = 'unknown';
  let batteryStatus = null;
  let listeners = [];

  /**
   * Initialize the network manager
   */
  async function init() {
    try {
      const savedMode = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (savedMode && MODES[savedMode]) {
        currentMode = MODES[savedMode];
      }

      await detectNetworkMode();
      setupEventListeners();
      await monitorBattery();
      updateModeIndicator();

      setInterval(async () => {
        if (currentMode.name === 'AUTO') {
          await detectNetworkMode();
          updateModeIndicator();
        }
      }, CONFIG.RECHECK_INTERVAL);

      console.log('✅ SANGOCAST Network Manager initialized');
      return true;
    } catch (error) {
      console.error('❌ Network Manager initialization failed:', error);
      return false;
    }
  }

  /**
   * Detect network mode based on connection quality
   */
  async function detectNetworkMode() {
    try {
      console.log('🔍 Detecting network conditions...');

      isOnline = navigator.onLine;
      
      if (!isOnline) {
        detectedMode = MODES.OFFLINE;
        if (currentMode.name === 'AUTO') {
          currentMode = MODES.OFFLINE;
        }
        notifyListeners();
        return detectedMode;
      }

      const isPingSuccessful = await pingTest();
      
      if (!isPingSuccessful) {
        detectedMode = MODES.OFFLINE;
        if (currentMode.name === 'AUTO') {
          currentMode = MODES.OFFLINE;
        }
        notifyListeners();
        return detectedMode;
      }

      connectionSpeed = await measureConnectionSpeed();
      console.log(`📊 Connection speed: ${connectionSpeed}`);

      const isBatteryLow = batteryStatus && !batteryStatus.charging && batteryStatus.level < 0.2;
      const connectionType = getConnectionType();
      console.log(`📡 Connection type: ${connectionType}`);

      if (connectionSpeed === 'fast' && !isBatteryLow && (connectionType === 'wifi' || connectionType === 'ethernet')) {
        detectedMode = MODES.ONLINE_LIVE;
      } else if (connectionSpeed === 'slow' || isBatteryLow || connectionType === 'cellular') {
        detectedMode = MODES.ONLINE_SMART;
      } else {
        detectedMode = MODES.ONLINE_SMART;
      }

      if (currentMode.name === 'AUTO') {
        currentMode = detectedMode;
      }

      localStorage.setItem(CONFIG.LAST_CHECK_KEY, Date.now().toString());
      notifyListeners();
      return detectedMode;

    } catch (error) {
      console.error('❌ Network detection failed:', error);
      detectedMode = MODES.OFFLINE;
      if (currentMode.name === 'AUTO') {
        currentMode = MODES.OFFLINE;
      }
      notifyListeners();
      return detectedMode;
    }
  }

  /**
   * Ping test to verify actual connectivity
   */
  async function pingTest() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), CONFIG.PING_TIMEOUT);
      const img = new Image();
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };

      img.src = `${CONFIG.PING_URL}?t=${Date.now()}`;
    });
  }

  /**
   * Measure connection speed
   */
  async function measureConnectionSpeed() {
    try {
      const startTime = performance.now();
      
      await Promise.race([
        fetch(`${CONFIG.SPEED_TEST_URL}?t=${Date.now()}`, { 
          method: 'GET',
          cache: 'no-cache'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), CONFIG.PING_TIMEOUT)
        )
      ]);

      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (duration < 1000) return 'fast';
      if (duration < 3000) return 'medium';
      return 'slow';
    } catch (error) {
      console.warn('⚠️ Speed test failed:', error.message);
      return 'unknown';
    }
  }

  /**
   * Get connection type from Network Information API
   */
  function getConnectionType() {
    try {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (!connection) return 'unknown';

      if (connection.effectiveType) {
        if (connection.effectiveType === '4g') return 'fast';
        if (connection.effectiveType === '3g') return 'medium';
        return 'slow';
      }

      if (connection.type) {
        if (connection.type === 'wifi' || connection.type === 'ethernet') return 'wifi';
        if (connection.type === 'cellular') return 'cellular';
      }

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Monitor battery status
   */
  async function monitorBattery() {
    try {
      if ('getBattery' in navigator) {
        const battery = await navigator.getBattery();
        
        batteryStatus = {
          level: battery.level,
          charging: battery.charging
        };

        battery.addEventListener('levelchange', () => {
          batteryStatus.level = battery.level;
          if (currentMode.name === 'AUTO') detectNetworkMode();
        });

        battery.addEventListener('chargingchange', () => {
          batteryStatus.charging = battery.charging;
          if (currentMode.name === 'AUTO') detectNetworkMode();
        });

        console.log(`🔋 Battery: ${Math.round(batteryStatus.level * 100)}% ${batteryStatus.charging ? '(charging)' : ''}`);
      }
    } catch (error) {
      console.warn('⚠️ Battery API not available:', error.message);
    }
  }

  /**
   * Set up event listeners for network changes
   */
  function setupEventListeners() {
    window.addEventListener('online', async () => {
      console.log('🌐 Connection restored');
      isOnline = true;
      await detectNetworkMode();
      updateModeIndicator();
    });

    window.addEventListener('offline', () => {
      console.log('📵 Connection lost');
      isOnline = false;
      detectedMode = MODES.OFFLINE;
      if (currentMode.name === 'AUTO') {
        currentMode = MODES.OFFLINE;
      }
      updateModeIndicator();
      notifyListeners();
    });

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', async () => {
        console.log('📶 Connection type changed');
        if (currentMode.name === 'AUTO') {
          await detectNetworkMode();
          updateModeIndicator();
        }
      });
    }

    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden && currentMode.name === 'AUTO') {
        const lastCheck = parseInt(localStorage.getItem(CONFIG.LAST_CHECK_KEY) || '0');
        const timeSinceCheck = Date.now() - lastCheck;
        
        if (timeSinceCheck > CONFIG.RECHECK_INTERVAL) {
          await detectNetworkMode();
          updateModeIndicator();
        }
      }
    });
  }

  /**
   * Update mode indicator in UI
   */
  function updateModeIndicator() {
    try {
      const indicator = document.getElementById('network-mode-indicator');
      if (!indicator) {
        console.warn('⚠️ Network indicator element not found');
        return;
      }

      const mode = currentMode.name === 'AUTO' ? detectedMode : currentMode;
      
      indicator.innerHTML = `
        <span style="color: ${mode.color}; font-size: 1.2em;">${mode.icon}</span>
        <span style="margin-left: 8px;">${mode.label}</span>
      `;
      
      indicator.title = mode.description;
      indicator.style.display = 'flex';
      indicator.style.alignItems = 'center';

      updateSettingsPanel();
      console.log(`📡 Mode updated: ${mode.name}`);
    } catch (error) {
      console.error('❌ Failed to update indicator:', error);
    }
  }

  /**
   * Update settings panel with current mode info
   */
  function updateSettingsPanel() {
    const settingsPanel = document.getElementById('network-settings-panel');
    if (!settingsPanel) return;

    const modeInfo = document.getElementById('current-mode-info');
    if (modeInfo) {
      const mode = currentMode.name === 'AUTO' ? detectedMode : currentMode;
      modeInfo.innerHTML = `
        <div style="padding: 12px; background: ${mode.color}15; border-left: 4px solid ${mode.color}; border-radius: 4px;">
          <div style="font-weight: 600; margin-bottom: 4px;">
            ${mode.icon} ${mode.label}
          </div>
          <div style="font-size: 0.9em; opacity: 0.8;">
            ${mode.description}
          </div>
          ${mode.fetchInterval ? `
            <div style="font-size: 0.85em; margin-top: 8px; opacity: 0.7;">
              Updates every ${mode.fetchInterval / 3600000} hour(s)
            </div>
          ` : ''}
          ${currentMode.name === 'AUTO' ? `
            <div style="font-size: 0.85em; margin-top: 8px; font-style: italic; opacity: 0.7;">
              Auto-detected: ${connectionSpeed} connection${batteryStatus ? `, battery ${Math.round(batteryStatus.level * 100)}%` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  /**
   * Set network mode manually
   */
  function setMode(modeName) {
    if (!MODES[modeName]) {
      console.error(`❌ Invalid mode: ${modeName}`);
      return false;
    }

    currentMode = MODES[modeName];
    localStorage.setItem(CONFIG.STORAGE_KEY, modeName);
    
    if (modeName === 'AUTO') {
      detectNetworkMode().then(() => updateModeIndicator());
    } else {
      updateModeIndicator();
      notifyListeners();
    }

    console.log(`✅ Mode set to: ${modeName}`);
    return true;
  }

  /**
   * Get current mode
   */
  function getCurrentMode() {
    return currentMode.name === 'AUTO' ? detectedMode : currentMode;
  }

  /**
   * Get fetch interval for current mode
   */
  function getFetchInterval() {
    return getCurrentMode().fetchInterval;
  }

  /**
   * Check if online
   */
  function isCurrentlyOnline() {
    return isOnline && getCurrentMode().name !== 'OFFLINE';
  }

  /**
   * Add change listener
   */
  function addChangeListener(callback) {
    if (typeof callback === 'function') {
      listeners.push(callback);
    }
  }

  /**
   * Remove change listener
   */
  function removeChangeListener(callback) {
    listeners = listeners.filter(cb => cb !== callback);
  }

  /**
   * Notify all listeners of mode change
   */
  function notifyListeners() {
    const mode = getCurrentMode();
    listeners.forEach(callback => {
      try {
        callback({
          mode: mode.name,
          isOnline: isCurrentlyOnline(),
          fetchInterval: mode.fetchInterval,
          connectionSpeed,
          batteryLevel: batteryStatus?.level
        });
      } catch (error) {
        console.error('❌ Listener error:', error);
      }
    });
  }

  /**
   * Get network status summary
   */
  function getStatus() {
    const mode = getCurrentMode();
    return {
      currentMode: currentMode.name,
      detectedMode: detectedMode.name,
      activeMode: mode.name,
      isOnline,
      connectionSpeed,
      batteryLevel: batteryStatus?.level,
      batteryCharging: batteryStatus?.charging,
      fetchInterval: mode.fetchInterval,
      lastCheck: localStorage.getItem(CONFIG.LAST_CHECK_KEY)
    };
  }

  /**
   * Force recheck network conditions
   */
  async function forceRecheck() {
    console.log('🔄 Forcing network recheck...');
    await detectNetworkMode();
    updateModeIndicator();
    return getStatus();
  }

  // Public API
  return {
    init,
    detectNetworkMode,
    updateModeIndicator,
    setMode,
    getCurrentMode,
    getFetchInterval,
    isOnline: isCurrentlyOnline,
    addChangeListener,
    removeChangeListener,
    getStatus,
    forceRecheck,
    MODES
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SangocastNetworkManager.init();
  });
} else {
  SangocastNetworkManager.init();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SangocastNetworkManager;
}

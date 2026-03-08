/**
 * SangoCast Network Manager v2.1
 * Manages network connectivity detection and status monitoring
 * Pure JavaScript module - no dependencies
 */

const SangocastNetworkManager = (function() {
  'use strict';

  // Private state
  let isOnline = navigator.onLine;
  let lastCheckTime = null;
  let checkInterval = null;
  let listeners = [];

  /**
   * Initialize the network manager
   */
  function init() {
    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    updateStatus();

    // Periodic heartbeat (every 30 seconds)
    checkInterval = setInterval(performHeartbeat, 30000);

    console.log('[NetworkManager] Initialized');
  }

  /**
   * Handle online event
   */
  function handleOnline() {
    isOnline = true;
    lastCheckTime = new Date().toISOString();
    notifyListeners();
    console.log('[NetworkManager] Network online');
  }

  /**
   * Handle offline event
   */
  function handleOffline() {
    isOnline = false;
    lastCheckTime = new Date().toISOString();
    notifyListeners();
    console.log('[NetworkManager] Network offline');
  }

  /**
   * Update network status
   */
  function updateStatus() {
    isOnline = navigator.onLine;
    lastCheckTime = new Date().toISOString();
  }

  /**
   * Perform network heartbeat check
   * Tests actual connectivity by attempting to fetch a small resource
   */
  async function performHeartbeat() {
    try {
      // Attempt to fetch a small resource with no-cache
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        mode: 'no-cors'
      });
      
      const wasOnline = isOnline;
      isOnline = true;
      lastCheckTime = new Date().toISOString();

      if (!wasOnline) {
        console.log('[NetworkManager] Heartbeat: Connection restored');
        notifyListeners();
      }
    } catch (error) {
      const wasOnline = isOnline;
      isOnline = false;
      lastCheckTime = new Date().toISOString();

      if (wasOnline) {
        console.log('[NetworkManager] Heartbeat: Connection lost');
        notifyListeners();
      }
    }
  }

  /**
   * Get current network status
   * @returns {Object} Status object with isOnline and lastCheck
   */
  function getStatus() {
    return {
      isOnline: isOnline,
      lastCheck: lastCheckTime
    };
  }

  /**
   * Add a listener for network status changes
   * @param {Function} callback - Function to call when status changes
   */
  function addChangeListener(callback) {
    if (typeof callback === 'function') {
      listeners.push(callback);
    }
  }

  /**
   * Remove a listener
   * @param {Function} callback - Function to remove
   */
  function removeChangeListener(callback) {
    listeners = listeners.filter(listener => listener !== callback);
  }

  /**
   * Notify all listeners of status change
   */
  function notifyListeners() {
    const status = getStatus();
    listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('[NetworkManager] Listener error:', error);
      }
    });
  }

  /**
   * Cleanup and stop monitoring
   */
  function destroy() {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    
    listeners = [];
    console.log('[NetworkManager] Destroyed');
  }

  // Public API
  return {
    init: init,
    getStatus: getStatus,
    performHeartbeat: performHeartbeat,
    addChangeListener: addChangeListener,
    removeChangeListener: removeChangeListener,
    destroy: destroy
  };
})();

// Auto-initialize if in browser environment
if (typeof window !== 'undefined') {
  SangocastNetworkManager.init();
}

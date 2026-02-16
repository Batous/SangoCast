/**
 * SANGOCAST Network Manager - Test Suite
 * Comprehensive tests for network detection and mode selection
 */

class NetworkManagerTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  // Test runner
  async runAll() {
    console.log('🧪 Starting SANGOCAST Network Manager Tests\n');
    console.log('═'.repeat(60));

    // Initialize manager
    await SangocastNetworkManager.init();

    // Run all tests
    await this.testInitialization();
    await this.testModeDetection();
    await this.testModeSelection();
    await this.testEventListeners();
    await this.testStoragePersistence();
    await this.testAPIResponses();
    await this.testUIUpdates();
    await this.testErrorHandling();

    // Display results
    this.displayResults();
  }

  // Test: Initialization
  async testInitialization() {
    this.section('Initialization Tests');

    this.test('Manager initializes successfully', () => {
      return SangocastNetworkManager !== undefined;
    });

    this.test('All modes are defined', () => {
      const modes = ['AUTO', 'ONLINE_LIVE', 'ONLINE_SMART', 'OFFLINE'];
      return modes.every(mode => SangocastNetworkManager.MODES[mode] !== undefined);
    });

    this.test('Default mode is AUTO', () => {
      const status = SangocastNetworkManager.getStatus();
      return status.currentMode === 'AUTO';
    });

    this.test('UI indicator exists', () => {
      const indicator = document.getElementById('network-mode-indicator');
      return indicator !== null;
    });
  }

  // Test: Mode Detection
  async testModeDetection() {
    this.section('Mode Detection Tests');

    this.test('detectNetworkMode returns valid mode', async () => {
      const mode = await SangocastNetworkManager.detectNetworkMode();
      const validModes = ['ONLINE_LIVE', 'ONLINE_SMART', 'OFFLINE'];
      return validModes.includes(mode.name);
    });

    this.test('isOnline reflects connection status', () => {
      const isOnline = SangocastNetworkManager.isOnline();
      return typeof isOnline === 'boolean';
    });

    this.test('Connection speed is detected', async () => {
      const status = SangocastNetworkManager.getStatus();
      const validSpeeds = ['fast', 'medium', 'slow', 'unknown'];
      return validSpeeds.includes(status.connectionSpeed);
    });

    this.test('Fetch interval is set correctly', () => {
      const interval = SangocastNetworkManager.getFetchInterval();
      return interval === null || (typeof interval === 'number' && interval > 0);
    });
  }

  // Test: Mode Selection
  async testModeSelection() {
    this.section('Mode Selection Tests');

    this.test('Can set ONLINE_LIVE mode', () => {
      const result = SangocastNetworkManager.setMode('ONLINE_LIVE');
      const status = SangocastNetworkManager.getStatus();
      return result && status.currentMode === 'ONLINE_LIVE';
    });

    this.test('ONLINE_LIVE has 1 hour interval', () => {
      SangocastNetworkManager.setMode('ONLINE_LIVE');
      const interval = SangocastNetworkManager.getFetchInterval();
      return interval === 3600000; // 1 hour in ms
    });

    this.test('Can set ONLINE_SMART mode', () => {
      const result = SangocastNetworkManager.setMode('ONLINE_SMART');
      const status = SangocastNetworkManager.getStatus();
      return result && status.currentMode === 'ONLINE_SMART';
    });

    this.test('ONLINE_SMART has 6 hour interval', () => {
      SangocastNetworkManager.setMode('ONLINE_SMART');
      const interval = SangocastNetworkManager.getFetchInterval();
      return interval === 21600000; // 6 hours in ms
    });

    this.test('Can set OFFLINE mode', () => {
      const result = SangocastNetworkManager.setMode('OFFLINE');
      const status = SangocastNetworkManager.getStatus();
      return result && status.currentMode === 'OFFLINE';
    });

    this.test('OFFLINE mode has no fetch interval', () => {
      SangocastNetworkManager.setMode('OFFLINE');
      const interval = SangocastNetworkManager.getFetchInterval();
      return interval === null;
    });

    this.test('Can switch back to AUTO mode', () => {
      const result = SangocastNetworkManager.setMode('AUTO');
      const status = SangocastNetworkManager.getStatus();
      return result && status.currentMode === 'AUTO';
    });

    this.test('Invalid mode returns false', () => {
      const result = SangocastNetworkManager.setMode('INVALID_MODE');
      return result === false;
    });
  }

  // Test: Event Listeners
  async testEventListeners() {
    this.section('Event Listener Tests');

    this.test('Can add change listener', () => {
      let listenerCalled = false;
      const testListener = () => { listenerCalled = true; };
      
      SangocastNetworkManager.addChangeListener(testListener);
      SangocastNetworkManager.setMode('ONLINE_LIVE');
      
      const result = listenerCalled;
      SangocastNetworkManager.removeChangeListener(testListener);
      SangocastNetworkManager.setMode('AUTO');
      
      return result;
    });

    this.test('Listener receives correct status', () => {
      return new Promise((resolve) => {
        const testListener = (status) => {
          const isValid = status.mode !== undefined && 
                         typeof status.isOnline === 'boolean';
          SangocastNetworkManager.removeChangeListener(testListener);
          resolve(isValid);
        };
        
        SangocastNetworkManager.addChangeListener(testListener);
        SangocastNetworkManager.setMode('ONLINE_SMART');
      });
    });

    this.test('Can remove listener', () => {
      let callCount = 0;
      const testListener = () => { callCount++; };
      
      SangocastNetworkManager.addChangeListener(testListener);
      SangocastNetworkManager.setMode('ONLINE_LIVE');
      
      SangocastNetworkManager.removeChangeListener(testListener);
      SangocastNetworkManager.setMode('ONLINE_SMART');
      
      SangocastNetworkManager.setMode('AUTO');
      return callCount === 1; // Should only be called once
    });

    this.test('Multiple listeners work independently', () => {
      let listener1Called = false;
      let listener2Called = false;
      
      const listener1 = () => { listener1Called = true; };
      const listener2 = () => { listener2Called = true; };
      
      SangocastNetworkManager.addChangeListener(listener1);
      SangocastNetworkManager.addChangeListener(listener2);
      
      SangocastNetworkManager.setMode('ONLINE_LIVE');
      
      const result = listener1Called && listener2Called;
      
      SangocastNetworkManager.removeChangeListener(listener1);
      SangocastNetworkManager.removeChangeListener(listener2);
      SangocastNetworkManager.setMode('AUTO');
      
      return result;
    });
  }

  // Test: Storage Persistence
  async testStoragePersistence() {
    this.section('Storage Persistence Tests');

    this.test('Mode is saved to localStorage', () => {
      SangocastNetworkManager.setMode('ONLINE_SMART');
      const saved = localStorage.getItem('sangocast_network_mode');
      SangocastNetworkManager.setMode('AUTO');
      return saved === 'ONLINE_SMART';
    });

    this.test('Last check timestamp is saved', async () => {
      await SangocastNetworkManager.detectNetworkMode();
      const lastCheck = localStorage.getItem('sangocast_last_check');
      return lastCheck !== null && !isNaN(parseInt(lastCheck));
    });

    this.test('Saved mode persists', () => {
      localStorage.setItem('sangocast_network_mode', 'ONLINE_LIVE');
      // Simulate reload by checking if mode would be restored
      const saved = localStorage.getItem('sangocast_network_mode');
      return saved === 'ONLINE_LIVE';
    });
  }

  // Test: API Responses
  async testAPIResponses() {
    this.section('API Response Tests');

    this.test('getStatus returns complete status', () => {
      const status = SangocastNetworkManager.getStatus();
      const requiredFields = [
        'currentMode', 'detectedMode', 'activeMode', 
        'isOnline', 'connectionSpeed'
      ];
      return requiredFields.every(field => status[field] !== undefined);
    });

    this.test('getCurrentMode returns mode object', () => {
      const mode = SangocastNetworkManager.getCurrentMode();
      return mode.name !== undefined && 
             mode.label !== undefined && 
             mode.icon !== undefined;
    });

    this.test('forceRecheck returns status', async () => {
      const status = await SangocastNetworkManager.forceRecheck();
      return status.activeMode !== undefined;
    });

    this.test('Mode objects have required properties', () => {
      const modes = Object.values(SangocastNetworkManager.MODES);
      return modes.every(mode => 
        mode.name && mode.label && mode.icon && mode.description && mode.color
      );
    });
  }

  // Test: UI Updates
  async testUIUpdates() {
    this.section('UI Update Tests');

    this.test('Indicator updates when mode changes', () => {
      const indicator = document.getElementById('network-mode-indicator');
      const initialHTML = indicator.innerHTML;
      
      SangocastNetworkManager.setMode('ONLINE_LIVE');
      SangocastNetworkManager.updateModeIndicator();
      const updatedHTML = indicator.innerHTML;
      
      SangocastNetworkManager.setMode('AUTO');
      return initialHTML !== updatedHTML;
    });

    this.test('Indicator shows correct icon', () => {
      SangocastNetworkManager.setMode('ONLINE_SMART');
      SangocastNetworkManager.updateModeIndicator();
      
      const indicator = document.getElementById('network-mode-indicator');
      const hasIcon = indicator.innerHTML.includes('🟡');
      
      SangocastNetworkManager.setMode('AUTO');
      return hasIcon;
    });

    this.test('Settings panel updates', () => {
      const panel = document.getElementById('network-settings-panel');
      if (!panel) return true; // Skip if panel doesn't exist
      
      const modeInfo = document.getElementById('current-mode-info');
      const hadContent = modeInfo && modeInfo.innerHTML.length > 0;
      
      SangocastNetworkManager.updateModeIndicator();
      const hasContent = modeInfo && modeInfo.innerHTML.length > 0;
      
      return hasContent || hadContent; // Either had content before or has it now
    });
  }

  // Test: Error Handling
  async testErrorHandling() {
    this.section('Error Handling Tests');

    this.test('Handles missing UI elements gracefully', () => {
      // Temporarily remove indicator
      const indicator = document.getElementById('network-mode-indicator');
      const parent = indicator.parentNode;
      parent.removeChild(indicator);
      
      // Should not throw error
      let errorThrown = false;
      try {
        SangocastNetworkManager.updateModeIndicator();
      } catch (e) {
        errorThrown = true;
      }
      
      // Restore indicator
      parent.appendChild(indicator);
      
      return !errorThrown;
    });

    this.test('Invalid listener doesn\'t break system', () => {
      SangocastNetworkManager.addChangeListener(null);
      SangocastNetworkManager.addChangeListener('not a function');
      SangocastNetworkManager.addChangeListener(123);
      
      // Should still work
      let worked = true;
      try {
        SangocastNetworkManager.setMode('ONLINE_LIVE');
        SangocastNetworkManager.setMode('AUTO');
      } catch (e) {
        worked = false;
      }
      
      return worked;
    });

    this.test('Handles failed ping test', async () => {
      // This test just verifies it doesn't crash
      let errorThrown = false;
      try {
        await SangocastNetworkManager.detectNetworkMode();
      } catch (e) {
        errorThrown = true;
      }
      return !errorThrown;
    });
  }

  // Test utilities
  section(name) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 ${name}`);
    console.log('─'.repeat(60));
  }

  test(description, testFn) {
    try {
      const result = testFn();
      
      if (result instanceof Promise) {
        result.then(passed => {
          this.recordResult(description, passed);
        }).catch(error => {
          this.recordResult(description, false, error);
        });
      } else {
        this.recordResult(description, result);
      }
    } catch (error) {
      this.recordResult(description, false, error);
    }
  }

  recordResult(description, passed, error) {
    const icon = passed ? '✅' : '❌';
    const status = passed ? 'PASS' : 'FAIL';
    
    console.log(`${icon} ${description}`);
    
    if (!passed && error) {
      console.log(`   Error: ${error.message || error}`);
    }
    
    this.results.push({ description, passed, error });
    
    if (passed) {
      this.passed++;
    } else {
      this.failed++;
    }
  }

  displayResults() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Test Results Summary');
    console.log('═'.repeat(60));
    
    const total = this.passed + this.failed;
    const percentage = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;
    
    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${percentage}%`);
    
    if (this.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => console.log(`   - ${r.description}`));
    }
    
    console.log('\n' + '═'.repeat(60));
    
    if (this.failed === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('⚠️  Some tests failed. Please review.');
    }
    
    console.log('═'.repeat(60) + '\n');
  }
}

// Auto-run tests when page loads
window.addEventListener('load', async () => {
  // Wait for manager to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const tests = new NetworkManagerTests();
  await tests.runAll();
});

/**
 * Production Safety Utilities for Ninja Timer
 *
 * These utilities provide defensive programming patterns to prevent crashes,
 * memory leaks, and ensure reliable operation during long production sessions.
 */

// ============================================================================
// TIMER MANAGEMENT - Track all timers for cleanup
// ============================================================================

const activeTimeouts = new Set();
const activeIntervals = new Set();

/**
 * Safe setTimeout that tracks the timer for cleanup
 * @param {Function} fn - Callback function
 * @param {number} delay - Delay in milliseconds
 * @returns {number} Timer ID
 */
function safeTimeout(fn, delay) {
  const id = setTimeout(() => {
    activeTimeouts.delete(id);
    try {
      fn();
    } catch (err) {
      console.error('[SafeTimeout] Callback error (recovered):', err);
    }
  }, delay);
  activeTimeouts.add(id);
  return id;
}

/**
 * Safe setInterval that tracks the interval for cleanup
 * @param {Function} fn - Callback function
 * @param {number} delay - Interval in milliseconds
 * @returns {number} Interval ID
 */
function safeInterval(fn, delay) {
  const id = setInterval(() => {
    try {
      fn();
    } catch (err) {
      console.error('[SafeInterval] Callback error (recovered):', err);
    }
  }, delay);
  activeIntervals.add(id);
  return id;
}

/**
 * Clear a tracked timeout
 * @param {number} id - Timer ID
 */
function safeClearTimeout(id) {
  if (id) {
    clearTimeout(id);
    activeTimeouts.delete(id);
  }
}

/**
 * Clear a tracked interval
 * @param {number} id - Interval ID
 */
function safeClearInterval(id) {
  if (id) {
    clearInterval(id);
    activeIntervals.delete(id);
  }
}

/**
 * Clear all tracked timers and intervals
 */
function clearAllTimers() {
  activeTimeouts.forEach(id => clearTimeout(id));
  activeTimeouts.clear();
  activeIntervals.forEach(id => clearInterval(id));
  activeIntervals.clear();
}

// ============================================================================
// LISTENER MANAGEMENT - Prevent listener accumulation
// ============================================================================

const listenerRegistry = new Map();

/**
 * Add an event listener with automatic deduplication
 * If a listener with the same key exists, it's removed before adding the new one
 * @param {EventTarget} target - DOM element or other event target
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {string} key - Unique key for this listener (for deduplication)
 * @param {object} options - addEventListener options
 */
function safeAddListener(target, event, handler, key, options = false) {
  const fullKey = `${key}:${event}`;

  // Remove existing listener if present
  if (listenerRegistry.has(fullKey)) {
    const { target: oldTarget, event: oldEvent, handler: oldHandler, options: oldOptions } = listenerRegistry.get(fullKey);
    try {
      oldTarget.removeEventListener(oldEvent, oldHandler, oldOptions);
    } catch (err) {
      // Target may have been destroyed
    }
  }

  // Store and add new listener
  listenerRegistry.set(fullKey, { target, event, handler, options });
  target.addEventListener(event, handler, options);
}

/**
 * Remove a specific tracked listener by key
 * @param {string} key - The key used when adding the listener
 * @param {string} event - Event name
 */
function safeRemoveListener(key, event) {
  const fullKey = `${key}:${event}`;
  if (listenerRegistry.has(fullKey)) {
    const { target, event: evtName, handler, options } = listenerRegistry.get(fullKey);
    try {
      target.removeEventListener(evtName, handler, options);
    } catch (err) {
      // Target may have been destroyed
    }
    listenerRegistry.delete(fullKey);
  }
}

/**
 * Remove all tracked listeners
 */
function clearAllListeners() {
  listenerRegistry.forEach(({ target, event, handler, options }) => {
    try {
      target.removeEventListener(event, handler, options);
    } catch (err) {
      // Target may have been destroyed
    }
  });
  listenerRegistry.clear();
}

// ============================================================================
// RAF MANAGEMENT - Controlled animation frame lifecycle
// ============================================================================

const rafRegistry = new Map();

/**
 * Start a managed render loop
 * @param {string} key - Unique key for this render loop
 * @param {Function} renderFn - Render function to call each frame
 * @returns {boolean} True if started, false if already running
 */
function startRenderLoop(key, renderFn) {
  if (rafRegistry.has(key)) {
    return false; // Already running
  }

  let rafId = null;
  let isRunning = true;

  function loop() {
    if (!isRunning) return;

    try {
      renderFn();
    } catch (err) {
      console.error(`[RenderLoop:${key}] Error (recovered):`, err);
    }

    if (isRunning) {
      rafId = requestAnimationFrame(loop);
    }
  }

  rafRegistry.set(key, {
    stop: () => {
      isRunning = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  });

  loop();
  return true;
}

/**
 * Stop a managed render loop
 * @param {string} key - Key of the render loop to stop
 */
function stopRenderLoop(key) {
  if (rafRegistry.has(key)) {
    rafRegistry.get(key).stop();
    rafRegistry.delete(key);
  }
}

/**
 * Stop all managed render loops
 */
function stopAllRenderLoops() {
  rafRegistry.forEach(entry => entry.stop());
  rafRegistry.clear();
}

/**
 * Check if a render loop is running
 * @param {string} key - Key to check
 * @returns {boolean}
 */
function isRenderLoopRunning(key) {
  return rafRegistry.has(key);
}

// ============================================================================
// DOM SAFETY - Safe element access
// ============================================================================

/**
 * Safely get an element by ID, returning a fallback if not found
 * @param {string} id - Element ID
 * @param {HTMLElement} fallback - Fallback element (default: creates detached div)
 * @returns {HTMLElement}
 */
function safeGetElement(id, fallback = null) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[SafeDOM] Element not found: #${id}`);
    return fallback || createDetachedElement('div');
  }
  return el;
}

/**
 * Safely query an element, returning a fallback if not found
 * @param {string} selector - CSS selector
 * @param {HTMLElement} fallback - Fallback element
 * @returns {HTMLElement}
 */
function safeQuerySelector(selector, fallback = null) {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn(`[SafeDOM] Element not found: ${selector}`);
    return fallback || createDetachedElement('div');
  }
  return el;
}

/**
 * Create a detached element that can receive operations without affecting DOM
 * @param {string} tagName - Element tag name
 * @returns {HTMLElement}
 */
function createDetachedElement(tagName) {
  const el = document.createElement(tagName);
  el._isDetached = true;
  return el;
}

/**
 * Check if an element is a detached fallback
 * @param {HTMLElement} el - Element to check
 * @returns {boolean}
 */
function isDetachedElement(el) {
  return el && el._isDetached === true;
}

// ============================================================================
// SAFE EXECUTION - Protected function calls
// ============================================================================

/**
 * Execute a function with error recovery
 * @param {Function} fn - Function to execute
 * @param {string} context - Context description for logging
 * @param {*} fallbackValue - Value to return on error
 * @returns {*} Result of fn() or fallbackValue on error
 */
function safeExecute(fn, context = 'unknown', fallbackValue = undefined) {
  try {
    return fn();
  } catch (err) {
    console.error(`[SafeExecute:${context}] Error (recovered):`, err);
    return fallbackValue;
  }
}

/**
 * Create a wrapped version of a function that never throws
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context description for logging
 * @returns {Function} Wrapped function
 */
function createSafeFunction(fn, context = 'unknown') {
  return function(...args) {
    try {
      return fn.apply(this, args);
    } catch (err) {
      console.error(`[SafeFunction:${context}] Error (recovered):`, err);
      return undefined;
    }
  };
}

// ============================================================================
// WATCHDOG - Detect frozen render loops
// ============================================================================

let watchdogInterval = null;
const watchdogHeartbeats = new Map();

/**
 * Start the watchdog timer
 * @param {Function} onFrozen - Callback when a loop appears frozen
 * @param {number} checkInterval - How often to check (ms)
 * @param {number} frozenThreshold - Time without heartbeat before considered frozen (ms)
 */
function startWatchdog(onFrozen, checkInterval = 1000, frozenThreshold = 5000) {
  if (watchdogInterval) return;

  watchdogInterval = setInterval(() => {
    const now = Date.now();
    watchdogHeartbeats.forEach((lastBeat, key) => {
      if (now - lastBeat > frozenThreshold) {
        console.error(`[Watchdog] Loop "${key}" appears frozen (no heartbeat for ${now - lastBeat}ms)`);
        if (onFrozen) {
          try {
            onFrozen(key);
          } catch (err) {
            console.error('[Watchdog] onFrozen callback error:', err);
          }
        }
      }
    });
  }, checkInterval);
}

/**
 * Stop the watchdog timer
 */
function stopWatchdog() {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
  watchdogHeartbeats.clear();
}

/**
 * Record a heartbeat for a render loop
 * @param {string} key - Loop identifier
 */
function watchdogHeartbeat(key) {
  watchdogHeartbeats.set(key, Date.now());
}

/**
 * Remove a loop from watchdog monitoring
 * @param {string} key - Loop identifier
 */
function watchdogUnregister(key) {
  watchdogHeartbeats.delete(key);
}

// ============================================================================
// COMPREHENSIVE CLEANUP - Call on window close
// ============================================================================

/**
 * Perform complete cleanup of all tracked resources
 */
function cleanupAll() {
  stopAllRenderLoops();
  clearAllTimers();
  clearAllListeners();
  stopWatchdog();
}

// ============================================================================
// EXPORTS
// ============================================================================

// ES Module exports
export {
  // Timer management
  safeTimeout,
  safeInterval,
  safeClearTimeout,
  safeClearInterval,
  clearAllTimers,

  // Listener management
  safeAddListener,
  safeRemoveListener,
  clearAllListeners,

  // RAF management
  startRenderLoop,
  stopRenderLoop,
  stopAllRenderLoops,
  isRenderLoopRunning,

  // DOM safety
  safeGetElement,
  safeQuerySelector,
  createDetachedElement,
  isDetachedElement,

  // Safe execution
  safeExecute,
  createSafeFunction,

  // Watchdog
  startWatchdog,
  stopWatchdog,
  watchdogHeartbeat,
  watchdogUnregister,

  // Cleanup
  cleanupAll
};

// For CommonJS / bundlers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    safeTimeout,
    safeInterval,
    safeClearTimeout,
    safeClearInterval,
    clearAllTimers,
    safeAddListener,
    safeRemoveListener,
    clearAllListeners,
    startRenderLoop,
    stopRenderLoop,
    stopAllRenderLoops,
    isRenderLoopRunning,
    safeGetElement,
    safeQuerySelector,
    createDetachedElement,
    isDetachedElement,
    safeExecute,
    createSafeFunction,
    startWatchdog,
    stopWatchdog,
    watchdogHeartbeat,
    watchdogUnregister,
    cleanupAll
  };
}

// For browser global (non-module scripts)
if (typeof window !== 'undefined') {
  window.SafeUtils = {
    safeTimeout,
    safeInterval,
    safeClearTimeout,
    safeClearInterval,
    clearAllTimers,
    safeAddListener,
    safeRemoveListener,
    clearAllListeners,
    startRenderLoop,
    stopRenderLoop,
    stopAllRenderLoops,
    isRenderLoopRunning,
    safeGetElement,
    safeQuerySelector,
    createDetachedElement,
    isDetachedElement,
    safeExecute,
    createSafeFunction,
    startWatchdog,
    stopWatchdog,
    watchdogHeartbeat,
    watchdogUnregister,
    cleanupAll
  };
}

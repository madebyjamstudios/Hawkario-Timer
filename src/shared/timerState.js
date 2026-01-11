/**
 * Ninja Timer - Canonical Timer State
 * Single source of truth for timer state shared between windows
 */

/**
 * Create a new timer state object with defaults
 * All timestamps are absolute Date.now() values
 */
export function createTimerState(overrides = {}) {
  return {
    // Sequence number - increment on every state change
    seq: 0,

    // Timer configuration
    mode: 'countdown',
    durationMs: 600000, // 10 minutes default
    format: 'MM:SS',

    // Timer runtime state (timestamps)
    startedAt: null,      // Epoch ms when timer was started
    pausedAccMs: 0,       // Accumulated pause time in ms
    isRunning: false,

    // Timer status
    ended: false,
    overtime: false,
    overtimeStartedAt: null,

    // Visual state (ABSOLUTE, not toggles!)
    blackout: false,
    flash: {
      active: false,
      startedAt: null
    },

    // Style configuration
    style: {
      color: '#ffffff',
      bgColor: '#000000',
      strokeWidth: 0,
      strokeColor: '#000000',
      shadowSize: 0
    },

    // Time of day format for ToD modes
    todFormat: '12h',

    ...overrides
  };
}

/**
 * Get default style object
 */
export function getDefaultStyle() {
  return {
    color: '#ffffff',
    bgColor: '#000000',
    strokeWidth: 0,
    strokeColor: '#000000',
    shadowSize: 0
  };
}

/**
 * Fixed style constants (not user-configurable)
 */
export const FIXED_STYLE = {
  fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  fontWeight: '600',
  opacity: 1,
  align: 'center',
  letterSpacing: 0.02
};

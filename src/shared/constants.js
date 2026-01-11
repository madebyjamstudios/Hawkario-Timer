/**
 * Ninja Timer - Shared Constants
 */

// Brand colors
export const BRAND_COLORS = {
  orange: '#E64A19',
  orangeLight: '#FF5722',
  orangeDark: '#BF360C',
  overtimeRed: '#ff3333'  // Exception: overtime stays red
};

// Local storage keys
export const STORAGE_KEYS = {
  PRESETS: 'ninja-presets-v1',
  SETTINGS: 'ninja-settings-v1'
};

// Timer modes
export const TIMER_MODES = {
  COUNTDOWN: 'countdown',
  COUNTUP: 'countup'
};

// Time formats
export const TIME_FORMATS = {
  HMS: 'H:MM:SS',
  MS: 'MM:SS',
  S: 'SS'
};

// Default timer configuration
export const DEFAULT_CONFIG = {
  mode: TIMER_MODES.COUNTDOWN,
  durationSec: 1200, // 20 minutes
  format: TIME_FORMATS.MS,
  style: {
    fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    fontWeight: '600',
    fontSizeVw: 10,
    color: '#ffffff',
    opacity: 1,
    strokeWidth: 0,
    strokeColor: '#000000',
    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
    align: 'center',
    letterSpacing: 0,
    bgMode: 'transparent',
    bgColor: '#000000',
    bgOpacity: 0
  },
  warn: {
    enabled: true,
    seconds: 120,
    colorEnabled: true,
    color: '#E64A19',
    flashEnabled: false,
    flashRateMs: 500,
    soundEnabled: false
  },
  sound: {
    warnEnabled: false,
    endEnabled: false,
    volume: 0.7
  }
};

// Sound types
export const SOUND_TYPES = {
  WARNING: 'warning',
  END: 'end',
  TICK: 'tick'
};

// Keyboard shortcuts
export const SHORTCUTS = {
  START: 'start',
  PAUSE: 'pause',
  RESET: 'reset',
  TOGGLE: 'toggle',
  FULLSCREEN: 'fullscreen'
};

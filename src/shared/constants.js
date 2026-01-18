/**
 * Ninja Timer - Shared Constants
 */

// Local storage keys
export const STORAGE_KEYS = {
  PROFILES: 'ninja-profiles-v1',
  PRESETS: 'ninja-presets-v1',  // Legacy, kept for migration
  SETTINGS: 'ninja-settings-v1',
  CRASH_RECOVERY: 'ninja-crash-recovery-v1',  // For production safety: auto-save timer state
  TUTORIAL_COMPLETE: 'ninja-tutorial-complete'  // Track if onboarding has been shown
};

// Timer modes
export const TIMER_MODES = {
  COUNTDOWN: 'countdown',
  COUNTUP: 'countup'
};

// Time formats
export const TIME_FORMATS = {
  HMS: 'HH:MM:SS',
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
    fontWeight: '700',
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


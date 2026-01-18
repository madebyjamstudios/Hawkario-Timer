/**
 * Ninja Timer - Control Window
 * Main controller for timer configuration and preset management
 *
 * Production Safety: This file includes defensive programming patterns
 * to prevent crashes and ensure reliable long-session operation.
 */

import { parseHMS, secondsToHMS, formatTime, formatTimePlain, formatTimeOfDay, hexToRgba, debounce } from '../shared/timer.js';
import { validateConfig, validatePresets, safeJSONParse, validateExportData } from '../shared/validation.js';
import { STORAGE_KEYS } from '../shared/constants.js';
import { createTimerState, FIXED_STYLE } from '../shared/timerState.js';
import { computeDisplay, getShadowCSS, getCombinedShadowCSS, FlashAnimator } from '../shared/renderTimer.js';
import { autoFitMessage, applyMessageStyle } from '../shared/renderMessage.js';
import { playSound } from '../shared/sounds.js';
import { BUILT_IN_FONTS, WEIGHT_LABELS, getAvailableWeights, isBuiltInFont, verifyFonts } from '../shared/fontManager.js';
import { BUILT_IN_SOUNDS, isBuiltInSound, isCustomSound, getCustomSoundId, createCustomSoundType, getAudioFormat, getAudioMimeType } from '../shared/soundManager.js';
import {
  safeTimeout,
  safeInterval,
  safeClearTimeout,
  safeClearInterval,
  clearAllTimers,
  safeAddListener,
  clearAllListeners,
  startRenderLoop,
  stopRenderLoop,
  stopAllRenderLoops,
  safeExecute,
  watchdogHeartbeat,
  startWatchdog,
  stopWatchdog,
  cleanupAll
} from '../shared/safeUtils.js';

// Profile color palette
const PROFILE_COLORS = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#3b82f6', // blue
  '#10b981'  // emerald
];

// DOM Elements
const els = {
  // Timer settings (in modal)
  mode: document.getElementById('mode'),
  startMode: document.getElementById('startMode'),
  targetTime: document.getElementById('targetTime'),
  targetTimeRow: document.getElementById('targetTimeRow'),
  duration: document.getElementById('duration'),
  durationRow: document.getElementById('durationRow'),
  format: document.getElementById('format'),
  allowOvertime: document.getElementById('allowOvertime'),
  allowOvertimeRow: document.getElementById('allowOvertimeRow'),

  // Appearance (simplified)
  fontPicker: document.getElementById('fontPicker'),
  fontFamily: document.getElementById('fontFamily'),
  fontWeight: document.getElementById('fontWeight'),
  fontColor: document.getElementById('fontColor'),
  strokeWidth: document.getElementById('strokeWidth'),
  strokeWidthValue: document.getElementById('strokeWidthValue'),
  strokeColor: document.getElementById('strokeColor'),
  shadowSize: document.getElementById('shadowSize'),
  shadowSizeValue: document.getElementById('shadowSizeValue'),
  shadowColor: document.getElementById('shadowColor'),
  bgColor: document.getElementById('bgColor'),

  // Sound
  soundEnd: document.getElementById('soundEnd'),
  soundPreview: document.getElementById('soundPreview'),
  soundVolume: document.getElementById('soundVolume'),
  volumeRow: document.getElementById('volumeRow'),

  // Warning thresholds
  warnYellowSec: document.getElementById('warnYellowSec'),
  warnOrangeSec: document.getElementById('warnOrangeSec'),

  // Live Preview (main window)
  previewSection: document.getElementById('previewSection'),
  previewResizeHandle: document.getElementById('previewResizeHandle'),
  previewWrapper: document.getElementById('previewWrapper'),
  livePreviewContainer: document.querySelector('.live-preview-wrapper'),
  livePreview: document.getElementById('livePreview'),
  livePreviewContentBox: document.getElementById('livePreviewContentBox'),
  livePreviewTimerSection: document.querySelector('.live-preview .timer-section'),
  livePreviewTimerBox: document.querySelector('.live-preview .timer-box'),
  livePreviewToDBox: document.querySelector('.live-preview .tod-box'),
  livePreviewMessageSection: document.querySelector('.live-preview .message-section'),
  livePreviewTimer: document.getElementById('livePreviewTimer'),
  livePreviewToD: document.getElementById('livePreviewToD'),
  livePreviewMessage: document.getElementById('livePreviewMessage'),

  // Modal Preview
  modalPreview: document.getElementById('modalPreview'),
  modalPreviewContentBox: document.querySelector('.modal-preview .content-box'),
  modalPreviewTimer: document.getElementById('modalPreviewTimer'),
  modalPreviewToD: document.getElementById('modalPreviewToD'),
  modalPreviewTimerSection: document.querySelector('.modal-preview .timer-section'),
  modalPreviewTimerBox: document.querySelector('.modal-preview .timer-box'),
  modalPreviewToDBox: document.querySelector('.modal-preview .tod-box'),

  // Controls
  blackoutBtn: document.getElementById('blackoutBtn'),
  flashBtn: document.getElementById('flashBtn'),
  openOutput: document.getElementById('openOutput'),

  // Profile dropdown
  profileBtn: document.getElementById('profileBtn'),
  profileName: document.getElementById('profileName'),
  profileColorDot: document.getElementById('profileColorDot'),

  // Presets
  presetName: document.getElementById('presetName'),
  presetList: document.getElementById('presetList'),
  presetListContainer: document.querySelector('.preset-list-container'),
  timerProgressContainer: document.getElementById('timerProgressContainer'),
  progressFill: document.getElementById('progressFill'),
  progressSegments: document.getElementById('progressSegments'),
  progressIndicator: document.getElementById('progressIndicator'),
  progressTrack: document.getElementById('progressTrack'),
  seekLine: document.getElementById('seekLine'),
  seekTooltip: document.getElementById('seekTooltip'),
  warningZones: document.getElementById('warningZones'),
  importFile: document.getElementById('importFile'),
  addTimer: document.getElementById('addTimer'),

  // Timer Modal
  timerModal: document.getElementById('timerModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalPopout: document.getElementById('modalPopout'),
  modalClose: document.getElementById('modalClose'),
  modalCancel: document.getElementById('modalCancel'),
  modalSave: document.getElementById('modalSave'),

  // App Settings Modal
  appSettingsBtn: document.getElementById('appSettingsBtn'),
  appSettingsModal: document.getElementById('appSettingsModal'),
  appSettingsClose: document.getElementById('appSettingsClose'),
  appSettingsSave: document.getElementById('appSettingsSave'),
  settingsExport: document.getElementById('settingsExport'),
  settingsImport: document.getElementById('settingsImport'),

  // App Settings Fields
  todFormat: document.getElementById('todFormat'),
  timezone: document.getElementById('timezone'),
  appearance: document.getElementById('appearance'),
  confirmDelete: document.getElementById('confirmDelete'),
  defaultMode: document.getElementById('defaultMode'),
  defaultDuration: document.getElementById('defaultDuration'),
  defaultFormat: document.getElementById('defaultFormat'),
  defaultSound: document.getElementById('defaultSound'),
  defaultAllowOvertime: document.getElementById('defaultAllowOvertime'),
  defaultSoundVolume: document.getElementById('defaultSoundVolume'),
  // Appearance defaults
  defaultFontFamily: document.getElementById('defaultFontFamily'),
  defaultFontWeight: document.getElementById('defaultFontWeight'),
  defaultColor: document.getElementById('defaultColor'),
  defaultStrokeWidth: document.getElementById('defaultStrokeWidth'),
  defaultStrokeColor: document.getElementById('defaultStrokeColor'),
  defaultShadowSize: document.getElementById('defaultShadowSize'),
  defaultShadowColor: document.getElementById('defaultShadowColor'),
  defaultBgColor: document.getElementById('defaultBgColor'),
  // Warning defaults
  defaultWarnYellow: document.getElementById('defaultWarnYellow'),
  defaultWarnOrange: document.getElementById('defaultWarnOrange'),
  timerZoom: document.getElementById('timerZoom'),
  alignToggle: document.getElementById('alignToggle'),
  outputOnTop: document.getElementById('outputOnTop'),
  controlOnTop: document.getElementById('controlOnTop'),

  // OSC Settings
  oscEnabled: document.getElementById('oscEnabled'),
  oscListenPort: document.getElementById('oscListenPort'),
  oscListenPortRow: document.getElementById('oscListenPortRow'),
  oscFeedbackEnabled: document.getElementById('oscFeedbackEnabled'),
  oscFeedbackHost: document.getElementById('oscFeedbackHost'),
  oscFeedbackHostRow: document.getElementById('oscFeedbackHostRow'),
  oscFeedbackPort: document.getElementById('oscFeedbackPort'),
  oscFeedbackPortRow: document.getElementById('oscFeedbackPortRow'),
  oscStatus: document.getElementById('oscStatus'),

  // Keyboard Shortcuts
  shortcutsModal: document.getElementById('shortcutsModal'),
  shortcutsClose: document.getElementById('shortcutsClose'),

  // Confirm Dialog
  confirmDialog: document.getElementById('confirmDialog'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmMessage: document.getElementById('confirmMessage'),
  confirmDontAskContainer: document.getElementById('confirmDontAskContainer'),
  confirmDontAsk: document.getElementById('confirmDontAsk'),
  confirmCancel: document.getElementById('confirmCancel'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

  // Tab elements
  timersTabBtn: document.getElementById('timersTabBtn'),
  messagesTabBtn: document.getElementById('messagesTabBtn'),
  timersTab: document.getElementById('timersTab'),
  messagesTab: document.getElementById('messagesTab'),

  // Message elements
  messageList: document.getElementById('messageList'),

  // Custom Sounds
  customSoundsList: document.getElementById('customSoundsList'),
  addCustomSound: document.getElementById('addCustomSound')
};

// ============================================================================
// DOM SAFEGUARDING (Production Safety)
// ============================================================================

/**
 * Create a safe fallback element that absorbs operations without crashing
 * @param {string} tagName - Element tag name
 * @returns {HTMLElement} - Detached element
 */
function createSafeFallback(tagName = 'div') {
  const el = document.createElement(tagName);
  el._isFallback = true;
  // Make common properties work without errors
  el.value = '';
  el.checked = false;
  el.selectedIndex = 0;
  el.classList.add = () => {};
  el.classList.remove = () => {};
  el.classList.toggle = () => false;
  el.classList.contains = () => false;
  return el;
}

/**
 * Validate all DOM elements and replace missing ones with safe fallbacks
 * Logs warnings but doesn't crash
 */
function safeguardElements() {
  const missingElements = [];

  for (const [key, el] of Object.entries(els)) {
    if (!el) {
      missingElements.push(key);
      // Replace with safe fallback
      els[key] = createSafeFallback();
    }
  }

  if (missingElements.length > 0) {
    console.warn('[DOM Safety] Missing elements (using fallbacks):', missingElements.join(', '));
  }
}

// Run safeguarding immediately
safeguardElements();

// Helper functions for unified time input (HH:MM:SS or HHH:MM:SS)
function formatTimeValue(h, m, s) {
  const hh = Math.min(999, Math.max(0, h));
  const mm = Math.min(59, Math.max(0, m));
  const ss = Math.min(59, Math.max(0, s));
  // Pad hours to 2 digits minimum, but allow 3 for 100+ hours
  const hhStr = hh >= 100 ? String(hh) : String(hh).padStart(2, '0');
  return `${hhStr}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function parseTimeValue(val) {
  const parts = (val || '00:00:00').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const s = parseInt(parts[2], 10) || 0;
  return { h, m, s };
}

/**
 * Smart parse informal duration strings
 * Supports: "530" → 5:30, "90" → 1:30, "13000" → 1:30:00, "5:30" → 5:30, etc.
 * Returns { h, m, s } or null if not parseable
 */
function parseSmartDuration(val) {
  if (!val) return null;
  const str = val.trim();

  // Already formatted as HH:MM:SS or H:MM:SS
  if (/^\d{1,3}:\d{1,2}:\d{1,2}$/.test(str)) {
    const parts = str.split(':');
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    const ss = parseInt(parts[2], 10);
    // Validate and normalize (e.g., 1:99:99 → 2:40:39)
    const totalSec = Math.min(hh * 3600 + mm * 60 + ss, 999 * 3600 + 59 * 60 + 59);
    return { h: Math.floor(totalSec / 3600), m: Math.floor((totalSec % 3600) / 60), s: totalSec % 60 };
  }

  // Formatted as MM:SS or M:SS
  if (/^\d{1,2}:\d{1,2}$/.test(str)) {
    const parts = str.split(':');
    const mm = parseInt(parts[0], 10);
    const ss = parseInt(parts[1], 10);
    // Validate and normalize (e.g., 99:99 → 1:40:39)
    const totalSec = Math.min(mm * 60 + ss, 999 * 3600 + 59 * 60 + 59);
    return { h: Math.floor(totalSec / 3600), m: Math.floor((totalSec % 3600) / 60), s: totalSec % 60 };
  }

  // Just digits - smart parse based on length
  // Cap at 999:59:59 to prevent unreasonable values
  const MAX_SECONDS = 999 * 3600 + 59 * 60 + 59;
  if (/^\d+$/.test(str)) {
    const num = str;
    if (num.length <= 2) {
      // 1-2 digits: treat as seconds (e.g., "30" → 0:00:30)
      const totalSec = Math.min(parseInt(num, 10), MAX_SECONDS);
      return { h: Math.floor(totalSec / 3600), m: Math.floor((totalSec % 3600) / 60), s: totalSec % 60 };
    } else if (num.length <= 4) {
      // 3-4 digits: treat as MMSS (e.g., "530" → 0:05:30, "1230" → 0:12:30)
      const ss = parseInt(num.slice(-2), 10);
      const mm = parseInt(num.slice(0, -2), 10);
      // Handle overflow (e.g., "90" as seconds)
      const totalSec = Math.min(mm * 60 + ss, MAX_SECONDS);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return { h, m, s };
    } else {
      // 5-6 digits: treat as HHMMSS (e.g., "13000" → 1:30:00, "123456" → 12:34:56)
      const ss = parseInt(num.slice(-2), 10);
      const mm = parseInt(num.slice(-4, -2), 10);
      const hh = parseInt(num.slice(0, -4), 10) || 0;
      // Validate and convert to total seconds to handle overflow (e.g., 99 seconds → 1:39)
      const totalSec = Math.min(hh * 3600 + mm * 60 + ss, MAX_SECONDS);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return { h, m, s };
    }
  }

  return null;
}

function getDurationSeconds() {
  const { h, m, s } = parseTimeValue(els.duration.value);
  return h * 3600 + m * 60 + s;
}

function setDurationInputs(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  els.duration.value = formatTimeValue(h, m, s);
  updateDurationDigitDisplay();
}

// Update duration display (now using unified input field)
function updateDurationDigitDisplay() {
  // Show/hide h0 (hundreds of hours) column based on current duration
  const h0Col = document.getElementById('h0Col');
  if (h0Col) {
    const { h } = parseTimeValue(els.duration.value);
    h0Col.style.display = h >= 100 ? '' : 'none';
  }
}

// Modal duration controls always show HH:MM:SS for consistent editing
// The Format dropdown only affects the output window display
function updateDurationControlsFormat() {
  // No-op: hours group always visible in modal
}

/**
 * Show/hide overtime setting based on mode (only for countdown modes)
 */
function updateOvertimeVisibility() {
  if (!els.allowOvertimeRow) return;
  const mode = els.mode?.value;
  const startMode = els.startMode?.value || 'manual';
  // Hide overtime for non-countdown modes AND for End By mode (always stops at target)
  const showOvertime = (mode === 'countdown' || mode === 'countdown-tod') && startMode !== 'endBy';
  els.allowOvertimeRow.style.display = showOvertime ? '' : 'none';
}

function updateStartModeVisibility() {
  const startMode = els.startMode?.value || 'manual';

  // Show target time row for endBy and startAt modes
  if (els.targetTimeRow) {
    els.targetTimeRow.classList.toggle('hidden', startMode === 'manual');
  }

  // Hide duration row for endBy mode (duration is calculated from target time)
  if (els.durationRow) {
    els.durationRow.style.display = startMode === 'endBy' ? 'none' : '';
  }

  // Also update overtime visibility (hidden for endBy)
  updateOvertimeVisibility();
}

function getDefaultDurationSeconds() {
  const { h, m, s } = parseTimeValue(els.defaultDuration.value);
  return h * 3600 + m * 60 + s;
}

function setDefaultDurationInputs(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  els.defaultDuration.value = formatTimeValue(h, m, s);
}

// Helper functions for MM:SS time input (warning thresholds)
function formatMSValue(m, s) {
  const pad = n => String(Math.max(0, n)).padStart(2, '0');
  const mm = Math.min(99, Math.max(0, m));
  const ss = Math.min(59, Math.max(0, s));
  return `${pad(mm)}:${pad(ss)}`;
}

function parseMSValue(val) {
  const parts = (val || '00:00').split(':');
  const m = parseInt(parts[0], 10) || 0;
  const s = parseInt(parts[1], 10) || 0;
  return { m, s };
}

function getMSSeconds(input) {
  const { m, s } = parseMSValue(input.value);
  return m * 60 + s;
}

function setMSInput(input, totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  input.value = formatMSValue(m, s);
}

/**
 * Get selected alignment from toggle buttons or saved settings
 */
function getSelectedAlign() {
  // Try to get from toggle buttons first
  if (els.alignToggle) {
    const activeBtn = els.alignToggle.querySelector('.align-toggle-btn.active');
    if (activeBtn?.dataset.align) {
      return activeBtn.dataset.align;
    }
  }
  // Fall back to saved settings
  const settings = loadAppSettings();
  return settings.defaults?.align || 'center';
}

/**
 * Initialize a MM:SS time input with section-based navigation
 * Sections: MM (0-1), SS (3-4), colon at 2
 */
function initTimeInputMS(input) {
  if (!input) return;

  // Get section from cursor position
  const getSection = (pos) => {
    if (pos <= 2) return 'minutes';
    return 'seconds';
  };

  // Get section digit boundaries
  const getSectionRange = (section) => {
    switch (section) {
      case 'minutes': return [0, 2];
      case 'seconds': return [3, 5];
    }
  };

  // Handle click - adjust cursor if on colon
  input.addEventListener('click', () => {
    setTimeout(() => {
      const pos = input.selectionStart;
      if (pos === 2) {
        input.setSelectionRange(pos + 1, pos + 1);
      }
    }, 0);
  });

  // Handle keyboard navigation and input
  input.addEventListener('keydown', (e) => {
    const pos = input.selectionStart;
    const selEnd = input.selectionEnd;
    const section = getSection(pos);
    const [start, end] = getSectionRange(section);
    const val = input.value;

    // Arrow keys
    if (e.key === 'ArrowLeft') {
      if (pos <= start) {
        if (section === 'seconds') {
          e.preventDefault();
          input.setSelectionRange(2, 2); // Jump to end of minutes
        } else {
          e.preventDefault(); // Wall at minutes
        }
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      if (pos >= end) {
        if (section === 'minutes') {
          e.preventDefault();
          input.setSelectionRange(3, 3); // Jump to start of seconds
        } else {
          e.preventDefault(); // Wall at seconds
        }
      }
      return;
    }

    // Tab - allow natural behavior
    if (e.key === 'Tab') return;

    // Cmd/Ctrl+A - select current section only
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      input.setSelectionRange(start, end);
      return;
    }

    // Backspace - replace current digit with 0
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (pos > start) {
        const newPos = pos - 1;
        const chars = val.split('');
        chars[newPos] = '0';
        input.value = chars.join('');
        input.setSelectionRange(newPos, newPos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // Delete - replace current digit with 0
    if (e.key === 'Delete') {
      e.preventDefault();
      if (pos < end) {
        const chars = val.split('');
        chars[pos] = '0';
        input.value = chars.join('');
        input.setSelectionRange(pos, pos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // Digit input
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();

      // If selection spans multiple chars, replace the section
      if (selEnd > pos) {
        const chars = val.split('');
        for (let i = start; i < end; i++) {
          chars[i] = '0';
        }
        chars[start] = e.key;
        input.value = chars.join('');
        input.setSelectionRange(start + 1, start + 1);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      // Insert digit at current position
      if (pos < end) {
        const chars = val.split('');
        chars[pos] = e.key;

        // Validate and reformat
        const newVal = chars.join('');
        const { m, s } = parseMSValue(newVal);
        input.value = formatMSValue(m, s);

        // Move cursor
        let newPos = pos + 1;
        if (newPos === 2) newPos++; // Skip colon
        if (newPos > 4) newPos = 4;
        input.setSelectionRange(newPos, newPos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // Block all other printable characters
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
    }
  });

  // Handle double-click - select current section only
  input.addEventListener('dblclick', (e) => {
    e.preventDefault();
    const pos = input.selectionStart;
    const section = getSection(pos);
    const [start, end] = getSectionRange(section);
    input.setSelectionRange(start, end);
  });

  // Prevent invalid paste, try to parse time from paste
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const match = text.match(/(\d{1,2}):(\d{1,2})/);
    if (match) {
      const m = parseInt(match[1], 10);
      const s = parseInt(match[2], 10);
      input.value = formatMSValue(m, s);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Ensure value is always valid format on blur
  input.addEventListener('blur', () => {
    const { m, s } = parseMSValue(input.value);
    input.value = formatMSValue(m, s);
  });
}

/**
 * Initialize a unified time input with section-based navigation
 * Sections: HH (0-1), MM (3-4), SS (6-7), colons at 2 and 5
 */
function initTimeInput(input) {
  if (!input) return;

  // Get section from cursor position
  const getSection = (pos) => {
    if (pos <= 2) return 'hours';
    if (pos <= 5) return 'minutes';
    return 'seconds';
  };

  // Get section digit boundaries (start inclusive, end exclusive for selection)
  const getSectionRange = (section) => {
    switch (section) {
      case 'hours': return [0, 2];
      case 'minutes': return [3, 5];
      case 'seconds': return [6, 8];
    }
  };

  // Ensure cursor doesn't land on colons
  const adjustCursor = (pos) => {
    if (pos === 2) return 1; // Before first colon, go to end of hours
    if (pos === 5) return 4; // Before second colon, go to end of minutes
    return pos;
  };

  // Handle click - adjust cursor if on colon
  input.addEventListener('click', () => {
    setTimeout(() => {
      const pos = input.selectionStart;
      if (pos === 2 || pos === 5) {
        input.setSelectionRange(pos + 1, pos + 1);
      }
    }, 0);
  });

  // Handle keyboard navigation and input
  input.addEventListener('keydown', (e) => {
    const pos = input.selectionStart;
    const selEnd = input.selectionEnd;
    const section = getSection(pos);
    const [start, end] = getSectionRange(section);
    const val = input.value;

    // Arrow keys
    if (e.key === 'ArrowLeft') {
      if (pos <= start) {
        // At left edge of section
        if (section === 'minutes') {
          e.preventDefault();
          input.setSelectionRange(2, 2); // Jump to end of hours
        } else if (section === 'seconds') {
          e.preventDefault();
          input.setSelectionRange(5, 5); // Jump to end of minutes
        } else {
          // hours section: wall
          e.preventDefault();
        }
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      if (pos >= end) {
        // At right edge of section
        if (section === 'hours') {
          e.preventDefault();
          input.setSelectionRange(3, 3); // Jump to start of minutes
        } else if (section === 'minutes') {
          e.preventDefault();
          input.setSelectionRange(6, 6); // Jump to start of seconds
        } else {
          // seconds section: wall
          e.preventDefault();
        }
      }
      return;
    }

    // Tab - allow natural behavior
    if (e.key === 'Tab') return;

    // Cmd/Ctrl+A - select current section only
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      input.setSelectionRange(start, end);
      return;
    }

    // Backspace - replace current digit with 0
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (pos > start) {
        const newPos = pos - 1;
        const chars = val.split('');
        chars[newPos] = '0';
        input.value = chars.join('');
        input.setSelectionRange(newPos, newPos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // Delete - replace current digit with 0
    if (e.key === 'Delete') {
      e.preventDefault();
      if (pos < end) {
        const chars = val.split('');
        chars[pos] = '0';
        input.value = chars.join('');
        input.setSelectionRange(pos, pos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // Digit input
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();

      // If selection spans multiple chars, replace the section
      if (selEnd > pos) {
        const chars = val.split('');
        // Clear selected section and put digit at start
        for (let i = start; i < end; i++) {
          chars[i] = '0';
        }
        chars[start] = e.key;
        input.value = chars.join('');
        input.setSelectionRange(start + 1, start + 1);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      // Insert digit at current position
      if (pos < end) {
        const chars = val.split('');
        chars[pos] = e.key;

        // Validate the section value
        const newVal = chars.join('');
        const { h, m, s } = parseTimeValue(newVal);

        // Clamp values and reformat
        input.value = formatTimeValue(h, m, s);

        // Move cursor
        let newPos = pos + 1;
        if (newPos === 2 || newPos === 5) newPos++; // Skip colon
        if (newPos > 7) newPos = 7;
        input.setSelectionRange(newPos, newPos);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    // Block all other printable characters
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
    }
  });

  // Handle double-click - select current section only
  input.addEventListener('dblclick', (e) => {
    e.preventDefault();
    const pos = input.selectionStart;
    const section = getSection(pos);
    const [start, end] = getSectionRange(section);
    input.setSelectionRange(start, end);
  });

  // Smart paste - accepts many formats: "530", "5:30", "1:30:00", etc.
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const parsed = parseSmartDuration(text);
    if (parsed) {
      input.value = formatTimeValue(parsed.h, parsed.m, parsed.s);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Smart blur - accepts informal input and normalizes
  input.addEventListener('blur', () => {
    const parsed = parseSmartDuration(input.value);
    if (parsed) {
      input.value = formatTimeValue(parsed.h, parsed.m, parsed.s);
    } else {
      // Fallback to strict parsing
      const { h, m, s } = parseTimeValue(input.value);
      input.value = formatTimeValue(h, m, s);
    }
  });
}

// State
let isRunning = false;
let outputWindowReady = false;

/**
 * Set running state and report to main process (for quit confirmation)
 */
function setRunning(running) {
  isRunning = running;
  window.ninja.reportTimerRunning(running);
}
let editingPresetIndex = null; // Track which preset is being edited
let activePresetIndex = null; // Track which preset is currently playing
let settingsWindowOpen = false; // Track if settings window is open
let settingsWindowTimerIndex = null; // Track which timer is being edited in settings window

// Active timer config - stored separately so modal editing doesn't affect live preview
let activeTimerConfig = {
  mode: 'countdown',
  durationSec: 600,
  format: 'MM:SS',
  style: {
    color: '#ffffff',
    strokeWidth: 0,
    strokeColor: '#000000',
    shadowSize: 0,
    shadowColor: '#000000',
    bgColor: '#000000'
  }
};

// Timer state for live preview
const timerState = {
  startedAt: null,
  pausedAcc: 0,
  ended: false,
  overtime: false,
  overtimeStartedAt: null
};
let isBlackedOut = false;

// State sequence number for sync
let stateSeq = 0;

// Flash animator instance (shared between preview)
let flashAnimator = null;

// Flash state for synced broadcast
let flashState = { active: false, startedAt: null };

// Message state
let activeMessage = null; // { text, bold, italic, color, mode, sentAt, duration }
let messageTimerId = null;
// Legacy: messages used to be stored in 'ninja-messages-v1', now stored in profiles

// Profile state
let profiles = [];
let activeProfileId = null;

/**
 * Set the active timer config from a preset config
 * This is what the live preview and output display - separate from form fields
 */
function setActiveTimerConfig(config) {
  activeTimerConfig = {
    mode: config.mode || 'countdown',
    durationSec: config.durationSec || 600,
    format: config.format || 'MM:SS',
    allowOvertime: config.allowOvertime !== false,
    style: {
      fontFamily: config.style?.fontFamily || 'Inter',
      fontWeight: config.style?.fontWeight ?? 700,
      color: config.style?.color || '#ffffff',
      strokeWidth: config.style?.strokeWidth ?? 0,
      strokeColor: config.style?.strokeColor || '#000000',
      shadowSize: config.style?.shadowSize ?? 0,
      shadowColor: config.style?.shadowColor || '#000000',
      bgColor: config.style?.bgColor || '#000000'
    },
    sound: {
      endType: config.sound?.endType || 'none',
      volume: config.sound?.volume ?? 0.7
    },
    warnYellowSec: config.warnYellowSec ?? 60,
    warnOrangeSec: config.warnOrangeSec ?? 15
  };
}

// Undo/Redo stacks for reverting changes
const undoStack = [];
const redoStack = [];
const MAX_UNDO_STATES = 20;

/**
 * Save current state to undo stack
 * @param {boolean} includeProfiles - If true, saves full profiles state (for profile deletion)
 */
function saveUndoState(includeProfiles = false) {
  const state = {
    presets: JSON.parse(JSON.stringify(loadPresets())),
    messages: JSON.parse(JSON.stringify(loadMessages())),
    activePresetIndex: activePresetIndex
  };

  // For profile-level operations, save full profiles state
  if (includeProfiles) {
    state.profiles = JSON.parse(JSON.stringify(profiles));
    state.activeProfileId = activeProfileId;
    state.isProfileUndo = true;
  }

  undoStack.push(state);

  // Clear redo stack when new action is performed
  redoStack.length = 0;

  // Limit stack size
  if (undoStack.length > MAX_UNDO_STATES) {
    undoStack.shift();
  }
}

/**
 * Undo last change - restore previous state
 */
function undo() {
  if (undoStack.length === 0) {
    showToast('Nothing to undo', 'info');
    return false;
  }

  // Save current state to redo stack before restoring
  const currentState = {
    presets: JSON.parse(JSON.stringify(loadPresets())),
    messages: JSON.parse(JSON.stringify(loadMessages())),
    activePresetIndex: activePresetIndex
  };

  const previousState = undoStack.pop();

  // Handle profile-level undo (e.g., profile deletion)
  if (previousState.isProfileUndo) {
    currentState.profiles = JSON.parse(JSON.stringify(profiles));
    currentState.activeProfileId = activeProfileId;
    currentState.isProfileUndo = true;
    redoStack.push(currentState);

    profiles = previousState.profiles;
    activeProfileId = previousState.activeProfileId;
    saveProfiles();
    updateProfileButton();
    activePresetIndex = previousState.activePresetIndex;
    renderPresetList();
    renderMessageList();
    showToast('Profile restored', 'success');
    return true;
  }

  redoStack.push(currentState);

  // Restore presets
  savePresets(previousState.presets);
  activePresetIndex = previousState.activePresetIndex;

  // Restore messages
  if (previousState.messages) {
    saveMessagesToStorage(previousState.messages);
    renderMessageList();
  }

  // If we have an active preset, apply its config
  if (activePresetIndex !== null && previousState.presets[activePresetIndex]) {
    const config = previousState.presets[activePresetIndex].config;
    setActiveTimerConfig(config);
    applyConfig(config);
  }

  renderPresetList();
  showToast('Undone (Shift+Z to redo)', 'success');
  return true;
}

/**
 * Redo last undone change
 */
function redo() {
  if (redoStack.length === 0) {
    showToast('Nothing to redo', 'info');
    return false;
  }

  // Save current state to undo stack before redoing
  const currentState = {
    presets: JSON.parse(JSON.stringify(loadPresets())),
    messages: JSON.parse(JSON.stringify(loadMessages())),
    activePresetIndex: activePresetIndex
  };

  const redoState = redoStack.pop();

  // Handle profile-level redo
  if (redoState.isProfileUndo) {
    currentState.profiles = JSON.parse(JSON.stringify(profiles));
    currentState.activeProfileId = activeProfileId;
    currentState.isProfileUndo = true;
    undoStack.push(currentState);

    profiles = redoState.profiles;
    activeProfileId = redoState.activeProfileId;
    saveProfiles();
    updateProfileButton();
    activePresetIndex = redoState.activePresetIndex;
    renderPresetList();
    renderMessageList();
    showToast('Redone', 'success');
    return true;
  }

  undoStack.push(currentState);

  // Restore presets
  savePresets(redoState.presets);
  activePresetIndex = redoState.activePresetIndex;

  // Restore messages
  if (redoState.messages) {
    saveMessagesToStorage(redoState.messages);
    renderMessageList();
  }

  // If we have an active preset, apply its config
  if (activePresetIndex !== null && redoState.presets[activePresetIndex]) {
    const config = redoState.presets[activePresetIndex].config;
    setActiveTimerConfig(config);
    applyConfig(config);
  }

  renderPresetList();
  showToast('Redone', 'success');
  return true;
}

// Drag state for timer reordering (mouse-based drag system)
const dragState = {
  isDragging: false,
  dragActivated: false,  // True only after mouse moves 5px+
  fromIndex: null,
  currentSlot: null,     // Current visual slot position (for transforms)
  draggedRow: null,
  ghostEl: null,
  placeholderEl: null,
  grabOffsetX: 0,
  grabOffsetY: 0,
  startX: 0,
  startY: 0,
  originalHeight: 0,
  originalWidth: 0,
  // Transform-based drag fields
  visibleItems: [],      // All timer elements (excluding placeholder)
  linkZones: [],         // All link zone elements
  timerLinkZoneMap: null, // Maps each timer element → its link zone (above it)
  draggedLinkZone: null, // Link zone being dragged with timer (if any)
  hasLink: false,        // Whether dragged timer has a link to timer above
  slotHeight: 0,         // Height of timer + link zone for transforms
  originalBaseY: 0,      // Original Y position of first slot (before any transforms)
  autoScrollInterval: null // Interval for auto-scrolling during drag
};

// Message drag state (simpler than timers - no link zones)
const messageDragState = {
  isDragging: false,
  dragActivated: false,
  fromIndex: null,
  currentSlot: null,
  draggedRow: null,
  ghostEl: null,
  placeholderEl: null,
  grabOffsetX: 0,
  grabOffsetY: 0,
  startX: 0,
  startY: 0,
  originalHeight: 0,
  originalWidth: 0,
  visibleItems: [],
  slotHeight: 0,
  originalBaseY: 0,
  autoScrollInterval: null // Interval for auto-scrolling during drag
};

// Auto-scroll configuration
const AUTO_SCROLL_ZONE = 50; // Pixels from edge to trigger scroll
const AUTO_SCROLL_SPEED = 8; // Pixels per frame

/**
 * Handle auto-scroll during drag operations
 * @param {number} clientY - Mouse Y position
 * @param {HTMLElement} container - Scrollable container
 * @param {Object} state - Drag state object (dragState or messageDragState)
 */
function handleDragAutoScroll(clientY, container, state) {
  const rect = container.getBoundingClientRect();
  const topZone = rect.top + AUTO_SCROLL_ZONE;
  const bottomZone = rect.bottom - AUTO_SCROLL_ZONE;

  // Clear existing interval
  if (state.autoScrollInterval) {
    clearInterval(state.autoScrollInterval);
    state.autoScrollInterval = null;
  }

  // Check if in scroll zones
  if (clientY < topZone && container.scrollTop > 0) {
    // Scroll up
    state.autoScrollInterval = setInterval(() => {
      container.scrollTop -= AUTO_SCROLL_SPEED;
      if (container.scrollTop <= 0) {
        clearInterval(state.autoScrollInterval);
        state.autoScrollInterval = null;
      }
    }, 16);
  } else if (clientY > bottomZone && container.scrollTop < container.scrollHeight - container.clientHeight) {
    // Scroll down
    state.autoScrollInterval = setInterval(() => {
      container.scrollTop += AUTO_SCROLL_SPEED;
      if (container.scrollTop >= container.scrollHeight - container.clientHeight) {
        clearInterval(state.autoScrollInterval);
        state.autoScrollInterval = null;
      }
    }, 16);
  }
}

// SVG Icons
const ICONS = {
  flash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  drag: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="5" width="16" height="2" rx="1"/><rect x="4" y="11" width="16" height="2" rx="1"/><rect x="4" y="17" width="16" height="2" rx="1"/></svg>',
  reset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  more: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  clone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  delete: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  add: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  pencil: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>'
};

// ============ Toast Notifications (disabled) ============

function showToast(message, type = 'info') {
  // Notifications disabled per user request
  return;
}

// ============ App Settings ============

const APP_SETTINGS_KEY = 'ninja:appSettings';

// Global timezone options
const TIMEZONES = [
  { value: 'auto', label: 'Auto (System)' },
  // Americas (West to East)
  { value: 'Pacific/Honolulu', label: '(GMT-10) Hawaii' },
  { value: 'America/Anchorage', label: '(GMT-9) Alaska' },
  { value: 'America/Los_Angeles', label: '(GMT-8) Los Angeles' },
  { value: 'America/Denver', label: '(GMT-7) Denver' },
  { value: 'America/Chicago', label: '(GMT-6) Chicago' },
  { value: 'America/New_York', label: '(GMT-5) New York' },
  { value: 'America/Sao_Paulo', label: '(GMT-3) São Paulo' },
  // Europe & Africa
  { value: 'Atlantic/Reykjavik', label: '(GMT+0) Reykjavik' },
  { value: 'Europe/London', label: '(GMT+0) London' },
  { value: 'Europe/Paris', label: '(GMT+1) Paris' },
  { value: 'Europe/Berlin', label: '(GMT+1) Berlin' },
  { value: 'Africa/Cairo', label: '(GMT+2) Cairo' },
  { value: 'Africa/Johannesburg', label: '(GMT+2) Johannesburg' },
  { value: 'Europe/Moscow', label: '(GMT+3) Moscow' },
  // Middle East & Asia
  { value: 'Asia/Dubai', label: '(GMT+4) Dubai' },
  { value: 'Asia/Kolkata', label: '(GMT+5:30) India' },
  { value: 'Asia/Bangkok', label: '(GMT+7) Bangkok' },
  { value: 'Asia/Singapore', label: '(GMT+8) Singapore' },
  { value: 'Asia/Hong_Kong', label: '(GMT+8) Hong Kong' },
  { value: 'Asia/Shanghai', label: '(GMT+8) Shanghai' },
  { value: 'Asia/Tokyo', label: '(GMT+9) Tokyo' },
  { value: 'Asia/Seoul', label: '(GMT+9) Seoul' },
  // Australia & Pacific
  { value: 'Australia/Perth', label: '(GMT+8) Perth' },
  { value: 'Australia/Sydney', label: '(GMT+10) Sydney' },
  { value: 'Pacific/Auckland', label: '(GMT+12) Auckland' },
];

const DEFAULT_APP_SETTINGS = {
  todFormat: '12h',
  timezone: 'auto',
  appearance: 'auto',  // 'auto' | 'light' | 'dark'
  confirmDelete: true,
  outputOnTop: false,
  controlOnTop: false,
  timerZoom: 100,
  defaults: {
    mode: 'countdown',
    durationSec: 600,
    format: 'MM:SS',
    soundType: 'none',
    soundVolume: 0.7,
    allowOvertime: true,
    // Appearance defaults
    fontFamily: 'Inter',
    fontWeight: 700,
    color: '#ffffff',
    strokeWidth: 0,
    strokeColor: '#000000',
    shadowSize: 0,
    shadowColor: '#000000',
    bgColor: '#000000',
    // Alignment
    align: 'center',
    // Warning defaults
    warnYellowSec: 60,
    warnOrangeSec: 15
  },
  // OSC Integration
  osc: {
    enabled: false,
    listenPort: 8000,
    feedbackEnabled: false,
    feedbackHost: '127.0.0.1',
    feedbackPort: 9000
  }
};

function loadAppSettings() {
  try {
    const saved = localStorage.getItem(APP_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_APP_SETTINGS,
        ...parsed,
        defaults: { ...DEFAULT_APP_SETTINGS.defaults, ...parsed.defaults },
        osc: { ...DEFAULT_APP_SETTINGS.osc, ...(parsed.osc || {}) }
      };
    }
  } catch (e) {
    console.error('Failed to load app settings:', e);
  }
  return DEFAULT_APP_SETTINGS;
}

function saveAppSettings(settings) {
  try {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save app settings:', e);
  }
}

// ============ Theme Management ============

// Theme background colors (must match CSS variables)
const THEME_BACKGROUNDS = {
  light: '#faf9f6',  // Warm cream
  dark: '#0a0a0a'    // Near black
};

function applyTheme(appearance) {
  let theme = appearance;
  if (appearance === 'auto') {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    theme = prefersLight ? 'light' : 'dark'; // Default to dark if no preference
  }
  document.documentElement.setAttribute('data-theme', theme);

  // Update window background color for smooth resizing
  const bgColor = THEME_BACKGROUNDS[theme] || THEME_BACKGROUNDS.dark;
  window.ninja.setBackgroundColor('control', bgColor);
}

// Listen for system theme changes (for auto mode)
const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const themeChangeHandler = () => {
  const settings = loadAppSettings();
  if (settings.appearance === 'auto') {
    applyTheme('auto');
  }
};
themeMediaQuery.addEventListener('change', themeChangeHandler);

// Store update check result (whether update available or up to date)
let updateResult = null;

async function checkForUpdates(silent = false) {
  const statusEl = document.getElementById('updateStatus');
  const checkBtn = document.getElementById('checkUpdates');
  const downloadBtn = document.getElementById('downloadUpdates');
  const restartBtn = document.getElementById('restartApp');

  if (!statusEl) return null;

  if (!silent) {
    statusEl.textContent = 'Checking...';
    statusEl.className = '';
    downloadBtn?.classList.add('hidden');
    restartBtn?.classList.add('hidden');
  }

  try {
    const result = await window.ninja.checkForUpdates();

    if (result.error) {
      if (!silent) {
        statusEl.textContent = result.error;
        statusEl.className = 'update-error';
      }
      return null;
    }
    // Store result regardless of update status
    updateResult = result;

    if (result.updateAvailable) {
      if (!silent) {
        if (result.downloadUrl) {
          statusEl.innerHTML = `Update available! <span class="version-info">(${result.localSha} → ${result.remoteSha})</span>`;
        } else {
          statusEl.innerHTML = `Update available! <span class="version-info">(${result.localSha} → ${result.remoteSha})</span><br><span class="no-release">No release found - visit GitHub to download</span>`;
        }
        statusEl.className = 'update-available';
        checkBtn?.classList.add('hidden');

        if (result.downloadUrl) {
          downloadBtn?.classList.remove('hidden');
        }
      }
    } else {
      if (!silent) {
        statusEl.innerHTML = `<span class="update-check">✓</span> You're up to date! <span class="version-info">(${result.localSha})</span>`;
        statusEl.className = 'update-success';
        checkBtn?.classList.add('hidden');
      }
    }
    return result;
  } catch (e) {
    console.error('Failed to check for updates:', e);
    if (!silent) {
      statusEl.textContent = 'Failed to check for updates';
      statusEl.className = 'update-error';
    }
    return null;
  }
}

// Show update status in the settings modal
function showUpdateStatus(result) {
  if (!result) return;

  const statusEl = document.getElementById('updateStatus');
  const downloadBtn = document.getElementById('downloadUpdates');
  const refreshBtn = document.getElementById('refreshUpdates');
  const settingsBtn = els.appSettingsBtn;

  if (!statusEl) return;

  if (result.updateAvailable) {
    // Show update available status
    if (result.downloadUrl) {
      statusEl.innerHTML = `Update available! <span class="version-info">(${result.localSha} → ${result.remoteSha})</span>`;
      downloadBtn?.classList.remove('hidden');
    } else {
      statusEl.innerHTML = `Update available! <span class="version-info">(${result.localSha} → ${result.remoteSha})</span><br><span class="no-release">No release found - visit GitHub to download</span>`;
    }
    statusEl.className = 'update-available';

    // Add badge to settings button
    if (settingsBtn && !settingsBtn.querySelector('.update-badge')) {
      const badge = document.createElement('span');
      badge.className = 'update-badge';
      settingsBtn.appendChild(badge);
    }

    // Add badge to Updates section title
    const updatesSectionTitle = document.getElementById('updatesSectionTitle');
    if (updatesSectionTitle && !updatesSectionTitle.querySelector('.update-badge')) {
      updatesSectionTitle.style.position = 'relative';
      updatesSectionTitle.style.display = 'inline-flex';
      updatesSectionTitle.style.alignItems = 'center';
      updatesSectionTitle.style.gap = '8px';

      const badge = document.createElement('span');
      badge.className = 'update-badge section-badge';
      updatesSectionTitle.appendChild(badge);
    }
  } else {
    // Show up to date status
    statusEl.innerHTML = `<span class="update-check">✓</span> You're up to date! <span class="version-info">(${result.localSha})</span>`;
    statusEl.className = 'update-success';
    downloadBtn?.classList.add('hidden');
  }
}

// Legacy alias for backward compatibility
function showUpdateBadge(result) {
  showUpdateStatus(result);
}

// Auto-check for updates on startup (silent)
async function checkForUpdatesOnStartup() {
  // Delay to not slow down initial load
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const result = await checkForUpdates(true);
    if (result?.updateAvailable) {
      showUpdateBadge(result);
    }
  } catch (e) {
    // Silent fail on startup check
  }
}

async function downloadUpdates() {
  const statusEl = document.getElementById('updateStatus');
  const downloadBtn = document.getElementById('downloadUpdates');
  const restartBtn = document.getElementById('restartApp');
  const progressContainer = document.getElementById('downloadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const progressTime = document.getElementById('progressTime');

  statusEl.textContent = '';
  statusEl.className = '';
  downloadBtn.classList.add('hidden');
  progressContainer.classList.remove('hidden');

  // Progress animation
  let progress = 0;
  const startTime = Date.now();
  const estimatedDuration = 5000; // Estimate 5 seconds for typical download

  const updateProgress = (percent) => {
    progress = Math.min(percent, 99);
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;

    // Calculate time remaining
    const elapsed = Date.now() - startTime;
    if (progress > 5) {
      const estimatedTotal = elapsed / (progress / 100);
      const remaining = Math.max(0, estimatedTotal - elapsed);
      const remainingSec = Math.ceil(remaining / 1000);
      if (remainingSec > 0) {
        progressTime.textContent = `${remainingSec}s left`;
      } else {
        progressTime.textContent = 'Almost done...';
      }
    }
  };

  // Animate progress while downloading
  const progressInterval = setInterval(() => {
    // Slowly animate up to 90% during download
    if (progress < 90) {
      const elapsed = Date.now() - startTime;
      const targetProgress = Math.min(90, (elapsed / estimatedDuration) * 90);
      updateProgress(targetProgress);
    }
  }, 100);

  try {
    const result = await window.ninja.downloadUpdates(updateResult?.downloadUrl);
    clearInterval(progressInterval);

    if (result.success) {
      // Complete the progress bar with celebration
      const progressBar = document.querySelector('.progress-bar');
      progressFill.style.width = '100%';
      progressText.textContent = '100%';
      progressBar.classList.add('complete');
      progressTime.textContent = 'Complete!';
      progressTime.classList.add('complete');

      // Longer delay to enjoy the completion animation
      setTimeout(() => {
        progressContainer.classList.add('hidden');
        progressBar.classList.remove('complete');
        progressTime.classList.remove('complete');
        statusEl.innerHTML = `<span class="update-check">✓</span> Downloaded! Drag to Applications to install.`;
        statusEl.className = 'update-success';
        // Don't show restart button - user needs to install manually
      }, 1200);
    } else {
      progressContainer.classList.add('hidden');
      statusEl.textContent = result.error || 'Download failed';
      statusEl.className = 'update-error';
      downloadBtn.classList.remove('hidden');
      downloadBtn.disabled = false;
    }
  } catch (e) {
    clearInterval(progressInterval);
    console.error('Failed to download updates:', e);
    progressContainer.classList.add('hidden');
    statusEl.textContent = 'Download failed';
    statusEl.className = 'update-error';
    downloadBtn.classList.remove('hidden');
    downloadBtn.disabled = false;
  }
}

function restartApp() {
  window.ninja.restartApp();
}

function openAppSettings() {
  const settings = loadAppSettings();

  // Populate form fields
  els.todFormat.value = settings.todFormat;

  // Populate timezone dropdown
  if (els.timezone) {
    els.timezone.innerHTML = '';
    TIMEZONES.forEach(tz => {
      const option = document.createElement('option');
      option.value = tz.value;
      option.textContent = tz.label;
      els.timezone.appendChild(option);
    });
    els.timezone.value = settings.timezone || 'auto';
  }

  // Appearance setting
  if (els.appearance) {
    els.appearance.value = settings.appearance || 'auto';
  }

  els.confirmDelete.value = settings.confirmDelete ? 'on' : 'off';
  els.defaultMode.value = settings.defaults.mode;
  setDefaultDurationInputs(settings.defaults.durationSec);
  els.defaultFormat.value = settings.defaults.format;
  // Support both old format (soundEnabled: boolean) and new format (soundType: string)
  if (typeof settings.defaults.soundType === 'string') {
    els.defaultSound.value = settings.defaults.soundType;
  } else if (settings.defaults.soundEnabled === true) {
    els.defaultSound.value = 'chime'; // Migrate old 'on' to 'chime'
  } else {
    els.defaultSound.value = 'none';
  }

  // Load allow overtime setting (default to true for backwards compatibility)
  if (els.defaultAllowOvertime) {
    els.defaultAllowOvertime.checked = settings.defaults.allowOvertime !== false;
  }

  // Load sound volume
  if (els.defaultSoundVolume) {
    els.defaultSoundVolume.value = settings.defaults.soundVolume ?? 0.7;
  }

  // Load appearance defaults
  if (els.defaultColor) {
    els.defaultColor.value = settings.defaults.color || '#ffffff';
  }
  if (els.defaultStrokeWidth) {
    els.defaultStrokeWidth.value = settings.defaults.strokeWidth ?? 0;
  }
  if (els.defaultStrokeColor) {
    els.defaultStrokeColor.value = settings.defaults.strokeColor || '#000000';
  }
  if (els.defaultShadowSize) {
    els.defaultShadowSize.value = settings.defaults.shadowSize ?? 0;
  }
  if (els.defaultShadowColor) {
    els.defaultShadowColor.value = settings.defaults.shadowColor || '#000000';
  }
  if (els.defaultBgColor) {
    els.defaultBgColor.value = settings.defaults.bgColor || '#000000';
  }

  // Load font defaults
  if (els.defaultFontFamily) {
    els.defaultFontFamily.value = settings.defaults.fontFamily || 'Inter';
  }
  if (els.defaultFontWeight) {
    els.defaultFontWeight.value = settings.defaults.fontWeight ?? 700;
  }

  // Load custom sounds list
  loadCustomSoundsList();

  // Load warning defaults (convert seconds to MM:SS)
  if (els.defaultWarnYellow) {
    setMSInput(els.defaultWarnYellow, settings.defaults.warnYellowSec ?? 60);
  }
  if (els.defaultWarnOrange) {
    setMSInput(els.defaultWarnOrange, settings.defaults.warnOrangeSec ?? 15);
  }

  // Load timer zoom setting
  if (els.timerZoom) {
    els.timerZoom.value = settings.timerZoom ?? 100;
  }

  // Load alignment setting
  if (els.alignToggle) {
    const currentAlign = settings.defaults?.align || 'center';
    els.alignToggle.querySelectorAll('.align-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.align === currentAlign);
    });
  }

  // Load window stay on top settings from saved settings
  els.outputOnTop.checked = settings.outputOnTop || false;
  els.controlOnTop.checked = settings.controlOnTop || false;

  // Load OSC settings
  const osc = settings.osc || {};
  els.oscEnabled.checked = osc.enabled || false;
  els.oscListenPort.value = osc.listenPort || 8000;
  els.oscFeedbackEnabled.checked = osc.feedbackEnabled || false;
  els.oscFeedbackHost.value = osc.feedbackHost || '127.0.0.1';
  els.oscFeedbackPort.value = osc.feedbackPort || 9000;
  updateOSCVisibility();

  els.appSettingsModal.classList.remove('hidden');

  // Reset progress bar state
  document.getElementById('downloadProgress').classList.add('hidden');
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressText').textContent = '0%';
  document.getElementById('progressTime').textContent = '';
  document.getElementById('progressTime').classList.remove('complete');
  document.querySelector('.progress-bar').classList.remove('complete');
  document.getElementById('restartApp')?.classList.add('hidden');

  // Show update status automatically
  const statusEl = document.getElementById('updateStatus');
  const downloadBtn = document.getElementById('downloadUpdates');

  if (updateResult) {
    // We have a result - show it
    showUpdateStatus(updateResult);
  } else {
    // No result yet - show checking and trigger check
    statusEl.textContent = 'Checking for updates...';
    statusEl.className = '';
    downloadBtn?.classList.add('hidden');
    checkForUpdates(false);
  }
}

function closeAppSettings() {
  els.appSettingsModal.classList.add('hidden');
}

function saveAppSettingsFromForm() {
  const outputOnTop = els.outputOnTop.checked;
  const controlOnTop = els.controlOnTop.checked;

  // Build OSC settings from form
  const oscSettings = {
    enabled: els.oscEnabled.checked,
    listenPort: parseInt(els.oscListenPort.value, 10) || 8000,
    feedbackEnabled: els.oscFeedbackEnabled.checked,
    feedbackHost: els.oscFeedbackHost.value || '127.0.0.1',
    feedbackPort: parseInt(els.oscFeedbackPort.value, 10) || 9000
  };

  const appearance = els.appearance?.value || 'auto';

  const settings = {
    todFormat: els.todFormat.value,
    timezone: els.timezone?.value || 'auto',
    appearance: appearance,
    confirmDelete: els.confirmDelete.value === 'on',
    outputOnTop: outputOnTop,
    controlOnTop: controlOnTop,
    timerZoom: parseInt(els.timerZoom?.value, 10) || 100,
    defaults: {
      mode: els.defaultMode.value,
      durationSec: getDefaultDurationSeconds(),
      format: els.defaultFormat.value,
      soundType: els.defaultSound.value || 'none',
      soundVolume: parseFloat(els.defaultSoundVolume?.value) || 0.7,
      allowOvertime: els.defaultAllowOvertime?.checked ?? true,
      // Appearance defaults
      fontFamily: els.defaultFontFamily?.value || 'Inter',
      fontWeight: parseInt(els.defaultFontWeight?.value, 10) || 700,
      color: els.defaultColor?.value || '#ffffff',
      strokeWidth: parseInt(els.defaultStrokeWidth?.value, 10) || 0,
      strokeColor: els.defaultStrokeColor?.value || '#000000',
      shadowSize: parseInt(els.defaultShadowSize?.value, 10) || 0,
      shadowColor: els.defaultShadowColor?.value || '#000000',
      bgColor: els.defaultBgColor?.value || '#000000',
      // Alignment
      align: getSelectedAlign(),
      // Warning defaults
      warnYellowSec: getMSSeconds(els.defaultWarnYellow) || 60,
      warnOrangeSec: getMSSeconds(els.defaultWarnOrange) || 15
    },
    osc: oscSettings
  };

  // Apply window stay on top settings to main process
  window.ninja.setAlwaysOnTop('output', outputOnTop);
  window.ninja.setAlwaysOnTop('control', controlOnTop);

  // Apply OSC settings to main process
  window.ninja.oscSetSettings(oscSettings).then(() => {
    updateOSCStatus();
  });

  saveAppSettings(settings);

  // Apply theme immediately
  applyTheme(appearance);

  // Apply zoom to preview immediately
  fitPreviewTimer();

  closeAppSettings();
}

// ============ Font Picker ============

/**
 * Render the Apple-style font picker in the timer modal
 */
function renderFontPicker() {
  if (!els.fontPicker) return;

  const currentFont = els.fontFamily?.value || 'Inter';

  els.fontPicker.innerHTML = BUILT_IN_FONTS.map(font => `
    <div class="font-option${font.family === currentFont ? ' selected' : ''}" data-font="${font.family}">
      <div class="font-option-preview" style="font-family: '${font.family}', sans-serif; font-weight: ${font.weights[font.weights.length - 1]};">12</div>
      <div class="font-option-name">${font.family}</div>
      <div class="font-option-desc">${font.description}</div>
    </div>
  `).join('');

  // Add click handlers
  els.fontPicker.querySelectorAll('.font-option').forEach(option => {
    option.addEventListener('click', () => {
      const fontFamily = option.dataset.font;
      selectFont(fontFamily);
    });
  });
}

/**
 * Select a font in the font picker
 */
function selectFont(fontFamily) {
  if (!els.fontPicker || !els.fontFamily) return;

  // Update hidden input
  els.fontFamily.value = fontFamily;

  // Update visual selection
  els.fontPicker.querySelectorAll('.font-option').forEach(option => {
    option.classList.toggle('selected', option.dataset.font === fontFamily);
  });

  // Update available weights
  updateFontWeightOptions(fontFamily);

  // Scroll selected option into view
  const selectedOption = els.fontPicker.querySelector('.font-option.selected');
  if (selectedOption) {
    selectedOption.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Update modal preview
  updateModalPreview();
}

/**
 * Update font weight dropdown options based on selected font family
 */
function updateFontWeightOptions(fontFamily) {
  if (!els.fontWeight) return;

  const currentWeight = parseInt(els.fontWeight.value, 10) || 700;
  const weights = getAvailableWeights(fontFamily);

  // Clear and repopulate
  els.fontWeight.innerHTML = '';
  weights.forEach(weight => {
    const option = document.createElement('option');
    option.value = weight;
    option.textContent = WEIGHT_LABELS[weight] || `Weight ${weight}`;
    els.fontWeight.appendChild(option);
  });

  // Restore value if still valid, otherwise pick closest
  if (weights.includes(currentWeight)) {
    els.fontWeight.value = currentWeight;
  } else {
    // Find closest weight
    const closest = weights.reduce((prev, curr) =>
      Math.abs(curr - currentWeight) < Math.abs(prev - currentWeight) ? curr : prev
    );
    els.fontWeight.value = closest;
  }
}

// ============ Custom Sounds Management ============

// Cache for custom sounds list
let customSounds = [];

// Audio element for previewing custom sounds
let previewAudio = null;

/**
 * Load and display custom sounds list in App Settings
 */
async function loadCustomSoundsList() {
  try {
    customSounds = await window.ninja.soundsList();
    renderCustomSoundsList();
    updateSoundDropdowns();
  } catch (e) {
    console.error('Failed to load custom sounds:', e);
  }
}

/**
 * Render the custom sounds list UI
 */
function renderCustomSoundsList() {
  if (!els.customSoundsList) return;

  els.customSoundsList.innerHTML = '';

  customSounds.forEach(sound => {
    const item = document.createElement('div');
    item.className = 'custom-sound-item';

    // Build DOM safely to prevent XSS from user-provided sound names
    const info = document.createElement('div');
    info.className = 'custom-sound-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'custom-sound-name';
    nameSpan.textContent = sound.name; // Safe: uses textContent

    const metaSpan = document.createElement('span');
    metaSpan.className = 'custom-sound-meta';
    metaSpan.textContent = sound.fileName; // Safe: uses textContent

    info.appendChild(nameSpan);
    info.appendChild(metaSpan);

    const actions = document.createElement('div');
    actions.className = 'custom-sound-actions';

    const previewBtn = document.createElement('button');
    previewBtn.className = 'custom-sound-preview';
    previewBtn.dataset.soundId = sound.id;
    previewBtn.title = 'Preview sound';
    previewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'custom-sound-delete';
    deleteBtn.dataset.soundId = sound.id;
    deleteBtn.title = 'Delete sound';
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

    actions.appendChild(previewBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(info);
    item.appendChild(actions);
    els.customSoundsList.appendChild(item);
  });

  // Add click handlers for preview and delete buttons
  els.customSoundsList.querySelectorAll('.custom-sound-preview').forEach(btn => {
    btn.addEventListener('click', () => previewCustomSound(btn.dataset.soundId));
  });
  els.customSoundsList.querySelectorAll('.custom-sound-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteCustomSound(btn.dataset.soundId));
  });
}

/**
 * Update all sound dropdowns with custom sounds
 */
function updateSoundDropdowns() {
  const dropdowns = [els.soundEnd, els.defaultSound];

  dropdowns.forEach(dropdown => {
    if (!dropdown) return;

    // Get current value to restore after updating
    const currentValue = dropdown.value;

    // Remove existing custom sound options (keep built-in)
    const builtInValues = BUILT_IN_SOUNDS.map(s => s.value);
    Array.from(dropdown.options).forEach(opt => {
      if (!builtInValues.includes(opt.value)) {
        opt.remove();
      }
    });

    // Add custom sounds
    customSounds.forEach(sound => {
      const option = document.createElement('option');
      option.value = createCustomSoundType(sound.id);
      option.textContent = sound.name;
      dropdown.appendChild(option);
    });

    // Restore value if still valid
    if (Array.from(dropdown.options).some(opt => opt.value === currentValue)) {
      dropdown.value = currentValue;
    }
  });
}

/**
 * Handle adding a new custom sound
 */
async function handleAddCustomSound() {
  try {
    const result = await window.ninja.soundsSelectFile();
    if (!result) return; // User cancelled

    const { fileName, fileData } = result;

    // Extract name from filename
    const soundName = fileName.replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    // Upload the sound
    const sound = await window.ninja.soundsUpload({ fileName, fileData, soundName });
    if (!sound) {
      console.error('Failed to upload sound');
      return;
    }

    // Reload the sounds list
    await loadCustomSoundsList();
  } catch (e) {
    console.error('Failed to add custom sound:', e);
  }
}

/**
 * Handle deleting a custom sound
 */
async function deleteCustomSound(soundId) {
  try {
    const success = await window.ninja.soundsDelete(soundId);
    if (success) {
      await loadCustomSoundsList();
    }
  } catch (e) {
    console.error('Failed to delete custom sound:', e);
  }
}

/**
 * Preview a custom sound
 */
async function previewCustomSound(soundId) {
  try {
    // Stop any currently playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
    }

    const soundData = await window.ninja.soundsGetData(soundId);
    if (!soundData) return;

    const mimeType = getAudioMimeType(soundData.format);
    const dataUrl = `data:${mimeType};base64,${soundData.data}`;

    previewAudio = new Audio(dataUrl);
    previewAudio.volume = 0.7;
    previewAudio.play();
  } catch (e) {
    console.error('Failed to preview custom sound:', e);
  }
}

/**
 * Load all custom sounds on startup
 */
async function loadAllCustomSounds() {
  try {
    customSounds = await window.ninja.soundsList();
    updateSoundDropdowns();
  } catch (e) {
    console.error('Failed to load custom sounds:', e);
  }
}

// ============ Tab Navigation ============

function switchTab(tabName) {
  els.timersTabBtn.classList.toggle('active', tabName === 'timers');
  els.messagesTabBtn.classList.toggle('active', tabName === 'messages');
  els.timersTab.classList.toggle('active', tabName === 'timers');
  els.messagesTab.classList.toggle('active', tabName === 'messages');

  // Update Add button text based on active tab
  els.addTimer.textContent = tabName === 'timers' ? '+ Add Timer' : '+ Add Message';
}

function getActiveTab() {
  return els.messagesTab.classList.contains('active') ? 'messages' : 'timers';
}

// ============ OSC Integration ============

let oscFeedbackInterval = null;
let oscEnabled = false;
let oscFeedbackEnabled = false;

/**
 * Initialize OSC from saved settings
 */
async function initOSC() {
  const settings = loadAppSettings();
  const osc = settings.osc || {};

  if (osc.enabled || osc.feedbackEnabled) {
    await window.ninja.oscSetSettings(osc);
    oscEnabled = osc.enabled;
    oscFeedbackEnabled = osc.feedbackEnabled;

    if (osc.feedbackEnabled) {
      startOSCFeedback();
    }
  }
}

/**
 * Update OSC visibility based on enabled state
 */
function updateOSCVisibility() {
  const enabled = els.oscEnabled.checked;
  const feedbackEnabled = els.oscFeedbackEnabled.checked;

  // Show/hide port row based on enabled
  if (els.oscListenPortRow) {
    els.oscListenPortRow.style.display = enabled ? '' : 'none';
  }

  // Show/hide feedback settings
  if (els.oscFeedbackHostRow) {
    els.oscFeedbackHostRow.style.display = feedbackEnabled ? '' : 'none';
  }
  if (els.oscFeedbackPortRow) {
    els.oscFeedbackPortRow.style.display = feedbackEnabled ? '' : 'none';
  }
}

/**
 * Update OSC status display
 */
function updateOSCStatus() {
  if (!els.oscStatus) return;

  const enabled = els.oscEnabled.checked;
  const feedbackEnabled = els.oscFeedbackEnabled.checked;

  if (!enabled && !feedbackEnabled) {
    els.oscStatus.textContent = '';
    return;
  }

  const parts = [];
  if (enabled) {
    parts.push(`Listening on port ${els.oscListenPort.value}`);
  }
  if (feedbackEnabled) {
    parts.push(`Feedback to ${els.oscFeedbackHost.value}:${els.oscFeedbackPort.value}`);
  }

  els.oscStatus.textContent = parts.join(' • ');
}

/**
 * Handle incoming OSC command
 * All indices are 1-based for user-friendliness
 */
function handleOSCCommand(address, args) {
  const presets = loadPresets();

  switch (address) {
    // Timer control
    case '/ninja/timer/start':
      sendCommand('start');
      break;

    case '/ninja/timer/pause':
      sendCommand('pause');
      break;

    case '/ninja/timer/resume':
      sendCommand('resume');
      break;

    case '/ninja/timer/toggle':
      if (isRunning) {
        sendCommand('pause');
      } else if (timerState.startedAt !== null) {
        sendCommand('resume');
      } else {
        sendCommand('start');
      }
      break;

    case '/ninja/timer/reset':
      sendCommand('reset');
      break;

    case '/ninja/timer/stop':
      sendCommand('reset');
      break;

    case '/ninja/timer/select': {
      // 1-based index from OSC, convert to 0-based
      const index = (args[0] || 1) - 1;
      if (index >= 0 && index < presets.length) {
        activePresetIndex = index;
        setActiveTimerConfig(presets[index].config);
        applyConfig(presets[index].config);
        renderPresetList();
        broadcastTimerState();
      }
      break;
    }

    case '/ninja/timer/select/name': {
      const name = args[0];
      if (name) {
        const index = presets.findIndex(p => p.name === name);
        if (index >= 0) {
          activePresetIndex = index;
          setActiveTimerConfig(presets[index].config);
          applyConfig(presets[index].config);
          renderPresetList();
          broadcastTimerState();
        }
      }
      break;
    }

    case '/ninja/timer/next': {
      if (presets.length > 0) {
        const next = (activePresetIndex === null ? 0 : activePresetIndex + 1) % presets.length;
        activePresetIndex = next;
        setActiveTimerConfig(presets[next].config);
        applyConfig(presets[next].config);
        renderPresetList();
        broadcastTimerState();
      }
      break;
    }

    case '/ninja/timer/previous': {
      if (presets.length > 0) {
        const prev = activePresetIndex === null ? 0 : (activePresetIndex - 1 + presets.length) % presets.length;
        activePresetIndex = prev;
        setActiveTimerConfig(presets[prev].config);
        applyConfig(presets[prev].config);
        renderPresetList();
        broadcastTimerState();
      }
      break;
    }

    case '/ninja/timer/duration': {
      const seconds = args[0];
      if (typeof seconds === 'number' && seconds > 0) {
        activeTimerConfig.durationSec = seconds;
        broadcastTimerState();
      }
      break;
    }

    case '/ninja/timer/duration/add': {
      const delta = args[0];
      if (typeof delta === 'number') {
        activeTimerConfig.durationSec = Math.max(1, activeTimerConfig.durationSec + delta);
        broadcastTimerState();
      }
      break;
    }

    // Display control
    case '/ninja/display/blackout': {
      const state = args[0];
      window.ninja.setBlackout(state === 1 || state === true);
      break;
    }

    case '/ninja/display/blackout/toggle':
      window.ninja.toggleBlackout();
      break;

    case '/ninja/display/flash':
      // Trigger flash via the existing flash mechanism
      flashAnimator?.trigger();
      broadcastTimerState();
      break;

    case '/ninja/display/visibility': {
      const visible = args[0];
      // This would need the visibility toggle to be implemented
      break;
    }

    // Message control
    case '/ninja/message/show': {
      // 1-based index from OSC
      const index = (args[0] || 1) - 1;
      const messages = loadMessages();
      if (index >= 0 && index < messages.length) {
        toggleMessageVisibility(messages[index].id, true);
      }
      break;
    }

    case '/ninja/message/show/text': {
      const searchText = args[0];
      if (searchText) {
        const messages = loadMessages();
        const msg = messages.find(m => m.text.includes(searchText));
        if (msg) {
          toggleMessageVisibility(msg.id, true);
        }
      }
      break;
    }

    case '/ninja/message/hide': {
      const messages = loadMessages();
      const visibleMsg = messages.find(m => m.visible);
      if (visibleMsg) {
        toggleMessageVisibility(visibleMsg.id, false);
      }
      break;
    }

    // Profile control
    case '/ninja/profile/select': {
      // 1-based index from OSC
      const index = (args[0] || 1) - 1;
      if (index >= 0 && index < profiles.length) {
        switchProfile(profiles[index].id);
      }
      break;
    }

    case '/ninja/profile/select/name': {
      const name = args[0];
      if (name) {
        const profile = profiles.find(p => p.name === name);
        if (profile) {
          switchProfile(profile.id);
        }
      }
      break;
    }

    default:
      console.log('[OSC] Unknown command:', address, args);
  }
}

/**
 * Start OSC feedback interval (1 second updates)
 */
function startOSCFeedback() {
  stopOSCFeedback();

  oscFeedbackInterval = setInterval(() => {
    sendOSCFeedback();
  }, 1000);
}

/**
 * Stop OSC feedback interval
 */
function stopOSCFeedback() {
  if (oscFeedbackInterval) {
    clearInterval(oscFeedbackInterval);
    oscFeedbackInterval = null;
  }
}

/**
 * Send current state as OSC feedback
 */
function sendOSCFeedback() {
  if (!oscFeedbackEnabled) return;

  const presets = loadPresets();
  const preset = activePresetIndex !== null ? presets[activePresetIndex] : null;
  const profile = getActiveProfile();

  // Calculate display values
  const display = computeDisplay({
    mode: activeTimerConfig.mode,
    durationMs: activeTimerConfig.durationSec * 1000,
    startedAt: timerState.startedAt,
    pausedAccMs: timerState.pausedAcc,
    isRunning,
    ended: timerState.ended,
    overtime: timerState.overtime
  }, Date.now());

  // Send all feedback messages
  window.ninja.oscSendFeedback('/ninja/state/running', [isRunning ? 1 : 0]);
  window.ninja.oscSendFeedback('/ninja/state/time', [display.text || '--:--']);
  window.ninja.oscSendFeedback('/ninja/state/remaining', [Math.floor((display.remainingMs || 0) / 1000)]);
  window.ninja.oscSendFeedback('/ninja/state/elapsed', [Math.floor((display.elapsedMs || 0) / 1000)]);
  window.ninja.oscSendFeedback('/ninja/state/progress', [display.progress || 0]);
  window.ninja.oscSendFeedback('/ninja/state/overtime', [display.overtime ? 1 : 0]);
  window.ninja.oscSendFeedback('/ninja/state/ended', [timerState.ended ? 1 : 0]);
  window.ninja.oscSendFeedback('/ninja/state/blackout', [blackoutActive ? 1 : 0]);
  window.ninja.oscSendFeedback('/ninja/state/timer/name', [preset?.name || '']);
  window.ninja.oscSendFeedback('/ninja/state/timer/index', [(activePresetIndex ?? -1) + 1]); // 1-based
  window.ninja.oscSendFeedback('/ninja/state/profile/name', [profile?.name || '']);
  window.ninja.oscSendFeedback('/ninja/state/profile/index', [profiles.indexOf(profile) + 1]); // 1-based
}

// ============ Message Management ============

function loadMessages() {
  const profile = getActiveProfile();
  if (!profile) return [];

  // Ensure messages array exists
  if (!profile.messages) profile.messages = [];

  // Migrate: add id, visible, and uppercase fields to any messages without them
  let needsSave = false;
  profile.messages = profile.messages.map(msg => {
    let updated = msg;
    if (!msg.id) {
      needsSave = true;
      updated = {
        ...updated,
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        visible: false
      };
    }
    if (msg.uppercase === undefined) {
      needsSave = true;
      updated = { ...updated, uppercase: false };
    }
    return updated;
  });

  if (needsSave) {
    saveProfiles();
  }

  return profile.messages;
}

function saveMessagesToStorage(list) {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.messages = list;
  saveProfiles();
}

/**
 * Restore active message from storage (for hot reload persistence)
 * Called on init to restore message state after reload
 */
function restoreActiveMessage() {
  const messages = loadMessages();
  const visibleMsg = messages.find(m => m.visible);

  if (visibleMsg) {
    activeMessage = visibleMsg;
    const msgData = {
      text: visibleMsg.text,
      bold: visibleMsg.bold,
      italic: visibleMsg.italic,
      uppercase: visibleMsg.uppercase,
      color: visibleMsg.color,
      visible: true
    };
    // Update preview
    updateLivePreviewMessage(msgData);
    // Send to output (if connected)
    window.ninja.sendMessage(msgData);
  }
}

function updateTabBadges() {
  const timerCount = loadPresets().length;
  const messageCount = loadMessages().length;

  const timersBadge = document.getElementById('timersBadge');
  const messagesBadge = document.getElementById('messagesBadge');

  if (timersBadge) timersBadge.textContent = timerCount > 0 ? timerCount : '';
  if (messagesBadge) messagesBadge.textContent = messageCount > 0 ? messageCount : '';
}

// Message tooltip element (created once, reused)
let messageTooltip = null;
let messageTooltipTimer = null;

function getMessageTooltip() {
  if (!messageTooltip) {
    messageTooltip = document.createElement('div');
    messageTooltip.className = 'message-tooltip';
    document.body.appendChild(messageTooltip);
  }
  return messageTooltip;
}

function showMessageTooltip(msg, targetEl) {
  // Clear any existing timer
  if (messageTooltipTimer) {
    clearTimeout(messageTooltipTimer);
  }

  // Delay showing tooltip by 1 second
  messageTooltipTimer = setTimeout(() => {
    const tooltip = getMessageTooltip();
    if (!msg.text) {
      tooltip.style.display = 'none';
      return;
    }

    // Apply formatting
    tooltip.textContent = msg.text;
    tooltip.style.color = msg.color || '#ffffff';
    tooltip.style.fontWeight = msg.bold ? 'bold' : 'normal';
    tooltip.style.fontStyle = msg.italic ? 'italic' : 'normal';
    tooltip.style.textTransform = msg.uppercase ? 'uppercase' : 'none';

    // Position tooltip above the target element
    const rect = targetEl.getBoundingClientRect();
    tooltip.style.display = 'block';
    tooltip.style.left = rect.left + (rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - 8) + 'px';
  }, 1000);
}

function hideMessageTooltip() {
  // Clear timer if hovering off before tooltip shows
  if (messageTooltipTimer) {
    clearTimeout(messageTooltipTimer);
    messageTooltipTimer = null;
  }
  const tooltip = getMessageTooltip();
  tooltip.style.display = 'none';
}

function renderMessageList() {
  const messages = loadMessages();
  els.messageList.innerHTML = '';

  messages.forEach((msg, idx) => {
    const row = document.createElement('div');
    row.className = 'message-item' + (msg.visible ? ' showing' : '');
    row.dataset.id = msg.id;

    // Left column: drag handle + delete button stacked
    const leftCol = document.createElement('div');
    leftCol.className = 'message-left-col';

    // Drag handle (number shows by default, drag icon on hover)
    const dragHandle = document.createElement('div');
    dragHandle.className = 'message-drag-handle';
    dragHandle.innerHTML = `
      <span class="message-number">${idx + 1}</span>
      <span class="message-drag-icon">${ICONS.drag}</span>
    `;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn message-delete-btn';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

    leftCol.append(dragHandle, deleteBtn);

    // Content area
    const content = document.createElement('div');
    content.className = 'message-content';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'message-text-input';
    textInput.placeholder = 'Type message...';
    textInput.value = msg.text || '';
    textInput.style.color = msg.color || '#ffffff';
    if (msg.bold) textInput.style.fontWeight = 'bold';
    if (msg.italic) textInput.style.fontStyle = 'italic';
    if (msg.uppercase) textInput.style.textTransform = 'uppercase';

    const formatRow = document.createElement('div');
    formatRow.className = 'message-format-row';

    const boldBtn = document.createElement('button');
    boldBtn.className = 'format-btn bold-btn' + (msg.bold ? ' active' : '');
    boldBtn.title = 'Bold';
    boldBtn.innerHTML = '<strong>B</strong>';

    const italicBtn = document.createElement('button');
    italicBtn.className = 'format-btn italic-btn' + (msg.italic ? ' active' : '');
    italicBtn.title = 'Italic';
    italicBtn.innerHTML = '<em>I</em>';

    const uppercaseBtn = document.createElement('button');
    uppercaseBtn.className = 'format-btn uppercase-btn' + (msg.uppercase ? ' active' : '');
    uppercaseBtn.title = 'ALL CAPS';
    uppercaseBtn.innerHTML = 'AA';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'message-color-input';
    colorInput.value = msg.color || '#ffffff';
    colorInput.title = 'Text Color';

    // Visibility button (moved to format row)
    const visibilityBtn = document.createElement('button');
    visibilityBtn.className = 'message-visibility-btn' + (msg.visible ? ' active' : '');
    visibilityBtn.title = msg.visible ? 'Hide from output' : 'Show on output';
    visibilityBtn.innerHTML = '<span class="visibility-indicator"></span>';

    // Spacer pushes visibility button to far right
    const spacer = document.createElement('div');
    spacer.style.flex = '1';

    formatRow.append(boldBtn, italicBtn, uppercaseBtn, colorInput, spacer, visibilityBtn);
    content.append(textInput, formatRow);

    row.append(leftCol, content);
    els.messageList.appendChild(row);

    // Tooltip on hover (only on text input, not whole row)
    textInput.addEventListener('mouseenter', () => showMessageTooltip(msg, textInput));
    textInput.addEventListener('mouseleave', hideMessageTooltip);

    // Setup events for this message item
    setupMessageItemEvents(row, msg.id, textInput, boldBtn, italicBtn, uppercaseBtn, colorInput, visibilityBtn, deleteBtn, dragHandle, idx);
  });

  updateTabBadges();
}

function setupMessageItemEvents(row, messageId, textInput, boldBtn, italicBtn, uppercaseBtn, colorInput, visibilityBtn, deleteBtn, dragHandle, idx) {
  // Debounced save for text input
  const debouncedSave = debounce(() => {
    updateMessageField(messageId, 'text', textInput.value);
  }, 300);

  textInput.addEventListener('input', debouncedSave);

  // Enter/Escape to blur and save
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      // Force immediate save before blur
      updateMessageField(messageId, 'text', textInput.value);
      textInput.blur();
    }
  });

  colorInput.addEventListener('input', () => {
    updateMessageField(messageId, 'color', colorInput.value);
    textInput.style.color = colorInput.value;
  });

  boldBtn.addEventListener('click', () => {
    boldBtn.classList.toggle('active');
    const isBold = boldBtn.classList.contains('active');
    updateMessageField(messageId, 'bold', isBold);
    textInput.style.fontWeight = isBold ? 'bold' : 'normal';
  });

  italicBtn.addEventListener('click', () => {
    italicBtn.classList.toggle('active');
    const isItalic = italicBtn.classList.contains('active');
    updateMessageField(messageId, 'italic', isItalic);
    textInput.style.fontStyle = isItalic ? 'italic' : 'normal';
  });

  uppercaseBtn.addEventListener('click', () => {
    uppercaseBtn.classList.toggle('active');
    const isUppercase = uppercaseBtn.classList.contains('active');
    updateMessageField(messageId, 'uppercase', isUppercase);
    textInput.style.textTransform = isUppercase ? 'uppercase' : 'none';
  });

  visibilityBtn.addEventListener('click', () => {
    // Add transitioning stripes briefly (same as blackout button)
    visibilityBtn.classList.add('transitioning');
    setTimeout(() => {
      visibilityBtn.classList.remove('transitioning');
    }, 300);

    // Toggle immediately (like blackout)
    toggleMessageVisibility(messageId);
  });

  deleteBtn.addEventListener('click', () => {
    deleteMessage(messageId);
  });

  // Drag handle events
  dragHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = row.getBoundingClientRect();
    messageDragState.grabOffsetX = e.clientX - rect.left;
    messageDragState.grabOffsetY = e.clientY - rect.top;
    messageDragState.startX = e.clientX;
    messageDragState.startY = e.clientY;
    messageDragState.originalHeight = rect.height;
    messageDragState.originalWidth = rect.width;
    messageDragState.isDragging = true;
    messageDragState.dragActivated = false;
    messageDragState.fromIndex = idx;
    messageDragState.currentSlot = idx;
    messageDragState.draggedRow = row;
  });
}

function updateMessageField(messageId, field, value) {
  const messages = loadMessages();
  const msg = messages.find(m => m.id === messageId);
  if (msg) {
    saveUndoState(); // Save state before edit for undo
    msg[field] = value;
    saveMessagesToStorage(messages);

    // If this message is currently visible, update the output and live preview
    if (msg.visible) {
      const msgData = {
        text: msg.text,
        bold: msg.bold,
        italic: msg.italic,
        uppercase: msg.uppercase,
        color: msg.color,
        visible: true
      };
      window.ninja.sendMessage(msgData);
      updateLivePreviewMessage(msgData);
    }
  }
}

/**
 * Update the live preview message display
 * Uses virtual canvas for identical rendering with output
 */
function updateLivePreviewMessage(message) {
  if (!els.livePreviewMessage || !els.livePreviewContentBox) return;

  const wasVisible = els.livePreviewContentBox.classList.contains('with-message');

  if (!message || !message.visible) {
    // Shrink timer before layout change to prevent flash
    if (wasVisible) {
      els.livePreviewTimer.style.fontSize = '10px';
      els.livePreviewToD.style.fontSize = '10px';
    }
    els.livePreviewContentBox.classList.remove('with-message');
    els.livePreviewMessage.classList.remove('visible', 'bold', 'italic', 'uppercase');
    lastPreviewMessageText = '';
    lastPreviewMessageBold = false;
    lastPreviewMessageItalic = false;
    lastPreviewMessageUppercase = false;
    // Force layout recalculation
    void els.livePreviewContentBox.offsetHeight;

    // Refit timer and ToD since they now have full height
    if (wasVisible) {
      fitPreviewTimer();
      fitPreviewToD();
    }
    return;
  }

  // Use shared module for styling (identical to output)
  applyMessageStyle(els.livePreviewMessage, message);
  els.livePreviewMessage.classList.add('visible');

  // Shrink timer before layout change to prevent "big then small" flash
  if (!wasVisible) {
    els.livePreviewTimer.style.fontSize = '10px';
    els.livePreviewToD.style.fontSize = '10px';
  }

  els.livePreviewContentBox.classList.add('with-message');
  // Force layout recalculation
  void els.livePreviewContentBox.offsetHeight;

  // Wait for layout to update, then fit content
  requestAnimationFrame(() => {
    // Fit message content (when text or formatting changes, or message just became visible)
    const boldChanged = message.bold !== lastPreviewMessageBold;
    const italicChanged = message.italic !== lastPreviewMessageItalic;
    const uppercaseChanged = message.uppercase !== lastPreviewMessageUppercase;
    const formattingChanged = boldChanged || italicChanged || uppercaseChanged;
    if (message.text !== lastPreviewMessageText || formattingChanged || !wasVisible) {
      lastPreviewMessageText = message.text;
      lastPreviewMessageBold = message.bold;
      lastPreviewMessageItalic = message.italic;
      lastPreviewMessageUppercase = message.uppercase;
      fitPreviewMessage();
    }

    // Refit timer and ToD if message just became visible (area changed)
    if (!wasVisible) {
      fitPreviewTimer();
      fitPreviewToD();
    }
  });
}

function toggleMessageVisibility(messageId) {
  const messages = loadMessages();
  const targetIndex = messages.findIndex(m => m.id === messageId);
  if (targetIndex === -1) return;

  saveUndoState(); // Save state before toggle for undo

  const target = messages[targetIndex];
  const wasVisible = target.visible;

  // Hide all messages first (only one visible at a time)
  messages.forEach(m => m.visible = false);

  if (!wasVisible) {
    // Show this message
    target.visible = true;
    activeMessage = target;

    const msgData = {
      text: target.text,
      bold: target.bold,
      italic: target.italic,
      uppercase: target.uppercase,
      color: target.color,
      visible: true
    };
    window.ninja.sendMessage(msgData);
    updateLivePreviewMessage(msgData);
  } else {
    // Was visible, now hide
    activeMessage = null;
    window.ninja.sendMessage({ visible: false });
    updateLivePreviewMessage({ visible: false });
  }

  saveMessagesToStorage(messages);
  renderMessageList();
}

async function deleteMessage(messageId) {
  const messages = loadMessages();
  const idx = messages.findIndex(m => m.id === messageId);
  if (idx === -1) return;

  const msg = messages[idx];
  const settings = loadAppSettings();

  if (settings.confirmDelete) {
    const displayText = msg.text.substring(0, 30) + (msg.text.length > 30 ? '...' : '');
    const result = await showConfirmDialog({
      title: 'Delete Message?',
      message: `Delete "${displayText || 'Empty message'}"?`,
      showDontAsk: true
    });

    if (!result.confirmed) return;

    if (result.dontAskAgain) {
      settings.confirmDelete = false;
      saveAppSettings(settings);
      populateAppSettingsForm();
    }
  }

  // Save state for undo before deleting
  saveUndoState();

  // If this message was visible, hide it first
  if (msg.visible) {
    activeMessage = null;
    window.ninja.sendMessage({ visible: false });
    updateLivePreviewMessage({ visible: false });
  }

  messages.splice(idx, 1);
  saveMessagesToStorage(messages);
  renderMessageList();

  showToast('Message deleted (Cmd/Ctrl+Z to undo)', 'success');
}

function addNewMessage() {
  saveUndoState(); // Save state before adding for undo

  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text: '',
    bold: false,
    italic: false,
    uppercase: false,
    color: '#ffffff',
    visible: false
  };

  const messages = loadMessages();
  messages.push(newMsg);
  saveMessagesToStorage(messages);
  renderMessageList();

  // Focus the new message's text input
  const newRow = els.messageList.querySelector(`[data-id="${newMsg.id}"]`);
  if (newRow) {
    const input = newRow.querySelector('.message-text-input');
    if (input) {
      input.focus();
      // Scroll to show the new message
      newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// ============ Custom Confirm Dialog ============

let confirmResolver = null;

function showConfirmDialog(options = {}) {
  return new Promise((resolve) => {
    confirmResolver = resolve;

    // Set content
    els.confirmTitle.textContent = options.title || 'Confirm';
    els.confirmMessage.textContent = options.message || 'Are you sure?';

    // Reset checkbox
    els.confirmDontAsk.checked = false;

    // Show/hide "Don't ask again" checkbox
    els.confirmDontAskContainer.style.display = options.showDontAsk !== false ? 'flex' : 'none';

    // Show dialog
    els.confirmDialog.classList.remove('hidden');
  });
}

function closeConfirmDialog(result) {
  els.confirmDialog.classList.add('hidden');
  if (confirmResolver) {
    confirmResolver({
      confirmed: result,
      dontAskAgain: els.confirmDontAsk.checked
    });
    confirmResolver = null;
  }
}

// ============ Keyboard Shortcuts Modal ============

function toggleShortcutsModal() {
  if (els.shortcutsModal.classList.contains('hidden')) {
    els.shortcutsModal.classList.remove('hidden');
  } else {
    els.shortcutsModal.classList.add('hidden');
  }
}

function setupShortcutsModal() {
  // Close button
  els.shortcutsClose.addEventListener('click', () => {
    els.shortcutsModal.classList.add('hidden');
  });

  // Close on overlay click
  els.shortcutsModal.addEventListener('click', (e) => {
    if (e.target === els.shortcutsModal) {
      els.shortcutsModal.classList.add('hidden');
    }
  });
}

// ============ Confirm Dialog ============

function setupConfirmDialog() {
  els.confirmCancel.addEventListener('click', () => closeConfirmDialog(false));
  els.confirmDeleteBtn.addEventListener('click', () => closeConfirmDialog(true));

  // Close on overlay click
  els.confirmDialog.addEventListener('click', (e) => {
    if (e.target === els.confirmDialog) {
      closeConfirmDialog(false);
    }
  });

  // Keyboard shortcuts for confirm dialog
  document.addEventListener('keydown', (e) => {
    if (els.confirmDialog.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
      closeConfirmDialog(false);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      closeConfirmDialog(true);
    }
  });
}

// FIXED_STYLE and getShadowCSS are now imported from shared/timerState.js and shared/renderTimer.js

function getDefaultTimerConfig() {
  const settings = loadAppSettings();
  const d = settings.defaults;

  return {
    mode: d.mode || 'countdown',
    durationSec: d.durationSec || 600,
    format: d.format || 'MM:SS',
    allowOvertime: d.allowOvertime !== false,
    style: {
      fontFamily: d.fontFamily || 'Inter',
      fontWeight: d.fontWeight ?? 700,
      color: d.color || '#ffffff',
      strokeWidth: d.strokeWidth ?? 0,
      strokeColor: d.strokeColor || '#000000',
      shadowSize: d.shadowSize ?? 0,
      shadowColor: d.shadowColor || '#000000',
      bgColor: d.bgColor || '#000000'
    },
    sound: {
      endType: d.soundType || 'none',
      volume: d.soundVolume ?? 0.7
    },
    warnYellowSec: d.warnYellowSec ?? 60,
    warnOrangeSec: d.warnOrangeSec ?? 15
  };
}

// ============ Timer Progress Bar ============

/**
 * Get the chain of linked timers that includes the active timer
 * Returns array of { index, preset, durationMs } from chain start to end
 */
function getLinkedTimerChain() {
  const presets = loadPresets();
  if (activePresetIndex === null || presets.length === 0) return [];

  // Find the start of the chain (first timer that leads to active timer)
  let chainStart = activePresetIndex;
  for (let i = activePresetIndex - 1; i >= 0; i--) {
    if (presets[i].linkedToNext) {
      chainStart = i;
    } else {
      break;
    }
  }

  // Build chain from start to end (following links)
  const chain = [];
  let idx = chainStart;
  while (idx < presets.length) {
    const preset = presets[idx];
    chain.push({
      index: idx,
      preset: preset,
      durationMs: (preset.config?.durationSec || 0) * 1000
    });

    if (preset.linkedToNext && idx < presets.length - 1) {
      idx++;
    } else {
      break;
    }
  }

  return chain;
}

// Cached total duration for seek calculations
let cachedTotalMs = 0;

// Last rendered warning thresholds (to avoid unnecessary re-renders)
let lastWarnYellowSec = null;
let lastWarnOrangeSec = null;
let lastDurationSec = null;

/**
 * Update the progress bar with elapsed/remaining time
 * Shows segments for linked timers and positions indicator accordingly
 * @param {number} currentElapsedMs - Elapsed time in current timer (milliseconds)
 * @param {number} currentTotalMs - Current timer's total duration (milliseconds)
 */
function updateProgressBar(currentElapsedMs, currentTotalMs) {
  // Show default state when no timer is selected
  if (activePresetIndex === null) {
    els.progressFill.style.width = '0%';
    els.progressIndicator.style.left = '0%';
    els.progressFill.classList.remove('warning-yellow', 'warning-orange');
    els.progressFill.classList.add('no-glow'); // Hide shadow at 0%
    cachedTotalMs = 600000;
    return;
  }

  // Timer selected but not started - show full duration at 0%
  if (!isRunning && timerState.startedAt === null && timerState.pausedAcc === 0) {
    const durationMs = activeTimerConfig.durationSec * 1000;
    els.progressFill.style.width = '0%';
    els.progressIndicator.style.left = '0%';
    els.progressFill.classList.remove('warning-yellow', 'warning-orange');
    els.progressFill.classList.add('no-glow'); // Hide shadow at 0%
    cachedTotalMs = durationMs;
    renderWarningZones();
    renderSmartSegments();
    return;
  }

  // Simple progress bar showing only current timer's status
  cachedTotalMs = currentTotalMs;
  const progressPercent = Math.min(100, (currentElapsedMs / currentTotalMs) * 100);

  els.progressFill.style.width = progressPercent + '%';
  els.progressIndicator.style.left = progressPercent + '%';

  // Show/hide glow based on progress (hide at 0% to prevent shadow sticking out)
  els.progressFill.classList.toggle('no-glow', progressPercent === 0);

  // Show indicator only when timer has progress (hide at 0% for clean rounded edges)
  els.progressIndicator.style.opacity = progressPercent === 0 ? '0' : '1';

  // Update fill color based on warning zone
  const remainingMs = currentTotalMs - currentElapsedMs;
  const remainingSec = remainingMs / 1000;
  const yellowSec = activeTimerConfig.warnYellowSec ?? 60;
  const orangeSec = activeTimerConfig.warnOrangeSec ?? 15;

  // Remove existing warning classes
  els.progressFill.classList.remove('warning-yellow', 'warning-orange');

  // Add appropriate warning class based on remaining time
  if (remainingSec <= orangeSec) {
    els.progressFill.classList.add('warning-orange');
  } else if (remainingSec <= yellowSec) {
    els.progressFill.classList.add('warning-yellow');
  }

  // Render warning zones and smart segments for current timer only
  renderWarningZones();
  renderSmartSegments();
}

/**
 * Update the progress bar inside a preset row
 * @param {number} idx - The preset index
 * @param {number} progressPercent - Progress percentage (0-100)
 */
function updateRowProgressBar(idx, progressPercent) {
  const rows = els.presetList.querySelectorAll('.preset-item');
  if (rows[idx]) {
    const progressBar = rows[idx].querySelector('.row-progress-bar');
    if (progressBar) {
      progressBar.style.width = progressPercent + '%';
    }
  }
}

// Clear all row progress bars (used when switching timers)
function clearAllRowProgressBars() {
  const rows = els.presetList.querySelectorAll('.preset-item');
  rows.forEach(row => {
    const progressBar = row.querySelector('.row-progress-bar');
    if (progressBar) {
      progressBar.style.width = '0%';
    }
  });
}

/**
 * Update the playing class and button states on preset rows without full re-render
 * Only updates innerHTML when state actually changes to avoid interfering with clicks
 */
function updatePlayingRowState() {
  const rows = els.presetList.querySelectorAll('.preset-item');
  rows.forEach((row, idx) => {
    const isSelected = activePresetIndex === idx;
    const isPlaying = isSelected && isRunning;
    const isPaused = isSelected && !isRunning && timerState.startedAt !== null;

    row.classList.toggle('selected', isSelected);
    row.classList.toggle('playing', isPlaying);

    // Update play/pause button icon and class - only if state changed
    const playBtn = row.querySelector('.play-btn, .pause-btn');
    if (playBtn) {
      const shouldBePause = isPlaying;
      const currentlyPause = playBtn.classList.contains('pause-btn');

      // Only update if the button state needs to change
      if (shouldBePause && !currentlyPause) {
        playBtn.className = 'icon-btn pause-btn';
        playBtn.innerHTML = ICONS.pause;
        playBtn.title = 'Pause';
      } else if (!shouldBePause && currentlyPause) {
        playBtn.className = 'icon-btn play-btn';
        playBtn.innerHTML = ICONS.play;
        playBtn.title = isPaused ? 'Resume' : 'Load & Start';
      }
    }
  });
}

// ============ Progress Bar Interactivity ============

/**
 * Initialize progress bar mouse interaction for seek functionality
 */
function initProgressBarInteractivity() {
  const track = els.progressTrack;
  if (!track) return;

  track.addEventListener('mouseenter', () => {
    els.seekLine.classList.remove('hidden');
    els.seekTooltip.classList.remove('hidden');
  });

  track.addEventListener('mouseleave', () => {
    els.seekLine.classList.add('hidden');
    els.seekTooltip.classList.add('hidden');
  });

  track.addEventListener('mousemove', (e) => {
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));

    // Position seek line and tooltip
    els.seekLine.style.left = percent + '%';
    els.seekTooltip.style.left = percent + '%';

    // Calculate time at position (use active timer's format)
    const format = activeTimerConfig?.format || 'MM:SS';
    if (cachedTotalMs > 0) {
      const timeAtPosition = (percent / 100) * cachedTotalMs;
      els.seekTooltip.textContent = formatTimePlain(timeAtPosition, format);
    } else {
      els.seekTooltip.textContent = format === 'HH:MM:SS' ? '--:--:--' : '--:--';
    }
  });

  track.addEventListener('click', (e) => {
    // Don't seek if no timer is active or in TOD mode
    if (activePresetIndex === null) return;
    if (activeTimerConfig.mode === 'tod') return;
    if (cachedTotalMs <= 0) return;

    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));

    // Calculate target elapsed time
    const targetElapsedMs = (percent / 100) * cachedTotalMs;

    // Seek to position
    seekToTime(targetElapsedMs);
  });
}

/**
 * Seek timer to a specific elapsed time
 * @param {number} targetElapsedMs - Target elapsed time in milliseconds
 */
function seekToTime(targetElapsedMs) {
  // Always seek within the current timer only - never switch timers via progress bar click
  // Timer switching in linked chains should only happen automatically when timers complete
  const durationMs = activeTimerConfig.durationSec * 1000;
  const clampedElapsed = Math.max(0, Math.min(targetElapsedMs, durationMs));

  const now = Date.now();
  if (isRunning) {
    timerState.startedAt = now - clampedElapsed;
    timerState.pausedAcc = 0; // Clear pausedAcc since seeked position is encoded in startedAt
  } else {
    timerState.pausedAcc = clampedElapsed;
    if (timerState.startedAt === null) {
      timerState.startedAt = now;
    }
  }

  // Clear ended/overtime state if seeking back
  if (clampedElapsed < durationMs) {
    timerState.ended = false;
    timerState.overtime = false;
    timerState.overtimeStartedAt = null;
  }

  broadcastTimerState();
}

/**
 * Render warning zone backgrounds on the progress bar
 */
function renderWarningZones() {
  if (!activeTimerConfig || !els.warningZones) return;

  const durationSec = activeTimerConfig.durationSec;
  const yellowSec = activeTimerConfig.warnYellowSec ?? 60;
  const orangeSec = activeTimerConfig.warnOrangeSec ?? 15;

  renderWarningZonesForDuration(durationSec, yellowSec, orangeSec);
}

/**
 * Render warning zones for a specific duration (used when no timer selected)
 */
function renderWarningZonesForDuration(durationSec, yellowSec, orangeSec) {
  if (!els.warningZones) return;

  els.warningZones.innerHTML = '';

  if (durationSec <= 0) return;

  // Calculate zone boundaries
  const yellowStartPercent = Math.max(0, ((durationSec - yellowSec) / durationSec) * 100);
  const orangeStartPercent = Math.max(0, ((durationSec - orangeSec) / durationSec) * 100);

  // Green zone (from start to yellow threshold)
  if (yellowStartPercent > 0) {
    const greenZone = document.createElement('div');
    greenZone.className = 'warning-zone green';
    greenZone.style.left = '0';
    greenZone.style.width = yellowStartPercent + '%';
    els.warningZones.appendChild(greenZone);
  }

  // Yellow zone (between yellow and orange thresholds)
  if (yellowSec > orangeSec && yellowStartPercent < orangeStartPercent) {
    const yellowZone = document.createElement('div');
    yellowZone.className = 'warning-zone yellow';
    yellowZone.style.left = yellowStartPercent + '%';
    yellowZone.style.width = (orangeStartPercent - yellowStartPercent) + '%';
    els.warningZones.appendChild(yellowZone);
  }

  // Orange zone (from orange threshold to end)
  if (orangeSec > 0 && orangeStartPercent < 100) {
    const orangeZone = document.createElement('div');
    orangeZone.className = 'warning-zone orange';
    orangeZone.style.left = orangeStartPercent + '%';
    orangeZone.style.right = '0';
    els.warningZones.appendChild(orangeZone);
  }
}

/**
 * Render smart segment markers based on timer duration
 */
function renderSmartSegments() {
  if (!activeTimerConfig || !els.progressSegments) return;
  if (activeTimerConfig.mode === 'tod') return;

  // Check if count-up mode
  const isCountUp = activeTimerConfig.mode === 'countup' || activeTimerConfig.mode === 'countup-tod';

  // Always use current timer's duration only
  renderSmartSegmentsForDuration(activeTimerConfig.durationSec, isCountUp);
}

/**
 * Render smart segment markers for a specific duration
 * Creates markers at key positions showing:
 * - Countdown: TIME REMAINING (10:00 at 0%, 2:30 at 75%)
 * - Count-up: TIME ELAPSED (0:00 at 0%, 7:30 at 75%)
 */
function renderSmartSegmentsForDuration(durationSec, isCountUp = false) {
  if (!els.progressSegments) return;

  // Clear existing markers
  const markers = els.progressSegments.querySelectorAll('.segment-marker');
  markers.forEach(m => m.remove());

  if (durationSec <= 0) return;

  // Create markers at key positions (0%, 25%, 50%, 75%)
  const positions = [0, 25, 50, 75];

  // Determine if we need to show hours based on total duration
  const needsHours = durationSec >= 3600;

  for (const percent of positions) {
    // For countdown: show time remaining (decreases as progress increases)
    // For count-up: show time elapsed (increases as progress increases)
    const timeSec = isCountUp
      ? (percent / 100) * durationSec  // Elapsed time
      : durationSec - ((percent / 100) * durationSec);  // Remaining time

    const marker = document.createElement('div');
    marker.className = 'segment-marker';
    marker.style.left = percent + '%';

    // Hide the line for 0% marker (just show the label)
    if (percent === 0) {
      marker.style.background = 'transparent';
    }

    // Format time label - use consistent format based on total duration
    const hours = Math.floor(timeSec / 3600);
    const minutes = Math.floor((timeSec % 3600) / 60);
    const seconds = Math.round(timeSec % 60);

    if (needsHours) {
      // For timers >= 1 hour, always show H:MM:SS format
      marker.dataset.time = hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    } else if (seconds === 0) {
      marker.dataset.time = minutes + ':00';
    } else {
      marker.dataset.time = minutes + ':' + String(seconds).padStart(2, '0');
    }

    els.progressSegments.appendChild(marker);
  }
}

/**
 * Update progress bar warning zones and segments for current timer
 */
function updateProgressBarZones() {
  // Default to 10:00 if no timer selected
  if (!activeTimerConfig || activePresetIndex === null) {
    renderWarningZonesForDuration(600, 60, 15);
    renderSmartSegmentsForDuration(600);
    return;
  }

  // Render warning zones and segments for selected timer
  renderWarningZones();
  renderSmartSegments();
}

// ============ Modal Management ============

function openModal(presetIndex = null) {
  editingPresetIndex = presetIndex;

  if (presetIndex !== null) {
    // Editing existing preset
    const presets = loadPresets();
    const preset = presets[presetIndex];
    els.modalTitle.textContent = 'Edit Timer';
    els.presetName.value = preset.name;
    applyConfig(preset.config);
    // Tutorial hook - advance if on openEdit step
    onTutorialAction('openEdit');
  } else {
    // Creating new preset - apply defaults
    els.modalTitle.textContent = 'New Timer';
    const presets = loadPresets();
    let counter = 1;
    let name = `Timer ${counter}`;
    while (presets.some(p => p.name === name)) {
      counter++;
      name = `Timer ${counter}`;
    }
    els.presetName.value = name;
    // Apply default settings for new timers
    applyConfig(getDefaultTimerConfig());
  }

  els.timerModal.classList.remove('hidden');
  els.presetName.focus();
  els.presetName.select();
  updateDurationDigitDisplay();
  updateDurationControlsFormat();
  updateOvertimeVisibility();
  updateModalPreview();
}

function closeModal() {
  els.timerModal.classList.add('hidden');
  editingPresetIndex = null;
}

function saveModal() {
  // Validate target time for non-manual start modes
  const startMode = els.startMode?.value || 'manual';
  if (startMode !== 'manual') {
    const targetTime = els.targetTime?.value;
    if (!targetTime) {
      showToast('Please set a target time', 'error');
      els.targetTime?.focus();
      return;
    }
    // Check if target time is in the future
    const targetDate = new Date(targetTime);
    if (targetDate <= new Date()) {
      showToast('Target time must be in the future', 'error');
      els.targetTime?.focus();
      return;
    }
  }

  // Warn about long duration timers in Manual mode (suggest End By for accuracy)
  const LONG_TIMER_THRESHOLD_SEC = 3600; // 1 hour
  if (startMode === 'manual') {
    const durationSec = getDurationSeconds();
    if (durationSec >= LONG_TIMER_THRESHOLD_SEC) {
      const hours = Math.floor(durationSec / 3600);
      console.log(`[Timer] Tip: For ${hours}+ hour timers, consider "End By Time" mode to prevent drift`);
      // Note: showToast is disabled - uncomment when re-enabled:
      // showToast(`Tip: For ${hours}+ hour timers, "End By Time" mode prevents drift`, 'info');
    }
  }

  saveUndoState(); // Save state before changes for undo

  const name = els.presetName.value.trim() || 'Timer';
  const config = getCurrentConfig();
  const presets = loadPresets();

  if (editingPresetIndex !== null) {
    // Update existing preset (preserve linkedToNext)
    const linkedToNext = presets[editingPresetIndex].linkedToNext || false;
    presets[editingPresetIndex] = { name, config, linkedToNext };
    showToast(`Updated "${name}"`, 'success');

    // If editing the active timer, update activeTimerConfig too
    if (editingPresetIndex === activePresetIndex) {
      setActiveTimerConfig(config);
    }
  } else {
    // Create new preset
    presets.push({ name, config });
    showToast(`Created "${name}"`, 'success');
  }

  savePresets(presets);

  // Close modal first, then re-render after a frame to avoid click blocking
  closeModal();
  requestAnimationFrame(() => {
    renderPresetList();
  });
}

function updateModalPreview() {
  if (!els.modalPreview || !els.modalPreviewTimer) return;

  const mode = els.mode.value;
  const format = els.format.value;
  const durationSec = getDurationSeconds();
  const shadowSize = parseInt(els.shadowSize.value, 10) || 0;
  const shadowColor = els.shadowColor.value || '#000000';

  // Apply styles (using user-selected font + settings)
  const fontFamily = els.fontFamily?.value || 'Inter';
  const fontWeight = els.fontWeight?.value || 700;
  els.modalPreview.style.background = els.bgColor.value;
  els.modalPreviewTimer.style.fontFamily = `'${fontFamily}', ${FIXED_STYLE.fontFamily}`;
  els.modalPreviewTimer.style.fontWeight = fontWeight;
  els.modalPreviewTimer.style.color = els.fontColor.value;
  els.modalPreviewTimer.style.opacity = FIXED_STYLE.opacity;
  // Use shadow-based stroke instead of -webkit-text-stroke to avoid intersection artifacts
  els.modalPreviewTimer.style.webkitTextStrokeWidth = '0px';
  els.modalPreviewTimer.style.textShadow = getCombinedShadowCSS(
    parseInt(els.strokeWidth.value, 10) || 0,
    els.strokeColor.value,
    shadowSize,
    shadowColor
  );
  els.modalPreviewTimer.style.letterSpacing = FIXED_STYLE.letterSpacing + 'em';

  // Update displayed time - modal preview always shows duration only (no ToD)
  // This section is for adjusting time, not displaying time of day
  let displayText = '';

  if (mode === 'hidden') {
    els.modalPreviewTimer.style.visibility = 'hidden';
    els.modalPreviewTimerSection?.classList.remove('with-tod');
    return;
  } else {
    els.modalPreviewTimer.style.visibility = 'visible';
  }

  // Never show ToD layout in modal - duration only
  els.modalPreviewTimerSection?.classList.remove('with-tod');

  // Always show duration (even for ToD mode - user is editing the timer settings)
  // Always use HH:MM:SS format in modal for consistent button alignment
  displayText = formatTime(durationSec * 1000, 'HH:MM:SS');

  // Pad first segment with leading zero for modal preview (button alignment)
  displayText = displayText.replace(/^(\d)(<span)/, '0$1$2');

  els.modalPreviewTimer.innerHTML = displayText;

  // Clear ToD element - not used in modal
  if (els.modalPreviewToD) {
    els.modalPreviewToD.innerHTML = '';
  }

  // Fit timer content (no ToD)
  fitModalPreviewContent(false);

  // Align duration buttons to match timer digit positions
  alignDurationButtons();
}

/**
 * Fit modal preview timer and ToD content
 * Uses full content-box dimensions (fills modal-preview with small padding)
 */
function fitModalPreviewContent(hasToD) {
  if (!els.modalPreviewTimer || !els.modalPreviewContentBox) return;

  // Get content-box dimensions (fills modal-preview with 4px inset padding)
  const contentBoxWidth = els.modalPreviewContentBox.offsetWidth;
  const contentBoxHeight = els.modalPreviewContentBox.offsetHeight;

  if (contentBoxWidth <= 0 || contentBoxHeight <= 0) {
    // Layout not ready, retry
    setTimeout(() => fitModalPreviewContent(hasToD), 50);
    return;
  }

  // Timer container height:
  // - Timer only: 100% of content-box (fills entire box)
  // - Timer+ToD: 75% of content-box (timer-box)
  const timerContainerHeight = hasToD ? contentBoxHeight * 0.75 : contentBoxHeight;
  const maxWidth = contentBoxWidth;
  const maxHeight = timerContainerHeight * 0.95;

  // Measure timer at base font size
  els.modalPreviewTimer.style.fontSize = '100px';
  void els.modalPreviewTimer.offsetWidth;

  const naturalWidth = els.modalPreviewTimer.offsetWidth;
  const naturalHeight = els.modalPreviewTimer.offsetHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) return;

  // Scale to fit within container
  const scaleW = maxWidth / naturalWidth;
  const scaleH = maxHeight / naturalHeight;
  const scale = Math.min(scaleW, scaleH);
  els.modalPreviewTimer.style.fontSize = Math.floor(100 * scale) + 'px';

  // Fit ToD if visible (25% of content-box)
  if (hasToD && els.modalPreviewToD) {
    const todContainerHeight = contentBoxHeight * 0.25;
    const todMaxWidth = contentBoxWidth;
    const todMaxHeight = todContainerHeight * 0.9;

    els.modalPreviewToD.style.fontSize = '100px';
    void els.modalPreviewToD.offsetWidth;

    const todNaturalWidth = els.modalPreviewToD.offsetWidth;
    const todNaturalHeight = els.modalPreviewToD.offsetHeight;
    if (todNaturalWidth > 0 && todNaturalHeight > 0) {
      const todScaleW = todMaxWidth / todNaturalWidth;
      const todScaleH = todMaxHeight / todNaturalHeight;
      const todScale = Math.min(todScaleW, todScaleH);
      els.modalPreviewToD.style.fontSize = Math.floor(100 * todScale) + 'px';
    }
  }
}

// ============ Collapsible Settings Sections ============

const SECTIONS_STATE_KEY = 'ninja:sectionsState';

function setupCollapsibleSections() {
  const sections = document.querySelectorAll('.collapsible-section');

  // Restore saved state
  const savedState = JSON.parse(localStorage.getItem(SECTIONS_STATE_KEY) || '{}');

  sections.forEach(section => {
    const sectionId = section.dataset.section;
    const header = section.querySelector('.section-header');

    // Restore collapsed state
    if (savedState[sectionId] === true) {
      section.classList.add('collapsed');
    }

    // Add click handler
    header.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      saveSectionsState();
    });
  });
}

function saveSectionsState() {
  const sections = document.querySelectorAll('.collapsible-section');
  const state = {};

  sections.forEach(section => {
    const sectionId = section.dataset.section;
    state[sectionId] = section.classList.contains('collapsed');
  });

  localStorage.setItem(SECTIONS_STATE_KEY, JSON.stringify(state));
}

// ============ Settings Tabs (Timer Modal) ============

const SETTINGS_TAB_KEY = 'ninja:settingsTab';

function setupSettingsTabs() {
  const tabs = document.querySelectorAll('.settings-tab');
  const panels = document.querySelectorAll('.settings-tab-panel');

  if (tabs.length === 0) return;

  // Restore last active tab
  const savedTab = localStorage.getItem(SETTINGS_TAB_KEY) || 'timer';
  switchSettingsTab(savedTab);

  // Add click handlers
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      switchSettingsTab(tabId);
      localStorage.setItem(SETTINGS_TAB_KEY, tabId);
    });
  });
}

function switchSettingsTab(tabId) {
  const tabs = document.querySelectorAll('.settings-tab');
  const panels = document.querySelectorAll('.settings-tab-panel');

  // Update tab buttons
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update panels
  panels.forEach(panel => {
    if (panel.dataset.panel === tabId) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });
}

// ============ Preview Panel Resize ============

const PREVIEW_WIDTH_KEY = 'ninja:previewWidth';
let isResizing = false;
let startY = 0;
let startWidth = 0;

// Track last rendered text/format/mode to only refit when needed
let lastPreviewTimerText = '';
let lastPreviewMessageText = '';
let lastPreviewMessageBold = false;
let lastPreviewMessageItalic = false;
let lastPreviewMessageUppercase = false;
let lastPreviewTimerFormat = '';
let lastPreviewTimerMode = '';
let lastPreviewTimerLength = 0;

/**
 * Get reference text for timer sizing based on format and duration
 * Uses 8s because 8 is typically the widest digit
 */
function getRefText(format, durationSec) {
  if (format === 'HH:MM:SS') {
    const hours = Math.floor(durationSec / 3600);
    if (hours >= 10) return '88:88:88';
    return '8:88:88';
  }
  // MM:SS format
  const minutes = Math.floor(durationSec / 60);
  if (minutes >= 100) return '888:88';
  if (minutes >= 10) return '88:88';
  return '8:88';
}

/**
 * Position the preview content-box using fixed positioning
 * This is needed because content-box uses position: fixed to escape overflow clipping
 * (matching how output.css works with position: fixed on content-box)
 */
function positionPreviewContentBox() {
  const wrapper = els.previewWrapper;
  const contentBox = els.livePreviewContentBox;
  if (!wrapper || !contentBox) return;

  const rect = wrapper.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  // Calculate content-box dimensions (90% x 64% of wrapper, matching output)
  const width = rect.width * 0.9;
  const height = rect.height * 0.64;

  // Center within the wrapper's screen position
  contentBox.style.width = width + 'px';
  contentBox.style.height = height + 'px';
  contentBox.style.left = (rect.left + rect.width / 2) + 'px';
  contentBox.style.top = (rect.top + rect.height / 2) + 'px';
}

/**
 * Fit preview timer to fill its container - scale until box touches edge
 * Respects message mode (34% height) and ToD mode (75% of that)
 */
function fitPreviewTimer() {
  if (!els.livePreviewTimer || !els.livePreviewTimerBox || !els.livePreviewContentBox) return;

  // Position the content-box first (needed for position: fixed)
  positionPreviewContentBox();

  const hasToD = els.livePreviewTimerSection?.classList.contains('with-tod');
  const hasMessage = els.livePreviewContentBox?.classList.contains('with-message');

  // Container width is always timer-section width
  const containerWidth = els.livePreviewTimerSection?.offsetWidth || 0;

  // Container height depends on mode:
  // - Timer only (no message): content-box height
  // - Timer only (with message): timer-section height (34%)
  // - Timer+ToD (no message): timer-box height (75%)
  // - Timer+ToD (with message): timer-box height (75% of 34%)
  let containerHeight;
  if (hasToD) {
    containerHeight = els.livePreviewTimerBox.offsetHeight;
  } else if (hasMessage) {
    containerHeight = els.livePreviewTimerSection?.offsetHeight || 0;
  } else {
    containerHeight = els.livePreviewContentBox.offsetHeight;
  }

  // If layout not ready, retry after short delay (matches output behavior)
  if (containerWidth <= 0 || containerHeight <= 0) {
    setTimeout(fitPreviewTimer, 50);
    return;
  }

  const appSettings = loadAppSettings();
  const zoom = (appSettings.timerZoom ?? 100) / 100;
  const maxWidth = containerWidth * zoom;
  const maxHeight = containerHeight * 0.95;

  // Temporarily center for consistent measurement
  const savedJustify = els.livePreviewTimerSection?.style.justifyContent;
  if (els.livePreviewTimerSection) {
    els.livePreviewTimerSection.style.justifyContent = 'center';
  }

  // Measure timer at base font size
  els.livePreviewTimer.style.fontSize = '100px';
  void els.livePreviewTimer.offsetWidth;

  const naturalWidth = els.livePreviewTimer.offsetWidth;
  const naturalHeight = els.livePreviewTimer.offsetHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    if (els.livePreviewTimerSection) {
      els.livePreviewTimerSection.style.justifyContent = savedJustify;
    }
    return;
  }

  // Scale to fill, cap at edges
  const scaleW = maxWidth / naturalWidth;
  const scaleH = maxHeight / naturalHeight;
  const scale = Math.min(scaleW, scaleH);

  const fontSize = Math.floor(100 * scale);
  els.livePreviewTimer.style.fontSize = fontSize + 'px';

  // Restore alignment
  if (els.livePreviewTimerSection) {
    els.livePreviewTimerSection.style.justifyContent = savedJustify;
  }
}

/**
 * Fit preview ToD to fill its container (tod-box, 25% of content-box)
 * Scale until tod-box touches edge
 */
function fitPreviewToD() {
  if (!els.livePreviewToD || !els.livePreviewToDBox) return;
  if (!els.livePreviewTimerSection?.classList.contains('with-tod')) return;

  const containerWidth = els.livePreviewToDBox.offsetWidth;
  const containerHeight = els.livePreviewToDBox.offsetHeight;

  // If layout not ready, retry after short delay (matches output behavior)
  if (containerWidth <= 0 || containerHeight <= 0) {
    setTimeout(fitPreviewToD, 50);
    return;
  }

  const appSettings = loadAppSettings();
  const zoom = (appSettings.timerZoom ?? 100) / 100;
  const maxWidth = containerWidth * zoom;
  const maxHeight = containerHeight * 0.90;

  // Temporarily center for consistent measurement
  const savedJustify = els.livePreviewTimerSection?.style.justifyContent;
  if (els.livePreviewTimerSection) {
    els.livePreviewTimerSection.style.justifyContent = 'center';
  }

  // Measure ToD at base font size
  els.livePreviewToD.style.fontSize = '100px';
  void els.livePreviewToD.offsetWidth;

  const naturalWidth = els.livePreviewToD.offsetWidth;
  const naturalHeight = els.livePreviewToD.offsetHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    if (els.livePreviewTimerSection) {
      els.livePreviewTimerSection.style.justifyContent = savedJustify;
    }
    return;
  }

  // Scale to fill, cap at edges
  const scaleW = maxWidth / naturalWidth;
  const scaleH = maxHeight / naturalHeight;
  const scale = Math.min(scaleW, scaleH);

  const fontSize = Math.floor(100 * scale);
  els.livePreviewToD.style.fontSize = fontSize + 'px';

  // Restore alignment
  if (els.livePreviewTimerSection) {
    els.livePreviewTimerSection.style.justifyContent = savedJustify;
  }
}

/**
 * Fit preview message text to message-section container
 * Tries different word-wrap widths to find optimal layout that maximizes text size
 */
function fitPreviewMessage() {
  if (!els.livePreviewMessage || !els.livePreviewMessageSection) return;

  const containerWidth = els.livePreviewMessageSection.offsetWidth;
  const containerHeight = els.livePreviewMessageSection.offsetHeight;

  // If layout not ready, retry after short delay
  if (containerWidth <= 0 || containerHeight <= 0) {
    setTimeout(fitPreviewMessage, 50);
    return;
  }

  // Target 95% of container
  const targetWidth = containerWidth * 0.95;
  const targetHeight = containerHeight * 0.95;

  // Temporarily center for consistent measurement
  const savedJustify = els.livePreviewMessageSection.style.justifyContent;
  els.livePreviewMessageSection.style.justifyContent = 'center';

  // Set maxWidth to container width - text wraps at container boundary
  els.livePreviewMessage.style.maxWidth = targetWidth + 'px';

  // Binary search for largest font that fits (textFit algorithm)
  let min = 8;
  let max = 500;
  let bestFit = min;

  while (min <= max) {
    const mid = Math.floor((min + max) / 2);
    els.livePreviewMessage.style.fontSize = mid + 'px';
    void els.livePreviewMessage.offsetWidth; // Force reflow

    const textHeight = els.livePreviewMessage.scrollHeight;
    const textWidth = els.livePreviewMessage.scrollWidth;

    if (textHeight <= targetHeight && textWidth <= targetWidth) {
      bestFit = mid;
      min = mid + 1; // Try larger
    } else {
      max = mid - 1; // Too big, try smaller
    }
  }

  els.livePreviewMessage.style.fontSize = bestFit + 'px';

  // Restore alignment
  els.livePreviewMessageSection.style.justifyContent = savedJustify;
}

function setupPreviewResize() {
  els.previewResizeHandle.addEventListener('mousedown', startResize);
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
}

function startResize(e) {
  isResizing = true;
  startY = e.clientY;
  startWidth = els.previewWrapper.offsetWidth;
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
}

function doResize(e) {
  if (!isResizing) return;

  // Dragging down increases size (handle is at bottom)
  // We control width, and CSS aspect-ratio handles height
  const delta = e.clientY - startY;
  // Convert vertical drag to width change (scaled by aspect ratio)
  const widthDelta = delta * (16 / 9);
  const containerWidth = els.previewSection.offsetWidth;
  const newWidth = Math.max(150, Math.min(containerWidth, startWidth + widthDelta));
  els.previewWrapper.style.width = newWidth + 'px';

  // Refit timer when preview is resized
  fitPreviewTimer();
  fitPreviewMessage();
}

function stopResize() {
  if (!isResizing) return;
  isResizing = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  // Save the width
  const width = els.previewWrapper.offsetWidth;
  localStorage.setItem(PREVIEW_WIDTH_KEY, width);
}

function restorePreviewWidth() {
  const containerWidth = els.previewSection.offsetWidth;
  const saved = localStorage.getItem(PREVIEW_WIDTH_KEY);

  if (saved) {
    // Clamp saved width to container (fixes oversized preview on smaller window)
    const width = Math.min(parseInt(saved, 10), containerWidth);
    els.previewWrapper.style.width = (width > 0 ? width : containerWidth) + 'px';
  } else {
    // Default to maximum width on first launch
    if (containerWidth > 0) {
      els.previewWrapper.style.width = containerWidth + 'px';
    }
  }
  // Fit timer content
  requestAnimationFrame(() => {
    fitPreviewTimer();
    fitPreviewMessage();
  });
}

/**
 * Auto-fit text element to fill container (considers both width and height)
 * @param {HTMLElement} textEl - The text element to size
 * @param {HTMLElement} containerEl - The container to fit within
 * @param {number} targetPercent - Target width percentage (0.9 = 90%)
 */
function autoFitText(textEl, containerEl, targetPercent = 0.9) {
  if (!textEl || !containerEl) return;

  // Reset to measure natural size at a base font size
  textEl.style.fontSize = '100px';
  textEl.style.transform = 'scale(1)';

  const containerWidth = containerEl.offsetWidth;
  const containerHeight = containerEl.offsetHeight;
  const targetWidth = containerWidth * targetPercent;

  // Use 34% height when message is visible (34/66 split), otherwise 85%
  const hasMessage = containerEl.classList.contains('with-message');
  const targetHeight = containerHeight * (hasMessage ? 0.34 : 0.85);

  const naturalWidth = textEl.scrollWidth;
  const naturalHeight = textEl.scrollHeight;

  if (naturalWidth > 0 && containerWidth > 0) {
    // Calculate ratios for both width and height constraints
    const widthRatio = targetWidth / naturalWidth;
    const heightRatio = targetHeight / naturalHeight;
    // Use the smaller ratio to ensure it fits both constraints
    const ratio = Math.min(widthRatio, heightRatio);
    const newFontSize = Math.max(10, 100 * ratio); // Min 10px for readability
    textEl.style.fontSize = newFontSize + 'px';
  }
}

// Align duration button columns to match timer digit positions
function alignDurationButtons() {
  const timerEl = els.modalPreviewTimer;
  const controls = document.getElementById('durationControls');
  if (!timerEl || !controls) return;

  // Get the timer's computed font size
  const fontSize = parseFloat(window.getComputedStyle(timerEl).fontSize) || 20;

  // Approximate character width (monospace-like with tabular nums)
  // Inter font at tabular-nums is roughly 0.65em per digit
  const charWidth = fontSize * 0.65;
  const colonWidth = fontSize * 0.35;

  // Apply widths to digit columns
  const digitCols = controls.querySelectorAll('.digit-col');
  digitCols.forEach(col => {
    col.style.width = charWidth + 'px';
  });

  // Apply widths to separators (colons) - centered vertically
  const separators = controls.querySelectorAll('.digit-separator');
  separators.forEach(sep => {
    sep.style.width = colonWidth + 'px';
    sep.style.fontSize = fontSize * 0.7 + 'px';
  });

  // Scale buttons proportionally
  const btnWidth = Math.max(16, charWidth * 0.85);
  const btnHeight = Math.max(14, fontSize * 0.35);
  const digitBtns = controls.querySelectorAll('.digit-btn');
  digitBtns.forEach(btn => {
    btn.style.width = btnWidth + 'px';
    btn.style.height = btnHeight + 'px';
    btn.style.fontSize = Math.max(8, fontSize * 0.2) + 'px';
  });
}

/**
 * Get auto-fit percent based on current mode
 * Timer-only modes get more space (0.95), ToD+timer uses 0.9
 */
function getAutoFitPercent() {
  const mode = activeTimerConfig?.mode || 'countdown';
  const hasToD = mode === 'countdown-tod' || mode === 'countup-tod';
  return hasToD ? 0.9 : 0.95;
}

// ============ Preview ============

function applyPreview() {
  // Apply live preview styles
  applyLivePreviewStyle();
  // Apply alignment (global setting)
  applyLivePreviewAlignment();
}

// Debounced preview update for performance
const debouncedPreview = debounce(applyPreview, 50);

/**
 * Apply styles to live preview (mirrors output window)
 * Scales font size proportionally to preview box width
 */
function applyLivePreviewStyle() {
  const shadowSize = parseInt(els.shadowSize.value, 10) || 0;
  const shadowColor = els.shadowColor.value || '#000000';

  // Get font settings from active timer config
  const fontFamily = activeTimerConfig?.style?.fontFamily || 'Inter';
  const fontWeight = activeTimerConfig?.style?.fontWeight || 700;

  els.livePreview.style.background = els.bgColor.value;
  els.livePreviewTimer.style.fontFamily = `'${fontFamily}', ${FIXED_STYLE.fontFamily}`;
  els.livePreviewTimer.style.fontWeight = fontWeight;
  els.livePreviewTimer.style.letterSpacing = FIXED_STYLE.letterSpacing + 'em';

  // Skip styles controlled by FlashAnimator during flash
  if (!flashAnimator?.isFlashing) {
    els.livePreviewTimer.style.color = els.fontColor.value;
    els.livePreviewTimer.style.opacity = FIXED_STYLE.opacity;
    // Use shadow-based stroke instead of -webkit-text-stroke to avoid intersection artifacts
    els.livePreviewTimer.style.webkitTextStrokeWidth = '0px';
    els.livePreviewTimer.style.textShadow = getCombinedShadowCSS(
      parseInt(els.strokeWidth.value, 10) || 0,
      els.strokeColor.value,
      shadowSize,
      shadowColor
    );
  }

  // Font size is handled by fitPreviewTimer (only when text changes)
}

/**
 * Apply alignment to live preview timer and message sections
 */
function applyLivePreviewAlignment() {
  const align = getSelectedAlign();

  // Map align value to CSS justify-content
  const justifyMap = {
    'left': 'flex-start',
    'center': 'center',
    'right': 'flex-end'
  };
  const justifyContent = justifyMap[align] || 'center';

  // Apply to timer section in live preview
  const timerSection = els.livePreview?.querySelector('.timer-section');
  if (timerSection) {
    timerSection.style.justifyContent = justifyContent;
  }

  // Apply to message section in live preview
  const messageSection = els.livePreview?.querySelector('.message-section');
  if (messageSection) {
    messageSection.style.justifyContent = justifyContent;
  }
}

/**
 * Broadcast canonical timer state to output window
 * Uses StageTimer-style sync: send raw timestamps, output computes display
 */
function broadcastTimerState() {
  if (!outputWindowReady) return;

  const appSettings = loadAppSettings();

  // Increment sequence number
  stateSeq++;

  // Send canonical state - output will compute display from this
  window.ninja.sendTimerState({
    seq: stateSeq,
    mode: activeTimerConfig.mode,
    startMode: activeTimerConfig.startMode || 'manual',
    targetTime: activeTimerConfig.targetTime || null,
    durationMs: activeTimerConfig.durationSec * 1000,
    format: activeTimerConfig.format,
    startedAt: timerState.startedAt,
    pausedAccMs: timerState.pausedAcc,
    isRunning: isRunning,
    ended: timerState.ended,
    overtime: timerState.overtime,
    overtimeStartedAt: timerState.overtimeStartedAt,
    blackout: isBlackedOut,
    flash: {
      active: flashState.active,
      startedAt: flashState.startedAt
    },
    style: {
      ...activeTimerConfig.style,
      align: appSettings.defaults?.align || 'center'
    },
    todFormat: appSettings.todFormat,
    timezone: appSettings.timezone || 'auto',
    timerZoom: appSettings.timerZoom ?? 100,
    // Warning thresholds for color changes
    warnYellowSec: activeTimerConfig.warnYellowSec ?? 60,
    warnOrangeSec: activeTimerConfig.warnOrangeSec ?? 15
  });
}

/**
 * Broadcast display state to output window (LEGACY - kept for backwards compatibility)
 * This makes the output window a pure mirror of the live preview
 */
function broadcastDisplayState(state) {
  if (!outputWindowReady) return;

  // Use activeTimerConfig for style values (not form fields)
  const style = activeTimerConfig.style;

  window.ninja.sendDisplayState({
    visible: state.visible !== false,
    text: state.text || '',
    colorState: state.colorState || 'normal',
    color: state.color || style.color,
    opacity: state.opacity !== undefined ? state.opacity : FIXED_STYLE.opacity,
    blackout: state.blackout || false,
    overtime: state.overtime || false,
    flashing: state.flashing || false,
    elapsed: state.elapsed || '',
    remaining: state.remaining || '',
    style: {
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      strokeWidth: style.strokeWidth,
      strokeColor: style.strokeColor,
      textShadow: getShadowCSS(style.shadowSize, style.shadowColor),
      textAlign: FIXED_STYLE.align,
      letterSpacing: FIXED_STYLE.letterSpacing,
      background: style.bgColor
    }
  });
}

/**
 * Render loop for live preview - mirrors actual timer output
 * Uses activeTimerConfig so modal editing doesn't affect display
 *
 * Production Safety: Wrapped in try-catch to prevent render errors from crashing the app
 */
let renderLoopActive = true;  // Flag to stop render loop on cleanup

function renderLivePreview() {
  // Check if we should stop
  if (!renderLoopActive) return;

  // Record heartbeat for watchdog monitoring
  watchdogHeartbeat('preview');

  try {
    renderLivePreviewInternal();
  } catch (err) {
    console.error('[RenderLoop] Error (recovered):', err);
  }

  // Schedule next frame if still active
  if (renderLoopActive) {
    requestAnimationFrame(renderLivePreview);
  }
}

function renderLivePreviewInternal() {
  // Use stored active timer config (not form fields)
  const mode = activeTimerConfig.mode;
  const startMode = activeTimerConfig.startMode || 'manual';
  const targetTime = activeTimerConfig.targetTime;

  // Check for auto-start (Start At mode)
  if (startMode === 'startAt' && targetTime && !isRunning && activePresetIndex !== null) {
    const targetMs = new Date(targetTime).getTime();
    const nowMs = Date.now();
    if (nowMs >= targetMs && !timerState.ended) {
      // Target time reached - auto-start the timer
      sendCommand('start');
    }
  }

  // Calculate effective duration based on start mode
  let durationSec = activeTimerConfig.durationSec;
  if (startMode === 'endBy' && targetTime) {
    // End By mode: duration is time until target
    const targetMs = new Date(targetTime).getTime();
    const nowMs = Date.now();
    durationSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  }

  const format = activeTimerConfig.format;
  const fontColor = activeTimerConfig.style.color;
  const bgColor = activeTimerConfig.style.bgColor;

  let displayText = '';
  let elapsed = 0;
  let remainingSec = 0;

  // Handle hidden mode
  if (mode === 'hidden') {
    els.livePreviewTimer.style.visibility = 'hidden';
    broadcastTimerState();
    broadcastDisplayState({ visible: false });
    updateProgressBarZones();
    return; // Next frame scheduled by wrapper
  } else {
    els.livePreviewTimer.style.visibility = 'visible';
  }

  // Handle Time of Day only mode
  const appSettings = loadAppSettings();
  const todFormat = appSettings.todFormat;
  const timezone = appSettings.timezone;
  if (mode === 'tod') {
    displayText = formatTimeOfDay(todFormat, timezone);
    els.livePreviewTimer.innerHTML = displayText;
    // Refit when format, mode, or text length changes (font scales to fill width)
    const textLength = displayText.replace(/<[^>]*>/g, '').length;
    if (format !== lastPreviewTimerFormat || mode !== lastPreviewTimerMode || textLength !== lastPreviewTimerLength) {
      lastPreviewTimerFormat = format;
      lastPreviewTimerMode = mode;
      lastPreviewTimerLength = textLength;
      fitPreviewTimer();
    }
    // Skip color changes during flash animation
    if (!flashAnimator?.isFlashing) {
      els.livePreviewTimer.style.color = fontColor;
      els.livePreviewTimer.style.opacity = FIXED_STYLE.opacity;
    }

    // Update row progress bar for ToD mode (internal timer still runs)
    if (activePresetIndex !== null && isRunning && timerState.startedAt) {
      const totalMs = durationSec * 1000;
      const currentElapsedMs = Date.now() - timerState.startedAt + timerState.pausedAcc;
      const rowProgressPercent = totalMs > 0 ? Math.min(100, (currentElapsedMs / totalMs) * 100) : 0;
      updateRowProgressBar(activePresetIndex, rowProgressPercent);

      // Check if internal timer ended (for linked chain)
      if (currentElapsedMs >= totalMs && !timerState.ended) {
        timerState.ended = true;

        // Play end sound if configured
        const soundType = activeTimerConfig.sound?.endType;
        const soundVolume = activeTimerConfig.sound?.volume ?? 0.7;
        if (soundType && soundType !== 'none') {
          playSound(soundType, soundVolume);
        }

        // Check for linked next timer
        const presets = loadPresets();
        const currentPreset = presets[activePresetIndex];

        if (currentPreset?.linkedToNext && activePresetIndex < presets.length - 1) {
          // Auto-play next linked timer
          setRunning(false);
          const nextIdx = activePresetIndex + 1;
          const nextPreset = presets[nextIdx];
          activePresetIndex = nextIdx;
          setActiveTimerConfig(nextPreset.config);
          applyConfig(nextPreset.config);

          setTimeout(() => {
            sendCommand('start');
            renderPresetList();
          }, 1000);
        } else {
          // End of chain or standalone timer - check overtime setting
          // ToD mode doesn't have visual overtime, but respects the stop behavior
          if (activeTimerConfig.allowOvertime === false) {
            // Stop at 0:00
            setRunning(false);
            timerState.pausedAcc = activeTimerConfig.durationSec * 1000;
            timerState.startedAt = null;
          }
          // If overtime is allowed, ToD just keeps showing the clock (no change needed)
          renderPresetList();
        }
      }
    } else if (activePresetIndex !== null) {
      // Timer not running, just update progress bar with paused state
      const totalMs = durationSec * 1000;
      const rowProgressPercent = totalMs > 0 ? Math.min(100, (timerState.pausedAcc / totalMs) * 100) : 0;
      updateRowProgressBar(activePresetIndex, rowProgressPercent);
    }
    updatePlayingRowState();

    broadcastTimerState();
    broadcastDisplayState({
      visible: true,
      text: displayText,
      colorState: 'normal',
      color: fontColor,
      opacity: FIXED_STYLE.opacity,
      blackout: isBlackedOut
    });
    // Update clock display in TOD mode
    const nowTod = Date.now();
    if (nowTod - lastClockUpdate >= 1000) {
      updateCurrentTimeDisplay();
      lastClockUpdate = nowTod;
    }
    return; // Next frame scheduled by wrapper
  }

  // Determine mode type
  const isCountdown = mode === 'countdown' || mode === 'countdown-tod';
  const isCountup = mode === 'countup' || mode === 'countup-tod';
  const isPureToD = mode === 'tod';
  const showToD = mode === 'countdown-tod' || mode === 'countup-tod';

  if (!isRunning && timerState.pausedAcc === 0 && timerState.startedAt === null) {
    // Timer has never been started - show initial state
    elapsed = isCountdown ? durationSec * 1000 : 0;
    remainingSec = Math.floor(elapsed / 1000);
  } else if (!isRunning && timerState.pausedAcc > 0) {
    // Timer is paused - show paused time
    if (isCountdown) {
      elapsed = Math.max(0, (durationSec * 1000) - timerState.pausedAcc);
      // Use ceil for countdown so paused time rounds up (shows fuller time)
      remainingSec = Math.ceil(elapsed / 1000);
    } else {
      // Count-up paused - elapsed is time passed, remainingSec is time until goal
      elapsed = timerState.pausedAcc;
      const elapsedSec = Math.floor(elapsed / 1000);
      remainingSec = Math.max(0, durationSec - elapsedSec);
    }
  } else {
    // Timer is running
    const now = Date.now();
    const base = now - timerState.startedAt + timerState.pausedAcc;

    if (isCountdown) {
      elapsed = Math.max(0, (durationSec * 1000) - base);
      // Use ceil so timer shows full duration for the first second (10:00 stays until 9:59)
      remainingSec = Math.ceil(elapsed / 1000);

      // Check if timer ended
      if (elapsed === 0 && !timerState.ended) {
        timerState.ended = true;

        // Play end sound if configured
        const soundType = activeTimerConfig.sound?.endType;
        const soundVolume = activeTimerConfig.sound?.volume ?? 0.7;
        if (soundType && soundType !== 'none') {
          playSound(soundType, soundVolume);
        }

        // Check for linked next timer
        const presets = loadPresets();
        const currentPreset = presets[activePresetIndex];

        if (currentPreset?.linkedToNext && activePresetIndex < presets.length - 1) {
          // Auto-play next linked timer after short delay
          setRunning(false);
          const nextIdx = activePresetIndex + 1;
          const nextPreset = presets[nextIdx];
          activePresetIndex = nextIdx;
          setActiveTimerConfig(nextPreset.config);
          applyConfig(nextPreset.config);

          setTimeout(() => {
            sendCommand('start');
            renderPresetList();
          }, 1000);
        } else {
          // Check if overtime is allowed for this timer
          // Overtime is never allowed for "End By" mode (timer ends at target time)
          const allowOvertime = activeTimerConfig.allowOvertime !== false && startMode !== 'endBy';
          if (allowOvertime) {
            // Start overtime mode - keep running but count up
            timerState.overtime = true;
            timerState.overtimeStartedAt = Date.now();
          } else {
            // Stop at 0:00 - set pausedAcc to full duration so display shows 0:00
            setRunning(false);
            timerState.pausedAcc = activeTimerConfig.durationSec * 1000;
            timerState.startedAt = null; // Clear startedAt so play button starts fresh
          }
          renderPresetList(); // Update button states
        }
      }
    } else if (isCountup) {
      // Count up mode - elapsed is time passed, remainingSec is time until goal
      elapsed = base;
      const elapsedSec = Math.floor(elapsed / 1000);
      remainingSec = Math.max(0, durationSec - elapsedSec);
    }
  }

  // Format display text
  if (timerState.overtime && timerState.overtimeStartedAt) {
    // Overtime mode - show +M:SS in red
    const overtimeMs = Date.now() - timerState.overtimeStartedAt;
    const overtimeSec = Math.floor(overtimeMs / 1000);
    const mins = Math.floor(overtimeSec / 60);
    const secs = overtimeSec % 60;
    displayText = '+' + mins + ':' + String(secs).padStart(2, '0');
    els.livePreviewTimer.classList.add('overtime');
  } else {
    // Use roundUp=true for countdown so 9999ms shows as 10:00, not 9:59
    displayText = formatTime(elapsed, format, isCountdown);
    els.livePreviewTimer.classList.remove('overtime');
  }

  // Handle ToD mode toggle (75/25 split)
  const hadToD = els.livePreviewTimerSection?.classList.contains('with-tod');
  const todModeChanged = showToD !== hadToD;
  if (todModeChanged) {
    // Shrink timer before layout change to prevent "big then small" flash
    els.livePreviewTimer.style.fontSize = '10px';
    els.livePreviewToD.style.fontSize = '10px';
    if (showToD) {
      els.livePreviewTimerSection?.classList.add('with-tod');
    } else {
      els.livePreviewTimerSection?.classList.remove('with-tod');
    }
    // Force layout recalculation
    void els.livePreviewTimerSection?.offsetHeight;
  }

  // Update timer display FIRST (before measuring for fit)
  els.livePreviewTimer.innerHTML = displayText;

  // Update ToD display (separate element, uses innerHTML for colon spans)
  if (showToD) {
    const todText = formatTimeOfDay(todFormat, timezone);
    els.livePreviewToD.innerHTML = todText;
    els.livePreviewToD.style.visibility = 'visible';
  } else {
    els.livePreviewToD.style.visibility = 'hidden';
  }

  // Always refit on every frame to handle window resizes (matches output behavior)
  // MUST be called AFTER innerHTML is set so we measure the new content
  fitPreviewTimer();
  if (showToD) fitPreviewToD();

  // Update progress bar
  if (isCountdown) {
    const totalMs = durationSec * 1000;
    const elapsedMs = totalMs - elapsed;
    updateProgressBar(elapsedMs, totalMs);
  } else if (isCountup) {
    // For count-up, show progress toward the goal
    const totalMs = durationSec * 1000;
    updateProgressBar(elapsed, totalMs);
  } else {
    // Reset for other modes
    els.progressFill.style.width = '0%';
  }

  // Update row progress bar and playing state
  if (activePresetIndex !== null) {
    const totalMs = durationSec * 1000;
    const currentElapsedMs = isRunning && timerState.startedAt
      ? (Date.now() - timerState.startedAt + timerState.pausedAcc)
      : timerState.pausedAcc;
    const rowProgressPercent = totalMs > 0 ? Math.min(100, (currentElapsedMs / totalMs) * 100) : 0;
    updateRowProgressBar(activePresetIndex, rowProgressPercent);
  }
  updatePlayingRowState();

  // Warning color thresholds (from config or defaults)
  const warnYellowSec = activeTimerConfig.warnYellowSec ?? 60;
  const warnOrangeSec = activeTimerConfig.warnOrangeSec ?? 15;

  // Determine warning/overtime color (skip for pure ToD mode - just shows current time)
  let timerColor = fontColor;
  let colorState = 'normal';

  if (!isPureToD) {
    if (timerState.overtime) {
      timerColor = '#dc2626'; // Red for overtime
      colorState = 'overtime';
    } else if ((isCountdown || isCountup) && remainingSec <= 0) {
      timerColor = '#dc2626'; // Red for timer ended
      colorState = 'ended';
    } else if ((isCountdown || isCountup) && remainingSec <= warnOrangeSec && remainingSec > 0) {
      timerColor = '#E64A19'; // Orange for critical warning
      colorState = 'warning-orange';
    } else if ((isCountdown || isCountup) && remainingSec <= warnYellowSec) {
      timerColor = '#eab308'; // Yellow for warning
      colorState = 'warning-yellow';
    }
  }

  // Color states (skip during flash animation - let FlashAnimator control styles)
  if (!flashAnimator?.isFlashing) {
    els.livePreviewTimer.style.color = timerColor;
    els.livePreviewTimer.style.opacity = FIXED_STYLE.opacity;
    els.livePreview.classList.toggle('overtime', !isPureToD && timerState.overtime);
    // ToD always uses base color - never warning/overtime colors
    if (showToD && els.livePreviewToD) {
      els.livePreviewToD.style.color = fontColor;
    }
  }

  // Blackout state
  if (isBlackedOut) {
    els.livePreview.classList.add('blackout');
  } else {
    els.livePreview.classList.remove('blackout');
  }

  // For broadcast
  let currentColor = timerColor;
  let currentOpacity = FIXED_STYLE.opacity;

  // Broadcast canonical timer state to output window (new StageTimer-style)
  broadcastTimerState();

  // Also broadcast display state for backwards compatibility
  broadcastDisplayState({
    visible: true,
    text: displayText,
    colorState: colorState,
    color: currentColor,
    opacity: currentOpacity,
    blackout: isBlackedOut,
    overtime: timerState.overtime
  });

  // Update mode indicator
  updateProgressBarZones();
  // Next frame scheduled by wrapper
}

// ============ Configuration ============

function getCurrentConfig() {
  // Get current alignment from app settings (global setting)
  const currentAlign = appSettings.defaults?.align || 'center';

  return {
    mode: els.mode.value,
    startMode: els.startMode?.value || 'manual',
    targetTime: els.targetTime?.value || null,
    durationSec: getDurationSeconds(),
    format: els.format.value,
    allowOvertime: els.allowOvertime?.checked ?? true,
    style: {
      fontFamily: els.fontFamily?.value || 'Inter',
      fontWeight: parseInt(els.fontWeight?.value, 10) || 700,
      color: els.fontColor.value,
      strokeWidth: parseInt(els.strokeWidth.value, 10) || 0,
      strokeColor: els.strokeColor.value,
      shadowSize: parseInt(els.shadowSize.value, 10) || 0,
      shadowColor: els.shadowColor.value,
      bgColor: els.bgColor.value,
      align: currentAlign
    },
    sound: {
      endType: els.soundEnd.value || 'none',
      volume: parseFloat(els.soundVolume.value) || 0.7
    },
    // Warning thresholds (seconds remaining) - from MM:SS inputs
    warnYellowSec: getMSSeconds(els.warnYellowSec) || 60,
    warnOrangeSec: getMSSeconds(els.warnOrangeSec) || 15
  };
}

function applyConfig(config) {
  if (!config) return;

  els.mode.value = config.mode || 'countdown';

  // Start mode and target time
  if (els.startMode) {
    els.startMode.value = config.startMode || 'manual';
  }
  if (els.targetTime) {
    els.targetTime.value = config.targetTime || '';
  }
  updateStartModeVisibility();

  setDurationInputs(config.durationSec || 1200);
  els.format.value = config.format || 'MM:SS';

  if (config.style) {
    // Font settings
    const fontFamily = config.style.fontFamily || 'Inter';
    if (els.fontFamily) {
      els.fontFamily.value = fontFamily;
    }
    // Update font picker visual selection
    if (els.fontPicker) {
      els.fontPicker.querySelectorAll('.font-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.font === fontFamily);
      });
      // Scroll selected into view
      const selectedOption = els.fontPicker.querySelector('.font-option.selected');
      if (selectedOption) {
        selectedOption.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
      }
    }
    if (els.fontWeight) {
      updateFontWeightOptions(fontFamily);
      els.fontWeight.value = config.style.fontWeight ?? 700;
    }
    els.fontColor.value = config.style.color || '#ffffff';
    els.strokeWidth.value = config.style.strokeWidth ?? 0;
    els.strokeColor.value = config.style.strokeColor || '#000000';
    els.shadowSize.value = config.style.shadowSize ?? 0;
    els.shadowColor.value = config.style.shadowColor || '#000000';
    els.bgColor.value = config.style.bgColor || '#000000';
    // Update range value displays
    updateRangeDisplays();
  }

  if (config.sound) {
    // Support both old format (endEnabled: boolean) and new format (endType: string)
    if (typeof config.sound.endType === 'string') {
      els.soundEnd.value = config.sound.endType;
    } else if (config.sound.endEnabled === true) {
      els.soundEnd.value = 'chime'; // Migrate old 'on' to 'chime'
    } else {
      els.soundEnd.value = 'none';
    }
    els.soundVolume.value = config.sound.volume ?? 0.7;
    // Update volume row visibility
    updateVolumeRowVisibility();
  }

  // Warning thresholds - set as MM:SS
  setMSInput(els.warnYellowSec, config.warnYellowSec ?? 60);
  setMSInput(els.warnOrangeSec, config.warnOrangeSec ?? 15);

  // Overtime setting (default to true for backwards compatibility)
  if (els.allowOvertime) {
    els.allowOvertime.checked = config.allowOvertime !== false;
  }

  applyPreview();
}

/**
 * Update range slider value displays
 */
function updateRangeDisplays() {
  if (els.strokeWidthValue) {
    els.strokeWidthValue.textContent = els.strokeWidth.value + 'px';
  }
  if (els.shadowSizeValue) {
    els.shadowSizeValue.textContent = els.shadowSize.value + 'px';
  }
}

/**
 * Volume row always visible - user may want to set volume before selecting a sound
 */
function updateVolumeRowVisibility() {
  // No-op: volume slider always visible
}

// ============ Timer Commands ============

function sendCommand(command) {
  // Update local timer state for live preview
  switch (command) {
    case 'start':
      setRunning(true);
      timerState.startedAt = Date.now();
      timerState.pausedAcc = 0;
      timerState.ended = false;
      timerState.overtime = false;
      timerState.overtimeStartedAt = null;
      // Pulse the progress indicator
      els.progressIndicator.classList.remove('pulse');
      void els.progressIndicator.offsetWidth; // Force reflow
      els.progressIndicator.classList.add('pulse');
      // Tutorial hook - advance if on playTimer step
      onTutorialAction('playTimer');
      break;

    case 'pause':
      if (isRunning) {
        setRunning(false);
        timerState.pausedAcc += Date.now() - timerState.startedAt;
      }
      break;

    case 'resume':
      // Resume from paused state without resetting
      setRunning(true);
      timerState.startedAt = Date.now();
      // Keep pausedAcc as is - it contains the elapsed time (including seeked position)
      // Pulse the progress indicator
      els.progressIndicator.classList.remove('pulse');
      void els.progressIndicator.offsetWidth; // Force reflow
      els.progressIndicator.classList.add('pulse');
      break;

    case 'reset':
      setRunning(false);
      timerState.startedAt = null;
      timerState.pausedAcc = 0;
      timerState.ended = false;
      timerState.overtime = false;
      timerState.overtimeStartedAt = null;
      // Clear row progress bar
      if (activePresetIndex !== null) {
        updateRowProgressBar(activePresetIndex, 0);
      }
      renderPresetList(); // Update button states
      break;
  }

  // Broadcast state to output window (includes seeked position in pausedAcc)
  broadcastTimerState();

  // Also send legacy command for backward compatibility
  window.ninja.sendTimerCommand(command, activeTimerConfig);
}

// ============ Profiles ============

/**
 * Generate a unique ID for profiles
 */
function generateProfileId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Load profiles from localStorage, with migration from old presets format
 */
function loadProfiles() {
  try {
    // Try to load profiles from new key
    const profilesData = localStorage.getItem(STORAGE_KEYS.PROFILES);
    if (profilesData) {
      const parsed = JSON.parse(profilesData);
      profiles = parsed.profiles || [];
      activeProfileId = parsed.activeProfileId || profiles[0]?.id || null;

      // Migrate: assign colors to profiles that don't have them
      let needsSave = false;
      profiles.forEach((profile, idx) => {
        if (!profile.color) {
          profile.color = PROFILE_COLORS[idx % PROFILE_COLORS.length];
          needsSave = true;
        }
      });

      // Migrate: move global messages into profiles
      const legacyMessages = localStorage.getItem('ninja-messages-v1');
      if (legacyMessages) {
        try {
          const messages = JSON.parse(legacyMessages);
          // Add messages to active profile
          const activeProfile = profiles.find(p => p.id === activeProfileId);
          if (activeProfile && !activeProfile.messages) {
            activeProfile.messages = messages;
            needsSave = true;
          }
          // Clean up legacy storage
          localStorage.removeItem('ninja-messages-v1');
          console.log('[Migration] Moved messages into active profile');
        } catch (e) {
          console.error('[Migration] Failed to migrate messages:', e);
        }
      }

      // Ensure all profiles have messages array
      profiles.forEach(p => {
        if (!p.messages) {
          p.messages = [];
          needsSave = true;
        }
      });

      if (needsSave) {
        saveProfiles();
      }
      return;
    }

    // Migration: check for old presets and wrap in default profile
    let legacyPresets = [];

    // Check for presets in current key
    let data = localStorage.getItem(STORAGE_KEYS.PRESETS);

    // Also check for very old key from first version
    if (!data) {
      const oldKey = 'hawktimer-pro-presets-v1';
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        data = oldData;
        localStorage.removeItem(oldKey); // Clean up old key
      }
    }

    if (data) {
      legacyPresets = validatePresets(JSON.parse(data));
    }

    // Create default profile with legacy presets (or empty if none)
    profiles = [{
      id: 'default',
      name: 'Default',
      color: PROFILE_COLORS[0],
      createdAt: new Date().toISOString(),
      presets: legacyPresets,
      messages: []
    }];
    activeProfileId = 'default';

    // Save to new format
    saveProfiles();

    if (legacyPresets.length > 0) {
      showToast('Migrated timers to new profile system', 'success');
    }
  } catch (e) {
    console.error('Failed to load profiles:', e);
    // Create empty default profile on error
    profiles = [{
      id: 'default',
      name: 'Default',
      color: PROFILE_COLORS[0],
      createdAt: new Date().toISOString(),
      presets: [],
      messages: []
    }];
    activeProfileId = 'default';
  }
}

/**
 * Save profiles to localStorage
 */
function saveProfiles() {
  try {
    const data = {
      version: 1,
      activeProfileId,
      profiles
    };
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(data));
  } catch (e) {
    showToast('Failed to save profiles', 'error');
    console.error('Failed to save profiles:', e);
  }
}

/**
 * Get the currently active profile
 */
function getActiveProfile() {
  return profiles.find(p => p.id === activeProfileId) || profiles[0];
}

/**
 * Get presets from the active profile
 */
function getActivePresets() {
  const profile = getActiveProfile();
  return profile ? profile.presets : [];
}

/**
 * Save presets to the active profile
 */
function saveActivePresets(presets) {
  const profile = getActiveProfile();
  if (profile) {
    profile.presets = presets;
    saveProfiles();
  }
}

/**
 * Update the profile button to show the current profile name
 */
function updateProfileButton() {
  const profile = getActiveProfile();
  if (profile && els.profileName) {
    els.profileName.textContent = profile.name;
    els.profileName.title = profile.name; // Full name on hover
  }
  // Update color dot
  if (profile && els.profileColorDot) {
    els.profileColorDot.style.background = profile.color || PROFILE_COLORS[0];
    els.profileColorDot.style.boxShadow = `0 0 6px ${profile.color || PROFILE_COLORS[0]}`;
  }
}

// Current profile dropdown element (for cleanup)
let profileDropdown = null;

// Profile to highlight when dropdown opens (for new profile animation)
let highlightProfileId = null;

// Profile drag state (transform-based like timers)
let profileDragState = {
  isDragging: false,
  dragActivated: false, // True only after mouse moves 5px+
  dragEndTime: 0,       // Timestamp when drag ended (to prevent click after drag)
  fromIndex: null,
  currentSlot: null,
  draggedEl: null,
  items: [],        // All profile item elements
  listSection: null, // Reference to list section for has-drag class
  slotHeight: 0,    // Height of each profile item
  baseY: 0,         // Y position of first item at drag start
  initialScrollTop: 0, // Scroll position at drag start
  startX: 0,
  startY: 0
};

// Store handler references for cleanup
let profileDropdownCloseHandler = null;
let profileDragMoveHandler = null;
let profileDragEndHandler = null;

/**
 * Hide the profile dropdown
 */
function hideProfileDropdown() {
  // Remove close handler if present
  if (profileDropdownCloseHandler) {
    document.removeEventListener('click', profileDropdownCloseHandler);
    profileDropdownCloseHandler = null;
  }

  // Remove drag handlers if present
  if (profileDragMoveHandler) {
    document.removeEventListener('mousemove', profileDragMoveHandler);
    profileDragMoveHandler = null;
  }
  if (profileDragEndHandler) {
    document.removeEventListener('mouseup', profileDragEndHandler);
    profileDragEndHandler = null;
  }

  // Reset drag state
  profileDragState.isDragging = false;
  profileDragState.dragActivated = false;

  if (profileDropdown) {
    profileDropdown.remove();
    profileDropdown = null;
  }
  els.profileBtn?.classList.remove('active');
}

// Current color picker element and state
let profileColorPicker = null;
let profileColorPickerCloseHandler = null;

/**
 * Show color picker for a profile
 */
function showProfileColorPicker(profileId, anchorEl) {
  // Close other popups first
  document.querySelector('.preset-menu')?.remove();
  document.querySelector('.quick-edit-popup')?.remove();
  document.querySelector('.duration-edit-popup')?.remove();
  hideProfileColorPicker();

  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;

  // Track pending selection (not saved until Save is clicked)
  let pendingColor = profile.color || PROFILE_COLORS[0];

  const rect = anchorEl.getBoundingClientRect();

  // Create color picker popup
  profileColorPicker = document.createElement('div');
  profileColorPicker.className = 'profile-color-picker';
  profileColorPicker.style.top = (rect.bottom + 6) + 'px';
  profileColorPicker.style.left = (rect.left - 40) + 'px';

  // Create color swatches (5x2 grid for 10 colors)
  PROFILE_COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch' + (pendingColor === color ? ' selected' : '');
    swatch.style.background = color;
    swatch.style.boxShadow = `0 0 6px ${color}`;
    swatch.dataset.color = color;

    // Click to SELECT (not save yet)
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingColor = color;
      // Update visual selection
      profileColorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
    });

    profileColorPicker.appendChild(swatch);
  });

  // Add Cancel/Save buttons
  const buttons = document.createElement('div');
  buttons.className = 'color-picker-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'color-picker-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideProfileColorPicker();
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'color-picker-save';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Save the pending color
    profile.color = pendingColor;
    saveProfiles();
    updateProfileButton();
    hideProfileColorPicker();
    // Update the color dot in the dropdown directly (no reopen)
    const dot = document.querySelector(`[data-profile-id="${profileId}"] .profile-color-dot`);
    if (dot) {
      dot.style.background = pendingColor;
      dot.style.boxShadow = `0 0 6px ${pendingColor}`;
    }
  });

  buttons.appendChild(cancelBtn);
  buttons.appendChild(saveBtn);
  profileColorPicker.appendChild(buttons);

  document.body.appendChild(profileColorPicker);

  // Close on click outside (but not on picker itself)
  profileColorPickerCloseHandler = (e) => {
    if (!profileColorPicker?.contains(e.target)) {
      hideProfileColorPicker();
    }
  };
  setTimeout(() => {
    document.addEventListener('click', profileColorPickerCloseHandler);
  }, 0);
}

/**
 * Hide the color picker
 */
function hideProfileColorPicker() {
  if (profileColorPickerCloseHandler) {
    document.removeEventListener('click', profileColorPickerCloseHandler);
    profileColorPickerCloseHandler = null;
  }
  if (profileColorPicker) {
    profileColorPicker.remove();
    profileColorPicker = null;
  }
}

/**
 * Show the profile dropdown menu
 * @param {boolean} forceRefresh - If true, refresh the dropdown without toggling
 */
function showProfileDropdown(forceRefresh = false) {
  // Close other popups first (not profile dropdown itself)
  document.querySelector('.preset-menu')?.remove();
  document.querySelector('.quick-edit-popup')?.remove();
  document.querySelector('.duration-edit-popup')?.remove();
  hideProfileColorPicker();

  // If already open, either toggle or refresh
  if (profileDropdown) {
    if (forceRefresh) {
      // Refresh: close silently and continue to recreate
      hideProfileDropdown();
    } else {
      // Toggle: close and return
      hideProfileDropdown();
      return;
    }
  }

  // Position dropdown below the button
  const btnRect = els.profileBtn.getBoundingClientRect();

  // Create dropdown element
  profileDropdown = document.createElement('div');
  profileDropdown.className = 'profile-dropdown';
  profileDropdown.style.top = (btnRect.bottom + 4) + 'px';
  profileDropdown.style.right = (window.innerWidth - btnRect.right) + 'px';

  // Profile list section
  const listSection = document.createElement('div');
  listSection.className = 'profile-dropdown-section profile-list-section';

  let itemToHighlight = null;

  profiles.forEach((profile, idx) => {
    const item = document.createElement('div');
    item.className = 'profile-item' + (profile.id === activeProfileId ? ' current' : '');
    item.dataset.index = idx;
    item.dataset.profileId = profile.id;
    const color = profile.color || PROFILE_COLORS[idx % PROFILE_COLORS.length];
    const shortcutNum = idx < 9 ? (idx + 1) : '';
    item.innerHTML = `
      <div class="profile-drag-handle">
        <span class="profile-number">${shortcutNum}</span>
        <span class="profile-drag-icon">${ICONS.drag}</span>
      </div>
      <span class="profile-color-dot" style="background: ${color}; box-shadow: 0 0 6px ${color};"></span>
      <span class="profile-item-name">${escapeHtml(profile.name)}</span>
      <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    `;

    // Track item for highlight animation
    if (profile.id === highlightProfileId) {
      itemToHighlight = item;
    }

    // Color dot click handler - show color picker
    const colorDot = item.querySelector('.profile-color-dot');
    colorDot.addEventListener('click', (e) => {
      e.stopPropagation();
      showProfileColorPicker(profile.id, colorDot);
    });

    // Click to switch profile (but not if drag is active or just ended)
    item.addEventListener('click', (e) => {
      if (profileDragState.isDragging) return;
      // Ignore clicks within 100ms of drag ending (prevents accidental close)
      if (Date.now() - profileDragState.dragEndTime < 100) return;
      switchProfile(profile.id);
      hideProfileDropdown();
    });

    // Drag handling on the drag handle
    const dragHandle = item.querySelector('.profile-drag-handle');
    dragHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Get current index from DOM position (not stale closure variable)
      const currentItems = Array.from(listSection.querySelectorAll('.profile-item'));
      const currentIdx = currentItems.indexOf(item);
      if (currentIdx === -1) return;

      // Just record start position - don't activate until mouse moves 5px
      profileDragState.isDragging = true;
      profileDragState.dragActivated = false;
      profileDragState.fromIndex = currentIdx;
      profileDragState.currentSlot = currentIdx;
      profileDragState.draggedEl = item;
      profileDragState.listSection = listSection;
      profileDragState.startX = e.clientX;
      profileDragState.startY = e.clientY;

      // Register handlers fresh for each drag attempt
      profileDragMoveHandler = handleProfileDragMove;
      profileDragEndHandler = handleProfileDragEnd;
      document.addEventListener('mousemove', profileDragMoveHandler);
      document.addEventListener('mouseup', profileDragEndHandler);
    });

    listSection.appendChild(item);
  });

  // Profile drag mousemove handler - uses transforms like timers
  const handleProfileDragMove = (e) => {
    if (!profileDragState.isDragging) return;

    // Check if we should activate drag (mouse moved > 5px)
    if (!profileDragState.dragActivated) {
      const dx = e.clientX - profileDragState.startX;
      const dy = e.clientY - profileDragState.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) return; // Not moved enough yet

      // Activate drag - set up visual feedback
      profileDragState.dragActivated = true;

      const section = profileDragState.listSection;
      if (!section) return;

      const allItems = Array.from(section.querySelectorAll('.profile-item'));
      const itemRect = profileDragState.draggedEl.getBoundingClientRect();
      const firstRect = allItems[0].getBoundingClientRect();

      profileDragState.items = allItems;
      profileDragState.slotHeight = itemRect.height;
      profileDragState.baseY = firstRect.top;
      profileDragState.initialScrollTop = section.scrollTop;

      profileDragState.draggedEl.classList.add('dragging');
      section.classList.add('has-drag');

      // Add transition class to all items for smooth movement
      allItems.forEach(el => el.style.transition = 'transform 0.15s ease');
    }

    const { fromIndex, items, slotHeight, baseY, listSection, initialScrollTop } = profileDragState;
    if (!items.length) return;

    // Account for any scroll that happened since drag started
    const scrollDelta = listSection ? (listSection.scrollTop - initialScrollTop) : 0;
    const adjustedBaseY = baseY - scrollDelta;

    // Calculate which slot the mouse is over
    // No offset = immediate triggering as soon as cursor enters another slot
    const mouseY = e.clientY;
    let newSlot = Math.floor((mouseY - adjustedBaseY) / slotHeight);
    newSlot = Math.max(0, Math.min(items.length - 1, newSlot));

    if (newSlot !== profileDragState.currentSlot) {
      profileDragState.currentSlot = newSlot;

      // Apply transforms to shift items
      items.forEach((el, i) => {
        if (i === fromIndex) {
          // Dragged item stays in place visually (we move it with transforms)
          const delta = (newSlot - fromIndex) * slotHeight;
          el.style.transform = `translateY(${delta}px)`;
        } else {
          // Other items shift to make room
          let shift = 0;
          if (fromIndex < newSlot) {
            // Dragging down: items between from+1 and newSlot shift UP
            if (i > fromIndex && i <= newSlot) {
              shift = -slotHeight;
            }
          } else if (fromIndex > newSlot) {
            // Dragging up: items between newSlot and from-1 shift DOWN
            if (i >= newSlot && i < fromIndex) {
              shift = slotHeight;
            }
          }
          el.style.transform = shift ? `translateY(${shift}px)` : '';
        }
      });
    }
  };

  const handleProfileDragEnd = () => {
    if (!profileDragState.isDragging) return;

    // If drag was never activated (just a click), just reset state
    if (!profileDragState.dragActivated) {
      profileDragState.isDragging = false;
      profileDragState.dragActivated = false;
      profileDragState.dragEndTime = Date.now();
      profileDragState.fromIndex = null;
      profileDragState.currentSlot = null;
      profileDragState.draggedEl = null;
      profileDragState.items = [];
      profileDragState.listSection = null;
      profileDragState.initialScrollTop = 0;
      // Capture handlers before nulling to ensure correct removal
      const moveHandler = profileDragMoveHandler;
      const endHandler = profileDragEndHandler;
      profileDragMoveHandler = null;
      profileDragEndHandler = null;
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', endHandler);
      return;
    }

    const { fromIndex, currentSlot, items, draggedEl, listSection: section } = profileDragState;

    // Remove transitions and transforms
    items.forEach(el => {
      el.style.transition = '';
      el.style.transform = '';
    });

    draggedEl?.classList.remove('dragging');
    section?.classList.remove('has-drag');

    // Reset drag state first
    profileDragState.isDragging = false;
    profileDragState.dragActivated = false;
    profileDragState.dragEndTime = Date.now();
    profileDragState.fromIndex = null;
    profileDragState.currentSlot = null;
    profileDragState.draggedEl = null;
    profileDragState.items = [];
    profileDragState.listSection = null;
    profileDragState.initialScrollTop = 0;

    // Remove these specific handler instances before potential dropdown recreation
    const moveHandler = profileDragMoveHandler;
    const endHandler = profileDragEndHandler;
    profileDragMoveHandler = null;
    profileDragEndHandler = null;
    document.removeEventListener('mousemove', moveHandler);
    document.removeEventListener('mouseup', endHandler);

    // Commit the reorder if position changed
    if (fromIndex !== currentSlot) {
      reorderProfiles(fromIndex, currentSlot);

      // Reorder DOM elements in place (no flicker)
      if (section) {
        const profileItems = Array.from(section.querySelectorAll('.profile-item'));
        // Sort items to match new profiles order and update shortcut numbers
        profiles.forEach((profile, newIdx) => {
          const item = profileItems.find(el => el.dataset.profileId === profile.id);
          if (item) {
            section.appendChild(item); // Move to end in correct order
            // Update shortcut number in drag handle
            const numberEl = item.querySelector('.profile-number');
            if (numberEl) {
              numberEl.textContent = newIdx < 9 ? (newIdx + 1) : '';
            }
          }
        });
      }
    }
  };

  // New profile section (at top)
  const newSection = document.createElement('div');
  newSection.className = 'profile-dropdown-section';

  const newAction = document.createElement('div');
  newAction.className = 'profile-action new-profile';
  newAction.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
    New Profile
  `;
  newAction.addEventListener('click', () => {
    createNewProfile();
  });
  newSection.appendChild(newAction);

  profileDropdown.appendChild(newSection);

  // Divider
  const divider1 = document.createElement('div');
  divider1.className = 'profile-dropdown-divider';
  profileDropdown.appendChild(divider1);

  // Profile list section (scrollable)
  profileDropdown.appendChild(listSection);

  // Divider
  const divider2 = document.createElement('div');
  divider2.className = 'profile-dropdown-divider';
  profileDropdown.appendChild(divider2);

  // Actions section (rename, duplicate, delete) at bottom
  const actionsSection = document.createElement('div');
  actionsSection.className = 'profile-dropdown-section';

  // Rename action
  const renameAction = document.createElement('div');
  renameAction.className = 'profile-action';
  renameAction.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
    Rename
  `;
  renameAction.addEventListener('click', () => {
    hideProfileDropdown();
    promptRenameProfile();
  });
  actionsSection.appendChild(renameAction);

  // Duplicate action
  const duplicateAction = document.createElement('div');
  duplicateAction.className = 'profile-action';
  duplicateAction.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
    Duplicate
  `;
  duplicateAction.addEventListener('click', () => {
    hideProfileDropdown();
    duplicateProfile(activeProfileId);
  });
  actionsSection.appendChild(duplicateAction);

  // Delete action
  const deleteAction = document.createElement('div');
  const canDelete = profiles.length > 1;
  deleteAction.className = 'profile-action delete' + (canDelete ? '' : ' disabled');
  deleteAction.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
    Delete
  `;
  if (canDelete) {
    deleteAction.addEventListener('click', () => {
      hideProfileDropdown();
      deleteProfile(activeProfileId);
    });
  } else {
    deleteAction.title = 'Cannot delete the only profile';
  }
  actionsSection.appendChild(deleteAction);

  profileDropdown.appendChild(actionsSection);

  // Add to DOM
  document.body.appendChild(profileDropdown);
  els.profileBtn.classList.add('active');

  // Highlight animation for new profile
  if (itemToHighlight && highlightProfileId) {
    // Scroll to the new profile
    requestAnimationFrame(() => {
      itemToHighlight.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      // Add highlight animation class
      itemToHighlight.classList.add('profile-highlight');
      // Remove after animation completes
      setTimeout(() => {
        itemToHighlight.classList.remove('profile-highlight');
      }, 800);
    });
    highlightProfileId = null; // Clear after use
  }

  // Close on click outside (but not while dragging)
  // Store and add close handler
  profileDropdownCloseHandler = (e) => {
    // Don't close if we're dragging profiles
    if (profileDragState.isDragging) return;
    if (!profileDropdown?.contains(e.target) && e.target !== els.profileBtn && !els.profileBtn?.contains(e.target)) {
      hideProfileDropdown();
    }
  };
  setTimeout(() => document.addEventListener('click', profileDropdownCloseHandler), 0);
}

/**
 * Escape HTML entities for safe display
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Reorder profiles - move from one index to another
 */
function reorderProfiles(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= profiles.length) return;
  if (toIndex < 0 || toIndex >= profiles.length) return;

  saveUndoState(true); // Save state before reorder for undo

  // Remove from old position and insert at new position
  const [movedProfile] = profiles.splice(fromIndex, 1);
  profiles.splice(toIndex, 0, movedProfile);

  saveProfiles();
}

/**
 * Switch to a different profile
 */
function switchProfile(id) {
  // Don't switch if already on this profile
  if (id === activeProfileId) return;

  // Find the profile
  const profile = profiles.find(p => p.id === id);
  if (!profile) return;

  // Stop any running timer
  if (isRunning) {
    setRunning(false);
    timerState.startedAt = null;
    timerState.pausedAcc = 0;
    timerState.ended = false;
    timerState.overtime = false;
    timerState.overtimeStartedAt = null;
  }

  // Reset active preset index
  activePresetIndex = null;

  // Update active profile
  activeProfileId = id;
  saveProfiles();

  // Update UI
  updateProfileButton();
  renderPresetList();
  renderMessageList();

  // Hide any currently visible message and restore from new profile
  if (activeMessage) {
    window.ninja.sendMessage({ visible: false });
    updateLivePreviewMessage({ visible: false });
    activeMessage = null;
  }
  restoreActiveMessage();

  // Select first timer in new profile if available
  const presets = getActivePresets();
  if (presets.length > 0) {
    activePresetIndex = 0;
    setActiveTimerConfig(presets[0].config);
    applyConfig(presets[0].config);
  }

  // Update progress bar
  updateProgressBar();
  broadcastTimerState();

  // Show toast
  showToast(`Switched to "${profile.name}"`, 'success');
}

/**
 * Show rename popup for the current profile
 */
function promptRenameProfile() {
  const profile = getActiveProfile();
  if (!profile) return;

  // Remove any existing popup
  const existing = document.querySelector('.profile-rename-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'quick-edit-popup profile-rename-popup';

  const inputRow = document.createElement('div');
  inputRow.className = 'quick-edit-input-row';

  const label = document.createElement('label');
  label.textContent = 'Profile name:';
  label.className = 'quick-edit-label';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = profile.name;
  input.placeholder = 'Profile name';

  inputRow.append(label, input);

  const buttons = document.createElement('div');
  buttons.className = 'quick-edit-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => popup.remove();

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = () => {
    const newName = input.value.trim();
    if (!newName) {
      showToast('Profile name cannot be empty', 'error');
      return;
    }
    saveUndoState(true); // Save state before rename for undo
    profile.name = newName;
    saveProfiles();
    updateProfileButton();
    popup.remove();
    showToast('Profile renamed', 'success');
  };

  // Handle Enter key to save
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBtn.click();
    } else if (e.key === 'Escape') {
      popup.remove();
    }
  });

  buttons.append(cancelBtn, saveBtn);
  popup.append(inputRow, buttons);

  // Position popup near the profile button
  const rect = els.profileBtn.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 6}px`;
  popup.style.right = `${window.innerWidth - rect.right}px`;
  popup.style.left = 'auto';

  document.body.appendChild(popup);

  // Focus and select the input
  input.focus();
  input.select();

  // Close on click outside
  const closeHandler = (e) => {
    if (!popup.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/**
 * Duplicate a profile - shows popup to name the copy
 */
function duplicateProfile(id) {
  const profile = profiles.find(p => p.id === id);
  if (!profile) return;

  // Remove any existing popup
  const existing = document.querySelector('.profile-duplicate-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'quick-edit-popup profile-duplicate-popup';

  const inputRow = document.createElement('div');
  inputRow.className = 'quick-edit-input-row';

  const label = document.createElement('label');
  label.textContent = 'New name:';
  label.className = 'quick-edit-label';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = profile.name + ' (Copy)';
  input.placeholder = 'Profile name';

  inputRow.append(label, input);

  const buttons = document.createElement('div');
  buttons.className = 'quick-edit-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => popup.remove();

  const createBtn = document.createElement('button');
  createBtn.className = 'save-btn';
  createBtn.textContent = 'Duplicate';
  createBtn.onclick = () => {
    const newName = input.value.trim();
    if (!newName) {
      showToast('Profile name cannot be empty', 'error');
      return;
    }

    // Create the new profile
    const newProfile = {
      id: generateProfileId(),
      name: newName,
      color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
      createdAt: new Date().toISOString(),
      presets: JSON.parse(JSON.stringify(profile.presets))
    };

    saveUndoState(true); // Save state before duplicate for undo
    profiles.push(newProfile);
    saveProfiles();

    popup.remove();

    // Switch to the new profile
    switchProfile(newProfile.id);
    showToast('Profile duplicated', 'success');
  };

  // Handle Enter key to create
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      createBtn.click();
    } else if (e.key === 'Escape') {
      popup.remove();
    }
  });

  buttons.append(cancelBtn, createBtn);
  popup.append(inputRow, buttons);

  // Position popup near the profile button
  const rect = els.profileBtn.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 6}px`;
  popup.style.right = `${window.innerWidth - rect.right}px`;
  popup.style.left = 'auto';

  document.body.appendChild(popup);

  // Focus and select the input
  input.focus();
  input.select();

  // Close on click outside
  const closeHandler = (e) => {
    if (!popup.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/**
 * Delete a profile
 */
async function deleteProfile(id) {
  // Don't delete if it's the only profile
  if (profiles.length <= 1) {
    showToast('Cannot delete the only profile', 'error');
    return;
  }

  const profile = profiles.find(p => p.id === id);
  if (!profile) return;

  // Confirm deletion
  const appSettings = loadAppSettings();
  if (appSettings.confirmDelete) {
    const result = await showConfirmDialog({
      title: 'Delete Profile?',
      message: `Delete "${profile.name}" and all its timers?`,
      showDontAsk: true
    });

    if (!result.confirmed) return;

    if (result.dontAskAgain) {
      const updatedSettings = loadAppSettings();
      updatedSettings.confirmDelete = false;
      saveAppSettings(updatedSettings);
      populateAppSettingsForm();
    }
  }

  // Find the index of the profile to delete
  const idx = profiles.findIndex(p => p.id === id);
  if (idx === -1) return;

  // Save state for undo (with full profiles)
  saveUndoState(true);

  // Remove the profile
  profiles.splice(idx, 1);

  // If we deleted the active profile, switch to another one
  if (id === activeProfileId) {
    // Switch to the next profile, or the previous if this was the last
    const newIdx = Math.min(idx, profiles.length - 1);
    activeProfileId = profiles[newIdx].id;

    // Reset timer state
    setRunning(false);
    timerState.startedAt = null;
    timerState.pausedAcc = 0;
    timerState.ended = false;
    timerState.overtime = false;
    activePresetIndex = null;

    // Select first timer in new profile
    const presets = getActivePresets();
    if (presets.length > 0) {
      activePresetIndex = 0;
      setActiveTimerConfig(presets[0].config);
      applyConfig(presets[0].config);
    }
  }

  saveProfiles();
  updateProfileButton();
  renderPresetList();
  updateProgressBar();
  broadcastTimerState();
  showToast('Profile deleted (Cmd/Ctrl+Z to undo)', 'success');
}

/**
 * Create a new profile
 */
function createNewProfile() {
  // Generate unique name
  let counter = 1;
  let name = 'Profile 1';
  while (profiles.some(p => p.name === name)) {
    counter++;
    name = `Profile ${counter}`;
  }

  // Create profile with one default timer and one default message
  const defaultConfig = getDefaultTimerConfig();
  const newProfile = {
    id: generateProfileId(),
    name: name,
    color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
    createdAt: new Date().toISOString(),
    presets: [{
      name: 'Timer 1',
      config: defaultConfig
    }],
    messages: [{
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: '',
      bold: false,
      italic: false,
      uppercase: false,
      color: '#ffffff',
      visible: false
    }]
  };

  profiles.push(newProfile);
  saveProfiles();

  // Switch to the new profile
  switchProfile(newProfile.id);

  // Set highlight ID and refresh dropdown to show animation
  highlightProfileId = newProfile.id;
  showProfileDropdown(true); // Force refresh without toggle

  showToast('Profile created', 'success');
}

// ============ Presets ============

/**
 * Load presets from active profile
 * (Wrapper for backward compatibility)
 */
function loadPresets() {
  return getActivePresets();
}

/**
 * Save presets to active profile
 * (Wrapper for backward compatibility)
 */
function savePresets(list) {
  saveActivePresets(list);
}

/**
 * Toggle link between a preset and the next one
 */
function toggleLink(idx) {
  const presets = loadPresets();
  if (idx >= 0 && idx < presets.length - 1) {
    saveUndoState(); // Save state before link change for undo
    const wasLinked = presets[idx].linkedToNext;
    presets[idx].linkedToNext = !presets[idx].linkedToNext;
    savePresets(presets);

    // Toggle the class directly without re-rendering to preserve hover state
    const linkZones = els.presetList.querySelectorAll('.link-zone');
    if (linkZones[idx]) {
      const linkIcon = linkZones[idx].querySelector('.link-icon');
      if (wasLinked) {
        // Unlinking - remove the linked class
        linkZones[idx].classList.remove('linked');
        if (linkIcon) {
          linkIcon.title = 'Click to auto-start next timer when this one ends';
        }
      } else {
        // Linking - add the linked class and pulse animation
        linkZones[idx].classList.add('linked');
        linkZones[idx].classList.add('just-linked');
        if (linkIcon) {
          linkIcon.title = 'Linked: Next timer starts automatically. Click to unlink.';
        }
        setTimeout(() => {
          linkZones[idx].classList.remove('just-linked');
        }, 500);
      }
    }
  }
}

function renderPresetList() {
  const list = loadPresets();

  // Capture current progress of active row before clearing DOM
  let savedProgress = null;
  if (activePresetIndex !== null) {
    const activeRow = els.presetList.querySelector(`.preset-item[data-index="${activePresetIndex}"]`);
    if (activeRow) {
      const progressBar = activeRow.querySelector('.row-progress-bar');
      if (progressBar) {
        savedProgress = progressBar.style.width;
      }
    }
  }

  els.presetList.innerHTML = '';

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: #666; text-align: center; padding: 20px;';
    empty.textContent = 'No presets yet';
    els.presetList.appendChild(empty);
    updateTabBadges();
    return;
  }

  list.forEach((preset, idx) => {
    const row = document.createElement('div');
    const isSelected = activePresetIndex === idx;
    const isPlaying = isSelected && isRunning;
    row.className = 'preset-item' + (isPlaying ? ' selected playing' : (isSelected ? ' selected' : ''));
    row.dataset.index = idx;

    // Progress bar overlay (first child, behind content)
    const progressBar = document.createElement('div');
    progressBar.className = 'row-progress-bar';
    // Restore saved progress without transition to avoid re-animation glitch
    if (isSelected && savedProgress) {
      progressBar.style.transition = 'none';
      progressBar.style.width = savedProgress;
      // Re-enable transition after a frame
      requestAnimationFrame(() => {
        progressBar.style.transition = '';
      });
    }
    row.appendChild(progressBar);

    // Drag handle with number/hamburger icon
    const dragHandle = document.createElement('div');
    dragHandle.className = 'preset-drag-handle';

    const numberSpan = document.createElement('span');
    numberSpan.className = 'preset-number';
    numberSpan.textContent = idx + 1;

    const dragIcon = document.createElement('span');
    dragIcon.className = 'preset-drag-icon';
    dragIcon.innerHTML = ICONS.drag;

    dragHandle.append(numberSpan, dragIcon);

    // Mouse-based drag - start drag on mousedown on drag handle
    dragHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = row.getBoundingClientRect();
      dragState.grabOffsetX = e.clientX - rect.left;
      dragState.grabOffsetY = e.clientY - rect.top;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      dragState.originalHeight = rect.height;
      dragState.originalWidth = rect.width;
      dragState.isDragging = true;
      dragState.dragActivated = false;  // Don't activate until mouse moves
      dragState.fromIndex = idx;
      dragState.currentIndex = idx;
      dragState.draggedRow = row;
    });

    // Name with pencil edit icon - opens quick edit popup
    const name = document.createElement('div');
    name.className = 'preset-name';
    name.title = 'Click to edit title';
    name.onclick = (e) => {
      e.stopPropagation();
      showQuickEditPopup(idx, preset, name);
    };

    const nameText = document.createElement('span');
    nameText.className = 'preset-name-text';
    nameText.textContent = preset.name;
    nameText.title = preset.name; // Tooltip showing full title on hover

    const editIcon = document.createElement('span');
    editIcon.className = 'edit-icon';
    editIcon.innerHTML = ICONS.pencil;

    name.append(nameText, editIcon);

    // Duration container with duration text and mode indicator
    const durationContainer = document.createElement('div');
    durationContainer.className = 'preset-duration-container';

    // Duration text (clickable to edit)
    const duration = document.createElement('span');
    duration.className = 'preset-duration';
    duration.textContent = secondsToHMS(preset.config?.durationSec || 0);
    duration.style.cursor = 'pointer';
    duration.title = 'Click to edit duration';
    duration.onclick = (e) => {
      e.stopPropagation();
      showDurationEditPopup(idx, preset, duration);
    };

    durationContainer.append(duration);

    const actions = document.createElement('div');
    actions.className = 'preset-actions';

    // First button: Clock (select) or Rewind (reset) depending on selection state
    const selectResetBtn = document.createElement('button');
    selectResetBtn.type = 'button';
    selectResetBtn.className = 'icon-btn';
    if (isSelected) {
      // Selected timer shows rewind icon to reset
      selectResetBtn.innerHTML = ICONS.reset;
      selectResetBtn.title = 'Reset timer';
      selectResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        sendCommand('reset');
      });
    } else {
      // Non-selected timer shows clock icon to select
      selectResetBtn.innerHTML = ICONS.clock;
      selectResetBtn.title = 'Select timer';
      selectResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        // Select this timer without starting - reload preset at click time for fresh data
        const currentPresets = loadPresets();
        const clickedPreset = currentPresets[idx];
        if (clickedPreset) {
          clearAllRowProgressBars(); // Clear progress from previous timer
          setActiveTimerConfig(clickedPreset.config);
          applyConfig(clickedPreset.config);
          activePresetIndex = idx;
          sendCommand('reset');
          renderPresetList();

          // Notify settings window if open
          if (settingsWindowOpen) {
            window.ninja.sendSettingsLoadTimer(idx);
          }
        }
      });
    }

    // Edit button (settings icon)
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn';
    editBtn.innerHTML = ICONS.settings;
    editBtn.title = 'Edit settings';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // If settings window is open, focus it and load this timer
      if (settingsWindowOpen) {
        window.ninja.openSettingsWindow(idx);
      } else {
        openModal(idx);
      }
    });

    // Play/Pause button
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    const isActiveAndRunning = isSelected && isRunning;
    const isActiveAndPaused = isSelected && !isRunning && timerState.startedAt !== null;
    playBtn.className = isActiveAndRunning ? 'icon-btn pause-btn' : 'icon-btn play-btn';
    playBtn.innerHTML = isActiveAndRunning ? ICONS.pause : ICONS.play;
    playBtn.title = isActiveAndRunning ? 'Pause' : (isActiveAndPaused ? 'Resume' : 'Load & Start');
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Check current state at click time, not captured state from render
      const currentlyRunning = activePresetIndex === idx && isRunning;
      const currentlyPaused = activePresetIndex === idx && !isRunning && timerState.startedAt !== null;

      if (currentlyRunning) {
        // Pause the timer
        sendCommand('pause');
      } else if (currentlyPaused) {
        // Resume the paused timer (preserves seeked position)
        sendCommand('resume');
      } else {
        // Start this preset fresh - reload preset at click time to ensure fresh data
        const currentPresets = loadPresets();
        const clickedPreset = currentPresets[idx];
        if (clickedPreset) {
          clearAllRowProgressBars(); // Clear progress from previous timer
          setActiveTimerConfig(clickedPreset.config);
          applyConfig(clickedPreset.config);
          activePresetIndex = idx;
          sendCommand('start');
        }
      }
      updatePlayingRowState(); // Update button states without re-rendering
    });

    // More button (three dots)
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'icon-btn more-btn';
    moreBtn.innerHTML = ICONS.more;
    moreBtn.title = 'More options';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showPresetMenu(idx, preset, moreBtn);
    });

    actions.append(selectResetBtn, editBtn, playBtn, moreBtn);
    row.append(dragHandle, name, durationContainer, actions);
    els.presetList.appendChild(row);

    // Add link zone between timers (except after last one)
    if (idx < list.length - 1) {
      const linkZone = document.createElement('div');
      linkZone.className = 'link-zone';
      if (preset.linkedToNext) {
        linkZone.classList.add('linked');
      }

      const linkIcon = document.createElement('div');
      linkIcon.className = 'link-icon';
      linkIcon.innerHTML = ICONS.link;
      linkIcon.title = preset.linkedToNext
        ? 'Linked: Next timer starts automatically. Click to unlink.'
        : 'Click to auto-start next timer when this one ends';

      // Add click handler to both zone and icon for reliable clicking
      const handleLinkClick = (e) => {
        e.stopPropagation();
        toggleLink(idx);
      };
      linkZone.appendChild(linkIcon);
      linkZone.addEventListener('click', handleLinkClick);
      linkIcon.addEventListener('click', handleLinkClick);

      els.presetList.appendChild(linkZone);
    }
  });

  updateTabBadges();
}

// Close all popup menus and dropdowns
function closeAllPopups() {
  // Close preset menu
  document.querySelector('.preset-menu')?.remove();
  // Close quick edit popup
  document.querySelector('.quick-edit-popup')?.remove();
  // Close duration edit popup
  document.querySelector('.duration-edit-popup')?.remove();
  // Close profile color picker
  hideProfileColorPicker();
  // Close profile dropdown
  hideProfileDropdown();
}

// Dropdown menu for preset actions
function showPresetMenu(idx, preset, anchorEl) {
  // Close any other open popups first
  closeAllPopups();

  const menu = document.createElement('div');
  menu.className = 'preset-menu';

  const cloneItem = document.createElement('button');
  cloneItem.className = 'menu-item';
  cloneItem.innerHTML = `${ICONS.clone} Clone`;
  cloneItem.onclick = () => {
    saveUndoState(); // Save state before clone for undo
    const presets = loadPresets();
    presets.splice(idx + 1, 0, {
      ...preset,
      name: preset.name + ' (copy)'
    });
    savePresets(presets);
    renderPresetList();
    menu.remove();
    showToast('Preset cloned (Cmd/Ctrl+Z to undo)', 'success');
  };

  const deleteItem = document.createElement('button');
  deleteItem.className = 'menu-item delete';
  deleteItem.innerHTML = `${ICONS.delete} Delete`;

  // Disable delete if this timer is currently playing
  const isThisTimerPlaying = activePresetIndex === idx && isRunning;
  if (isThisTimerPlaying) {
    deleteItem.disabled = true;
    deleteItem.title = 'Stop the timer before deleting';
  }

  deleteItem.onclick = async () => {
    menu.remove();

    const appSettings = loadAppSettings();
    let shouldDelete = true;

    // Only show confirm dialog if setting is enabled
    if (appSettings.confirmDelete) {
      const result = await showConfirmDialog({
        title: 'Delete Timer?',
        message: `Delete "${preset.name}"?`,
        showDontAsk: true
      });

      shouldDelete = result.confirmed;

      // If user checked "Don't ask again", update settings
      if (result.confirmed && result.dontAskAgain) {
        const updatedSettings = loadAppSettings();
        updatedSettings.confirmDelete = false;
        saveAppSettings(updatedSettings);
        populateAppSettingsForm();
      }
    }

    if (shouldDelete) {
      saveUndoState(); // Save state before delete for undo
      const presets = loadPresets();
      presets.splice(idx, 1);
      savePresets(presets);
      if (editingPresetIndex === idx) {
        editingPresetIndex = null;
        els.presetName.value = '';
      }
      // Update activePresetIndex if needed
      if (activePresetIndex === idx) {
        activePresetIndex = null;
      } else if (activePresetIndex > idx) {
        activePresetIndex--;
      }
      renderPresetList();
      showToast('Timer deleted (Cmd/Ctrl+Z to undo)', 'success');
    }
  };

  menu.append(cloneItem, deleteItem);

  // Position menu near the button
  const rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;

  document.body.appendChild(menu);

  // Close menu on click outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target) && e.target !== anchorEl) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Quick edit popup for timer name
function showQuickEditPopup(idx, preset, anchorEl) {
  // Close any other open popups first
  closeAllPopups();

  const popup = document.createElement('div');
  popup.className = 'quick-edit-popup';

  const inputRow = document.createElement('div');
  inputRow.className = 'quick-edit-input-row';

  const label = document.createElement('label');
  label.textContent = 'Title:';
  label.className = 'quick-edit-label';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = preset.name;
  input.placeholder = 'Timer title';

  inputRow.append(label, input);

  const buttons = document.createElement('div');
  buttons.className = 'quick-edit-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => popup.remove();

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = () => {
    saveUndoState(); // Save state before rename for undo
    const newName = input.value.trim() || 'Timer';
    const presets = loadPresets();
    presets[idx].name = newName;
    savePresets(presets);
    renderPresetList();
    popup.remove();
  };

  buttons.append(cancelBtn, saveBtn);
  popup.append(inputRow, buttons);

  // Position popup near the anchor element
  const rect = anchorEl.getBoundingClientRect();
  popup.style.top = `${rect.bottom + 6}px`;
  popup.style.left = `${rect.left}px`;

  document.body.appendChild(popup);

  // Focus and select the input
  input.focus();
  input.select();

  // Save on Enter, cancel on Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBtn.click();
    }
    if (e.key === 'Escape') {
      popup.remove();
    }
  });

  // Close on click outside
  const closePopup = (e) => {
    if (!popup.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
      popup.remove();
      document.removeEventListener('click', closePopup);
    }
  };
  setTimeout(() => document.addEventListener('click', closePopup), 0);
}

function showDurationEditPopup(idx, preset, anchorEl) {
  // Toggle: if already open for this element, close it
  const existing = document.querySelector('.duration-edit-popup');
  const wasOpen = existing && anchorEl.classList.contains('editing');

  // Close all popups first (including this one if open)
  closeAllPopups();

  if (wasOpen) {
    anchorEl.classList.remove('editing');
    return; // Was already open, just close
  }

  // Add editing highlight
  anchorEl.classList.add('editing');
  const removeEditing = () => anchorEl.classList.remove('editing');

  const popup = document.createElement('div');
  popup.className = 'duration-edit-popup';

  // Input row with label
  const inputRow = document.createElement('div');
  inputRow.className = 'duration-edit-input-row';

  const label = document.createElement('label');
  label.textContent = 'Duration:';
  label.className = 'duration-edit-label';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'duration-edit-input';
  input.value = secondsToHMS(preset.config?.durationSec || 0);
  input.placeholder = 'HH:MM:SS';
  input.maxLength = 10;

  inputRow.append(label, input);

  // Buttons row
  const buttons = document.createElement('div');
  buttons.className = 'duration-edit-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => {
    removeEditing();
    popup.remove();
  };

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';

  const saveDuration = () => {
    const parsed = parseSmartDuration(input.value) || parseTimeValue(input.value);
    const { h, m, s } = parsed;
    const totalSec = h * 3600 + m * 60 + s;
    removeEditing();
    saveUndoState();
    const presets = loadPresets();
    presets[idx].config.durationSec = totalSec;
    savePresets(presets);
    renderPresetList();
    // Flash success on the new duration
    setTimeout(() => {
      const newDurationEl = document.querySelector(`.preset-item[data-index="${idx}"] .preset-duration`);
      if (newDurationEl) {
        newDurationEl.classList.add('save-success');
        setTimeout(() => newDurationEl.classList.remove('save-success'), 400);
      }
    }, 10);
    popup.remove();
  };

  saveBtn.onclick = saveDuration;

  buttons.append(cancelBtn, saveBtn);
  popup.append(inputRow, buttons);

  // Position popup near the anchor element
  const rect = anchorEl.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.left = `${rect.left}px`;

  document.body.appendChild(popup);

  // Smart positioning: dropdown by default, dropup if not enough space below
  const popupRect = popup.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 10;
  const spaceAbove = rect.top - 10;

  if (spaceBelow >= popupRect.height || spaceBelow >= spaceAbove) {
    popup.style.top = `${rect.bottom + 4}px`;
  } else {
    popup.style.top = `${rect.top - popupRect.height - 4}px`;
  }

  // Adjust horizontal position if off-screen
  if (popupRect.right > window.innerWidth - 10) {
    popup.style.left = `${window.innerWidth - popupRect.width - 10}px`;
  }

  // Focus and select
  input.focus();
  input.select();

  // Save on Enter, cancel on Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveDuration();
    }
    if (e.key === 'Escape') {
      removeEditing();
      popup.remove();
    }
  });

  // Close on click outside
  const closePopup = (e) => {
    if (!popup.contains(e.target) && e.target !== anchorEl) {
      removeEditing();
      popup.remove();
      document.removeEventListener('click', closePopup);
    }
  };
  setTimeout(() => document.addEventListener('click', closePopup), 0);
}

function createDefaultPreset() {
  const presets = loadPresets();
  // Don't auto-create timer for first profile (tutorial experience)
  // User must manually add their first timer

  // Auto-select first timer on startup (if any exist)
  if (presets.length > 0 && activePresetIndex === null) {
    activePresetIndex = 0;
    const firstPreset = presets[0];
    setActiveTimerConfig(firstPreset.config);
    applyConfig(firstPreset.config);
  }
}

function createDefaultMessage() {
  // Don't auto-create message for first profile (tutorial experience)
  // User must manually add their first message
  // New profiles created via createNewProfile() get a default message
}

function handleExport() {
  const appSettings = loadAppSettings();

  // Count totals across all profiles
  const totalPresets = profiles.reduce((sum, p) => sum + p.presets.length, 0);
  const totalMessages = profiles.reduce((sum, p) => sum + (p.messages || []).length, 0);

  if (profiles.length === 0 || totalPresets === 0) {
    showToast('No data to export', 'error');
    return;
  }

  // Create v3 export format with profiles
  const exportData = {
    version: 3,
    exportedAt: new Date().toISOString(),
    appSettings: appSettings,
    profiles: profiles,
    activeProfileId: activeProfileId
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ninja-timer-backup.json';
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 5000);
  const parts = [`${profiles.length} profile(s)`, `${totalPresets} timer(s)`];
  if (totalMessages > 0) parts.push(`${totalMessages} message(s)`);
  showToast(`Exported ${parts.join(', ')}`);
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file size (max 1MB)
  if (file.size > 1024 * 1024) {
    showToast('File too large (max 1MB)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    // Parse JSON first
    let rawData;
    try {
      rawData = JSON.parse(reader.result);
    } catch {
      showToast('Invalid JSON file', 'error');
      return;
    }

    // Validate and detect version
    const importData = validateExportData(rawData);

    if (!importData) {
      showToast('Invalid backup file format', 'error');
      return;
    }

    let profilesImported = 0;
    let presetsImported = 0;
    let settingsImported = false;

    // Handle v3 format (profiles)
    let messagesImported = 0;
    if (importData.version === 3 && importData.profiles) {
      // Merge imported profiles with existing
      importData.profiles.forEach(importedProfile => {
        // Check if profile with same name exists
        const existingIdx = profiles.findIndex(p => p.name === importedProfile.name);
        if (existingIdx >= 0) {
          // Merge presets and messages into existing profile
          const existing = profiles[existingIdx];
          existing.presets = [...existing.presets, ...importedProfile.presets];
          presetsImported += importedProfile.presets.length;
          // Merge messages if present
          if (importedProfile.messages && importedProfile.messages.length > 0) {
            existing.messages = [...(existing.messages || []), ...importedProfile.messages];
            messagesImported += importedProfile.messages.length;
          }
        } else {
          // Add as new profile with new ID to avoid conflicts
          const newProfile = {
            ...importedProfile,
            id: generateProfileId(),
            createdAt: new Date().toISOString(),
            messages: importedProfile.messages || []
          };
          profiles.push(newProfile);
          profilesImported++;
          presetsImported += importedProfile.presets.length;
          messagesImported += (importedProfile.messages || []).length;
        }
      });
      saveProfiles();
    }
    // Handle v2 format (presets only) - add to current profile
    else if (importData.presets && importData.presets.length > 0) {
      const existing = loadPresets();
      const merged = [...existing, ...importData.presets];
      savePresets(merged);
      presetsImported = importData.presets.length;
    }

    // Import app settings (v2 and v3)
    if ((importData.version === 2 || importData.version === 3) && importData.appSettings) {
      saveAppSettings(importData.appSettings);
      // Apply window settings immediately
      window.ninja.setAlwaysOnTop('output', importData.appSettings.outputOnTop);
      window.ninja.setAlwaysOnTop('control', importData.appSettings.controlOnTop);
      settingsImported = true;
    }

    // Build import summary
    const parts = [];
    if (profilesImported > 0) parts.push(`${profilesImported} profile(s)`);
    if (presetsImported > 0) parts.push(`${presetsImported} timer(s)`);
    if (messagesImported > 0) parts.push(`${messagesImported} message(s)`);
    if (settingsImported) parts.push('settings');

    // Show appropriate toast
    if (parts.length > 0) {
      showToast(`Imported ${parts.join(', ')}`, 'success');
    } else {
      showToast('Nothing to import', 'error');
      return;
    }

    updateProfileButton();
    renderPresetList();
    renderMessageList();
  };

  reader.onerror = () => {
    showToast('Failed to read file', 'error');
  };

  reader.readAsText(file);
  e.target.value = ''; // Reset input
}

// ============ Event Listeners ============

function setupEventListeners() {
  // Initialize time inputs with section-based navigation
  initTimeInput(els.duration);
  initTimeInput(els.defaultDuration);
  initTimeInputMS(els.warnYellowSec);
  initTimeInputMS(els.warnOrangeSec);

  // Duration control buttons - per-digit (h0, h1, h2, m1, m2, s1, s2)
  // Each button adds/subtracts its place value with proper carry-over (e.g., 59:00 + 10min = 1:09:00)
  document.querySelectorAll('.digit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const digit = btn.dataset.digit;
      const isUp = btn.classList.contains('digit-up');
      const { h, m, s } = parseTimeValue(els.duration.value);

      // Calculate total time in seconds
      let totalSeconds = h * 3600 + m * 60 + s;

      // Each digit represents a specific time value in seconds
      const digitValues = {
        h0: 100 * 3600,  // 100 hours = 360000 seconds
        h1: 10 * 3600,   // 10 hours = 36000 seconds
        h2: 1 * 3600,    // 1 hour = 3600 seconds
        m1: 10 * 60,     // 10 minutes = 600 seconds
        m2: 1 * 60,      // 1 minute = 60 seconds
        s1: 10,          // 10 seconds
        s2: 1            // 1 second
      };

      // Add or subtract the digit's value with proper carry-over
      const delta = isUp ? digitValues[digit] : -digitValues[digit];
      totalSeconds += delta;

      // Clamp to valid range (0 to 999:59:59 = 3599999 seconds)
      const maxSeconds = 999 * 3600 + 59 * 60 + 59;
      totalSeconds = Math.max(0, Math.min(maxSeconds, totalSeconds));

      // Convert back to h:m:s
      const newH = Math.floor(totalSeconds / 3600);
      const newM = Math.floor((totalSeconds % 3600) / 60);
      const newS = totalSeconds % 60;

      els.duration.value = formatTimeValue(newH, newM, newS);
      updateDurationDigitDisplay();
      updateModalPreview();
    });
  });

  // Format change - show/hide hours group
  els.format.addEventListener('change', updateDurationControlsFormat);

  // Mode change - show/hide overtime setting
  els.mode.addEventListener('change', updateOvertimeVisibility);

  // Start mode change - show/hide target time and duration fields
  if (els.startMode) {
    els.startMode.addEventListener('change', updateStartModeVisibility);
  }

  // Input change listeners (debounced) - update both live and modal preview
  const inputEls = [
    els.mode, els.startMode, els.targetTime, els.duration, els.format,
    els.fontFamily, els.fontWeight,
    els.fontColor, els.strokeWidth, els.strokeColor,
    els.shadowSize, els.shadowColor, els.bgColor,
    els.soundEnd, els.soundVolume,
    els.warnYellowSec, els.warnOrangeSec
  ];

  inputEls.forEach(el => {
    if (el) {
      el.addEventListener('input', () => {
        debouncedPreview();
        updateModalPreview();
      });
      el.addEventListener('change', () => {
        applyPreview();
        updateModalPreview();
        // Send config update to output window
        if (outputWindowReady) {
          sendCommand('config');
        }
      });
    }
  });

  // Range slider value display updates
  if (els.strokeWidth) {
    els.strokeWidth.addEventListener('input', updateRangeDisplays);
  }
  if (els.shadowSize) {
    els.shadowSize.addEventListener('input', updateRangeDisplays);
  }

  // Initialize font picker
  renderFontPicker();

  // Sound selection - show/hide volume row
  if (els.soundEnd) {
    els.soundEnd.addEventListener('change', updateVolumeRowVisibility);
    // Initialize visibility
    updateVolumeRowVisibility();
  }

  // Sound preview button
  if (els.soundPreview) {
    els.soundPreview.addEventListener('click', () => {
      const soundType = els.soundEnd.value;
      const volume = parseFloat(els.soundVolume.value) || 0.7;
      if (soundType && soundType !== 'none') {
        playSound(soundType, volume);
      }
    });
  }

  // Initialize range displays
  updateRangeDisplays();

  // Blackout button (absolute state, not toggle)
  els.blackoutBtn.addEventListener('click', () => {
    // Add transitioning stripes briefly
    els.blackoutBtn.classList.add('transitioning');
    setTimeout(() => {
      els.blackoutBtn.classList.remove('transitioning');
    }, 300);

    // Toggle local state and send ABSOLUTE state to output
    isBlackedOut = !isBlackedOut;
    els.blackoutBtn.classList.toggle('active', isBlackedOut);
    window.ninja.setBlackout(isBlackedOut);
  });

  // Flash button - uses shared FlashAnimator for font-relative glow
  els.flashBtn.addEventListener('click', () => {
    // Don't start new flash if already flashing
    if (flashAnimator?.isFlashing) return;

    // Create timestamp for sync - both windows use the same startedAt
    const flashStartedAt = Date.now();

    // Collect elements to flash: timer + ToD (if visible)
    // Message should never flash
    const elementsToFlash = [els.livePreviewTimer];
    const hasToD = els.livePreviewTimerSection?.classList.contains('with-tod');
    if (hasToD && els.livePreviewToD) {
      elementsToFlash.push(els.livePreviewToD);
    }

    // Create flash animator with shared code (font-relative glow)
    // Pass null for container so only the timer/ToD text flashes
    flashAnimator = new FlashAnimator(
      elementsToFlash,
      null,
      () => {
        // On complete - update button state and clear flash state
        els.flashBtn.classList.remove('flashing');
        flashState.active = false;
        flashState.startedAt = null;
      }
    );

    // Store flash state for broadcast
    flashState.active = true;
    flashState.startedAt = flashStartedAt;

    els.flashBtn.classList.add('flashing');
    flashAnimator.start(flashStartedAt);

    // Broadcast state immediately so output starts with same timestamp
    broadcastTimerState();
  });

  // Profile dropdown button
  els.profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showProfileDropdown();
  });

  // Output button - opens window if not open, toggles fullscreen if already open
  els.openOutput.addEventListener('click', () => {
    if (outputWindowReady) {
      window.ninja.fullscreenOutput();
    } else {
      window.ninja.openOutputWindow();
    }
  });


  // App Settings
  els.appSettingsBtn.addEventListener('click', openAppSettings);
  els.appSettingsClose.addEventListener('click', closeAppSettings);
  els.appSettingsSave.addEventListener('click', saveAppSettingsFromForm);
  els.settingsExport.addEventListener('click', handleExport);
  els.settingsImport.addEventListener('click', () => els.importFile.click());

  // Alignment toggle buttons
  if (els.alignToggle) {
    els.alignToggle.querySelectorAll('.align-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        els.alignToggle.querySelectorAll('.align-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Update live preview alignment
        applyLivePreviewAlignment();
        // Update output window alignment in real-time
        broadcastTimerState();
      });
    });
  }

  // Custom Sounds
  if (els.addCustomSound) {
    els.addCustomSound.addEventListener('click', handleAddCustomSound);
  }

  // Refresh updates button
  document.getElementById('refreshUpdates')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshUpdates');
    btn?.classList.add('spinning');
    await checkForUpdates(false);
    setTimeout(() => btn?.classList.remove('spinning'), 600);
  });
  document.getElementById('downloadUpdates').addEventListener('click', downloadUpdates);
  document.getElementById('restartApp')?.addEventListener('click', restartApp);

  // Feedback toggle buttons
  document.querySelectorAll('.feedback-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.feedback-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Send Feedback button
  document.getElementById('sendFeedback')?.addEventListener('click', () => {
    const activeToggle = document.querySelector('.feedback-toggle.active');
    const feedbackType = activeToggle?.dataset.value || 'other';
    const feedbackMessage = document.getElementById('feedbackMessage')?.value?.trim() || '';

    const typeLabels = {
      feature: 'Feature Request',
      bug: 'Bug Report',
      idea: 'General Idea',
      other: 'Feedback'
    };

    const subject = `[Ninja Timer] ${typeLabels[feedbackType] || 'Feedback'}`;
    const body = feedbackMessage || '(No message provided)';

    // Open email client with pre-filled content
    const mailtoUrl = `mailto:madebyjamstudios@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl);

    // Clear the form after sending
    document.getElementById('feedbackMessage').value = '';
  });

  // Tab navigation
  els.timersTabBtn.addEventListener('click', () => switchTab('timers'));
  els.messagesTabBtn.addEventListener('click', () => switchTab('messages'));

  // Close app settings on backdrop click
  els.appSettingsModal.addEventListener('click', (e) => {
    if (e.target === els.appSettingsModal) {
      closeAppSettings();
    }
  });

  // Keyboard shortcuts for app settings modal (Enter to save, Escape to cancel)
  document.addEventListener('keydown', (e) => {
    if (els.appSettingsModal.classList.contains('hidden')) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      saveAppSettingsFromForm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAppSettings();
    }
  });

  // Preset controls
  els.importFile.addEventListener('change', handleImport);
  els.addTimer.addEventListener('click', () => {
    if (getActiveTab() === 'messages') {
      // Add new message
      addNewMessage();
    } else {
      // Auto-create timer with defaults from app settings
      const presets = loadPresets();
      let counter = 1;
      let name = `Timer ${counter}`;
      while (presets.some(p => p.name === name)) {
        counter++;
        name = `Timer ${counter}`;
      }

      const defaultConfig = getDefaultTimerConfig();
      presets.push({ name, config: defaultConfig });
      savePresets(presets);
      renderPresetList();
      updateTabBadges();

      // Auto-scroll to show the new timer
      requestAnimationFrame(() => {
        els.presetList.scrollTop = els.presetList.scrollHeight;
      });

      // Tutorial hook - advance if on addTimer step
      onTutorialAction('addTimer');
    }
  });

  // Modal controls
  els.modalClose.addEventListener('click', closeModal);
  els.modalCancel.addEventListener('click', closeModal);
  els.modalSave.addEventListener('click', saveModal);

  // Pop-out button - open settings in separate window
  els.modalPopout?.addEventListener('click', () => {
    if (editingPresetIndex !== null) {
      window.ninja.openSettingsWindow(editingPresetIndex);
      settingsWindowTimerIndex = editingPresetIndex;
      closeModal();
    }
  });

  // Close modal on backdrop click
  els.timerModal.addEventListener('click', (e) => {
    if (e.target === els.timerModal) {
      closeModal();
    }
  });

  // Global keyboard shortcuts for settings modal (Enter to save, Escape to cancel)
  document.addEventListener('keydown', (e) => {
    if (els.timerModal.classList.contains('hidden')) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      saveModal();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  });

  // Global undo/redo shortcuts (Cmd+Z / Ctrl+Z and Cmd+Shift+Z / Ctrl+Shift+Z)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      // Don't undo/redo if in a text input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
  });

  // Global keyboard shortcuts (same as output window)
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    // Ignore if any modal is open
    if (!els.timerModal.classList.contains('hidden') ||
        !els.appSettingsModal.classList.contains('hidden') ||
        !els.confirmDialog.classList.contains('hidden')) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case ' ':
        // Space - toggle play/pause (always works, even if button has focus)
        e.preventDefault();
        // Blur any focused button to prevent it from being clicked
        if (document.activeElement?.tagName === 'BUTTON') {
          document.activeElement.blur();
        }
        if (isRunning) {
          sendCommand('pause');
        } else if (timerState.startedAt !== null) {
          sendCommand('resume');
        } else {
          sendCommand('start');
        }
        updatePlayingRowState(); // Update button states without re-rendering
        break;

      case 'r':
        // Reset (only without modifier keys to avoid conflict with Cmd+R)
        if (!e.metaKey && !e.ctrlKey) {
          sendCommand('reset');
        }
        break;

      case 'b':
        // Blackout toggle
        window.ninja.toggleBlackout();
        break;

      case '1': case '2': case '3': case '4': case '5':
      case '6': case '7': case '8': case '9':
        // Profile switching: 1-9 keys
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          const idx = parseInt(e.key) - 1;
          if (profiles[idx]) {
            switchProfile(profiles[idx].id);
          }
        }
        break;

      case 'f':
        // Flash timer (only without modifier keys)
        if (!e.metaKey && !e.ctrlKey) {
          els.flashBtn.click();
        }
        break;

      case '?':
        // Toggle keyboard shortcuts help
        toggleShortcutsModal();
        break;
    }
  });

  // Also handle ? on Shift+/ (for keyboards where ? requires shift)
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && e.shiftKey) {
      // Shift+/ = ? on most keyboards
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        toggleShortcutsModal();
      }
    }
    // Also allow Escape to close shortcuts modal
    if (e.key === 'Escape' && !els.shortcutsModal.classList.contains('hidden')) {
      els.shortcutsModal.classList.add('hidden');
    }
  });

  // Keyboard shortcuts from main process
  window.ninja.onKeyboardShortcut((shortcut) => {
    switch (shortcut) {
      case 'start':
        sendCommand('start');
        break;
      case 'pause':
        sendCommand('pause');
        break;
      case 'reset':
        sendCommand('reset');
        break;
      case 'toggle':
        if (isRunning) {
          sendCommand('pause');
        } else if (timerState.startedAt !== null) {
          // Timer is paused - resume
          sendCommand('resume');
        } else {
          // Timer hasn't started - start fresh
          sendCommand('start');
        }
        break;
      case 'blackout':
        window.ninja.toggleBlackout();
        break;
    }
  });

  // ============ OSC Command Handler ============
  window.ninja.onOSCCommand(({ address, args }) => {
    handleOSCCommand(address, args);
  });

  // Initialize OSC on startup
  initOSC();

  // OSC settings change listeners
  els.oscEnabled.addEventListener('change', updateOSCVisibility);
  els.oscFeedbackEnabled.addEventListener('change', updateOSCVisibility);

  // Output window ready notification
  window.ninja.onOutputWindowReady(() => {
    outputWindowReady = true;

    // Use activeTimerConfig (not form fields)
    const mode = activeTimerConfig.mode;
    const durationSec = activeTimerConfig.durationSec;
    const format = activeTimerConfig.format;

    // Sync current timer state to new window
    const config = { ...activeTimerConfig };
    config.timerState = {
      startedAt: timerState.startedAt,
      pausedAcc: timerState.pausedAcc,
      ended: timerState.ended,
      overtime: timerState.overtime,
      overtimeStartedAt: timerState.overtimeStartedAt
    };
    config.isRunning = isRunning;
    window.ninja.sendTimerCommand('sync', config);

    // Calculate the correct display text
    let displayText = '00:00';

    if (mode === 'tod') {
      const appSettings = loadAppSettings();
      displayText = formatTimeOfDay(appSettings.todFormat, appSettings.timezone);
    } else if (mode !== 'hidden') {
      const isCountdown = mode === 'countdown' || mode === 'countdown-tod';
      if (!isRunning && timerState.pausedAcc === 0 && timerState.startedAt === null) {
        // Timer never started - show initial duration
        const elapsed = isCountdown ? durationSec * 1000 : 0;
        displayText = formatTime(elapsed, format, isCountdown);
      } else {
        // Use whatever the live preview is showing (innerHTML to preserve HTML colons)
        displayText = els.livePreviewTimer.innerHTML || formatTime(isCountdown ? durationSec * 1000 : 0, format, isCountdown);
      }
    }

    // Send canonical state first
    broadcastTimerState();

    // Also send legacy display state for backwards compatibility
    broadcastDisplayState({
      visible: mode !== 'hidden',
      text: displayText,
      colorState: 'normal',
      color: activeTimerConfig.style.color,
      opacity: FIXED_STYLE.opacity
    });
  });

  // Output window closed notification
  window.ninja.onOutputWindowClosed(() => {
    outputWindowReady = false;
  });

  // ============ Settings Window IPC ============

  // Settings window ready notification
  window.ninja.onSettingsWindowReady(() => {
    settingsWindowOpen = true;
  });

  // Settings window closed notification
  window.ninja.onSettingsWindowClosed(() => {
    settingsWindowOpen = false;
    settingsWindowTimerIndex = null;
  });

  // Settings window requests timer data
  window.ninja.onSettingsTimerRequest((timerIndex) => {
    const presets = loadPresets();
    if (timerIndex >= 0 && timerIndex < presets.length) {
      const preset = presets[timerIndex];
      window.ninja.sendSettingsTimerData({
        index: timerIndex,
        preset: preset
      });
    }
  });

  // Settings window saves timer
  window.ninja.onSettingsTimerSave((data) => {
    if (data && data.index !== undefined && data.preset) {
      const presets = loadPresets();
      if (data.index >= 0 && data.index < presets.length) {
        // Preserve linkedToNext if it exists
        const linkedToNext = presets[data.index].linkedToNext || false;
        presets[data.index] = {
          name: data.preset.name,
          config: data.preset.config,
          linkedToNext
        };
        savePresets(presets);
        renderPresetList();

        // If editing the active timer, update live display
        if (data.index === activePresetIndex) {
          setActiveTimerConfig(data.preset.config);
          applyConfig(data.preset.config);
        }

        // Update settings window timer index
        settingsWindowTimerIndex = data.index;
      }
    }
  });

  // Settings window bounds changed - save to localStorage
  window.ninja.onSettingsWindowBounds?.((bounds) => {
    localStorage.setItem('ninja:settingsWindowBounds', JSON.stringify(bounds));
  });

  // Timer state request - output window asks for full state (on load/reload)
  window.ninja.onTimerStateRequest(() => {
    broadcastTimerState();
  });

  // Message state request - output window asks for current message (on load/reload)
  window.ninja.onMessageStateRequest(() => {
    // Check activeMessage first, then fall back to storage
    let visibleMsg = activeMessage;
    if (!visibleMsg || !visibleMsg.visible) {
      const messages = loadMessages();
      visibleMsg = messages.find(m => m.visible);
    }

    if (visibleMsg) {
      const msgData = {
        text: visibleMsg.text,
        bold: visibleMsg.bold,
        italic: visibleMsg.italic,
        uppercase: visibleMsg.uppercase,
        color: visibleMsg.color,
        visible: true
      };
      window.ninja.sendMessage(msgData);
    } else {
      window.ninja.sendMessage({ visible: false });
    }
  });

  // Blackout toggle listener (legacy - kept for backwards compatibility)
  window.ninja.onBlackoutToggle(() => {
    isBlackedOut = !isBlackedOut;
    els.blackoutBtn.classList.toggle('active', isBlackedOut);
  });
}

// ============ Drag and Drop ============

/**
 * Apply CSS transforms to reorder timers visually during drag
 * Links move with their associated timers (bottom timer owns the link)
 */
function applyDragTransforms(fromIndex, toIndex) {
  const slotHeight = dragState.slotHeight;

  // Transform the placeholder (dragged timer's original spot)
  const placeholderDelta = (toIndex - fromIndex) * slotHeight;
  if (dragState.placeholderEl) {
    dragState.placeholderEl.style.transform = `translateY(${placeholderDelta}px)`;
  }

  // Transform dragged timer's link zone (if any) - it moves with the timer
  if (dragState.draggedLinkZone) {
    dragState.draggedLinkZone.style.transform = `translateY(${placeholderDelta}px)`;
  }

  // Transform other timers and their link zones
  dragState.visibleItems.forEach((timer, i) => {
    if (i === fromIndex) return; // Skip dragged timer

    let transform = '';

    if (fromIndex < toIndex) {
      // Dragging DOWN: timers between from+1 and to shift UP
      if (i > fromIndex && i <= toIndex) {
        transform = `translateY(-${slotHeight}px)`;
      }
    } else if (fromIndex > toIndex) {
      // Dragging UP: timers between to and from-1 shift DOWN
      if (i >= toIndex && i < fromIndex) {
        transform = `translateY(${slotHeight}px)`;
      }
    }

    timer.style.transform = transform;

    // Also transform this timer's link zone (the one above it)
    const linkZone = dragState.timerLinkZoneMap.get(timer);
    if (linkZone && linkZone !== dragState.draggedLinkZone) {
      linkZone.style.transform = transform;
    }
  });
}

/**
 * Calculate target slot based on cursor Y position
 * Uses stored original positions to prevent oscillation from transforms
 */
function calculateTargetSlot(clientY) {
  const items = dragState.visibleItems;
  if (items.length === 0) return dragState.fromIndex;

  const slotHeight = dragState.slotHeight;
  const baseY = dragState.originalBaseY;

  for (let i = 0; i < items.length; i++) {
    const slotMid = baseY + i * slotHeight + slotHeight / 2;

    if (clientY < slotMid) {
      return i;
    }
  }

  return items.length - 1;
}

/**
 * Setup global mouse-based drag listeners (transform-based approach)
 */
function setupDragListeners() {
  // Update ghost position and handle drop targets on mousemove
  document.addEventListener('mousemove', (e) => {
    if (!dragState.isDragging) return;

    // Check if we should activate drag (mouse moved > 5px)
    if (!dragState.dragActivated) {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) return;  // Not moved enough yet

      // Activate drag - create ghost and placeholder
      dragState.dragActivated = true;
      const row = dragState.draggedRow;
      const fromIndex = dragState.fromIndex;

      // Collect all timer elements and link zones BEFORE any modifications
      const timers = Array.from(els.presetList.querySelectorAll('.preset-item'));
      const linkZones = Array.from(els.presetList.querySelectorAll('.link-zone'));

      dragState.visibleItems = timers;
      dragState.linkZones = linkZones;

      // Map each timer to its link zone (the one ABOVE it)
      // Link zone at index i is between timer[i] and timer[i+1], so it "belongs" to timer[i+1]
      dragState.timerLinkZoneMap = new Map();
      linkZones.forEach((zone, i) => {
        const timerBelow = timers[i + 1];
        if (timerBelow) {
          dragState.timerLinkZoneMap.set(timerBelow, zone);
        }
      });

      // Get the dragged timer's link zone (if it has one - meaning there's a timer above linked to it)
      const presets = loadPresets();
      if (fromIndex > 0) {
        dragState.draggedLinkZone = linkZones[fromIndex - 1] || null;
        dragState.hasLink = presets[fromIndex - 1]?.linkedToNext === true;
      } else {
        dragState.draggedLinkZone = null;
        dragState.hasLink = false;
      }

      // Calculate slot height (timer height + link zone height if present)
      const timerHeight = row.getBoundingClientRect().height;
      const linkZoneHeight = linkZones.length > 0 ? linkZones[0].getBoundingClientRect().height : 0;
      // Get gap from computed style
      const listStyle = window.getComputedStyle(els.presetList);
      const gap = parseFloat(listStyle.gap) || 0;
      dragState.slotHeight = timerHeight + linkZoneHeight + gap;

      // Store original base Y position (first timer's top) for stable slot calculation
      dragState.originalBaseY = timers[0].getBoundingClientRect().top;

      // Create ghost element (follows cursor - the one you're "holding")
      // If timer owns a link, include the link zone in the ghost
      let ghost;
      if (dragState.hasLink && dragState.draggedLinkZone) {
        // Create a wrapper to hold both link zone and timer
        ghost = document.createElement('div');
        ghost.className = 'drag-ghost-wrapper';
        ghost.style.display = 'flex';
        ghost.style.flexDirection = 'column';
        ghost.style.alignItems = 'stretch';

        // Clone and add the link zone
        const linkClone = dragState.draggedLinkZone.cloneNode(true);
        linkClone.style.pointerEvents = 'none';
        ghost.appendChild(linkClone);

        // Clone and add the timer (preserve state classes like selected/playing)
        const timerClone = row.cloneNode(true);
        timerClone.classList.add('drag-ghost');
        timerClone.style.margin = '0';
        timerClone.style.width = dragState.originalWidth + 'px';
        ghost.appendChild(timerClone);
      } else {
        // Clone preserves state classes (selected/playing)
        ghost = row.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.width = dragState.originalWidth + 'px';
        ghost.style.margin = '0';
      }

      ghost.style.position = 'fixed';
      ghost.style.left = (e.clientX - dragState.grabOffsetX) + 'px';
      ghost.style.top = (e.clientY - dragState.grabOffsetY) + 'px';
      ghost.style.pointerEvents = 'none';
      ghost.style.zIndex = '1000';
      ghost.style.opacity = '0.9';
      ghost.style.transform = 'scale(1.02)';
      ghost.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
      ghost.style.borderRadius = '12px';
      document.body.appendChild(ghost);
      dragState.ghostEl = ghost;

      // Turn original row into placeholder (in-place, no DOM movement)
      row.classList.add('drag-placeholder');
      row.style.opacity = '0.5';
      row.style.border = '2px dashed #555';
      row.style.borderRadius = '12px';
      dragState.placeholderEl = row;

      // Initialize current slot
      dragState.currentSlot = fromIndex;

      // Add transition class for smooth transforms
      timers.forEach(t => t.classList.add('drag-transforming'));
      linkZones.forEach(z => z.classList.add('drag-transforming'));
    }

    if (!dragState.ghostEl) return;

    // Move ghost to follow cursor exactly
    dragState.ghostEl.style.left = (e.clientX - dragState.grabOffsetX) + 'px';
    dragState.ghostEl.style.top = (e.clientY - dragState.grabOffsetY) + 'px';

    // Auto-scroll when near edges
    handleDragAutoScroll(e.clientY, els.presetList, dragState);

    // Calculate target slot based on cursor position
    const targetSlot = calculateTargetSlot(e.clientY);

    // Only update if slot changed
    if (targetSlot !== dragState.currentSlot) {
      dragState.currentSlot = targetSlot;
      applyDragTransforms(dragState.fromIndex, targetSlot);
    }
  });

  // Finish drag on mouseup
  document.addEventListener('mouseup', () => {
    if (!dragState.isDragging) return;

    // Clear auto-scroll interval
    if (dragState.autoScrollInterval) {
      clearInterval(dragState.autoScrollInterval);
      dragState.autoScrollInterval = null;
    }

    // If drag was never activated (just a click), just reset state
    if (!dragState.dragActivated) {
      dragState.isDragging = false;
      dragState.dragActivated = false;
      dragState.fromIndex = null;
      dragState.currentSlot = null;
      dragState.draggedRow = null;
      return;
    }

    // Remove ghost
    if (dragState.ghostEl) {
      dragState.ghostEl.remove();
      dragState.ghostEl = null;
    }

    // Clear all transforms and transition classes
    dragState.visibleItems.forEach(t => {
      t.style.transform = '';
      t.classList.remove('drag-transforming');
    });
    dragState.linkZones.forEach(z => {
      z.style.transform = '';
      z.classList.remove('drag-transforming');
    });

    // Reset placeholder styling
    if (dragState.placeholderEl) {
      dragState.placeholderEl.classList.remove('drag-placeholder');
      dragState.placeholderEl.style.opacity = '';
      dragState.placeholderEl.style.border = '';
      dragState.placeholderEl.style.borderRadius = '';
      dragState.placeholderEl.style.transform = '';
    }

    // Reorder if position changed
    const fromIndex = dragState.fromIndex;
    const toIndex = dragState.currentSlot;

    if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
      saveUndoState(); // Save state before reorder for undo
      const presets = loadPresets();
      const draggedTimerOwnsLink = dragState.hasLink;

      // Before reorder, capture which timer indices own links (have a timer above linking to them)
      // A timer at index i owns a link if presets[i-1].linkedToNext === true
      const linkOwners = new Set();
      for (let i = 1; i < presets.length; i++) {
        if (presets[i - 1].linkedToNext) {
          linkOwners.add(i);
        }
      }

      // Clear all linkedToNext flags - we'll recalculate after move
      presets.forEach(p => p.linkedToNext = false);

      // Remove the timer from old position
      const [moved] = presets.splice(fromIndex, 1);

      // Insert at the target slot position (no adjustment needed for transform-based approach)
      // Example: [A,B,C] drag A(0) to slot 1 → remove A → [B,C] → insert at 1 → [B,A,C] ✓
      const finalIndex = toIndex;
      presets.splice(finalIndex, 0, moved);

      // Re-establish links based on the move:
      // - If the dragged timer owned a link and is now at position > 0, link from timer above
      // - Timers that owned links but got displaced need their links updated

      // For each original link owner, find their new index and re-link if valid
      // But the dragged timer is special - it carries its link

      if (draggedTimerOwnsLink && finalIndex > 0) {
        // Dragged timer owned a link and isn't at position 0, so link to it
        presets[finalIndex - 1].linkedToNext = true;
      }

      // For other timers that owned links (not the dragged one):
      // They keep their link only if they're still at position > 0 AND the timer above them is valid
      linkOwners.forEach(originalIdx => {
        if (originalIdx === fromIndex) return; // Skip dragged timer, handled above

        // Find this timer's new index after the move
        let newIdx = originalIdx;
        if (originalIdx > fromIndex) {
          newIdx--; // Shifted up because we removed dragged timer
        }
        if (newIdx >= finalIndex) {
          newIdx++; // Shifted down because we inserted dragged timer
        }

        // If this timer is now at position 0, it can't have a link (no timer above)
        if (newIdx > 0) {
          presets[newIdx - 1].linkedToNext = true;
        }
        // If newIdx === 0, the link is lost (timer is now first)
      });

      savePresets(presets);

      // Update activePresetIndex if needed
      if (activePresetIndex === fromIndex) {
        activePresetIndex = finalIndex;
      } else if (fromIndex < activePresetIndex && finalIndex >= activePresetIndex) {
        activePresetIndex--;
      } else if (fromIndex > activePresetIndex && finalIndex <= activePresetIndex) {
        activePresetIndex++;
      }
    }

    // Reset drag state
    dragState.isDragging = false;
    dragState.dragActivated = false;
    dragState.fromIndex = null;
    dragState.currentSlot = null;
    dragState.draggedRow = null;
    dragState.visibleItems = [];
    dragState.linkZones = [];
    dragState.timerLinkZoneMap = null;
    dragState.draggedLinkZone = null;
    dragState.hasLink = false;
    dragState.slotHeight = 0;
    dragState.originalBaseY = 0;

    renderPresetList();
  });
}

/**
 * Setup message drag listeners (simpler than timers - no link zones)
 */
function setupMessageDragListeners() {
  document.addEventListener('mousemove', (e) => {
    if (!messageDragState.isDragging) return;

    // Check if we should activate drag (mouse moved > 5px)
    if (!messageDragState.dragActivated) {
      const dx = e.clientX - messageDragState.startX;
      const dy = e.clientY - messageDragState.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) return;

      // Activate drag
      messageDragState.dragActivated = true;
      const row = messageDragState.draggedRow;

      const messages = Array.from(els.messageList.querySelectorAll('.message-item'));
      messageDragState.visibleItems = messages;

      const listStyle = window.getComputedStyle(els.messageList);
      const gap = parseFloat(listStyle.gap) || 6;
      messageDragState.slotHeight = row.getBoundingClientRect().height + gap;
      messageDragState.originalBaseY = messages[0]?.getBoundingClientRect().top || 0;

      // Create ghost (preserve state classes like showing)
      const ghost = row.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.style.position = 'fixed';
      ghost.style.width = messageDragState.originalWidth + 'px';
      ghost.style.left = (e.clientX - messageDragState.grabOffsetX) + 'px';
      ghost.style.top = (e.clientY - messageDragState.grabOffsetY) + 'px';
      ghost.style.pointerEvents = 'none';
      ghost.style.zIndex = '1000';
      document.body.appendChild(ghost);
      messageDragState.ghostEl = ghost;

      // Turn original row into placeholder
      row.classList.add('drag-placeholder');
      messageDragState.placeholderEl = row;

      messages.forEach(m => m.classList.add('drag-transforming'));
    }

    if (!messageDragState.ghostEl) return;

    messageDragState.ghostEl.style.left = (e.clientX - messageDragState.grabOffsetX) + 'px';
    messageDragState.ghostEl.style.top = (e.clientY - messageDragState.grabOffsetY) + 'px';

    // Auto-scroll when near edges
    handleDragAutoScroll(e.clientY, els.messageList, messageDragState);

    const targetSlot = calculateMessageTargetSlot(e.clientY);
    if (targetSlot !== messageDragState.currentSlot) {
      messageDragState.currentSlot = targetSlot;
      applyMessageDragTransforms(messageDragState.fromIndex, targetSlot);
    }
  });

  document.addEventListener('mouseup', () => {
    if (!messageDragState.isDragging) return;

    // Clear auto-scroll interval
    if (messageDragState.autoScrollInterval) {
      clearInterval(messageDragState.autoScrollInterval);
      messageDragState.autoScrollInterval = null;
    }

    if (!messageDragState.dragActivated) {
      resetMessageDragState();
      return;
    }

    if (messageDragState.ghostEl) {
      messageDragState.ghostEl.remove();
    }

    messageDragState.visibleItems.forEach(m => {
      m.style.transform = '';
      m.classList.remove('drag-transforming');
    });

    if (messageDragState.placeholderEl) {
      messageDragState.placeholderEl.classList.remove('drag-placeholder');
    }

    const fromIndex = messageDragState.fromIndex;
    const toIndex = messageDragState.currentSlot;

    if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
      saveUndoState(); // Save state before reorder for undo
      const messages = loadMessages();
      const [moved] = messages.splice(fromIndex, 1);
      messages.splice(toIndex, 0, moved);
      saveMessagesToStorage(messages);
    }

    resetMessageDragState();
    renderMessageList();
  });
}

function resetMessageDragState() {
  messageDragState.isDragging = false;
  messageDragState.dragActivated = false;
  messageDragState.fromIndex = null;
  messageDragState.currentSlot = null;
  messageDragState.draggedRow = null;
  messageDragState.ghostEl = null;
  messageDragState.placeholderEl = null;
  messageDragState.visibleItems = [];
}

function applyMessageDragTransforms(fromIndex, toIndex) {
  const slotHeight = messageDragState.slotHeight;

  if (messageDragState.placeholderEl) {
    const delta = (toIndex - fromIndex) * slotHeight;
    messageDragState.placeholderEl.style.transform = `translateY(${delta}px)`;
  }

  messageDragState.visibleItems.forEach((item, i) => {
    if (i === fromIndex) return;

    let transform = '';
    if (fromIndex < toIndex && i > fromIndex && i <= toIndex) {
      transform = `translateY(-${slotHeight}px)`;
    } else if (fromIndex > toIndex && i >= toIndex && i < fromIndex) {
      transform = `translateY(${slotHeight}px)`;
    }
    item.style.transform = transform;
  });
}

function calculateMessageTargetSlot(clientY) {
  const items = messageDragState.visibleItems;
  if (items.length === 0) return messageDragState.fromIndex;

  const slotHeight = messageDragState.slotHeight;
  const baseY = messageDragState.originalBaseY;

  for (let i = 0; i < items.length; i++) {
    const slotMid = baseY + i * slotHeight + slotHeight / 2;
    if (clientY < slotMid) return i;
  }
  return items.length - 1;
}

// ============ Crash Recovery (Production Safety) ============

let crashRecoveryInterval = null;

/**
 * Save current timer state for crash recovery
 * Called periodically while timer is running
 */
function saveCrashRecoveryState() {
  if (!isRunning || activePresetIndex === null) {
    // Clear recovery state when timer is not active
    try {
      localStorage.removeItem(STORAGE_KEYS.CRASH_RECOVERY);
    } catch (e) {
      // Ignore storage errors
    }
    return;
  }

  try {
    const recoveryState = {
      timestamp: Date.now(),
      activePresetIndex,
      timerState: {
        startedAt: timerState.startedAt,
        pausedAcc: timerState.pausedAcc,
        ended: timerState.ended,
        overtime: timerState.overtime,
        overtimeStartedAt: timerState.overtimeStartedAt
      },
      isRunning,
      activeTimerConfig: { ...activeTimerConfig },
      profileId: getActiveProfile()?.id || null
    };
    localStorage.setItem(STORAGE_KEYS.CRASH_RECOVERY, JSON.stringify(recoveryState));
  } catch (e) {
    console.warn('[CrashRecovery] Failed to save state:', e);
  }
}

/**
 * Check for crash recovery state on startup
 * Returns recovery state if available and recent (within 24 hours)
 */
function checkCrashRecovery() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CRASH_RECOVERY);
    if (!saved) return null;

    const state = JSON.parse(saved);

    // Only offer recovery if state is recent (within 24 hours)
    const ageMs = Date.now() - state.timestamp;
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

    if (ageMs > maxAgeMs) {
      localStorage.removeItem(STORAGE_KEYS.CRASH_RECOVERY);
      return null;
    }

    return state;
  } catch (e) {
    console.warn('[CrashRecovery] Failed to check state:', e);
    return null;
  }
}

/**
 * Restore timer from crash recovery state
 */
function restoreFromCrashRecovery(state) {
  try {
    // Restore profile if different
    if (state.profileId && state.profileId !== getActiveProfile()?.id) {
      const profiles = loadProfiles();
      const targetProfile = profiles.find(p => p.id === state.profileId);
      if (targetProfile) {
        setActiveProfileId(state.profileId);
        updateProfileButton();
        renderPresetList();
      }
    }

    // Restore active preset
    if (state.activePresetIndex !== null && state.activePresetIndex !== undefined) {
      const presets = loadPresets();
      if (state.activePresetIndex < presets.length) {
        activePresetIndex = state.activePresetIndex;
        setActiveTimerConfig(presets[activePresetIndex].config);
        applyConfig(presets[activePresetIndex].config);
      }
    }

    // Restore timer state
    if (state.timerState) {
      // Calculate how much time has passed since crash
      const elapsedSinceCrash = Date.now() - state.timestamp;

      // Restore with adjusted timestamps
      timerState.pausedAcc = state.timerState.pausedAcc || 0;
      timerState.ended = state.timerState.ended || false;
      timerState.overtime = state.timerState.overtime || false;
      timerState.overtimeStartedAt = state.timerState.overtimeStartedAt;

      // Timer was running when crashed - adjust startedAt or show as paused
      if (state.isRunning) {
        // Show as paused at the last known position
        // Add the elapsed time since crash to pausedAcc
        timerState.pausedAcc += elapsedSinceCrash;
        timerState.startedAt = null;
        setRunning(false);  // Start paused, let user resume

        console.log(`[CrashRecovery] Restored timer (paused, ${Math.round(elapsedSinceCrash / 1000)}s since crash)`);
      }
    }

    // Clear the recovery state
    localStorage.removeItem(STORAGE_KEYS.CRASH_RECOVERY);

    // Update display
    renderPresetList();
    updatePlayingRowState();

    return true;
  } catch (e) {
    console.error('[CrashRecovery] Failed to restore:', e);
    localStorage.removeItem(STORAGE_KEYS.CRASH_RECOVERY);
    return false;
  }
}

/**
 * Clear crash recovery state (called on normal shutdown)
 */
function clearCrashRecoveryState() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CRASH_RECOVERY);
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Start periodic crash recovery state saving
 */
function startCrashRecoverySaving() {
  // Save state every second when timer is running
  if (crashRecoveryInterval) {
    clearInterval(crashRecoveryInterval);
  }
  crashRecoveryInterval = setInterval(saveCrashRecoveryState, 1000);
}

/**
 * Stop crash recovery state saving
 */
function stopCrashRecoverySaving() {
  if (crashRecoveryInterval) {
    clearInterval(crashRecoveryInterval);
    crashRecoveryInterval = null;
  }
}

// ============ Tutorial System ============

let tutorialStep = 0;
let tutorialActive = false;
let tutorialKeydownHandler = null;

const TUTORIAL_STEPS = [
  { type: 'modal', step: 1 }, // Welcome
  {
    type: 'spotlight',
    step: 2,
    target: '#addTimer',
    text: 'Click <strong>+ Add Timer</strong> to create your first timer',
    position: 'top',
    action: 'addTimer'
  },
  {
    type: 'spotlight',
    step: 3,
    target: null, // Will be set dynamically to play button
    text: 'Press <strong>Play</strong> or hit <kbd>Space</kbd> to start',
    position: 'top',
    action: 'playTimer'
  },
  {
    type: 'spotlight',
    step: 4,
    target: null, // Will be set dynamically to edit button
    text: 'Click <strong>Edit</strong> to customize colors and fonts',
    position: 'left',
    action: 'openEdit'
  },
  { type: 'modal', step: 5 } // Done
];

/**
 * Check if tutorial should be shown
 */
function shouldShowTutorial() {
  // Don't show if already completed
  if (localStorage.getItem(STORAGE_KEYS.TUTORIAL_COMPLETE) === 'true') {
    return false;
  }
  // Don't show if user already has content
  const profile = getActiveProfile();
  if (profile && (profile.presets.length > 0 || profile.messages.length > 0)) {
    return false;
  }
  return true;
}

/**
 * Handle keyboard events during tutorial
 */
function handleTutorialKeydown(e) {
  if (!tutorialActive) return;

  // Escape to skip/close
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    advanceTutorial(); // Skip current step
    return;
  }

  // Block app shortcuts during tutorial
  const blockedKeys = ['Space', ' ', '?', 'r', 'R', 'f', 'F', 'b', 'B'];
  if (blockedKeys.includes(e.key) ||
      (e.key >= '1' && e.key <= '9')) {
    e.preventDefault();
    e.stopPropagation();
  }
}

/**
 * Initialize tutorial event listeners
 */
function initTutorial() {
  document.getElementById('tutorialStart')?.addEventListener('click', () => {
    tutorialStep = 1;
    advanceTutorial();
  });

  document.getElementById('tutorialSkip')?.addEventListener('click', skipTutorial);
  document.getElementById('tutorialFinish')?.addEventListener('click', completeTutorial);
  document.getElementById('tutorialSkipStep')?.addEventListener('click', () => {
    advanceTutorial();
  });

  // Restart tutorial from settings
  document.getElementById('restartTutorial')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEYS.TUTORIAL_COMPLETE);
    closeAppSettings();
    showTutorial();
  });

  // Create keyboard handler for capturing during tutorial
  tutorialKeydownHandler = handleTutorialKeydown;
}

/**
 * Show tutorial (welcome modal)
 */
function showTutorial() {
  tutorialActive = true;
  tutorialStep = 0;
  const overlay = document.getElementById('tutorialOverlay');
  overlay?.classList.remove('hidden');
  overlay?.classList.add('modal-active');

  // Show step 1 (welcome modal)
  document.querySelector('.tutorial-step[data-step="1"]')?.classList.remove('hidden');
  document.querySelector('.tutorial-step[data-step="5"]')?.classList.add('hidden');
  document.getElementById('tutorialModal')?.classList.remove('hidden');

  // Add keyboard handler (capture phase to intercept before other handlers)
  document.addEventListener('keydown', tutorialKeydownHandler, true);

  // Update progress dots
  updateProgressDots();

  // Auto-focus primary button for keyboard users
  setTimeout(() => {
    document.getElementById('tutorialStart')?.focus();
  }, 100);
}

/**
 * Update progress dot states and step counter
 */
function updateProgressDots() {
  const currentVisualStep = tutorialStep + 1;

  // Update progress dots
  document.querySelectorAll('.progress-dot').forEach(dot => {
    const dotStep = parseInt(dot.dataset.step);
    dot.classList.remove('active', 'completed');

    if (dotStep < currentVisualStep) {
      dot.classList.add('completed');
    } else if (dotStep === currentVisualStep) {
      dot.classList.add('active');
    }
  });

  // Update step counter in modal
  const stepCounter = document.getElementById('tutorialStepCounter');
  if (stepCounter && currentVisualStep <= 5) {
    stepCounter.textContent = `Step ${currentVisualStep} of 5`;
  }

  // Update step counter in tooltip
  const tooltipCounter = document.getElementById('tutorialTooltipCounter');
  if (tooltipCounter && currentVisualStep <= 5) {
    tooltipCounter.textContent = `Step ${currentVisualStep} of 5`;
  }
}

/**
 * Advance to next tutorial step
 */
function advanceTutorial() {
  tutorialStep++;

  // Update progress dots
  updateProgressDots();

  if (tutorialStep >= TUTORIAL_STEPS.length) {
    completeTutorial();
    return;
  }

  const step = TUTORIAL_STEPS[tutorialStep];

  if (step.type === 'modal') {
    showTutorialModal(step.step);
    // Auto-focus finish button on final modal and show confetti
    if (step.step === 5) {
      setTimeout(() => {
        document.getElementById('tutorialFinish')?.focus();
      }, 100);
      // Trigger confetti celebration
      showTutorialConfetti();
    }
  } else if (step.type === 'spotlight') {
    showTutorialSpotlight(step);
  }
}

/**
 * Show confetti celebration effect
 */
function showTutorialConfetti() {
  const container = document.getElementById('tutorialConfetti');
  if (!container) return;

  // Clear any existing confetti
  container.innerHTML = '';
  container.classList.remove('hidden');

  // Confetti colors matching app accent colors
  const colors = ['#1f6feb', '#22c55e', '#eab308', '#E64A19', '#a855f7', '#ec4899'];

  // Create confetti pieces
  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top = '-20px';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.animationDuration = `${2 + Math.random() * 2}s`;
    container.appendChild(piece);
  }

  // Hide container after animation
  setTimeout(() => {
    container.classList.add('hidden');
    container.innerHTML = '';
  }, 4000);
}

/**
 * Show modal step (welcome or done)
 */
function showTutorialModal(stepNum) {
  const overlay = document.getElementById('tutorialOverlay');
  const modal = document.getElementById('tutorialModal');
  const spotlight = document.getElementById('tutorialSpotlight');
  const tooltip = document.getElementById('tutorialTooltip');

  overlay?.classList.add('modal-active');
  modal?.classList.remove('hidden');
  spotlight?.classList.add('hidden');
  tooltip?.classList.add('hidden');

  document.querySelectorAll('.tutorial-step').forEach(el => {
    el.classList.toggle('hidden', el.dataset.step !== String(stepNum));
  });
}

/**
 * Show spotlight step with tooltip
 */
function showTutorialSpotlight(step) {
  const overlay = document.getElementById('tutorialOverlay');
  const modal = document.getElementById('tutorialModal');
  const spotlight = document.getElementById('tutorialSpotlight');
  const tooltip = document.getElementById('tutorialTooltip');
  const tooltipText = document.getElementById('tutorialTooltipText');

  overlay?.classList.remove('modal-active');
  modal?.classList.add('hidden');
  spotlight?.classList.remove('hidden');
  tooltip?.classList.remove('hidden');

  // Find target element
  let target;
  if (step.target) {
    target = document.querySelector(step.target);
  } else if (step.action === 'playTimer') {
    // Find play button in first preset row
    target = document.querySelector('.preset-item .play-btn') ||
             document.querySelector('.preset-item .pause-btn');
  } else if (step.action === 'openEdit') {
    target = document.querySelector('.preset-item .edit-btn');
  }

  if (target) {
    positionSpotlight(target, spotlight);
    positionTooltip(target, tooltip, step.position);
  }

  if (tooltipText) {
    tooltipText.innerHTML = step.text;
  }
}

/**
 * Position spotlight around target element
 */
function positionSpotlight(target, spotlight) {
  const rect = target.getBoundingClientRect();
  const padding = 8;

  spotlight.style.left = `${rect.left - padding}px`;
  spotlight.style.top = `${rect.top - padding}px`;
  spotlight.style.width = `${rect.width + padding * 2}px`;
  spotlight.style.height = `${rect.height + padding * 2}px`;
}

/**
 * Position tooltip near target element
 */
function positionTooltip(target, tooltip, position) {
  const rect = target.getBoundingClientRect();
  const gap = 16;

  // Need to make tooltip visible first to get its dimensions
  tooltip.style.visibility = 'hidden';
  tooltip.style.display = 'block';
  const tooltipRect = tooltip.getBoundingClientRect();
  tooltip.style.visibility = '';

  tooltip.dataset.position = position;

  let left, top;

  switch (position) {
    case 'bottom':
      left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      top = rect.bottom + gap;
      break;
    case 'top':
      left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      top = rect.top - tooltipRect.height - gap;
      break;
    case 'left':
      left = rect.left - tooltipRect.width - gap;
      top = rect.top + rect.height / 2 - tooltipRect.height / 2;
      break;
    case 'right':
      left = rect.right + gap;
      top = rect.top + rect.height / 2 - tooltipRect.height / 2;
      break;
  }

  // Keep on screen
  left = Math.max(16, Math.min(left, window.innerWidth - tooltipRect.width - 16));
  top = Math.max(16, Math.min(top, window.innerHeight - tooltipRect.height - 16));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

/**
 * Show success checkmark at target location
 */
function showTutorialCheckmark(target) {
  const checkmark = document.getElementById('tutorialCheckmark');
  if (!checkmark || !target) return;

  const rect = target.getBoundingClientRect();

  // Position checkmark centered on target
  checkmark.style.left = `${rect.left + rect.width / 2 - 24}px`;
  checkmark.style.top = `${rect.top + rect.height / 2 - 24}px`;

  // Show with fresh animation
  checkmark.classList.remove('hidden');

  // Force reflow to restart animation
  const svg = checkmark.querySelector('.checkmark-svg');
  if (svg) {
    svg.style.animation = 'none';
    svg.offsetHeight; // Force reflow
    svg.style.animation = '';
  }

  // Reset and restart animations
  const circle = checkmark.querySelector('.checkmark-circle');
  const check = checkmark.querySelector('.checkmark-check');
  if (circle) {
    circle.style.animation = 'none';
    circle.offsetHeight;
    circle.style.animation = 'checkmark-circle-pop 0.4s ease-out';
  }
  if (check) {
    check.style.animation = 'none';
    check.offsetHeight;
    check.style.animation = 'checkmark-draw 0.3s ease-out 0.2s forwards';
  }

  // Hide after animation
  setTimeout(() => {
    checkmark.classList.add('hidden');
  }, 800);
}

/**
 * Tutorial action hook - call from existing functions to advance tutorial
 */
function onTutorialAction(action) {
  if (!tutorialActive) return;

  const currentStep = TUTORIAL_STEPS[tutorialStep];
  if (currentStep?.action === action) {
    // Find target element for checkmark
    let target;
    if (currentStep.target) {
      target = document.querySelector(currentStep.target);
    } else if (currentStep.action === 'playTimer') {
      target = document.querySelector('.preset-item .play-btn') ||
               document.querySelector('.preset-item .pause-btn');
    } else if (currentStep.action === 'openEdit') {
      target = document.querySelector('.preset-item .edit-btn');
    }

    // Show checkmark, then advance
    showTutorialCheckmark(target);

    // Delay advancement to show checkmark animation
    setTimeout(() => advanceTutorial(), 600);
  }
}

/**
 * Skip tutorial - pre-populate content and close
 */
function skipTutorial() {
  const profile = getActiveProfile();
  if (profile) {
    // Create sample timer
    const sampleTimer = {
      name: '10:00 Timer',
      config: { ...getDefaultTimerConfig(), durationSec: 600 },
      linkedToNext: false
    };

    // Create sample message
    const sampleMessage = {
      id: `msg-${Date.now()}`,
      text: 'BREAK TIME',
      bold: true,
      italic: false,
      uppercase: true,
      color: '#ffffff',
      visible: false
    };

    profile.presets.push(sampleTimer);
    profile.messages.push(sampleMessage);
    saveProfiles();
    renderPresetList();
    renderMessageList();
    updateTabBadges();

    // Select the new timer
    activePresetIndex = 0;
    setActiveTimerConfig(profile.presets[0].config);
    renderPresetList();
  }

  completeTutorial();
}

/**
 * Complete tutorial and clean up
 */
function completeTutorial() {
  tutorialActive = false;
  localStorage.setItem(STORAGE_KEYS.TUTORIAL_COMPLETE, 'true');

  const overlay = document.getElementById('tutorialOverlay');
  const modal = document.getElementById('tutorialModal');
  const spotlight = document.getElementById('tutorialSpotlight');
  const tooltip = document.getElementById('tutorialTooltip');
  const confetti = document.getElementById('tutorialConfetti');

  // Add fade-out animation classes
  overlay?.classList.add('fade-out');
  modal?.classList.add('fade-out');

  // Hide elements after animation completes
  setTimeout(() => {
    overlay?.classList.add('hidden');
    overlay?.classList.remove('modal-active', 'fade-out');
    modal?.classList.remove('fade-out');
    spotlight?.classList.add('hidden');
    tooltip?.classList.add('hidden');
    confetti?.classList.add('hidden');
  }, 300);

  // Remove keyboard handler
  document.removeEventListener('keydown', tutorialKeydownHandler, true);
}

// ============ Initialization ============

function init() {
  // Apple-style: blur form controls after interaction so focus ring doesn't linger
  // Applies to selects and range sliders (not text inputs - those keep focus while typing)
  document.addEventListener('change', (e) => {
    const tag = e.target.tagName;
    const type = e.target.type;
    if (tag === 'SELECT' || type === 'range') {
      e.target.blur();
    }
  });

  // Load profiles (with migration from legacy presets)
  loadProfiles();
  updateProfileButton();

  // Check for crash recovery state
  const recoveryState = checkCrashRecovery();
  if (recoveryState) {
    // Show recovery notification
    console.log('[CrashRecovery] Found recovery state from', new Date(recoveryState.timestamp).toLocaleString());
    // Attempt to restore
    const restored = restoreFromCrashRecovery(recoveryState);
    if (restored) {
      console.log('[CrashRecovery] Timer state restored successfully');
    }
  }

  // Setup collapsible sections in modal (legacy, keep for app settings)
  setupCollapsibleSections();

  // Setup settings tabs in timer modal
  setupSettingsTabs();

  // Setup preview resize
  setupPreviewResize();
  restorePreviewWidth();

  // ResizeObserver for reliable resize detection (works with window snapping)
  const previewResizeObserver = new ResizeObserver(() => {
    // Double RAF to ensure all layouts have recalculated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const containerWidth = els.previewSection.offsetWidth;
        const currentWidth = els.previewWrapper.offsetWidth;
        // Shrink preview if it exceeds available space (min 150px)
        if (currentWidth > containerWidth && containerWidth >= 150) {
          els.previewWrapper.style.width = containerWidth + 'px';
        }
        fitPreviewTimer();
        fitPreviewToD();
        fitPreviewMessage();
      });
    });
  });
  // Observe previewSection for container width changes
  if (els.previewSection) {
    previewResizeObserver.observe(els.previewSection);
  }

  // Update content-box position on scroll/resize (needed for position: fixed)
  window.addEventListener('scroll', positionPreviewContentBox, true);
  window.addEventListener('resize', positionPreviewContentBox);

  // Setup custom confirm dialog
  setupConfirmDialog();

  // Setup keyboard shortcuts modal
  setupShortcutsModal();

  // Setup global drag listeners for ghost positioning
  setupDragListeners();
  setupMessageDragListeners();

  // Apply saved window on-top settings
  const appSettings = loadAppSettings();
  window.ninja.setAlwaysOnTop('output', appSettings.outputOnTop);
  window.ninja.setAlwaysOnTop('control', appSettings.controlOnTop);

  // Apply saved theme
  applyTheme(appSettings.appearance || 'auto');

  // Load custom sounds
  loadAllCustomSounds();

  // Create default preset on first launch
  createDefaultPreset();
  createDefaultMessage();

  setupEventListeners();
  applyPreview();
  renderPresetList();
  renderMessageList();
  restoreActiveMessage(); // Restore visible message after hot reload

  // Initialize progress bar click-to-seek functionality
  initProgressBarInteractivity();

  // Start live preview render loop
  renderLivePreview();

  // Initial fit after layout settles (handles first open sizing)
  setTimeout(() => {
    fitPreviewTimer();
    fitPreviewToD();
    fitPreviewMessage();
  }, 100);

  // Start crash recovery state saving
  startCrashRecoverySaving();

  // Verify bundled fonts loaded successfully
  verifyFonts().then(result => {
    if (!result.success) {
      console.warn('[Control] Some fonts failed - using system fallbacks');
    }
  });

  // Log version
  window.ninja.getVersion().then(version => {
    const footer = document.querySelector('footer small');
    if (footer) footer.textContent = `v${version}`;
  });

  // Check for updates on startup (silent, shows badge if available)
  checkForUpdatesOnStartup();

  // Initialize onboarding tutorial
  initTutorial();
  if (shouldShowTutorial()) {
    // Small delay to let UI render first
    setTimeout(showTutorial, 200);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.ninja.signalAppReady();
    init();
  });
} else {
  window.ninja.signalAppReady();
  init();
}

// Cleanup on window close (Production Safety)
window.addEventListener('beforeunload', () => {
  // FIRST: Clear crash recovery state synchronously on normal shutdown
  // This MUST happen first before any async cleanup that could fail
  // (only crashes will retain the state for recovery)
  clearCrashRecoveryState();

  // Stop crash recovery saving
  stopCrashRecoverySaving();

  // Stop the render loop
  renderLoopActive = false;

  // Stop watchdog monitoring
  stopWatchdog();

  // Clear all tracked timers (setTimeout/setInterval)
  clearAllTimers();

  // Clear all tracked event listeners
  clearAllListeners();

  // Remove IPC listeners
  window.ninja.removeAllListeners();

  // Remove theme change listener
  themeMediaQuery.removeEventListener('change', themeChangeHandler);

  console.log('[Cleanup] Control window cleanup complete');
});

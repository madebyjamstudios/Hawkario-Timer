/**
 * Ninja Timer - Control Window
 * Main controller for timer configuration and preset management
 */

import { parseHMS, secondsToHMS, formatTime, formatTimePlain, formatTimeOfDay, hexToRgba, debounce } from '../shared/timer.js';
import { validateConfig, validatePresets, safeJSONParse, validateExportData } from '../shared/validation.js';
import { STORAGE_KEYS } from '../shared/constants.js';
import { createTimerState, FIXED_STYLE } from '../shared/timerState.js';
import { computeDisplay, getShadowCSS, FlashAnimator } from '../shared/renderTimer.js';

// DOM Elements
const els = {
  // Timer settings (in modal)
  mode: document.getElementById('mode'),
  duration: document.getElementById('duration'),
  format: document.getElementById('format'),

  // Appearance (simplified)
  fontColor: document.getElementById('fontColor'),
  strokeWidth: document.getElementById('strokeWidth'),
  strokeWidthValue: document.getElementById('strokeWidthValue'),
  strokeColor: document.getElementById('strokeColor'),
  shadowSize: document.getElementById('shadowSize'),
  shadowSizeValue: document.getElementById('shadowSizeValue'),
  shadowColor: document.getElementById('shadowColor'),
  bgColor: document.getElementById('bgColor'),

  // Sound (simplified)
  soundEndEnable: document.getElementById('soundEndEnable'),
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
  livePreviewTimer: document.getElementById('livePreviewTimer'),

  // Modal Preview
  modalPreview: document.getElementById('modalPreview'),
  modalPreviewTimer: document.getElementById('modalPreviewTimer'),

  // Controls
  blackoutBtn: document.getElementById('blackoutBtn'),
  flashBtn: document.getElementById('flashBtn'),
  openOutput: document.getElementById('openOutput'),

  // Presets
  presetName: document.getElementById('presetName'),
  presetList: document.getElementById('presetList'),
  presetListContainer: document.querySelector('.preset-list-container'),
  timerProgressContainer: document.getElementById('timerProgressContainer'),
  elapsedTime: document.getElementById('elapsedTime'),
  remainingTime: document.getElementById('remainingTime'),
  progressFill: document.getElementById('progressFill'),
  progressSegments: document.getElementById('progressSegments'),
  progressIndicator: document.getElementById('progressIndicator'),
  importFile: document.getElementById('importFile'),
  addTimer: document.getElementById('addTimer'),

  // Timer Modal
  settingsModal: document.getElementById('settingsModal'),
  modalTitle: document.getElementById('modalTitle'),
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
  confirmDelete: document.getElementById('confirmDelete'),
  defaultMode: document.getElementById('defaultMode'),
  defaultDuration: document.getElementById('defaultDuration'),
  defaultFormat: document.getElementById('defaultFormat'),
  defaultSound: document.getElementById('defaultSound'),
  outputOnTop: document.getElementById('outputOnTop'),
  controlOnTop: document.getElementById('controlOnTop'),

  // Confirm Dialog
  confirmDialog: document.getElementById('confirmDialog'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmMessage: document.getElementById('confirmMessage'),
  confirmDontAskContainer: document.getElementById('confirmDontAskContainer'),
  confirmDontAsk: document.getElementById('confirmDontAsk'),
  confirmCancel: document.getElementById('confirmCancel'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
};

// Helper functions for unified time input (HH:MM:SS)
function formatTimeValue(h, m, s) {
  const pad = n => String(Math.max(0, n)).padStart(2, '0');
  const hh = Math.min(99, Math.max(0, h));
  const mm = Math.min(59, Math.max(0, m));
  const ss = Math.min(59, Math.max(0, s));
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function parseTimeValue(val) {
  const parts = (val || '00:00:00').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const s = parseInt(parts[2], 10) || 0;
  return { h, m, s };
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

// Update duration digit value displays
function updateDurationDigitDisplay() {
  const { h, m, s } = parseTimeValue(els.duration.value);
  const digitH1 = document.getElementById('digitH1');
  const digitH2 = document.getElementById('digitH2');
  const digitM1 = document.getElementById('digitM1');
  const digitM2 = document.getElementById('digitM2');
  const digitS1 = document.getElementById('digitS1');
  const digitS2 = document.getElementById('digitS2');

  if (digitH1) digitH1.textContent = Math.floor(h / 10);
  if (digitH2) digitH2.textContent = h % 10;
  if (digitM1) digitM1.textContent = Math.floor(m / 10);
  if (digitM2) digitM2.textContent = m % 10;
  if (digitS1) digitS1.textContent = Math.floor(s / 10);
  if (digitS2) digitS2.textContent = s % 10;
}

// Show/hide hours group based on format selection
function updateDurationControlsFormat() {
  const format = els.format?.value;
  const controls = document.getElementById('durationControls');
  if (controls) {
    controls.classList.toggle('format-mmss', format === 'MM:SS');
  }
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

  // Prevent invalid paste, try to parse time from paste
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    // Try to parse as HH:MM:SS or similar
    const match = text.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const s = parseInt(match[3], 10);
      input.value = formatTimeValue(h, m, s);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // Ensure value is always valid format on blur
  input.addEventListener('blur', () => {
    const { h, m, s } = parseTimeValue(input.value);
    input.value = formatTimeValue(h, m, s);
  });
}

// State
let isRunning = false;
let outputWindowReady = false;
let editingPresetIndex = null; // Track which preset is being edited
let activePresetIndex = null; // Track which preset is currently playing

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

/**
 * Set the active timer config from a preset config
 * This is what the live preview and output display - separate from form fields
 */
function setActiveTimerConfig(config) {
  activeTimerConfig = {
    mode: config.mode || 'countdown',
    durationSec: config.durationSec || 600,
    format: config.format || 'MM:SS',
    style: {
      color: config.style?.color || '#ffffff',
      strokeWidth: config.style?.strokeWidth ?? 0,
      strokeColor: config.style?.strokeColor || '#000000',
      shadowSize: config.style?.shadowSize ?? 0,
      shadowColor: config.style?.shadowColor || '#000000',
      bgColor: config.style?.bgColor || '#000000'
    }
  };
}

// Undo stack for reverting changes
const undoStack = [];
const MAX_UNDO_STATES = 20;

/**
 * Save current presets state to undo stack
 */
function saveUndoState() {
  const presets = loadPresets();
  const state = {
    presets: JSON.parse(JSON.stringify(presets)),
    activePresetIndex: activePresetIndex
  };
  undoStack.push(state);

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

  const previousState = undoStack.pop();
  savePresets(previousState.presets);
  activePresetIndex = previousState.activePresetIndex;

  // If we have an active preset, apply its config
  if (activePresetIndex !== null && previousState.presets[activePresetIndex]) {
    const config = previousState.presets[activePresetIndex].config;
    setActiveTimerConfig(config);
    applyConfig(config);
  }

  renderPresetList();
  showToast('Undone', 'success');
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
  originalBaseY: 0       // Original Y position of first slot (before any transforms)
};

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

const DEFAULT_APP_SETTINGS = {
  todFormat: '12h',
  confirmDelete: true,
  outputOnTop: false,
  controlOnTop: false,
  defaults: {
    mode: 'countdown',
    durationSec: 600,
    format: 'MM:SS'
  }
};

function loadAppSettings() {
  try {
    const saved = localStorage.getItem(APP_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_APP_SETTINGS, ...parsed, defaults: { ...DEFAULT_APP_SETTINGS.defaults, ...parsed.defaults } };
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

function openAppSettings() {
  const settings = loadAppSettings();

  // Populate form fields
  els.todFormat.value = settings.todFormat;
  els.confirmDelete.value = settings.confirmDelete ? 'on' : 'off';
  els.defaultMode.value = settings.defaults.mode;
  setDefaultDurationInputs(settings.defaults.durationSec);
  els.defaultFormat.value = settings.defaults.format;
  els.defaultSound.value = settings.defaults.soundEnabled ? 'on' : 'off';

  // Load window stay on top settings from saved settings
  els.outputOnTop.value = settings.outputOnTop ? 'on' : 'off';
  els.controlOnTop.value = settings.controlOnTop ? 'on' : 'off';

  els.appSettingsModal.classList.remove('hidden');
}

function closeAppSettings() {
  els.appSettingsModal.classList.add('hidden');
}

function saveAppSettingsFromForm() {
  const outputOnTop = els.outputOnTop.value === 'on';
  const controlOnTop = els.controlOnTop.value === 'on';

  const settings = {
    todFormat: els.todFormat.value,
    confirmDelete: els.confirmDelete.value === 'on',
    outputOnTop: outputOnTop,
    controlOnTop: controlOnTop,
    defaults: {
      mode: els.defaultMode.value,
      durationSec: getDefaultDurationSeconds(),
      format: els.defaultFormat.value,
      soundEnabled: els.defaultSound.value === 'on'
    }
  };

  // Apply window stay on top settings to main process
  window.ninja.setAlwaysOnTop('output', outputOnTop);
  window.ninja.setAlwaysOnTop('control', controlOnTop);

  saveAppSettings(settings);
  closeAppSettings();
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
    mode: d.mode,
    durationSec: d.durationSec,
    format: d.format,
    style: {
      color: '#ffffff',
      strokeWidth: 0,
      strokeColor: '#000000',
      shadowSize: 0,
      shadowColor: '#000000',
      bgColor: '#000000'
    },
    sound: {
      endEnabled: d.soundEnabled || false,
      volume: 0.7
    }
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

// Track last rendered segment count to avoid unnecessary DOM updates
let lastSegmentCount = 0;

/**
 * Update the progress bar with elapsed/remaining time
 * Shows segments for linked timers and positions indicator accordingly
 * @param {number} currentElapsedMs - Elapsed time in current timer (milliseconds)
 * @param {number} currentTotalMs - Current timer's total duration (milliseconds)
 */
function updateProgressBar(currentElapsedMs, currentTotalMs) {
  // Show empty state when no timer is active
  if (activePresetIndex === null || (!isRunning && timerState.startedAt === null)) {
    els.progressFill.style.width = '0%';
    els.progressIndicator.style.left = '0%';
    els.elapsedTime.textContent = '00:00';
    els.remainingTime.textContent = '00:00';
    // Clear segments
    if (lastSegmentCount !== 0) {
      els.progressSegments.innerHTML = '';
      lastSegmentCount = 0;
    }
    return;
  }

  const chain = getLinkedTimerChain();

  // If no chain or single timer, use simple progress
  if (chain.length <= 1) {
    const remainingMs = Math.max(0, currentTotalMs - currentElapsedMs);
    const progressPercent = Math.min(100, (currentElapsedMs / currentTotalMs) * 100);

    els.progressFill.style.width = progressPercent + '%';
    els.progressIndicator.style.left = progressPercent + '%';
    els.elapsedTime.textContent = formatTimePlain(currentElapsedMs, 'MM:SS');
    els.remainingTime.textContent = formatTimePlain(remainingMs, 'MM:SS');

    // Clear segments for single timer
    if (lastSegmentCount !== 0) {
      els.progressSegments.innerHTML = '';
      lastSegmentCount = 0;
    }
    return;
  }

  // Calculate total duration of chain
  const totalChainMs = chain.reduce((sum, t) => sum + t.durationMs, 0);

  // Calculate cumulative elapsed time
  // Sum up all completed timers before active + current timer's elapsed
  let cumulativeElapsedMs = 0;
  let activeIndexInChain = -1;

  for (let i = 0; i < chain.length; i++) {
    if (chain[i].index === activePresetIndex) {
      activeIndexInChain = i;
      break;
    }
    // Add full duration of completed timers
    cumulativeElapsedMs += chain[i].durationMs;
  }

  // Add current timer's elapsed time
  cumulativeElapsedMs += currentElapsedMs;

  const totalRemainingMs = Math.max(0, totalChainMs - cumulativeElapsedMs);
  const progressPercent = Math.min(100, (cumulativeElapsedMs / totalChainMs) * 100);

  els.progressFill.style.width = progressPercent + '%';
  els.progressIndicator.style.left = progressPercent + '%';
  els.elapsedTime.textContent = formatTimePlain(cumulativeElapsedMs, 'MM:SS');
  els.remainingTime.textContent = formatTimePlain(totalRemainingMs, 'MM:SS');

  // Render segment dividers (only if count changed)
  if (chain.length !== lastSegmentCount) {
    els.progressSegments.innerHTML = '';

    // Add dividers between segments (not at 0% or 100%)
    let cumulativePercent = 0;
    for (let i = 0; i < chain.length - 1; i++) {
      cumulativePercent += (chain[i].durationMs / totalChainMs) * 100;

      const divider = document.createElement('div');
      divider.className = 'segment-divider';
      divider.style.left = cumulativePercent + '%';
      els.progressSegments.appendChild(divider);
    }

    lastSegmentCount = chain.length;
  }
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

/**
 * Update the playing class on preset rows without full re-render
 */
function updatePlayingRowState() {
  const rows = els.presetList.querySelectorAll('.preset-item');
  rows.forEach((row, idx) => {
    const isSelected = activePresetIndex === idx;
    const isPlaying = isSelected && isRunning;

    row.classList.toggle('selected', isSelected);
    row.classList.toggle('playing', isPlaying);
  });
}

// ============ Modal Management ============

function openModal(presetIndex = null) {
  editingPresetIndex = presetIndex;

  if (presetIndex !== null) {
    // Editing existing preset
    const presets = loadPresets();
    const preset = presets[presetIndex];
    console.log('Opening modal for preset:', preset.name, 'config:', preset.config); // Debug log
    els.modalTitle.textContent = 'Edit Timer';
    els.presetName.value = preset.name;
    applyConfig(preset.config);
  } else {
    // Creating new preset
    els.modalTitle.textContent = 'New Timer';
    const presets = loadPresets();
    let counter = 1;
    let name = `Timer ${counter}`;
    while (presets.some(p => p.name === name)) {
      counter++;
      name = `Timer ${counter}`;
    }
    els.presetName.value = name;
  }

  els.settingsModal.classList.remove('hidden');
  els.presetName.focus();
  els.presetName.select();
  updateDurationDigitDisplay();
  updateDurationControlsFormat();
  updateModalPreview();
}

function closeModal() {
  els.settingsModal.classList.add('hidden');
  editingPresetIndex = null;
}

function saveModal() {
  saveUndoState(); // Save state before changes for undo

  const name = els.presetName.value.trim() || 'Timer';
  const config = getCurrentConfig();
  console.log('Saving config:', config); // Debug log
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
  renderPresetList();
  closeModal();
}

function updateModalPreview() {
  if (!els.modalPreview || !els.modalPreviewTimer) return;

  const mode = els.mode.value;
  const format = els.format.value;
  const durationSec = getDurationSeconds();
  const shadowSize = parseInt(els.shadowSize.value, 10) || 0;
  const shadowColor = els.shadowColor.value || '#000000';

  // Apply styles (using hardcoded FIXED_STYLE + user settings)
  els.modalPreview.style.background = els.bgColor.value;
  els.modalPreviewTimer.style.fontFamily = FIXED_STYLE.fontFamily;
  els.modalPreviewTimer.style.fontWeight = FIXED_STYLE.fontWeight;
  els.modalPreviewTimer.style.color = els.fontColor.value;
  els.modalPreviewTimer.style.opacity = FIXED_STYLE.opacity;
  els.modalPreviewTimer.style.webkitTextStrokeWidth = (parseInt(els.strokeWidth.value, 10) || 0) + 'px';
  els.modalPreviewTimer.style.webkitTextStrokeColor = els.strokeColor.value;
  els.modalPreviewTimer.style.textShadow = getShadowCSS(shadowSize, shadowColor);
  els.modalPreviewTimer.style.letterSpacing = FIXED_STYLE.letterSpacing + 'em';

  // Update displayed time based on mode
  let displayText = '';
  const isCountdown = mode === 'countdown' || mode === 'countdown-tod';
  const showToD = mode === 'countdown-tod' || mode === 'countup-tod';

  if (mode === 'hidden') {
    els.modalPreviewTimer.style.visibility = 'hidden';
    return;
  } else {
    els.modalPreviewTimer.style.visibility = 'visible';
  }

  if (mode === 'tod') {
    displayText = formatTimeOfDay(loadAppSettings().todFormat);
  } else {
    displayText = formatTime(isCountdown ? durationSec * 1000 : 0, format);
    if (showToD) {
      displayText += '<br><span class="tod-line">' + formatTimeOfDay(loadAppSettings().todFormat) + '</span>';
    }
  }

  els.modalPreviewTimer.innerHTML = displayText;

  // Auto-fit text - timer-only modes get more space (0.95), ToD+timer uses 0.9
  const fitPercent = showToD ? 0.9 : 0.95;
  autoFitText(els.modalPreviewTimer, els.modalPreview, fitPercent);

  // Align duration buttons to match timer digit positions
  alignDurationButtons();
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

// ============ Preview Panel Resize ============

const PREVIEW_WIDTH_KEY = 'ninja:previewWidth';
let isResizing = false;
let startY = 0;
let startWidth = 0;

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

  // Update preview text scaling in real-time
  autoFitText(els.livePreviewTimer, els.livePreview, getAutoFitPercent());
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
  const saved = localStorage.getItem(PREVIEW_WIDTH_KEY);
  if (saved) {
    els.previewWrapper.style.width = saved + 'px';
  } else {
    // Default to maximum width on first launch
    const containerWidth = els.previewSection.offsetWidth;
    if (containerWidth > 0) {
      els.previewWrapper.style.width = containerWidth + 'px';
    }
  }
  // Apply scaling after restoring width
  requestAnimationFrame(() => autoFitText(els.livePreviewTimer, els.livePreview, getAutoFitPercent()));
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
  const targetHeight = containerHeight * 0.85; // Match viewer's 85% height
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

  // Apply widths to separators
  const separators = controls.querySelectorAll('.digit-separator');
  separators.forEach(sep => {
    sep.style.width = colonWidth + 'px';
    sep.style.fontSize = fontSize * 0.7 + 'px';
  });

  // Scale digit values to match timer
  const digitValues = controls.querySelectorAll('.digit-value');
  digitValues.forEach(val => {
    val.style.fontSize = fontSize * 0.5 + 'px';
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

  els.livePreview.style.background = els.bgColor.value;
  els.livePreviewTimer.style.fontFamily = FIXED_STYLE.fontFamily;
  els.livePreviewTimer.style.fontWeight = FIXED_STYLE.fontWeight;
  els.livePreviewTimer.style.letterSpacing = FIXED_STYLE.letterSpacing + 'em';

  // Skip styles controlled by FlashAnimator during flash
  if (!flashAnimator?.isFlashing) {
    els.livePreviewTimer.style.color = els.fontColor.value;
    els.livePreviewTimer.style.opacity = FIXED_STYLE.opacity;
    els.livePreviewTimer.style.webkitTextStrokeWidth = (parseInt(els.strokeWidth.value, 10) || 0) + 'px';
    els.livePreviewTimer.style.webkitTextStrokeColor = els.strokeColor.value;
    els.livePreviewTimer.style.textShadow = getShadowCSS(shadowSize, shadowColor);
  }

  // Font size is handled by autoFitText in renderLivePreview
}

/**
 * Broadcast canonical timer state to output window
 * Uses StageTimer-style sync: send raw timestamps, output computes display
 */
function broadcastTimerState() {
  if (!outputWindowReady) return;

  const todFormat = loadAppSettings().todFormat;

  // Increment sequence number
  stateSeq++;

  // Send canonical state - output will compute display from this
  window.ninja.sendTimerState({
    seq: stateSeq,
    mode: activeTimerConfig.mode,
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
    style: activeTimerConfig.style,
    todFormat: todFormat,
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
      fontFamily: FIXED_STYLE.fontFamily,
      fontWeight: FIXED_STYLE.fontWeight,
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
 */
function renderLivePreview() {
  // Use stored active timer config (not form fields)
  const mode = activeTimerConfig.mode;
  const durationSec = activeTimerConfig.durationSec;
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
    requestAnimationFrame(renderLivePreview);
    return;
  } else {
    els.livePreviewTimer.style.visibility = 'visible';
  }

  // Handle Time of Day only mode
  const todFormat = loadAppSettings().todFormat;
  if (mode === 'tod') {
    displayText = formatTimeOfDay(todFormat);
    els.livePreviewTimer.textContent = displayText;
    autoFitText(els.livePreviewTimer, els.livePreview, 0.95);
    // Skip color changes during flash animation
    if (!flashAnimator?.isFlashing) {
      els.livePreviewTimer.style.color = fontColor;
      els.livePreviewTimer.style.opacity = FIXED_STYLE.opacity;
    }
    els.livePreview.classList.remove('warning');

    // Update row progress bar for ToD mode (internal timer still runs)
    if (activePresetIndex !== null && isRunning && timerState.startedAt) {
      const totalMs = durationSec * 1000;
      const currentElapsedMs = Date.now() - timerState.startedAt + timerState.pausedAcc;
      const rowProgressPercent = totalMs > 0 ? Math.min(100, (currentElapsedMs / totalMs) * 100) : 0;
      updateRowProgressBar(activePresetIndex, rowProgressPercent);

      // Check if internal timer ended (for linked chain)
      if (currentElapsedMs >= totalMs && !timerState.ended) {
        timerState.ended = true;

        // Check for linked next timer
        const presets = loadPresets();
        const currentPreset = presets[activePresetIndex];

        if (currentPreset?.linkedToNext && activePresetIndex < presets.length - 1) {
          // Auto-play next linked timer
          isRunning = false;
          const nextIdx = activePresetIndex + 1;
          const nextPreset = presets[nextIdx];
          activePresetIndex = nextIdx;
          setActiveTimerConfig(nextPreset.config);
          applyConfig(nextPreset.config);

          setTimeout(() => {
            sendCommand('start');
            renderPresetList();
          }, 1000);
        }
        // Note: No overtime for ToD mode since it just shows clock
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
    requestAnimationFrame(renderLivePreview);
    return;
  }

  // Determine mode type
  const isCountdown = mode === 'countdown' || mode === 'countdown-tod';
  const isCountup = mode === 'countup' || mode === 'countup-tod';
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
      elapsed = timerState.pausedAcc;
      remainingSec = Math.floor(elapsed / 1000);
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

        // Check for linked next timer
        const presets = loadPresets();
        const currentPreset = presets[activePresetIndex];

        if (currentPreset?.linkedToNext && activePresetIndex < presets.length - 1) {
          // Auto-play next linked timer after short delay
          isRunning = false;
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
          // Start overtime mode - keep running but count up
          timerState.overtime = true;
          timerState.overtimeStartedAt = Date.now();
          renderPresetList(); // Update button states
        }
      }
    } else if (isCountup) {
      // Count up mode
      elapsed = base;
      remainingSec = Math.floor(elapsed / 1000);
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

  if (showToD) {
    displayText += '<br><span class="tod-line">' + formatTimeOfDay(todFormat) + '</span>';
  }

  // Update display (use innerHTML for ToD line breaks)
  els.livePreviewTimer.innerHTML = displayText;
  // Timer-only modes get more space (0.95), ToD+timer uses 0.9
  const fitPercent = showToD ? 0.9 : 0.95;
  autoFitText(els.livePreviewTimer, els.livePreview, fitPercent);

  // Update progress bar
  if (isCountdown) {
    const totalMs = durationSec * 1000;
    const elapsedMs = totalMs - elapsed;
    updateProgressBar(elapsedMs, totalMs);
  } else if (isCountup) {
    // For countup, show elapsed time with no max
    els.progressFill.style.width = '0%';
    els.elapsedTime.textContent = formatTimePlain(elapsed, 'MM:SS');
    els.remainingTime.textContent = '--:--';
  } else {
    // Reset for other modes
    els.progressFill.style.width = '0%';
    els.elapsedTime.textContent = '00:00';
    els.remainingTime.textContent = '00:00';
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

  // Determine warning/overtime color
  let timerColor = fontColor;
  let colorState = 'normal';

  if (timerState.overtime) {
    timerColor = '#dc2626'; // Red for overtime
    colorState = 'overtime';
  } else if (isCountdown && remainingSec <= warnOrangeSec && remainingSec > 0) {
    timerColor = '#E64A19'; // Orange for critical warning
    colorState = 'warning-orange';
  } else if (isCountdown && remainingSec <= warnYellowSec) {
    timerColor = '#eab308'; // Yellow for warning
    colorState = 'warning-yellow';
  }

  // Color states (skip during flash animation - let FlashAnimator control styles)
  if (!flashAnimator?.isFlashing) {
    els.livePreviewTimer.style.color = timerColor;
    els.livePreviewTimer.style.opacity = FIXED_STYLE.opacity;
    els.livePreview.classList.toggle('overtime', timerState.overtime);
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
    overtime: timerState.overtime,
    elapsed: els.elapsedTime?.textContent || '',
    remaining: els.remainingTime?.textContent || ''
  });

  requestAnimationFrame(renderLivePreview);
}

// ============ Configuration ============

function getCurrentConfig() {
  return {
    mode: els.mode.value,
    durationSec: getDurationSeconds(),
    format: els.format.value,
    style: {
      color: els.fontColor.value,
      strokeWidth: parseInt(els.strokeWidth.value, 10) || 0,
      strokeColor: els.strokeColor.value,
      shadowSize: parseInt(els.shadowSize.value, 10) || 0,
      shadowColor: els.shadowColor.value,
      bgColor: els.bgColor.value
    },
    sound: {
      endEnabled: els.soundEndEnable.value === 'on',
      volume: parseFloat(els.soundVolume.value) || 0.7
    },
    // Warning thresholds (seconds remaining) - from MM:SS inputs
    warnYellowSec: getMSSeconds(els.warnYellowSec) || 60,
    warnOrangeSec: getMSSeconds(els.warnOrangeSec) || 15
  };
}

function applyConfig(config) {
  if (!config) return;
  console.log('Applying config, mode:', config.mode); // Debug log

  els.mode.value = config.mode || 'countdown';
  setDurationInputs(config.durationSec || 1200);
  els.format.value = config.format || 'MM:SS';

  if (config.style) {
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
    els.soundEndEnable.value = config.sound.endEnabled ? 'on' : 'off';
    els.soundVolume.value = config.sound.volume ?? 0.7;
    // Update volume row visibility
    updateVolumeRowVisibility();
  }

  // Warning thresholds - set as MM:SS
  setMSInput(els.warnYellowSec, config.warnYellowSec ?? 60);
  setMSInput(els.warnOrangeSec, config.warnOrangeSec ?? 15);

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
 * Update volume row visibility based on sound enabled state
 */
function updateVolumeRowVisibility() {
  if (els.volumeRow) {
    els.volumeRow.style.display = els.soundEndEnable.value === 'on' ? 'flex' : 'none';
  }
}

// ============ Timer Commands ============

function sendCommand(command) {
  // Use activeTimerConfig instead of form fields
  window.ninja.sendTimerCommand(command, activeTimerConfig);

  // Update local timer state for live preview
  switch (command) {
    case 'start':
      isRunning = true;
      timerState.startedAt = Date.now();
      timerState.pausedAcc = 0;
      timerState.ended = false;
      timerState.overtime = false;
      timerState.overtimeStartedAt = null;
      break;

    case 'pause':
      if (isRunning) {
        isRunning = false;
        timerState.pausedAcc += Date.now() - timerState.startedAt;
      }
      break;

    case 'resume':
      // Resume from paused state without resetting
      isRunning = true;
      timerState.startedAt = Date.now();
      // Keep pausedAcc as is - it contains the elapsed time
      break;

    case 'reset':
      isRunning = false;
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

}

// ============ Presets ============

function loadPresets() {
  try {
    // Check for presets in current key
    let data = localStorage.getItem(STORAGE_KEYS.PRESETS);
    console.log('Loading presets from localStorage:', data); // Debug log

    // Migration: check for old key from first version
    if (!data) {
      const oldKey = 'hawktimer-pro-presets-v1';
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        // Migrate old presets to new key
        localStorage.setItem(STORAGE_KEYS.PRESETS, oldData);
        localStorage.removeItem(oldKey); // Clean up old key
        data = oldData;
        showToast('Migrated presets from previous version', 'success');
      }
    }

    return data ? validatePresets(JSON.parse(data)) : [];
  } catch {
    return [];
  }
}

function savePresets(list) {
  try {
    console.log('Saving presets to localStorage:', JSON.stringify(list)); // Debug log
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(list));
  } catch (e) {
    showToast('Failed to save presets', 'error');
    console.error('Failed to save presets:', e);
  }
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
      if (wasLinked) {
        // Unlinking - remove the linked class
        linkZones[idx].classList.remove('linked');
      } else {
        // Linking - add the linked class and pulse animation
        linkZones[idx].classList.add('linked');
        linkZones[idx].classList.add('just-linked');
        setTimeout(() => {
          linkZones[idx].classList.remove('just-linked');
        }, 500);
      }
    }
  }
}

function renderPresetList() {
  const list = loadPresets();
  els.presetList.innerHTML = '';

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color: #666; text-align: center; padding: 20px;';
    empty.textContent = 'No presets yet';
    els.presetList.appendChild(empty);
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

    // Duration display
    const duration = document.createElement('div');
    duration.className = 'preset-duration';
    duration.textContent = secondsToHMS(preset.config?.durationSec || 0);

    const actions = document.createElement('div');
    actions.className = 'preset-actions';

    // First button: Clock (select) or Rewind (reset) depending on selection state
    const selectResetBtn = document.createElement('button');
    selectResetBtn.className = 'icon-btn';
    if (isSelected) {
      // Selected timer shows rewind icon to reset
      selectResetBtn.innerHTML = ICONS.reset;
      selectResetBtn.title = 'Reset timer';
      selectResetBtn.onclick = (e) => {
        e.stopPropagation();
        sendCommand('reset');
      };
    } else {
      // Non-selected timer shows clock icon to select
      selectResetBtn.innerHTML = ICONS.clock;
      selectResetBtn.title = 'Select timer';
      selectResetBtn.onclick = (e) => {
        e.stopPropagation();
        // Select this timer without starting
        setActiveTimerConfig(preset.config);
        applyConfig(preset.config);
        activePresetIndex = idx;
        sendCommand('reset');
        renderPresetList();
      };
    }

    // Edit button (settings icon)
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.innerHTML = ICONS.settings;
    editBtn.title = 'Edit settings';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openModal(idx);
    };

    // Play/Pause button
    const playBtn = document.createElement('button');
    const isActiveAndRunning = isSelected && isRunning;
    const isActiveAndPaused = isSelected && !isRunning && timerState.startedAt !== null;
    playBtn.className = isActiveAndRunning ? 'icon-btn pause-btn' : 'icon-btn play-btn';
    playBtn.innerHTML = isActiveAndRunning ? ICONS.pause : ICONS.play;
    playBtn.title = isActiveAndRunning ? 'Pause' : (isActiveAndPaused ? 'Resume' : 'Load & Start');
    playBtn.onclick = (e) => {
      e.stopPropagation();
      if (isActiveAndRunning) {
        // Pause the timer
        sendCommand('pause');
      } else if (isActiveAndPaused) {
        // Resume the paused timer
        sendCommand('resume');
      } else {
        // Start this preset fresh
        setActiveTimerConfig(preset.config);
        applyConfig(preset.config);
        activePresetIndex = idx;
        sendCommand('start');
      }
      renderPresetList(); // Re-render to update button states
    };

    // More button (three dots)
    const moreBtn = document.createElement('button');
    moreBtn.className = 'icon-btn more-btn';
    moreBtn.innerHTML = ICONS.more;
    moreBtn.title = 'More options';
    moreBtn.onclick = (e) => {
      e.stopPropagation();
      showPresetMenu(idx, preset, moreBtn);
    };

    actions.append(selectResetBtn, editBtn, playBtn, moreBtn);
    row.append(dragHandle, name, duration, actions);
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
}

// Dropdown menu for preset actions
function showPresetMenu(idx, preset, anchorEl) {
  // Remove any existing menu
  const existing = document.querySelector('.preset-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'preset-menu';

  const cloneItem = document.createElement('button');
  cloneItem.className = 'menu-item';
  cloneItem.innerHTML = `${ICONS.clone} Clone`;
  cloneItem.onclick = () => {
    const presets = loadPresets();
    presets.splice(idx + 1, 0, {
      ...preset,
      name: preset.name + ' (copy)'
    });
    savePresets(presets);
    renderPresetList();
    menu.remove();
    showToast('Preset cloned');
  };

  const deleteItem = document.createElement('button');
  deleteItem.className = 'menu-item delete';
  deleteItem.innerHTML = `${ICONS.delete} Delete`;
  deleteItem.onclick = async () => {
    menu.remove();

    const appSettings = loadAppSettings();
    let shouldDelete = true;

    // Only show confirm dialog if setting is enabled
    if (appSettings.confirmDelete) {
      const result = await showConfirmDialog({
        title: 'Delete Timer?',
        message: `Delete "${preset.name}"? This action cannot be undone.`,
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
  // Remove any existing popup
  const existing = document.querySelector('.quick-edit-popup');
  if (existing) existing.remove();

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

function createDefaultPreset() {
  const presets = loadPresets();
  if (presets.length === 0) {
    const defaultConfig = getDefaultTimerConfig();

    presets.push({
      name: 'Timer 1',
      config: defaultConfig
    });
    savePresets(presets);
  }

  // Auto-select first timer on startup
  if (presets.length > 0 && activePresetIndex === null) {
    activePresetIndex = 0;
    const firstPreset = presets[0];
    setActiveTimerConfig(firstPreset.config);
    applyConfig(firstPreset.config);
  }
}

function handleExport() {
  const presets = loadPresets();
  const appSettings = loadAppSettings();

  if (presets.length === 0) {
    showToast('No presets to export', 'error');
    return;
  }

  // Create v2 export format with app settings and presets
  const exportData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    appSettings: appSettings,
    presets: presets
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
  showToast(`Exported ${presets.length} preset(s) + settings`);
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

    // Import presets (merge with existing)
    let presetsImported = 0;
    if (importData.presets && importData.presets.length > 0) {
      const existing = loadPresets();
      const merged = [...existing, ...importData.presets];
      savePresets(merged);
      presetsImported = importData.presets.length;
    }

    // Import app settings (v2 only)
    let settingsImported = false;
    if (importData.version === 2 && importData.appSettings) {
      saveAppSettings(importData.appSettings);
      // Apply window settings immediately
      window.ninja.setAlwaysOnTop('output', importData.appSettings.outputOnTop);
      window.ninja.setAlwaysOnTop('control', importData.appSettings.controlOnTop);
      settingsImported = true;
    }

    // Show appropriate toast
    if (presetsImported > 0 && settingsImported) {
      showToast(`Imported ${presetsImported} preset(s) + settings`, 'success');
    } else if (presetsImported > 0) {
      showToast(`Imported ${presetsImported} preset(s)`, 'success');
    } else if (settingsImported) {
      showToast('Imported settings', 'success');
    } else {
      showToast('Nothing to import', 'error');
      return;
    }

    renderPresetList();
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
  initTimeInput(els.defaultDuration);
  initTimeInputMS(els.warnYellowSec);
  initTimeInputMS(els.warnOrangeSec);

  // Duration control buttons - per-digit (h1, h2, m1, m2, s1, s2)
  document.querySelectorAll('.digit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const digit = btn.dataset.digit;
      const isUp = btn.classList.contains('digit-up');
      const { h, m, s } = parseTimeValue(els.duration.value);

      // Split into individual digits
      let h1 = Math.floor(h / 10), h2 = h % 10;
      let m1 = Math.floor(m / 10), m2 = m % 10;
      let s1 = Math.floor(s / 10), s2 = s % 10;

      // Increment/decrement the specific digit
      const delta = isUp ? 1 : -1;
      switch (digit) {
        case 'h1': h1 = (h1 + delta + 10) % 10; break;
        case 'h2': h2 = (h2 + delta + 10) % 10; break;
        case 'm1': m1 = (m1 + delta + 6) % 6; break;  // 0-5 for tens of minutes
        case 'm2': m2 = (m2 + delta + 10) % 10; break;
        case 's1': s1 = (s1 + delta + 6) % 6; break;  // 0-5 for tens of seconds
        case 's2': s2 = (s2 + delta + 10) % 10; break;
      }

      // Rebuild duration values
      const newH = h1 * 10 + h2;
      const newM = m1 * 10 + m2;
      const newS = s1 * 10 + s2;

      els.duration.value = formatTimeValue(newH, newM, newS);
      updateDurationDigitDisplay();
      updateModalPreview();
    });
  });

  // Format change - show/hide hours group
  els.format.addEventListener('change', updateDurationControlsFormat);

  // Input change listeners (debounced) - update both live and modal preview
  const inputEls = [
    els.mode, els.duration, els.format,
    els.fontColor, els.strokeWidth, els.strokeColor,
    els.shadowSize, els.shadowColor, els.bgColor,
    els.soundEndEnable, els.soundVolume,
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

  // Sound enable toggle - show/hide volume row
  if (els.soundEndEnable) {
    els.soundEndEnable.addEventListener('change', updateVolumeRowVisibility);
    // Initialize visibility
    updateVolumeRowVisibility();
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

    // Create flash animator with shared code (font-relative glow)
    // Pass null for container so only the timer text flashes, not the whole control window
    flashAnimator = new FlashAnimator(
      els.livePreviewTimer,
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

  // Check for updates
  document.getElementById('checkUpdates').addEventListener('click', async () => {
    const statusEl = document.getElementById('updateStatus');
    statusEl.textContent = 'Checking...';

    try {
      const result = await window.ninja.checkForUpdates();

      if (result.error) {
        statusEl.textContent = result.error;
      } else if (result.updateAvailable) {
        statusEl.innerHTML = `Update available: v${result.latestVersion} <a href="${result.downloadUrl}" target="_blank">Download</a>`;
      } else {
        statusEl.textContent = `You're up to date (v${result.currentVersion})`;
      }
    } catch (e) {
      console.error('Failed to check for updates:', e);
      statusEl.textContent = 'Failed to check for updates';
    }
  });

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

    // Auto-scroll to show the new timer
    requestAnimationFrame(() => {
      els.presetList.scrollTop = els.presetList.scrollHeight;
    });
  });

  // Modal controls
  els.modalClose.addEventListener('click', closeModal);
  els.modalCancel.addEventListener('click', closeModal);
  els.modalSave.addEventListener('click', saveModal);

  // Close modal on backdrop click
  els.settingsModal.addEventListener('click', (e) => {
    if (e.target === els.settingsModal) {
      closeModal();
    }
  });

  // Global keyboard shortcuts for settings modal (Enter to save, Escape to cancel)
  document.addEventListener('keydown', (e) => {
    if (els.settingsModal.classList.contains('hidden')) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      saveModal();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  });

  // Global undo shortcut (Cmd+Z / Ctrl+Z)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      // Don't undo if in a text input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      undo();
    }
  });

  // Global keyboard shortcuts (same as output window)
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    // Ignore if any modal is open
    if (!els.settingsModal.classList.contains('hidden') ||
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
      displayText = formatTimeOfDay(loadAppSettings().todFormat);
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

  // Timer state request - output window asks for full state (on load/reload)
  window.ninja.onTimerStateRequest(() => {
    broadcastTimerState();
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

        // Clone and add the timer
        const timerClone = row.cloneNode(true);
        timerClone.className = 'preset-item';
        timerClone.style.margin = '0';
        timerClone.style.width = dragState.originalWidth + 'px';
        ghost.appendChild(timerClone);
      } else {
        ghost = row.cloneNode(true);
        ghost.className = 'preset-item drag-ghost';
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

// ============ Initialization ============

function init() {
  // Setup collapsible sections in modal
  setupCollapsibleSections();

  // Setup preview resize
  setupPreviewResize();
  restorePreviewWidth();

  // Setup custom confirm dialog
  setupConfirmDialog();

  // Setup global drag listeners for ghost positioning
  setupDragListeners();

  // Apply saved window on-top settings
  const appSettings = loadAppSettings();
  window.ninja.setAlwaysOnTop('output', appSettings.outputOnTop);
  window.ninja.setAlwaysOnTop('control', appSettings.controlOnTop);

  // Create default preset on first launch
  createDefaultPreset();

  setupEventListeners();
  applyPreview();
  renderPresetList();

  // Start live preview render loop
  renderLivePreview();

  // Log version
  window.ninja.getVersion().then(version => {
    const footer = document.querySelector('footer small');
    if (footer) footer.textContent = `v${version}`;
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Cleanup on window close
window.addEventListener('beforeunload', () => {
  window.ninja.removeAllListeners();
});

/**
 * Hawkario Timer -Control Window
 * Main controller for timer configuration and preset management
 */

import { parseHMS, secondsToHMS, formatTime, formatTimeOfDay, hexToRgba, debounce } from '../shared/timer.js';
import { validateConfig, validatePresets, safeJSONParse } from '../shared/validation.js';
import { STORAGE_KEYS } from '../shared/constants.js';

// DOM Elements
const els = {
  // Timer settings (in modal)
  mode: document.getElementById('mode'),
  duration: document.getElementById('duration'),
  format: document.getElementById('format'),

  // Typography
  fontFamily: document.getElementById('fontFamily'),
  fontWeight: document.getElementById('fontWeight'),
  fontSize: document.getElementById('fontSize'),
  fontColor: document.getElementById('fontColor'),
  opacity: document.getElementById('opacity'),
  strokeWidth: document.getElementById('strokeWidth'),
  strokeColor: document.getElementById('strokeColor'),
  shadow: document.getElementById('shadow'),
  align: document.getElementById('align'),
  letterSpacing: document.getElementById('letterSpacing'),

  // Background
  bgMode: document.getElementById('bgMode'),
  bgColor: document.getElementById('bgColor'),
  bgOpacity: document.getElementById('bgOpacity'),

  // Warnings
  warnEnable: document.getElementById('warnEnable'),
  warnTime: document.getElementById('warnTime'),
  warnColorEnable: document.getElementById('warnColorEnable'),
  warnColor: document.getElementById('warnColor'),
  warnFlashEnable: document.getElementById('warnFlashEnable'),
  flashRate: document.getElementById('flashRate'),

  // Sound
  soundWarnEnable: document.getElementById('soundWarnEnable'),
  soundEndEnable: document.getElementById('soundEndEnable'),
  soundVolume: document.getElementById('soundVolume'),

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
  defaultFontSize: document.getElementById('defaultFontSize'),
  defaultFontColor: document.getElementById('defaultFontColor'),
  defaultWarnEnabled: document.getElementById('defaultWarnEnabled'),
  defaultWarnTime: document.getElementById('defaultWarnTime'),
  defaultEndSound: document.getElementById('defaultEndSound'),
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

// State
let isRunning = false;
let outputWindowReady = false;
let editingPresetIndex = null; // Track which preset is being edited
let activePresetIndex = null; // Track which preset is currently playing

// Timer state for live preview
const timerState = {
  startedAt: null,
  pausedAcc: 0,
  ended: false,
  overtime: false,
  overtimeStartedAt: null
};
let isBlackedOut = false;

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
    return false;
  }

  const previousState = undoStack.pop();
  savePresets(previousState.presets);
  activePresetIndex = previousState.activePresetIndex;

  // If we have an active preset, apply its config
  if (activePresetIndex !== null && previousState.presets[activePresetIndex]) {
    applyConfig(previousState.presets[activePresetIndex].config);
  }

  renderPresetList();
  return true;
}

// Drag state for timer reordering (mouse-based drag system)
const dragState = {
  isDragging: false,
  dragActivated: false,  // True only after mouse moves 5px+
  fromIndex: null,
  currentIndex: null,
  draggedRow: null,
  ghostEl: null,
  placeholderEl: null,
  grabOffsetX: 0,
  grabOffsetY: 0,
  startX: 0,
  startY: 0,
  originalHeight: 0,
  originalWidth: 0
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

const APP_SETTINGS_KEY = 'hawkario:appSettings';

const DEFAULT_APP_SETTINGS = {
  todFormat: '24h',
  confirmDelete: true,
  defaults: {
    mode: 'countdown',
    durationSec: 600,
    format: 'MM:SS',
    fontSizeVw: 35,
    fontColor: '#ffffff',
    warnEnabled: true,
    warnSeconds: 60,
    endSoundEnabled: true
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

async function openAppSettings() {
  const settings = loadAppSettings();

  // Populate form fields
  els.todFormat.value = settings.todFormat;
  els.confirmDelete.value = settings.confirmDelete ? 'on' : 'off';
  els.defaultMode.value = settings.defaults.mode;
  els.defaultDuration.value = secondsToHMS(settings.defaults.durationSec);
  els.defaultFormat.value = settings.defaults.format;
  els.defaultFontSize.value = settings.defaults.fontSizeVw;
  els.defaultFontColor.value = settings.defaults.fontColor;
  els.defaultWarnEnabled.value = settings.defaults.warnEnabled ? 'on' : 'off';
  els.defaultWarnTime.value = secondsToHMS(settings.defaults.warnSeconds);
  els.defaultEndSound.value = settings.defaults.endSoundEnabled ? 'on' : 'off';

  // Fetch window stay on top settings from main process
  const windowSettings = await window.hawkario.getAlwaysOnTop();
  els.outputOnTop.value = windowSettings.output ? 'on' : 'off';
  els.controlOnTop.value = windowSettings.control ? 'on' : 'off';

  els.appSettingsModal.classList.remove('hidden');
}

function closeAppSettings() {
  els.appSettingsModal.classList.add('hidden');
}

function saveAppSettingsFromForm() {
  const settings = {
    todFormat: els.todFormat.value,
    confirmDelete: els.confirmDelete.value === 'on',
    defaults: {
      mode: els.defaultMode.value,
      durationSec: parseHMS(els.defaultDuration.value),
      format: els.defaultFormat.value,
      fontSizeVw: parseInt(els.defaultFontSize.value, 10) || 35,
      fontColor: els.defaultFontColor.value,
      warnEnabled: els.defaultWarnEnabled.value === 'on',
      warnSeconds: parseHMS(els.defaultWarnTime.value),
      endSoundEnabled: els.defaultEndSound.value === 'on'
    }
  };

  // Apply window stay on top settings to main process
  const outputOnTop = els.outputOnTop.value === 'on';
  const controlOnTop = els.controlOnTop.value === 'on';
  window.hawkario.setAlwaysOnTop('output', outputOnTop);
  window.hawkario.setAlwaysOnTop('control', controlOnTop);

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

function getDefaultTimerConfig() {
  const settings = loadAppSettings();
  const d = settings.defaults;

  return {
    mode: d.mode,
    durationSec: d.durationSec,
    format: d.format,
    style: {
      fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      fontWeight: '600',
      fontSizeVw: d.fontSizeVw,
      color: d.fontColor,
      opacity: 1,
      strokeWidth: 2,
      strokeColor: '#000000',
      textShadow: '0 2px 10px rgba(0,0,0,0.5)',
      align: 'center',
      letterSpacing: 0,
      bgMode: 'transparent',
      bgColor: '#000000',
      bgOpacity: 0
    },
    warn: {
      enabled: d.warnEnabled,
      seconds: d.warnSeconds,
      colorEnabled: true,
      color: '#E64A19',
      flashEnabled: false,
      flashRateMs: 500
    },
    sound: {
      warnEnabled: false,
      endEnabled: d.endSoundEnabled,
      volume: 0.7
    }
  };
}

// ============ Timer Progress Bar ============

/**
 * Update the progress bar with elapsed/remaining time
 * @param {number} elapsedMs - Elapsed time in milliseconds
 * @param {number} totalMs - Total duration in milliseconds
 */
function updateProgressBar(elapsedMs, totalMs) {
  // Show empty state when no timer is active
  if (activePresetIndex === null || (!isRunning && timerState.startedAt === null)) {
    els.progressFill.style.width = '0%';
    els.elapsedTime.textContent = '00:00';
    els.remainingTime.textContent = '00:00';
    return;
  }

  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const progressPercent = Math.min(100, (elapsedMs / totalMs) * 100);

  els.progressFill.style.width = progressPercent + '%';
  els.elapsedTime.textContent = formatTime(elapsedMs, 'MM:SS');
  els.remainingTime.textContent = formatTime(remainingMs, 'MM:SS');
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
  const presets = loadPresets();

  if (editingPresetIndex !== null) {
    // Update existing preset
    presets[editingPresetIndex] = { name, config };
    showToast(`Updated "${name}"`, 'success');
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
  const durationSec = parseHMS(els.duration.value);

  const bgOpacity = parseFloat(els.bgOpacity.value) || 0;
  const bg = els.bgMode.value === 'solid'
    ? hexToRgba(els.bgColor.value, bgOpacity)
    : 'transparent';

  // Scale font size proportionally for the modal preview
  // vw is relative to viewport, but we need it relative to the modal preview width
  const modalPreviewWidth = els.modalPreview.offsetWidth || 400;
  const viewportWidth = window.innerWidth;
  const scaleFactor = modalPreviewWidth / viewportWidth;
  const fontSizeVw = parseFloat(els.fontSize.value) || 10;
  const scaledFontSize = fontSizeVw * viewportWidth * scaleFactor / 100;

  // Scale stroke width proportionally too
  const strokeWidthPx = parseFloat(els.strokeWidth.value) || 0;
  const scaledStroke = strokeWidthPx * scaleFactor;

  els.modalPreview.style.background = bg;
  els.modalPreviewTimer.style.fontFamily = els.fontFamily.value;
  els.modalPreviewTimer.style.fontWeight = els.fontWeight.value;
  els.modalPreviewTimer.style.fontSize = scaledFontSize + 'px';
  els.modalPreviewTimer.style.color = els.fontColor.value;
  els.modalPreviewTimer.style.opacity = els.opacity.value;
  els.modalPreviewTimer.style.webkitTextStrokeWidth = Math.max(0, scaledStroke) + 'px';
  els.modalPreviewTimer.style.webkitTextStrokeColor = els.strokeColor.value;
  els.modalPreviewTimer.style.textShadow = els.shadow.value;
  els.modalPreviewTimer.style.letterSpacing = els.letterSpacing.value + 'em';

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
    displayText = formatTimeOfDay(format);
  } else {
    displayText = formatTime(isCountdown ? durationSec * 1000 : 0, format);
    if (showToD) {
      displayText += '  |  ' + formatTimeOfDay(format);
    }
  }

  els.modalPreviewTimer.textContent = displayText;
}

// ============ Collapsible Settings Sections ============

const SECTIONS_STATE_KEY = 'hawkario:sectionsState';

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

const PREVIEW_WIDTH_KEY = 'hawkario:previewWidth';
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
  updatePreviewScale();
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
  requestAnimationFrame(() => updatePreviewScale());
}

/**
 * Update preview text scale based on current preview width
 * This makes the preview behave like resizing a real window
 */
function updatePreviewScale() {
  const previewWidth = els.previewWrapper.offsetWidth || 300;
  const fontSizeVw = parseFloat(els.fontSize.value) || 35;

  // Scale font size: vw units mean percentage of width
  const scaledFontSize = (fontSizeVw / 100) * previewWidth;
  els.livePreviewTimer.style.fontSize = scaledFontSize + 'px';

  // Scale stroke width proportionally
  const strokeWidth = parseInt(els.strokeWidth.value, 10) || 0;
  const scaledStroke = (strokeWidth / 100) * previewWidth * 0.05;
  els.livePreviewTimer.style.webkitTextStrokeWidth = Math.max(0, scaledStroke) + 'px';
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
  const bgOpacity = parseFloat(els.bgOpacity.value) || 0;
  const bg = els.bgMode.value === 'solid'
    ? hexToRgba(els.bgColor.value, bgOpacity)
    : 'transparent';

  els.livePreview.style.background = bg;
  els.livePreviewTimer.style.fontFamily = els.fontFamily.value;
  els.livePreviewTimer.style.fontWeight = els.fontWeight.value;
  els.livePreviewTimer.style.color = els.fontColor.value;
  els.livePreviewTimer.style.opacity = els.opacity.value;
  els.livePreviewTimer.style.webkitTextStrokeColor = els.strokeColor.value;
  els.livePreviewTimer.style.textShadow = els.shadow.value;
  els.livePreviewTimer.style.letterSpacing = els.letterSpacing.value + 'em';

  // Use unified scaling function for font size and stroke
  updatePreviewScale();
}

/**
 * Render loop for live preview - mirrors actual timer output
 */
function renderLivePreview() {
  const mode = els.mode.value;
  const durationSec = parseHMS(els.duration.value);
  const format = els.format.value;
  const warnEnabled = els.warnEnable.value === 'on';
  const warnSeconds = parseHMS(els.warnTime.value);
  const warnColorEnabled = els.warnColorEnable.value === 'on';
  const warnColor = els.warnColor.value;
  const warnFlashEnabled = els.warnFlashEnable.value === 'on';
  const flashRateMs = parseInt(els.flashRate.value, 10) || 500;

  let displayText = '';
  let elapsed = 0;
  let remainingSec = 0;

  // Handle hidden mode
  if (mode === 'hidden') {
    els.livePreviewTimer.style.visibility = 'hidden';
    requestAnimationFrame(renderLivePreview);
    return;
  } else {
    els.livePreviewTimer.style.visibility = 'visible';
  }

  // Handle Time of Day only mode
  if (mode === 'tod') {
    displayText = formatTimeOfDay(format);
    els.livePreviewTimer.textContent = displayText;
    els.livePreviewTimer.style.color = els.fontColor.value;
    els.livePreviewTimer.style.opacity = els.opacity.value;
    els.livePreview.classList.remove('warning');
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
    } else {
      elapsed = timerState.pausedAcc;
    }
    remainingSec = Math.floor(elapsed / 1000);
  } else {
    // Timer is running
    const now = Date.now();
    const base = now - timerState.startedAt + timerState.pausedAcc;

    if (isCountdown) {
      elapsed = Math.max(0, (durationSec * 1000) - base);
      remainingSec = Math.floor(elapsed / 1000);

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
          applyConfig(nextPreset.config);

          setTimeout(() => {
            sendCommand('start');
            renderPresetList();
          }, 500);
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
    displayText = formatTime(elapsed, format);
    els.livePreviewTimer.classList.remove('overtime');
  }

  if (showToD) {
    displayText += '  |  ' + formatTimeOfDay(format);
  }

  // Update display
  els.livePreviewTimer.textContent = displayText;

  // Update progress bar
  if (isCountdown) {
    const totalMs = durationSec * 1000;
    const elapsedMs = totalMs - elapsed;
    updateProgressBar(elapsedMs, totalMs);
  } else if (isCountup) {
    // For countup, show elapsed time with no max
    els.progressFill.style.width = '0%';
    els.elapsedTime.textContent = formatTime(elapsed, 'MM:SS');
    els.remainingTime.textContent = '--:--';
  } else {
    // Reset for other modes
    els.progressFill.style.width = '0%';
    els.elapsedTime.textContent = '00:00';
    els.remainingTime.textContent = '00:00';
  }

  // Color states based on percentage remaining (only for countdown modes)
  // Normal (white): > 20% remaining
  // Warning (yellow): 10-20% remaining
  // Danger (orange): < 10% remaining
  if (isCountdown && durationSec > 0) {
    const percentRemaining = (remainingSec / durationSec) * 100;

    if (percentRemaining <= 10 && remainingSec > 0) {
      // Danger state - orange
      els.livePreviewTimer.style.color = '#E64A19';
      els.livePreview.classList.add('danger');
      els.livePreview.classList.remove('warning');

      // Flash effect in danger zone if enabled
      if (warnFlashEnabled) {
        const phase = Math.floor(Date.now() / flashRateMs) % 2;
        els.livePreviewTimer.style.opacity = phase
          ? els.opacity.value
          : Math.max(0.15, parseFloat(els.opacity.value) * 0.25);
      }
    } else if (percentRemaining <= 20 && remainingSec > 0) {
      // Warning state - yellow
      els.livePreviewTimer.style.color = '#ffcc00';
      els.livePreview.classList.add('warning');
      els.livePreview.classList.remove('danger');
      els.livePreviewTimer.style.opacity = els.opacity.value;
    } else {
      // Normal state - use configured color
      els.livePreviewTimer.style.color = els.fontColor.value;
      els.livePreviewTimer.style.opacity = els.opacity.value;
      els.livePreview.classList.remove('warning', 'danger');
    }
  } else {
    els.livePreviewTimer.style.color = els.fontColor.value;
    els.livePreviewTimer.style.opacity = els.opacity.value;
    els.livePreview.classList.remove('warning', 'danger');
  }

  // Blackout state
  if (isBlackedOut) {
    els.livePreview.classList.add('blackout');
  } else {
    els.livePreview.classList.remove('blackout');
  }

  requestAnimationFrame(renderLivePreview);
}

// ============ Configuration ============

function getCurrentConfig() {
  return {
    mode: els.mode.value,
    durationSec: parseHMS(els.duration.value),
    format: els.format.value,
    style: {
      fontFamily: els.fontFamily.value,
      fontWeight: els.fontWeight.value,
      fontSizeVw: parseFloat(els.fontSize.value) || 10,
      color: els.fontColor.value,
      opacity: parseFloat(els.opacity.value) || 1,
      strokeWidth: parseInt(els.strokeWidth.value, 10) || 0,
      strokeColor: els.strokeColor.value,
      textShadow: els.shadow.value,
      align: els.align.value,
      letterSpacing: parseFloat(els.letterSpacing.value) || 0,
      bgMode: els.bgMode.value,
      bgColor: els.bgColor.value,
      bgOpacity: parseFloat(els.bgOpacity.value) || 0
    },
    warn: {
      enabled: els.warnEnable.value === 'on',
      seconds: parseHMS(els.warnTime.value),
      colorEnabled: els.warnColorEnable.value === 'on',
      color: els.warnColor.value,
      flashEnabled: els.warnFlashEnable.value === 'on',
      flashRateMs: parseInt(els.flashRate.value, 10) || 500
    },
    sound: {
      warnEnabled: els.soundWarnEnable.value === 'on',
      endEnabled: els.soundEndEnable.value === 'on',
      volume: parseFloat(els.soundVolume.value) || 0.7
    }
  };
}

function applyConfig(config) {
  if (!config) return;

  els.mode.value = config.mode || 'countdown';
  els.duration.value = secondsToHMS(config.durationSec || 1200);
  els.format.value = config.format || 'MM:SS';

  if (config.style) {
    els.fontFamily.value = config.style.fontFamily || 'Inter, sans-serif';
    els.fontWeight.value = config.style.fontWeight || '600';
    els.fontSize.value = config.style.fontSizeVw || 10;
    els.fontColor.value = config.style.color || '#ffffff';
    els.opacity.value = config.style.opacity ?? 1;
    els.strokeWidth.value = config.style.strokeWidth ?? 2;
    els.strokeColor.value = config.style.strokeColor || '#000000';
    els.shadow.value = config.style.textShadow || 'none';
    els.align.value = config.style.align || 'center';
    els.letterSpacing.value = config.style.letterSpacing || 0;
    els.bgMode.value = config.style.bgMode || 'transparent';
    els.bgColor.value = config.style.bgColor || '#000000';
    els.bgOpacity.value = config.style.bgOpacity ?? 0;
  }

  if (config.warn) {
    els.warnEnable.value = config.warn.enabled ? 'on' : 'off';
    els.warnTime.value = secondsToHMS(config.warn.seconds || 120);
    els.warnColorEnable.value = config.warn.colorEnabled ? 'on' : 'off';
    els.warnColor.value = config.warn.color || '#E64A19';
    els.warnFlashEnable.value = config.warn.flashEnabled ? 'on' : 'off';
    els.flashRate.value = config.warn.flashRateMs || 500;
  }

  if (config.sound) {
    els.soundWarnEnable.value = config.sound.warnEnabled ? 'on' : 'off';
    els.soundEndEnable.value = config.sound.endEnabled ? 'on' : 'off';
    els.soundVolume.value = config.sound.volume ?? 0.7;
  }

  applyPreview();
}

// ============ Timer Commands ============

function sendCommand(command) {
  const config = getCurrentConfig();
  window.hawkario.sendTimerCommand(command, config);

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
      renderPresetList(); // Update button states
      break;
  }

}

// ============ Presets ============

function loadPresets() {
  try {
    // Check for presets in current key
    let data = localStorage.getItem(STORAGE_KEYS.PRESETS);

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
    row.className = isSelected ? 'preset-item selected' : 'preset-item';
    row.dataset.index = idx;

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
    name.title = 'Click to edit name';
    name.onclick = (e) => {
      e.stopPropagation();
      showQuickEditPopup(idx, preset, name);
    };

    const nameText = document.createElement('span');
    nameText.className = 'preset-name-text';
    nameText.textContent = preset.name;

    const editIcon = document.createElement('span');
    editIcon.className = 'edit-icon';
    editIcon.innerHTML = ICONS.pencil;

    name.append(nameText, editIcon);

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
    row.append(dragHandle, name, actions);
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
  input.placeholder = 'Timer name';

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
    applyConfig(firstPreset.config);
  }
}

function handleExportPresets() {
  const presets = loadPresets();
  if (presets.length === 0) {
    showToast('No presets to export', 'error');
    return;
  }

  const blob = new Blob([JSON.stringify(presets, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hawkario-presets.json';
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast(`Exported ${presets.length} preset(s)`);
}

function handleImportPresets(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate file size (max 1MB)
  if (file.size > 1024 * 1024) {
    showToast('File too large (max 1MB)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const imported = safeJSONParse(reader.result, validatePresets);

    if (!imported || imported.length === 0) {
      showToast('Invalid presets file', 'error');
      return;
    }

    // Merge with existing
    const existing = loadPresets();
    const merged = [...existing, ...imported];
    savePresets(merged);
    renderPresetList();
    showToast(`Imported ${imported.length} preset(s)`, 'success');
  };

  reader.onerror = () => {
    showToast('Failed to read file', 'error');
  };

  reader.readAsText(file);
  e.target.value = ''; // Reset input
}

// ============ Event Listeners ============

function setupEventListeners() {
  // Input change listeners (debounced) - update both live and modal preview
  const inputEls = [
    els.mode, els.duration, els.format,
    els.fontFamily, els.fontWeight, els.fontSize, els.fontColor,
    els.opacity, els.strokeWidth, els.strokeColor, els.shadow,
    els.align, els.letterSpacing,
    els.bgMode, els.bgColor, els.bgOpacity,
    els.warnEnable, els.warnTime, els.warnColorEnable, els.warnColor,
    els.warnFlashEnable, els.flashRate,
    els.soundWarnEnable, els.soundEndEnable, els.soundVolume
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

  // Blackout button (toggle) with stripe animation
  els.blackoutBtn.addEventListener('click', () => {
    // Add transitioning stripes briefly
    els.blackoutBtn.classList.add('transitioning');
    setTimeout(() => {
      els.blackoutBtn.classList.remove('transitioning');
    }, 300);

    window.hawkario.toggleBlackout();
  });

  // Flash button (synced with viewer): glow → grey → repeat 3 times
  els.flashBtn.addEventListener('click', () => {
    // Store original styles for live preview
    const originalColor = els.livePreviewTimer.style.color || '';
    const originalShadow = els.livePreviewTimer.style.textShadow || '';
    const originalStroke = els.livePreviewTimer.style.webkitTextStrokeColor || '';
    const originalStrokeWidth = els.livePreviewTimer.style.webkitTextStrokeWidth || '';

    // Timing (match viewer.js)
    const glowDuration = 400;
    const greyDuration = 300;

    let flashCount = 0;
    const maxFlashes = 3;

    const showGlow = () => {
      // White glow effect (compact but strong)
      els.flashBtn.classList.add('flashing');
      els.livePreviewTimer.style.color = '#ffffff';
      els.livePreviewTimer.style.webkitTextStrokeColor = '#ffffff';
      els.livePreviewTimer.style.webkitTextStrokeWidth = '1px';
      els.livePreviewTimer.style.textShadow = '0 0 2px #fff, 0 0 4px #fff, 0 0 8px rgba(255,255,255,0.9)';

      setTimeout(showGrey, glowDuration);
    };

    const showGrey = () => {
      // Grey text - no glow
      els.flashBtn.classList.remove('flashing');
      els.livePreviewTimer.style.color = '#666666';
      els.livePreviewTimer.style.webkitTextStrokeColor = '#666666';
      els.livePreviewTimer.style.webkitTextStrokeWidth = '0px';
      els.livePreviewTimer.style.textShadow = 'none';

      flashCount++;

      if (flashCount < maxFlashes) {
        setTimeout(showGlow, greyDuration);
      } else {
        // Done flashing, restore original
        setTimeout(() => {
          els.livePreviewTimer.style.color = originalColor;
          els.livePreviewTimer.style.textShadow = originalShadow;
          els.livePreviewTimer.style.webkitTextStrokeColor = originalStroke;
          els.livePreviewTimer.style.webkitTextStrokeWidth = originalStrokeWidth;
        }, greyDuration);
      }
    };

    showGlow();
    window.hawkario.sendTimerCommand('flash', getCurrentConfig());
  });

  // Output button - opens window if not open, toggles fullscreen if already open
  els.openOutput.addEventListener('click', () => {
    if (outputWindowReady) {
      window.hawkario.fullscreenOutput();
    } else {
      window.hawkario.openOutputWindow();
    }
  });


  // App Settings
  els.appSettingsBtn.addEventListener('click', openAppSettings);
  els.appSettingsClose.addEventListener('click', closeAppSettings);
  els.appSettingsSave.addEventListener('click', saveAppSettingsFromForm);
  els.settingsExport.addEventListener('click', handleExportPresets);
  els.settingsImport.addEventListener('click', () => els.importFile.click());

  // Close app settings on backdrop click
  els.appSettingsModal.addEventListener('click', (e) => {
    if (e.target === els.appSettingsModal) {
      closeAppSettings();
    }
  });

  // Keyboard shortcuts for app settings modal (Enter to save, Escape to cancel)
  document.addEventListener('keydown', (e) => {
    if (els.appSettingsModal.classList.contains('hidden')) return;

    if (e.key === 'Enter' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      saveAppSettingsFromForm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAppSettings();
    }
  });

  // Preset controls
  els.importFile.addEventListener('change', handleImportPresets);
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

    if (e.key === 'Enter' && e.target.tagName !== 'SELECT') {
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
    // Ignore if user is typing in an input or modal is open
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    if (!els.settingsModal.classList.contains('hidden') ||
        !els.appSettingsModal.classList.contains('hidden')) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case ' ':
        // Space - toggle play/pause
        e.preventDefault();
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
        window.hawkario.toggleBlackout();
        break;
    }
  });

  // Keyboard shortcuts from main process
  window.hawkario.onKeyboardShortcut((shortcut) => {
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
        window.hawkario.toggleBlackout();
        break;
    }
  });

  // Output window ready notification
  window.hawkario.onOutputWindowReady(() => {
    outputWindowReady = true;
    // Sync current timer state to new window
    const config = getCurrentConfig();
    config.timerState = {
      startedAt: timerState.startedAt,
      pausedAcc: timerState.pausedAcc,
      ended: timerState.ended,
      overtime: timerState.overtime,
      overtimeStartedAt: timerState.overtimeStartedAt
    };
    config.isRunning = isRunning;
    window.hawkario.sendTimerCommand('sync', config);
  });

  // Output window closed notification
  window.hawkario.onOutputWindowClosed(() => {
    outputWindowReady = false;
  });

  // Blackout toggle listener
  window.hawkario.onBlackoutToggle(() => {
    isBlackedOut = !isBlackedOut;
    els.blackoutBtn.classList.toggle('active', isBlackedOut);
  });
}

// ============ Drag and Drop ============

/**
 * Setup global mouse-based drag listeners
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

      // Create ghost element (follows cursor - the one you're "holding")
      const ghost = row.cloneNode(true);
      ghost.className = 'preset-item drag-ghost';
      ghost.style.width = dragState.originalWidth + 'px';
      ghost.style.position = 'fixed';
      ghost.style.left = (e.clientX - dragState.grabOffsetX) + 'px';
      ghost.style.top = (e.clientY - dragState.grabOffsetY) + 'px';
      ghost.style.pointerEvents = 'none';
      ghost.style.zIndex = '1000';
      ghost.style.margin = '0';
      ghost.style.opacity = '0.9';
      ghost.style.transform = 'scale(1.02)';
      ghost.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
      document.body.appendChild(ghost);
      dragState.ghostEl = ghost;

      // Create simple placeholder (same height, dashed border)
      const placeholder = document.createElement('div');
      placeholder.className = 'drag-placeholder';
      placeholder.style.height = dragState.originalHeight + 'px';
      placeholder.style.border = '2px dashed #555';
      placeholder.style.borderRadius = '12px';
      placeholder.style.boxSizing = 'border-box';
      placeholder.style.background = 'rgba(255,255,255,0.05)';
      dragState.placeholderEl = placeholder;

      // Hide original row but keep reference
      row.style.display = 'none';
      row.parentNode.insertBefore(placeholder, row);

      // Hide all link zones during drag (use visibility to preserve layout)
      const linkZones = els.presetList.querySelectorAll('.link-zone');
      linkZones.forEach(zone => {
        zone.style.visibility = 'hidden';
      });
    }

    if (!dragState.ghostEl) return;

    // Move ghost to follow cursor exactly
    dragState.ghostEl.style.left = (e.clientX - dragState.grabOffsetX) + 'px';
    dragState.ghostEl.style.top = (e.clientY - dragState.grabOffsetY) + 'px';

    // Get all visible preset items (excluding placeholder wrapper and hidden original)
    const allElements = Array.from(els.presetList.children);
    const visibleItems = allElements.filter(item =>
      item.classList.contains('preset-item') &&
      !item.classList.contains('drag-placeholder') &&
      item !== dragState.placeholderEl &&
      item.style.display !== 'none'
    );

    // Find which timer the cursor is hovering over
    let hoveredIndex = -1;

    for (let i = 0; i < visibleItems.length; i++) {
      const item = visibleItems[i];
      const rect = item.getBoundingClientRect();

      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        hoveredIndex = i;
        break;
      }
    }

    // Update hover highlight on timers during drag
    visibleItems.forEach((item, i) => {
      if (i === hoveredIndex) {
        item.classList.add('drag-hover');
      } else {
        item.classList.remove('drag-hover');
      }
    });

    // When hovering over a timer, insert placeholder based on cursor position
    // Top half of timer = insert before, bottom half = insert after
    if (hoveredIndex !== -1 && dragState.placeholderEl) {
      const hoveredItem = visibleItems[hoveredIndex];
      const rect = hoveredItem.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertBefore = e.clientY < midY;

      // Determine the correct sibling position
      let targetSibling;
      if (insertBefore) {
        targetSibling = hoveredItem; // Insert before hovered item
      } else {
        targetSibling = hoveredItem.nextSibling; // Insert after hovered item
      }

      // Check if placeholder is already in the right position
      const currentNext = dragState.placeholderEl.nextSibling;
      const isCorrectPosition = insertBefore
        ? (currentNext === hoveredItem)
        : (dragState.placeholderEl.previousSibling === hoveredItem);

      if (!isCorrectPosition) {
        // Remove placeholder from current position
        dragState.placeholderEl.remove();

        // Insert at new position
        if (targetSibling) {
          hoveredItem.parentNode.insertBefore(dragState.placeholderEl, targetSibling);
        } else {
          hoveredItem.parentNode.appendChild(dragState.placeholderEl);
        }
      }
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
      dragState.currentIndex = null;
      dragState.draggedRow = null;
      return;
    }

    // Remove ghost
    if (dragState.ghostEl) {
      dragState.ghostEl.remove();
      dragState.ghostEl = null;
    }

    // Remove drag-hover class from all items
    els.presetList.querySelectorAll('.drag-hover').forEach(item => {
      item.classList.remove('drag-hover');
    });

    // Calculate final index based on placeholder position
    let finalIndex = 0;
    const allChildren = Array.from(els.presetList.children);
    let count = 0;

    for (const child of allChildren) {
      if (child === dragState.placeholderEl) {
        finalIndex = count;
        break;
      }
      // Count only visible preset items (not hidden, not placeholder)
      if (child.classList.contains('preset-item') &&
          child.style.display !== 'none' &&
          !child.classList.contains('drag-placeholder')) {
        count++;
      }
    }

    // Remove placeholder
    if (dragState.placeholderEl) {
      dragState.placeholderEl.remove();
      dragState.placeholderEl = null;
    }

    // Show original row again
    if (dragState.draggedRow) {
      dragState.draggedRow.style.display = '';
    }

    // Reorder if position changed
    const fromIndex = dragState.fromIndex;
    if (fromIndex !== null && fromIndex !== finalIndex) {
      saveUndoState(); // Save state before reorder for undo
      const presets = loadPresets();
      const [moved] = presets.splice(fromIndex, 1);

      // Adjust finalIndex if we removed from before it
      let toIndex = finalIndex;
      if (fromIndex < finalIndex) {
        toIndex--;
      }

      presets.splice(toIndex, 0, moved);
      savePresets(presets);

      // Update activePresetIndex if needed
      if (activePresetIndex === fromIndex) {
        activePresetIndex = toIndex;
      } else if (fromIndex < activePresetIndex && toIndex >= activePresetIndex) {
        activePresetIndex--;
      } else if (fromIndex > activePresetIndex && toIndex <= activePresetIndex) {
        activePresetIndex++;
      }
    }

    // Reset drag state
    dragState.isDragging = false;
    dragState.dragActivated = false;
    dragState.fromIndex = null;
    dragState.currentIndex = null;
    dragState.draggedRow = null;

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

  // Create default preset on first launch
  createDefaultPreset();

  setupEventListeners();
  applyPreview();
  renderPresetList();

  // Start live preview render loop
  renderLivePreview();

  // Log version
  window.hawkario.getVersion().then(version => {
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
  window.hawkario.removeAllListeners();
});

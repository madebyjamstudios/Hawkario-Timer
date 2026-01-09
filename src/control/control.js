/**
 * Hawkario - Control Window
 * Main controller for timer configuration and preset management
 */

import { parseHMS, secondsToHMS, formatTime, hexToRgba, debounce } from '../shared/timer.js';
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
  livePreview: document.getElementById('livePreview'),
  livePreviewTimer: document.getElementById('livePreviewTimer'),

  // Modal Preview
  modalPreview: document.getElementById('modalPreview'),
  modalPreviewTimer: document.getElementById('modalPreviewTimer'),

  // Controls
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  blackoutBtn: document.getElementById('blackoutBtn'),
  openOutput: document.getElementById('openOutput'),
  goFullscreen: document.getElementById('goFullscreen'),

  // Presets
  presetName: document.getElementById('presetName'),
  presetList: document.getElementById('presetList'),
  presetListContainer: document.querySelector('.preset-list-container'),
  sizeSliderContainer: document.getElementById('sizeSliderContainer'),
  timerSizeSlider: document.getElementById('timerSizeSlider'),
  exportPresets: document.getElementById('exportPresets'),
  importPresets: document.getElementById('importPresets'),
  importFile: document.getElementById('importFile'),
  addTimer: document.getElementById('addTimer'),

  // Modal
  settingsModal: document.getElementById('settingsModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalClose: document.getElementById('modalClose'),
  modalCancel: document.getElementById('modalCancel'),
  modalSave: document.getElementById('modalSave')
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
  ended: false
};
let isBlackedOut = false;

// SVG Icons
const ICONS = {
  reset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>',
  settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  more: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  clone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  delete: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  add: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  pencil: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>'
};

// ============ Toast Notifications ============

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// ============ Timer Size Slider ============

const TIMER_SCALE_KEY = 'hawkario:timerScale';

function updateTimerScale(scale) {
  els.presetList.style.setProperty('--timer-scale', scale);
  localStorage.setItem(TIMER_SCALE_KEY, scale);
}

function findMaxSafeScale() {
  // Find the maximum scale before content overflows horizontally
  const list = els.presetList;
  if (!list || !list.children.length) return 1.5;

  const containerWidth = list.clientWidth;
  const currentScale = parseFloat(els.timerSizeSlider.value) || 1;

  // Check each preset item for overflow
  let maxScale = 1.5;
  for (const item of list.children) {
    if (item.classList.contains('preset-item')) {
      const itemWidth = item.scrollWidth;
      if (itemWidth > containerWidth) {
        // Already overflowing, calculate safe scale
        const safeScale = currentScale * (containerWidth / itemWidth) * 0.98;
        maxScale = Math.min(maxScale, safeScale);
      }
    }
  }

  return Math.max(0.5, maxScale);
}

function updateSliderMax() {
  const maxScale = findMaxSafeScale();
  els.timerSizeSlider.max = maxScale;

  // If current value exceeds max, clamp it
  const currentValue = parseFloat(els.timerSizeSlider.value);
  if (currentValue > maxScale) {
    els.timerSizeSlider.value = maxScale;
    updateTimerScale(maxScale);
  }
}

function checkSliderVisibility() {
  const list = els.presetList;
  if (!list) return;

  // Show slider if there are 3+ timers (likely to need resizing)
  const presetCount = loadPresets().length;
  if (presetCount >= 3) {
    els.sizeSliderContainer.classList.remove('hidden');
    // Update max after a brief delay for layout
    setTimeout(updateSliderMax, 50);
  } else {
    els.sizeSliderContainer.classList.add('hidden');
  }
}

function restoreTimerScale() {
  const savedScale = localStorage.getItem(TIMER_SCALE_KEY);
  if (savedScale) {
    const scale = parseFloat(savedScale);
    els.timerSizeSlider.value = scale;
    updateTimerScale(scale);
  }
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

  const bgOpacity = parseFloat(els.bgOpacity.value) || 0;
  const bg = els.bgMode.value === 'solid'
    ? hexToRgba(els.bgColor.value, bgOpacity)
    : 'transparent';

  els.modalPreview.style.background = bg;
  els.modalPreviewTimer.style.fontFamily = els.fontFamily.value;
  els.modalPreviewTimer.style.fontWeight = els.fontWeight.value;
  els.modalPreviewTimer.style.fontSize = els.fontSize.value + 'vw';
  els.modalPreviewTimer.style.color = els.fontColor.value;
  els.modalPreviewTimer.style.opacity = els.opacity.value;
  els.modalPreviewTimer.style.webkitTextStrokeWidth = els.strokeWidth.value + 'px';
  els.modalPreviewTimer.style.webkitTextStrokeColor = els.strokeColor.value;
  els.modalPreviewTimer.style.textShadow = els.shadow.value;
  els.modalPreviewTimer.style.letterSpacing = els.letterSpacing.value + 'em';

  // Update displayed time
  const durationSec = parseHMS(els.duration.value);
  els.modalPreviewTimer.textContent = formatTime(
    els.mode.value === 'countdown' ? durationSec * 1000 : 0,
    els.format.value
  );
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

  // Calculate scaled font size based on preview box width
  // vw units are relative to viewport, so we scale based on preview width
  const previewWidth = els.livePreview.offsetWidth || 200;
  const fontSizeVw = parseFloat(els.fontSize.value) || 10;
  const scaledFontSize = (fontSizeVw / 100) * previewWidth;
  els.livePreviewTimer.style.fontSize = scaledFontSize + 'px';

  // Scale stroke width proportionally too
  const strokeWidth = parseInt(els.strokeWidth.value, 10) || 0;
  const scaledStroke = Math.max(0.5, (strokeWidth / 100) * previewWidth * 0.1);
  els.livePreviewTimer.style.webkitTextStrokeWidth = scaledStroke + 'px';

  els.livePreviewTimer.style.color = els.fontColor.value;
  els.livePreviewTimer.style.opacity = els.opacity.value;
  els.livePreviewTimer.style.webkitTextStrokeColor = els.strokeColor.value;
  els.livePreviewTimer.style.textShadow = els.shadow.value;
  els.livePreviewTimer.style.letterSpacing = els.letterSpacing.value + 'em';
}

/**
 * Render loop for live preview - mirrors actual timer output
 */
function renderLivePreview() {
  const mode = els.mode.value;
  const durationSec = parseHMS(els.duration.value);
  const warnEnabled = els.warnEnable.value === 'on';
  const warnSeconds = parseHMS(els.warnTime.value);
  const warnColorEnabled = els.warnColorEnable.value === 'on';
  const warnColor = els.warnColor.value;
  const warnFlashEnabled = els.warnFlashEnable.value === 'on';
  const flashRateMs = parseInt(els.flashRate.value, 10) || 500;

  let elapsed;
  let remainingSec;

  if (!isRunning || timerState.startedAt === null) {
    // Timer is idle
    elapsed = mode === 'countdown' ? durationSec * 1000 : 0;
    remainingSec = Math.floor(elapsed / 1000);
  } else {
    // Timer is running
    const now = Date.now();
    const base = now - timerState.startedAt + timerState.pausedAcc;

    if (mode === 'countdown') {
      elapsed = Math.max(0, (durationSec * 1000) - base);
      remainingSec = Math.floor(elapsed / 1000);

      // Check if timer ended
      if (elapsed === 0 && !timerState.ended) {
        timerState.ended = true;
        isRunning = false;
        updateControlStates();
      }
    } else {
      // Count up mode
      elapsed = base;
      remainingSec = Math.floor(elapsed / 1000);
    }
  }

  // Update display
  els.livePreviewTimer.textContent = formatTime(elapsed, els.format.value);

  // Warning state
  const warnActive = mode === 'countdown' &&
    warnEnabled &&
    remainingSec <= warnSeconds &&
    remainingSec > 0 &&
    isRunning;

  if (warnActive) {
    if (warnColorEnabled) {
      els.livePreviewTimer.style.color = warnColor;
    }
    if (warnFlashEnabled) {
      const phase = Math.floor(Date.now() / flashRateMs) % 2;
      els.livePreviewTimer.style.opacity = phase
        ? els.opacity.value
        : Math.max(0.15, parseFloat(els.opacity.value) * 0.25);
    }
    els.livePreview.classList.add('warning');
  } else {
    els.livePreviewTimer.style.color = els.fontColor.value;
    els.livePreviewTimer.style.opacity = els.opacity.value;
    els.livePreview.classList.remove('warning');
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
    els.warnColor.value = config.warn.color || '#ff3333';
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
      break;

    case 'pause':
      if (isRunning) {
        isRunning = false;
        timerState.pausedAcc += Date.now() - timerState.startedAt;
      }
      break;

    case 'reset':
      isRunning = false;
      timerState.startedAt = null;
      timerState.pausedAcc = 0;
      timerState.ended = false;
      break;
  }

  updateControlStates();
}

function updateControlStates() {
  els.startBtn.disabled = isRunning;
  els.pauseBtn.disabled = !isRunning;
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
    row.className = 'preset-item';

    // Name with pencil edit icon
    const name = document.createElement('div');
    name.className = 'preset-name';
    name.title = 'Click to edit name';
    name.onclick = (e) => {
      e.stopPropagation();
      openModal(idx);
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

    // Reset button (rewind icon)
    const resetBtn = document.createElement('button');
    resetBtn.className = 'icon-btn';
    resetBtn.innerHTML = ICONS.reset;
    resetBtn.title = 'Load & Reset';
    resetBtn.onclick = (e) => {
      e.stopPropagation();
      applyConfig(preset.config);
      sendCommand('reset');
      showToast(`Loaded "${preset.name}"`);
    };

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
    const isActiveAndRunning = activePresetIndex === idx && isRunning;
    playBtn.className = isActiveAndRunning ? 'icon-btn pause-btn' : 'icon-btn play-btn';
    playBtn.innerHTML = isActiveAndRunning ? ICONS.pause : ICONS.play;
    playBtn.title = isActiveAndRunning ? 'Pause' : 'Load & Start';
    playBtn.onclick = (e) => {
      e.stopPropagation();
      if (isActiveAndRunning) {
        // Pause the timer
        sendCommand('pause');
        showToast('Paused');
      } else {
        // Start this preset
        applyConfig(preset.config);
        activePresetIndex = idx;
        sendCommand('start');
        showToast(`Started "${preset.name}"`);
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

    actions.append(resetBtn, editBtn, playBtn, moreBtn);
    row.append(name, actions);
    els.presetList.appendChild(row);
  });

  // Check if slider should be visible after rendering
  setTimeout(checkSliderVisibility, 50);
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
    const confirmed = await window.hawkario.showConfirm({
      title: 'Delete Preset',
      message: `Delete "${preset.name}"?`
    });
    if (confirmed) {
      const presets = loadPresets();
      presets.splice(idx, 1);
      savePresets(presets);
      if (editingPresetIndex === idx) {
        editingPresetIndex = null;
        els.presetName.value = '';
      }
      renderPresetList();
      showToast('Preset deleted');
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

function createDefaultPreset() {
  const presets = loadPresets();
  if (presets.length === 0) {
    const defaultConfig = {
      mode: 'countdown',
      durationSec: 600, // 10 minutes
      format: 'MM:SS',
      style: {
        fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        fontWeight: '600',
        fontSizeVw: 40,
        color: '#ffffff',
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
        enabled: true,
        seconds: 60,
        colorEnabled: true,
        color: '#ff3333',
        flashEnabled: false,
        flashRateMs: 500
      },
      sound: {
        warnEnabled: false,
        endEnabled: true,
        volume: 0.7
      }
    };

    presets.push({
      name: 'Timer 1',
      config: defaultConfig
    });
    savePresets(presets);
    applyConfig(defaultConfig);
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

  // Timer control buttons
  els.startBtn.addEventListener('click', () => sendCommand('start'));
  els.pauseBtn.addEventListener('click', () => sendCommand('pause'));
  els.resetBtn.addEventListener('click', () => sendCommand('reset'));
  els.blackoutBtn.addEventListener('click', () => window.hawkario.toggleBlackout());

  // Window controls
  els.openOutput.addEventListener('click', () => {
    window.hawkario.openOutputWindow();
    showToast('Opening output window...');
  });

  els.goFullscreen.addEventListener('click', () => {
    window.hawkario.fullscreenOutput();
  });

  // Timer size slider
  els.timerSizeSlider.addEventListener('input', (e) => {
    updateTimerScale(e.target.value);
    // Update max limit dynamically as user slides
    setTimeout(updateSliderMax, 10);
  });

  // Preset controls
  els.exportPresets.addEventListener('click', handleExportPresets);
  els.importPresets.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', handleImportPresets);
  els.addTimer.addEventListener('click', () => {
    // Auto-create timer with defaults (no modal)
    const presets = loadPresets();
    let counter = 1;
    let name = `Timer ${counter}`;
    while (presets.some(p => p.name === name)) {
      counter++;
      name = `Timer ${counter}`;
    }

    const defaultConfig = {
      mode: 'countdown',
      durationSec: 600,
      format: 'MM:SS',
      style: {
        fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        fontWeight: '600',
        fontSizeVw: 40,
        color: '#ffffff',
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
        enabled: true,
        seconds: 60,
        colorEnabled: true,
        color: '#ff3333',
        flashEnabled: false,
        flashRateMs: 500
      },
      sound: {
        warnEnabled: false,
        endEnabled: true,
        volume: 0.7
      }
    };

    presets.push({ name, config: defaultConfig });
    savePresets(presets);
    renderPresetList();
    showToast(`Added "${name}"`);
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

  // Save on Enter key in preset name
  els.presetName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveModal();
    }
    if (e.key === 'Escape') {
      closeModal();
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
        sendCommand(isRunning ? 'pause' : 'start');
        break;
      case 'blackout':
        window.hawkario.toggleBlackout();
        break;
    }
  });

  // Output window ready notification
  window.hawkario.onOutputWindowReady(() => {
    outputWindowReady = true;
    // Send current config to new window
    sendCommand('reset');
    showToast('Output window ready', 'success');
  });

  // Blackout toggle listener
  window.hawkario.onBlackoutToggle(() => {
    isBlackedOut = !isBlackedOut;
    els.blackoutBtn.classList.toggle('active', isBlackedOut);
    els.blackoutBtn.textContent = isBlackedOut ? 'Blackout ON' : 'Blackout';
  });
}

// ============ Initialization ============

function init() {
  // Setup collapsible sections in modal
  setupCollapsibleSections();

  // Restore timer scale
  restoreTimerScale();

  // Create default preset on first launch
  createDefaultPreset();

  setupEventListeners();
  applyPreview();
  renderPresetList();
  updateControlStates();

  // Check if slider should be visible after a short delay (for layout to settle)
  setTimeout(checkSliderVisibility, 100);

  // Recheck on window resize
  window.addEventListener('resize', debounce(checkSliderVisibility, 100));

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

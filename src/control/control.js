/**
 * Hawkario - Control Window
 * Main controller for timer configuration and preset management
 */

import { parseHMS, secondsToHMS, formatTime, hexToRgba, debounce } from '../shared/timer.js';
import { validateConfig, validatePresets, safeJSONParse } from '../shared/validation.js';
import { STORAGE_KEYS } from '../shared/constants.js';

// DOM Elements
const els = {
  // Timer settings
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

  // Preview
  preview: document.getElementById('preview'),

  // Controls
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  openOutput: document.getElementById('openOutput'),
  goFullscreen: document.getElementById('goFullscreen'),

  // Presets
  presetName: document.getElementById('presetName'),
  savePreset: document.getElementById('savePreset'),
  presetList: document.getElementById('presetList'),
  exportPresets: document.getElementById('exportPresets'),
  importPresets: document.getElementById('importPresets'),
  importFile: document.getElementById('importFile')
};

// State
let isRunning = false;
let outputWindowReady = false;

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

// ============ Preview ============

function getFormattedPreview() {
  const total = parseHMS(els.duration.value);
  return formatTime(total * 1000, els.format.value);
}

function applyPreview() {
  els.preview.textContent = getFormattedPreview();

  const previewBox = document.querySelector('.preview');
  const bgOpacity = parseFloat(els.bgOpacity.value) || 0;
  const bg = els.bgMode.value === 'solid'
    ? hexToRgba(els.bgColor.value, bgOpacity)
    : 'transparent';

  previewBox.style.background = bg;
  els.preview.style.fontFamily = els.fontFamily.value;
  els.preview.style.fontWeight = els.fontWeight.value;
  els.preview.style.fontSize = els.fontSize.value + 'vw';
  els.preview.style.color = els.fontColor.value;
  els.preview.style.opacity = els.opacity.value;
  els.preview.style.webkitTextStrokeWidth = els.strokeWidth.value + 'px';
  els.preview.style.webkitTextStrokeColor = els.strokeColor.value;
  els.preview.style.textShadow = els.shadow.value;
  els.preview.style.letterSpacing = els.letterSpacing.value + 'em';
  els.preview.style.textAlign = els.align.value;
}

// Debounced preview update for performance
const debouncedPreview = debounce(applyPreview, 50);

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

  if (command === 'start') {
    isRunning = true;
    updateControlStates();
  } else if (command === 'pause' || command === 'reset') {
    isRunning = false;
    updateControlStates();
  }
}

function updateControlStates() {
  els.startBtn.disabled = isRunning;
  els.pauseBtn.disabled = !isRunning;
}

// ============ Presets ============

function loadPresets() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PRESETS);
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
    empty.textContent = 'No presets saved';
    els.presetList.appendChild(empty);
    return;
  }

  list.forEach((preset, idx) => {
    const row = document.createElement('div');
    row.className = 'preset-item';

    const name = document.createElement('div');
    name.className = 'preset-name';
    name.textContent = preset.name;

    const actions = document.createElement('div');
    actions.className = 'preset-actions';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.onclick = () => {
      applyConfig(preset.config);
      sendCommand('reset');
      showToast(`Applied "${preset.name}"`);
    };

    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start';
    startBtn.className = 'secondary';
    startBtn.onclick = () => {
      applyConfig(preset.config);
      sendCommand('start');
      showToast(`Started "${preset.name}"`);
    };

    const dupBtn = document.createElement('button');
    dupBtn.textContent = 'Dup';
    dupBtn.className = 'secondary';
    dupBtn.title = 'Duplicate';
    dupBtn.onclick = () => {
      const presets = loadPresets();
      presets.splice(idx + 1, 0, {
        ...preset,
        name: preset.name + ' (copy)'
      });
      savePresets(presets);
      renderPresetList();
      showToast('Preset duplicated');
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Del';
    delBtn.className = 'secondary';
    delBtn.title = 'Delete';
    delBtn.onclick = () => {
      if (confirm(`Delete "${preset.name}"?`)) {
        const presets = loadPresets();
        presets.splice(idx, 1);
        savePresets(presets);
        renderPresetList();
        showToast('Preset deleted');
      }
    };

    actions.append(applyBtn, startBtn, dupBtn, delBtn);
    row.append(name, actions);
    els.presetList.appendChild(row);
  });
}

function handleSavePreset() {
  const name = els.presetName.value.trim() || 'Preset';
  const config = getCurrentConfig();
  const list = loadPresets();

  list.push({ name, config });
  savePresets(list);
  renderPresetList();

  els.presetName.value = '';
  showToast(`Saved "${name}"`);
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
  // Input change listeners (debounced)
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
      el.addEventListener('input', debouncedPreview);
      el.addEventListener('change', () => {
        applyPreview();
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

  // Window controls
  els.openOutput.addEventListener('click', () => {
    window.hawkario.openOutputWindow();
    showToast('Opening output window...');
  });

  els.goFullscreen.addEventListener('click', () => {
    window.hawkario.fullscreenOutput();
  });

  // Preset controls
  els.savePreset.addEventListener('click', handleSavePreset);
  els.exportPresets.addEventListener('click', handleExportPresets);
  els.importPresets.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', handleImportPresets);

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
    }
  });

  // Output window ready notification
  window.hawkario.onOutputWindowReady(() => {
    outputWindowReady = true;
    // Send current config to new window
    sendCommand('reset');
    showToast('Output window ready', 'success');
  });

  // Save preset on Enter key
  els.presetName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSavePreset();
    }
  });
}

// ============ Initialization ============

function init() {
  setupEventListeners();
  applyPreview();
  renderPresetList();
  updateControlStates();

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

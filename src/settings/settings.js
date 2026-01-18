/**
 * Ninja Timer - Settings Window
 * Detached timer settings editor
 */

// Built-in fonts (duplicated from fontManager.js to avoid ES module import issues)
const BUILT_IN_FONTS = [
  { family: 'Inter', weights: [400, 600, 700], description: 'Modern & Clean' },
  { family: 'Roboto', weights: [400, 700], description: 'Versatile' },
  { family: 'JetBrains Mono', weights: [400, 600], description: 'Monospace' },
  { family: 'Oswald', weights: [400, 700], description: 'Bold Condensed' },
  { family: 'Bebas Neue', weights: [400], description: 'Classic Display' },
  { family: 'Orbitron', weights: [400, 700], description: 'Futuristic' },
  { family: 'Teko', weights: [400, 600], description: 'Modern Condensed' },
  { family: 'Share Tech Mono', weights: [400], description: 'Digital' }
];

// ============ State ============
let currentTimerIndex = null;
let currentTimerName = '';
let isDirty = false;

// ============ DOM Elements ============
const els = {
  windowTitle: document.getElementById('windowTitle'),
  saveBtn: document.getElementById('saveBtn'),
  preview: document.getElementById('preview'),
  previewTimer: document.getElementById('previewTimer'),
  previewToD: document.getElementById('previewToD'),
  timerSection: document.querySelector('.timer-section'),
  durationControls: document.getElementById('durationControls'),
  hoursGroup: document.getElementById('hoursGroup'),
  h0Col: document.getElementById('h0Col'),
  toastContainer: document.getElementById('toastContainer'),

  // Form fields
  presetName: document.getElementById('presetName'),
  mode: document.getElementById('mode'),
  startMode: document.getElementById('startMode'),
  targetTime: document.getElementById('targetTime'),
  targetTimeRow: document.getElementById('targetTimeRow'),
  format: document.getElementById('format'),
  duration: document.getElementById('duration'),
  allowOvertime: document.getElementById('allowOvertime'),
  allowOvertimeRow: document.getElementById('allowOvertimeRow'),
  fontFamily: document.getElementById('fontFamily'),
  fontPicker: document.getElementById('fontPicker'),
  fontWeight: document.getElementById('fontWeight'),
  fontColor: document.getElementById('fontColor'),
  strokeWidth: document.getElementById('strokeWidth'),
  strokeColor: document.getElementById('strokeColor'),
  shadowSize: document.getElementById('shadowSize'),
  shadowColor: document.getElementById('shadowColor'),
  bgColor: document.getElementById('bgColor'),
  soundEnd: document.getElementById('soundEnd'),
  soundPreview: document.getElementById('soundPreview'),
  soundVolume: document.getElementById('soundVolume'),
  volumeRow: document.getElementById('volumeRow'),
  warnYellowSec: document.getElementById('warnYellowSec'),
  warnOrangeSec: document.getElementById('warnOrangeSec')
};

// Map BUILT_IN_FONTS to picker format
const FONTS = BUILT_IN_FONTS.map(f => ({
  family: f.family,
  name: f.family.split(' ')[0], // Short name
  desc: f.description
}));

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

  setupTabs();
  setupFontPicker();
  setupDurationControls();
  setupFormListeners();
  setupKeyboardShortcuts();

  // Save button
  els.saveBtn.addEventListener('click', saveTimer);

  // Signal that we're ready
  window.ninja.signalSettingsReady();

  // Listen for initial timer data
  window.ninja.onSettingsInit((timerIndex) => {
    currentTimerIndex = timerIndex;
    requestTimerData(timerIndex);
  });

  // Listen for timer data from control
  window.ninja.onSettingsTimerData((data) => {
    loadTimerData(data);
  });

  // Listen for load timer requests (when selection changes in main window)
  window.ninja.onSettingsLoadTimer((timerIndex) => {
    // Auto-save current if dirty
    if (isDirty && currentTimerIndex !== null) {
      saveTimer(true); // silent save
    }
    currentTimerIndex = timerIndex;
    requestTimerData(timerIndex);
  });
}

// ============ Timer Data ============
function requestTimerData(timerIndex) {
  window.ninja.requestSettingsTimer(timerIndex);
}

function loadTimerData(data) {
  if (!data || !data.preset) return;

  const { index, preset } = data;
  currentTimerIndex = index;
  currentTimerName = preset.name;
  const config = preset.config;

  // Update window title
  els.windowTitle.textContent = `Timer Settings — ${preset.name}`;

  // Populate form fields
  els.presetName.value = preset.name;
  els.mode.value = config.mode || 'countdown';
  els.startMode.value = config.startMode || 'manual';
  els.format.value = config.format || 'MM:SS';
  els.duration.value = formatDuration(config.durationSec || 600);
  els.allowOvertime.checked = config.allowOvertime !== false;

  // Target time (for startAt/endBy modes)
  if (config.targetTime) {
    // Convert ISO string to datetime-local format
    const dt = new Date(config.targetTime);
    const localIso = dt.toISOString().slice(0, 16);
    els.targetTime.value = localIso;
  } else {
    els.targetTime.value = '';
  }

  // Appearance
  selectFont(config.style?.fontFamily || 'Inter');
  els.fontWeight.value = config.style?.fontWeight || '700';
  els.fontColor.value = config.style?.color || '#ffffff';
  els.strokeWidth.value = config.style?.strokeWidth || 0;
  els.strokeColor.value = config.style?.strokeColor || '#000000';
  els.shadowSize.value = config.style?.shadowSize || 0;
  els.shadowColor.value = config.style?.shadowColor || '#000000';
  els.bgColor.value = config.style?.bgColor || '#000000';

  // Sound
  els.soundEnd.value = config.sound?.endType || 'none';
  els.soundVolume.value = config.sound?.volume ?? 0.7;

  // Warnings
  els.warnYellowSec.value = formatWarningTime(config.warnYellowSec ?? 60);
  els.warnOrangeSec.value = formatWarningTime(config.warnOrangeSec ?? 15);

  // Update UI state
  updateDurationControlsFormat();
  updateH0ColVisibility();
  updateOvertimeVisibility();
  updateTargetTimeVisibility();
  updateVolumeVisibility();
  updatePreview();

  isDirty = false;
}

function saveTimer(silent = false) {
  const config = getCurrentConfig();
  const name = els.presetName.value.trim() || 'Timer';

  window.ninja.saveSettingsTimer({
    index: currentTimerIndex,
    preset: {
      name,
      config
    }
  });

  currentTimerName = name;
  els.windowTitle.textContent = `Timer Settings — ${name}`;
  isDirty = false;

  if (!silent) {
    showToast(`Saved "${name}"`, 'success');
  }
}

function getCurrentConfig() {
  const config = {
    mode: els.mode.value,
    startMode: els.startMode.value,
    durationSec: parseDuration(els.duration.value),
    format: els.format.value,
    allowOvertime: els.allowOvertime.checked,
    style: {
      fontFamily: els.fontFamily.value,
      fontWeight: parseInt(els.fontWeight.value, 10),
      color: els.fontColor.value,
      strokeWidth: parseInt(els.strokeWidth.value, 10) || 0,
      strokeColor: els.strokeColor.value,
      shadowSize: parseInt(els.shadowSize.value, 10) || 0,
      shadowColor: els.shadowColor.value,
      bgColor: els.bgColor.value
    },
    sound: {
      endType: els.soundEnd.value,
      volume: parseFloat(els.soundVolume.value)
    },
    warnYellowSec: parseWarningTime(els.warnYellowSec.value),
    warnOrangeSec: parseWarningTime(els.warnOrangeSec.value)
  };

  // Include targetTime if startMode requires it
  if (els.startMode.value !== 'manual' && els.targetTime.value) {
    config.targetTime = new Date(els.targetTime.value).toISOString();
  }

  return config;
}

// ============ Tabs ============
function setupTabs() {
  const tabs = document.querySelectorAll('.settings-tab');
  const panels = document.querySelectorAll('.settings-tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPanel = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.querySelector(`[data-panel="${targetPanel}"]`).classList.add('active');
    });
  });
}

// ============ Font Picker ============
function setupFontPicker() {
  els.fontPicker.innerHTML = FONTS.map(font => `
    <div class="font-option" data-font="${font.family}">
      <div class="font-option-preview" style="font-family: '${font.family}'">12</div>
      <div class="font-option-name">${font.name}</div>
      <div class="font-option-desc">${font.desc}</div>
    </div>
  `).join('');

  els.fontPicker.addEventListener('click', (e) => {
    const option = e.target.closest('.font-option');
    if (option) {
      selectFont(option.dataset.font);
      markDirty();
      updatePreview();
    }
  });
}

function selectFont(fontFamily) {
  els.fontFamily.value = fontFamily;

  // Update selection UI
  document.querySelectorAll('.font-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.font === fontFamily);
  });

  // Scroll selected into view
  const selected = document.querySelector('.font-option.selected');
  if (selected) {
    selected.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// ============ Duration Controls ============
function setupDurationControls() {
  // Digit buttons
  document.querySelectorAll('.digit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const digit = btn.dataset.digit;
      const isUp = btn.classList.contains('digit-up');
      adjustDigit(digit, isUp ? 1 : -1);
      markDirty();
      updatePreview();
    });
  });

  // Duration input direct edit
  els.duration.addEventListener('change', () => {
    markDirty();
    updateH0ColVisibility();
    updatePreview();
  });
}

function adjustDigit(digit, delta) {
  const currentSec = parseDuration(els.duration.value);
  let h = Math.floor(currentSec / 3600);
  let m = Math.floor((currentSec % 3600) / 60);
  let s = currentSec % 60;

  // Split hours into digits
  let h0 = Math.floor(h / 100);
  let h1 = Math.floor((h % 100) / 10);
  let h2 = h % 10;
  let m1 = Math.floor(m / 10);
  let m2 = m % 10;
  let s1 = Math.floor(s / 10);
  let s2 = s % 10;

  // Apply delta
  switch (digit) {
    case 'h0': h0 = Math.max(0, Math.min(9, h0 + delta)); break;
    case 'h1': h1 = Math.max(0, Math.min(9, h1 + delta)); break;
    case 'h2': h2 = Math.max(0, Math.min(9, h2 + delta)); break;
    case 'm1': m1 = Math.max(0, Math.min(5, m1 + delta)); break;
    case 'm2': m2 = Math.max(0, Math.min(9, m2 + delta)); break;
    case 's1': s1 = Math.max(0, Math.min(5, s1 + delta)); break;
    case 's2': s2 = Math.max(0, Math.min(9, s2 + delta)); break;
  }

  // Reconstruct
  h = h0 * 100 + h1 * 10 + h2;
  m = m1 * 10 + m2;
  s = s1 * 10 + s2;
  const newSec = h * 3600 + m * 60 + s;

  els.duration.value = formatDuration(newSec);
  updateH0ColVisibility();
}

function updateH0ColVisibility() {
  // Show/hide h0 (hundreds of hours) column based on current duration
  if (els.h0Col) {
    const currentSec = parseDuration(els.duration.value);
    const h = Math.floor(currentSec / 3600);
    els.h0Col.style.display = h >= 100 ? '' : 'none';
  }
}

function updateDurationControlsFormat() {
  // Duration controls always show HH:MM:SS for consistent editing
  // The Format dropdown only affects the output window display
  // (No class toggle - hours group always visible)
}

// ============ Form Listeners ============
function setupFormListeners() {
  // All inputs trigger dirty state and preview update
  const inputs = [
    els.presetName, els.mode, els.startMode, els.targetTime, els.format,
    els.duration, els.allowOvertime,
    els.fontWeight, els.fontColor, els.strokeWidth, els.strokeColor,
    els.shadowSize, els.shadowColor, els.bgColor,
    els.soundEnd, els.soundVolume,
    els.warnYellowSec, els.warnOrangeSec
  ];

  inputs.forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
      markDirty();
      updatePreview();
    });
    input.addEventListener('change', () => {
      markDirty();
      updatePreview();
    });
  });

  // Mode change affects overtime visibility, duration controls, and ToD preview
  els.mode.addEventListener('change', () => {
    updateOvertimeVisibility();
    updateDurationControlsFormat();
    updatePreview();
  });

  // Start mode change affects target time visibility
  els.startMode.addEventListener('change', () => {
    updateTargetTimeVisibility();
  });

  // Format change affects duration controls
  els.format.addEventListener('change', () => {
    updateDurationControlsFormat();
  });

  // Sound change affects volume visibility
  els.soundEnd.addEventListener('change', () => {
    updateVolumeVisibility();
  });

  // Sound preview
  els.soundPreview?.addEventListener('click', () => {
    const soundType = els.soundEnd.value;
    const volume = parseFloat(els.soundVolume.value) || 0.7;
    if (soundType && soundType !== 'none') {
      playPreviewSound(soundType, volume);
    }
  });
}

// Simple sound preview using Web Audio API
let audioContext = null;
function playPreviewSound(type, volume = 0.5) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Different sound types
  const sounds = {
    chime: { freq: 880, duration: 0.3, type: 'sine' },
    bell: { freq: 660, duration: 0.4, type: 'triangle' },
    alert: { freq: 440, duration: 0.2, type: 'square' },
    gong: { freq: 220, duration: 0.6, type: 'sine' },
    soft: { freq: 523, duration: 0.25, type: 'sine' }
  };

  const sound = sounds[type] || sounds.chime;

  oscillator.type = sound.type;
  oscillator.frequency.setValueAtTime(sound.freq, now);

  gainNode.gain.setValueAtTime(volume * 0.3, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + sound.duration);

  oscillator.start(now);
  oscillator.stop(now + sound.duration);
}

function markDirty() {
  isDirty = true;
}

function updateOvertimeVisibility() {
  const mode = els.mode.value;
  const showOvertime = mode === 'countdown' || mode === 'countdown-tod';
  els.allowOvertimeRow.style.display = showOvertime ? '' : 'none';
}

function updateTargetTimeVisibility() {
  const startMode = els.startMode.value;
  const showTargetTime = startMode !== 'manual';
  els.targetTimeRow.classList.toggle('hidden', !showTargetTime);
}

function updateVolumeVisibility() {
  // No-op: volume slider always visible
}

// ============ Preview ============
function updatePreview() {
  const config = getCurrentConfig();
  const mode = config.mode;

  // Check if mode includes ToD
  const showToD = mode === 'tod' || mode === 'countdown-tod' || mode === 'countup-tod';

  // Update timer section class for ToD display
  if (els.timerSection) {
    els.timerSection.classList.toggle('with-tod', showToD);
  }

  // Timer display
  if (mode === 'tod') {
    // Pure ToD mode - show current time
    const now = new Date();
    els.previewTimer.textContent = formatTimeOfDay(now);
  } else {
    // Show duration in HH:MM:SS format for consistent editing
    const sec = config.durationSec;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    // Handle HHH (100+ hours) display
    const text = h >= 100
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    els.previewTimer.textContent = text;
  }

  // ToD preview (for modes that show both)
  if (showToD && els.previewToD) {
    const now = new Date();
    els.previewToD.textContent = formatTimeOfDay(now);
    els.previewToD.style.display = '';
  } else if (els.previewToD) {
    els.previewToD.style.display = 'none';
  }

  // Update preview styles
  const style = config.style;
  els.previewTimer.style.fontFamily = `'${style.fontFamily}', sans-serif`;
  els.previewTimer.style.fontWeight = style.fontWeight;
  els.previewTimer.style.color = style.color;
  els.preview.style.backgroundColor = style.bgColor;

  // Stroke (text-shadow based)
  if (style.strokeWidth > 0) {
    const sw = style.strokeWidth;
    const sc = style.strokeColor;
    els.previewTimer.style.webkitTextStroke = `${sw}px ${sc}`;
  } else {
    els.previewTimer.style.webkitTextStroke = 'none';
  }

  // Shadow
  if (style.shadowSize > 0) {
    const ss = style.shadowSize;
    const shc = style.shadowColor;
    els.previewTimer.style.textShadow = `0 0 ${ss}px ${shc}`;
  } else {
    els.previewTimer.style.textShadow = 'none';
  }
}

// Format time of day
function formatTimeOfDay(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ============ Keyboard Shortcuts ============
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Escape to close
    if (e.key === 'Escape') {
      handleClose();
    }

    // Cmd/Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveTimer();
    }

    // Cmd/Ctrl+W to close
    if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
      e.preventDefault();
      handleClose();
    }
  });
}

function handleClose() {
  // Auto-save if dirty
  if (isDirty && currentTimerIndex !== null) {
    saveTimer(true);
  }
  window.ninja.closeSettingsWindow();
}

// ============ Utilities ============
function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseDuration(str) {
  if (!str) return 600;

  // Remove non-numeric except colons
  str = str.replace(/[^\d:]/g, '');

  const parts = str.split(':').map(p => parseInt(p, 10) || 0);

  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    // Just seconds or minutes based on value
    return parts[0] > 99 ? parts[0] : parts[0] * 60;
  }

  return 600;
}

function formatWarningTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseWarningTime(str) {
  if (!str) return 0;
  const parts = str.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseInt(str, 10) || 0;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

// ============ Start ============
document.addEventListener('DOMContentLoaded', init);

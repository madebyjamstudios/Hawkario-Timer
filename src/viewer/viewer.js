/**
 * Hawkario Timer -Viewer Window
 * Output display for the timer
 */

import { formatTime, formatTimeOfDay, hexToRgba } from '../shared/timer.js';
import { playWarningSound, playEndSound, initAudio } from '../shared/sounds.js';

// DOM Elements
const timerEl = document.getElementById('timer');
const stageEl = document.querySelector('.stage');
const fsHintEl = document.getElementById('fsHint');

// Timer state
const state = {
  running: false,
  mode: 'countdown',
  durationSec: 0,
  startedAt: null,
  pausedAcc: 0,
  format: 'MM:SS',
  style: {
    fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    fontWeight: '600',
    fontSizeVw: 25,
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
    enabled: false,
    seconds: 120,
    colorEnabled: true,
    color: '#ff3333',
    flashEnabled: false,
    flashRateMs: 500,
    soundEnabled: false
  },
  sound: {
    warnEnabled: false,
    endEnabled: true,
    volume: 0.7
  }
};

// Track if warning sound has been played this cycle
let warningSoundPlayed = false;
let endSoundPlayed = false;

// Overtime state (when timer ends without linked next timer)
let isOvertime = false;
let overtimeStartedAt = null;

// Flash animation state
let isFlashing = false;

// Blackout state
let isBlackedOut = false;
const blackoutEl = document.createElement('div');
blackoutEl.className = 'blackout-overlay';
blackoutEl.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.5s ease;';
document.body.appendChild(blackoutEl);

/**
 * Toggle blackout overlay with fade animation
 */
function toggleBlackout() {
  isBlackedOut = !isBlackedOut;
  if (isBlackedOut) {
    blackoutEl.style.pointerEvents = 'auto';
    blackoutEl.style.opacity = '1';
  } else {
    blackoutEl.style.opacity = '0';
    blackoutEl.style.pointerEvents = 'none';
  }
}

/**
 * Flash the timer: glow → grey → repeat 3 times
 * Sequence: static → glow → grey → glow → grey → glow → grey → back to original
 */
function triggerFlash() {
  const originalColor = timerEl.style.color;
  const originalShadow = timerEl.style.textShadow;
  const originalStroke = timerEl.style.webkitTextStrokeColor;
  const originalStrokeWidth = timerEl.style.webkitTextStrokeWidth;

  // Mark as flashing to prevent applyColorState from overriding
  isFlashing = true;

  // Timing
  const glowDuration = 400;  // How long to show white glow
  const greyDuration = 300;  // How long to show grey

  let flashCount = 0;
  const maxFlashes = 3;

  const showGlow = () => {
    // White glow effect (compact but strong)
    timerEl.style.color = '#ffffff';
    timerEl.style.webkitTextStrokeColor = '#ffffff';
    timerEl.style.webkitTextStrokeWidth = '1px';
    timerEl.style.textShadow = '0 0 2px #fff, 0 0 4px #fff, 0 0 8px rgba(255,255,255,0.9)';

    setTimeout(showGrey, glowDuration);
  };

  const showGrey = () => {
    // Grey text - no glow, just grey
    timerEl.style.color = '#666666';
    timerEl.style.webkitTextStrokeColor = '#666666';
    timerEl.style.webkitTextStrokeWidth = '0px';
    timerEl.style.textShadow = 'none';

    flashCount++;

    if (flashCount < maxFlashes) {
      setTimeout(showGlow, greyDuration);
    } else {
      // Done flashing, restore original after brief grey display
      setTimeout(() => {
        timerEl.style.color = originalColor;
        timerEl.style.textShadow = originalShadow;
        timerEl.style.webkitTextStrokeColor = originalStroke;
        timerEl.style.webkitTextStrokeWidth = originalStrokeWidth;
        isFlashing = false;
      }, greyDuration);
    }
  };

  // Start with glow
  showGlow();
}

/**
 * Apply style configuration to timer element
 */
function applyStyle(style) {
  if (!style) return;

  timerEl.style.fontFamily = style.fontFamily;
  timerEl.style.fontWeight = style.fontWeight;
  timerEl.style.fontSize = style.fontSizeVw + 'vw';
  timerEl.style.color = style.color;
  timerEl.style.opacity = style.opacity;
  timerEl.style.textShadow = style.textShadow;
  timerEl.style.letterSpacing = style.letterSpacing + 'em';
  timerEl.style.webkitTextStrokeWidth = (style.strokeWidth || 0) + 'px';
  timerEl.style.webkitTextStrokeColor = style.strokeColor || '#000';
  timerEl.style.textAlign = style.align || 'center';

  // Alignment adjustments
  if (style.align === 'left') {
    stageEl.style.placeItems = 'center start';
    timerEl.style.justifySelf = 'start';
    timerEl.style.paddingLeft = '5vw';
  } else if (style.align === 'right') {
    stageEl.style.placeItems = 'center end';
    timerEl.style.justifySelf = 'end';
    timerEl.style.paddingRight = '5vw';
  } else {
    stageEl.style.placeItems = 'center';
    timerEl.style.justifySelf = 'center';
    timerEl.style.paddingLeft = '0';
    timerEl.style.paddingRight = '0';
  }

  // Background
  const bg = style.bgMode === 'solid'
    ? hexToRgba(style.bgColor, style.bgOpacity)
    : 'transparent';
  document.body.style.background = bg;
  stageEl.style.background = bg;
}

/**
 * Apply color state based on percentage remaining
 * Normal (white): > 20% remaining
 * Warning (yellow): 10-20% remaining
 * Danger (red): < 10% remaining
 */
function applyColorState(remainingSec, durationSec) {
  // Skip color changes during flash animation
  if (isFlashing) return;

  // Reset classes
  timerEl.classList.remove('warning', 'danger');

  if (durationSec <= 0 || remainingSec <= 0) {
    timerEl.style.color = state.style.color;
    timerEl.style.opacity = state.style.opacity;
    return;
  }

  const percentRemaining = (remainingSec / durationSec) * 100;

  if (percentRemaining <= 10) {
    // Danger state - red
    timerEl.style.color = '#ff3333';
    timerEl.classList.add('danger');

    // Flash effect in danger zone if enabled
    if (state.warn.flashEnabled) {
      const phase = Math.floor(Date.now() / state.warn.flashRateMs) % 2;
      timerEl.style.opacity = phase
        ? state.style.opacity
        : Math.max(0.15, state.style.opacity * 0.25);
    } else {
      timerEl.style.opacity = state.style.opacity;
    }
  } else if (percentRemaining <= 20) {
    // Warning state - yellow
    timerEl.style.color = '#ffcc00';
    timerEl.classList.add('warning');
    timerEl.style.opacity = state.style.opacity;
  } else {
    // Normal state - use configured color
    timerEl.style.color = state.style.color;
    timerEl.style.opacity = state.style.opacity;
  }
}

/**
 * Main render loop
 */
function render() {
  let displayText = '';
  let elapsed = 0;
  let remainingSec = 0;

  // Handle hidden mode
  if (state.mode === 'hidden') {
    timerEl.style.visibility = 'hidden';
    requestAnimationFrame(render);
    return;
  } else {
    timerEl.style.visibility = 'visible';
  }

  // Handle Time of Day modes
  if (state.mode === 'tod') {
    displayText = formatTimeOfDay(state.format);
    applyColorState(0, 0); // No warning colors for ToD
    timerEl.textContent = displayText;
    requestAnimationFrame(render);
    return;
  }

  // Handle countdown/countup with optional ToD
  const isCountdown = state.mode === 'countdown' || state.mode === 'countdown-tod';
  const isCountup = state.mode === 'countup' || state.mode === 'countup-tod';
  const showToD = state.mode === 'countdown-tod' || state.mode === 'countup-tod';

  if (!state.running || state.startedAt === null) {
    // Timer is idle
    elapsed = isCountdown ? state.durationSec * 1000 : 0;
    remainingSec = Math.floor(elapsed / 1000);

    // Apply color state based on percentage
    if (isCountdown) {
      applyColorState(remainingSec, state.durationSec);
    } else {
      applyColorState(0, 0);
    }
  } else {
    // Timer is running
    const now = Date.now();
    const base = now - state.startedAt + state.pausedAcc;

    if (isCountdown) {
      elapsed = Math.max(0, (state.durationSec * 1000) - base);
      remainingSec = Math.floor(elapsed / 1000);

      // Check if timer ended
      if (elapsed === 0 && !isOvertime) {
        // Start overtime mode
        isOvertime = true;
        overtimeStartedAt = Date.now();
        timerEl.classList.add('ended');
        timerEl.classList.add('overtime');

        // Play end sound
        if (!endSoundPlayed && state.sound.endEnabled) {
          playEndSound(state.sound.volume);
          endSoundPlayed = true;
        }
      }

      // Apply color state based on percentage
      applyColorState(remainingSec, state.durationSec);

      // Play warning sound at 20% threshold
      const percentRemaining = (remainingSec / state.durationSec) * 100;
      if (percentRemaining <= 20 && !warningSoundPlayed && state.sound.warnEnabled) {
        playWarningSound(state.sound.volume);
        warningSoundPlayed = true;
      }
    } else if (isCountup) {
      // Count up mode
      elapsed = base;
      remainingSec = Math.floor(elapsed / 1000);
      applyColorState(0, 0); // No warning colors for count up
    }
  }

  // Format display text
  if (isOvertime && overtimeStartedAt) {
    // Overtime mode - show +M:SS
    const overtimeMs = Date.now() - overtimeStartedAt;
    const overtimeSec = Math.floor(overtimeMs / 1000);
    const mins = Math.floor(overtimeSec / 60);
    const secs = overtimeSec % 60;
    displayText = '+' + mins + ':' + String(secs).padStart(2, '0');
  } else {
    displayText = formatTime(elapsed, state.format);
  }

  // Add Time of Day if needed
  if (showToD) {
    displayText += '  |  ' + formatTimeOfDay(state.format);
  }

  timerEl.textContent = displayText;
  requestAnimationFrame(render);
}

/**
 * Handle incoming timer updates from control window
 */
function handleTimerUpdate(data) {
  const { command, config } = data;

  // Apply configuration
  if (config) {
    state.mode = config.mode || state.mode;
    state.durationSec = config.durationSec ?? state.durationSec;
    state.format = config.format || state.format;

    if (config.style) {
      state.style = { ...state.style, ...config.style };
      applyStyle(state.style);
    }

    if (config.warn) {
      state.warn = { ...state.warn, ...config.warn };
    }

    if (config.sound) {
      state.sound = { ...state.sound, ...config.sound };
    }
  }

  // Handle commands
  switch (command) {
    case 'start':
      state.running = true;
      state.startedAt = Date.now();
      state.pausedAcc = 0;
      warningSoundPlayed = false;
      endSoundPlayed = false;
      isOvertime = false;
      overtimeStartedAt = null;
      timerEl.classList.remove('ended', 'overtime');
      break;

    case 'pause':
      if (state.running) {
        state.running = false;
        state.pausedAcc += Date.now() - state.startedAt;
      }
      break;

    case 'resume':
      // Resume from paused state without resetting
      state.running = true;
      state.startedAt = Date.now();
      // Keep pausedAcc as is - it contains the elapsed time
      break;

    case 'reset':
      state.running = false;
      state.startedAt = null;
      state.pausedAcc = 0;
      warningSoundPlayed = false;
      endSoundPlayed = false;
      isOvertime = false;
      overtimeStartedAt = null;
      timerEl.classList.remove('ended', 'overtime', 'warning', 'danger');
      // Reset to initial color state
      applyColorState(state.durationSec, state.durationSec);
      break;

    case 'config':
      // Config-only update, no command
      break;

    case 'flash':
      // Flash the timer white a few times
      triggerFlash();
      break;

    case 'sync':
      // Sync full timer state from control window
      if (config.timerState) {
        state.startedAt = config.timerState.startedAt;
        state.pausedAcc = config.timerState.pausedAcc || 0;
        isOvertime = config.timerState.overtime || false;
        overtimeStartedAt = config.timerState.overtimeStartedAt || null;
        if (config.timerState.ended) {
          timerEl.classList.add('ended');
        }
        if (isOvertime) {
          timerEl.classList.add('overtime');
        }
      }
      state.running = config.isRunning || false;
      warningSoundPlayed = true; // Don't replay sounds on sync
      endSoundPlayed = true;
      break;
  }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key.toLowerCase()) {
      case ' ':
        // Space - toggle play/pause (send to control)
        e.preventDefault();
        window.hawkario.sendKeyboardShortcut('toggle');
        break;

      case 'r':
        // Reset
        window.hawkario.sendKeyboardShortcut('reset');
        break;

      case 'b':
        // Blackout toggle
        window.hawkario.sendKeyboardShortcut('blackout');
        break;

      case 'escape':
        // Toggle fullscreen
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        break;
    }
  });
}

/**
 * Setup fullscreen hint with slow fade
 */
function setupFullscreenHint() {
  let hintTimeout;
  let hasInteracted = false;

  const fadeOutHint = () => {
    if (fsHintEl) {
      fsHintEl.classList.add('fade-out');
    }
  };

  const hideHintFast = () => {
    if (fsHintEl) {
      fsHintEl.classList.remove('fade-out');
      fsHintEl.classList.add('hidden');
    }
  };

  const showHint = () => {
    if (fsHintEl && !hasInteracted) {
      fsHintEl.classList.remove('hidden', 'fade-out');
      clearTimeout(hintTimeout);
      // Start slow fade after 2 seconds visible
      hintTimeout = setTimeout(fadeOutHint, 2000);
    }
  };

  // Hide immediately when entering fullscreen
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      hideHintFast();
      hasInteracted = true;
    }
  });

  // Show on mouse movement (only if not interacted yet)
  document.addEventListener('mousemove', () => {
    if (!hasInteracted) {
      showHint();
    }
  });

  // Initial slow fade after 6 seconds
  setTimeout(fadeOutHint, 6000);
}

/**
 * Initialize audio on first user interaction
 */
function setupAudioInit() {
  const initOnInteraction = () => {
    initAudio();
    document.removeEventListener('click', initOnInteraction);
    document.removeEventListener('keydown', initOnInteraction);
  };

  document.addEventListener('click', initOnInteraction);
  document.addEventListener('keydown', initOnInteraction);
}

/**
 * Initialize viewer
 */
function init() {
  // Apply initial styles
  applyStyle(state.style);

  // Setup IPC listener
  window.hawkario.onTimerUpdate(handleTimerUpdate);

  // Setup blackout listener
  window.hawkario.onBlackoutToggle(toggleBlackout);

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Setup fullscreen hint behavior
  setupFullscreenHint();

  // Setup audio initialization
  setupAudioInit();

  // Start render loop
  render();
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

/**
 * Hawkario - Viewer Window
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

// Blackout state
let isBlackedOut = false;
const blackoutEl = document.createElement('div');
blackoutEl.className = 'blackout-overlay';
blackoutEl.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;opacity:0;pointer-events:none;transition:opacity 1s ease;';
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
 * Flash the timer: fade to white glow → fade to grey × 3 times
 */
function triggerFlash() {
  const originalColor = timerEl.style.color;
  const originalShadow = timerEl.style.textShadow;
  const originalStroke = timerEl.style.webkitTextStrokeColor;
  const originalStrokeWidth = timerEl.style.webkitTextStrokeWidth;
  const originalTransition = timerEl.style.transition;

  let flashCount = 0;
  const maxFlashes = 3;
  const fadeDuration = 300;  // 0.3s fade transition
  const holdDuration = 200;  // 0.2s hold at peak

  // Enable smooth transitions
  timerEl.style.transition = 'color 0.3s ease, text-shadow 0.3s ease, -webkit-text-stroke-color 0.3s ease';

  const doFlash = () => {
    if (flashCount >= maxFlashes) {
      // Fade back to original
      timerEl.style.color = originalColor;
      timerEl.style.textShadow = originalShadow;
      timerEl.style.webkitTextStrokeColor = originalStroke;
      timerEl.style.webkitTextStrokeWidth = originalStrokeWidth;

      // Remove transition after final fade completes
      setTimeout(() => {
        timerEl.style.transition = originalTransition;
      }, fadeDuration);
      return;
    }

    // Fade IN to white glow
    timerEl.style.color = '#ffffff';
    timerEl.style.webkitTextStrokeColor = '#ffffff';
    timerEl.style.webkitTextStrokeWidth = '2px';
    timerEl.style.textShadow = '0 0 8px rgba(255,255,255,1), 0 0 15px rgba(255,255,255,0.8)';

    setTimeout(() => {
      // Fade OUT to grey (high contrast)
      timerEl.style.color = '#444444';
      timerEl.style.textShadow = 'none';
      timerEl.style.webkitTextStrokeColor = '#333333';
      timerEl.style.webkitTextStrokeWidth = '1px';

      setTimeout(() => {
        flashCount++;
        doFlash();
      }, fadeDuration + holdDuration);
    }, fadeDuration + holdDuration);
  };

  doFlash();
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
 * Apply warning state styling
 */
function applyWarningState(active) {
  if (active) {
    // Color change
    if (state.warn.colorEnabled) {
      timerEl.style.color = state.warn.color;
    }

    // Flash effect
    if (state.warn.flashEnabled) {
      const phase = Math.floor(Date.now() / state.warn.flashRateMs) % 2;
      timerEl.style.opacity = phase
        ? state.style.opacity
        : Math.max(0.15, state.style.opacity * 0.25);
    }

    timerEl.classList.add('warning');
  } else {
    timerEl.style.color = state.style.color;
    timerEl.style.opacity = state.style.opacity;
    timerEl.classList.remove('warning');
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
    applyWarningState(false);
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

    const warnActiveIdle = isCountdown &&
      state.warn.enabled &&
      remainingSec <= state.warn.seconds &&
      remainingSec > 0;

    applyWarningState(warnActiveIdle);
  } else {
    // Timer is running
    const now = Date.now();
    const base = now - state.startedAt + state.pausedAcc;

    if (isCountdown) {
      elapsed = Math.max(0, (state.durationSec * 1000) - base);
      remainingSec = Math.floor(elapsed / 1000);

      // Check if timer ended
      if (elapsed === 0) {
        state.running = false;
        timerEl.classList.add('ended');

        // Play end sound
        if (!endSoundPlayed && state.sound.endEnabled) {
          playEndSound(state.sound.volume);
          endSoundPlayed = true;
        }
      }

      // Warning state
      const warnActive = state.warn.enabled &&
        remainingSec <= state.warn.seconds &&
        remainingSec > 0;

      applyWarningState(warnActive);

      // Play warning sound once
      if (warnActive && !warningSoundPlayed && state.sound.warnEnabled) {
        playWarningSound(state.sound.volume);
        warningSoundPlayed = true;
      }
    } else if (isCountup) {
      // Count up mode
      elapsed = base;
      remainingSec = Math.floor(elapsed / 1000);
      applyWarningState(false);
    }
  }

  // Format display text
  displayText = formatTime(elapsed, state.format);

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
      timerEl.classList.remove('ended');
      break;

    case 'pause':
      if (state.running) {
        state.running = false;
        state.pausedAcc += Date.now() - state.startedAt;
      }
      break;

    case 'reset':
      state.running = false;
      state.startedAt = null;
      state.pausedAcc = 0;
      warningSoundPlayed = false;
      endSoundPlayed = false;
      timerEl.classList.remove('ended');
      applyWarningState(false);
      break;

    case 'config':
      // Config-only update, no command
      break;

    case 'flash':
      // Flash the timer white a few times
      triggerFlash();
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

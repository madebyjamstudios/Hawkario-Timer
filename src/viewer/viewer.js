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

// Hardcoded style defaults (not user-configurable)
const FIXED_STYLE = {
  fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  fontWeight: '600',
  opacity: 1,
  align: 'center',
  letterSpacing: 0.02
};

/**
 * Generate text shadow CSS from size value
 */
function getShadowCSS(sizePx) {
  if (sizePx === 0) return 'none';
  const blur = sizePx;
  const spread = Math.round(sizePx * 0.3);
  return `0 ${spread}px ${blur}px rgba(0,0,0,0.5)`;
}

// Timer state
const state = {
  running: false,
  mode: 'countdown',
  durationSec: 0,
  startedAt: null,
  pausedAcc: 0,
  format: 'MM:SS',
  style: {
    color: '#ffffff',
    strokeWidth: 2,
    strokeColor: '#000000',
    shadowSize: 10,
    bgColor: '#000000'
  },
  sound: {
    endEnabled: false,
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

// Display state from control window (master source)
let displayState = {
  visible: true,
  text: '00:00',
  colorState: 'normal',
  color: '#ffffff',
  opacity: 1,
  blackout: false,
  overtime: false,
  elapsed: '',
  remaining: '',
  style: null
};
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
    // Scale glow based on viewport width (larger window = larger glow)
    const vw = window.innerWidth / 100;
    const glowScale = Math.max(1, vw * 0.15); // Scale factor based on viewport
    const strokeWidth = Math.max(1, glowScale * 0.5);
    const blur1 = Math.round(glowScale * 2);
    const blur2 = Math.round(glowScale * 4);
    const blur3 = Math.round(glowScale * 8);

    // White glow effect (scales with viewport)
    timerEl.style.color = '#ffffff';
    timerEl.style.webkitTextStrokeColor = '#ffffff';
    timerEl.style.webkitTextStrokeWidth = strokeWidth + 'px';
    timerEl.style.textShadow = `0 0 ${blur1}px #fff, 0 0 ${blur2}px #fff, 0 0 ${blur3}px rgba(255,255,255,0.9)`;

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

  // Use hardcoded FIXED_STYLE values for non-configurable options
  timerEl.style.fontFamily = style.fontFamily || FIXED_STYLE.fontFamily;
  timerEl.style.fontWeight = style.fontWeight || FIXED_STYLE.fontWeight;
  // Font size is auto-calculated by autoFitTimer()
  timerEl.style.color = style.color || state.style.color;
  timerEl.style.opacity = FIXED_STYLE.opacity;

  // Handle both broadcast format (textShadow) and state format (shadowSize)
  if (style.textShadow) {
    timerEl.style.textShadow = style.textShadow;
  } else if (style.shadowSize !== undefined) {
    timerEl.style.textShadow = getShadowCSS(style.shadowSize);
  } else {
    timerEl.style.textShadow = getShadowCSS(state.style.shadowSize);
  }

  timerEl.style.letterSpacing = (style.letterSpacing ?? FIXED_STYLE.letterSpacing) + 'em';
  timerEl.style.webkitTextStrokeWidth = (style.strokeWidth ?? state.style.strokeWidth) + 'px';
  timerEl.style.webkitTextStrokeColor = style.strokeColor || state.style.strokeColor;
  timerEl.style.textAlign = style.textAlign || FIXED_STYLE.align;

  // Always centered (no alignment options anymore)
  stageEl.style.placeItems = 'center';
  timerEl.style.justifySelf = 'center';
  timerEl.style.paddingLeft = '0';
  timerEl.style.paddingRight = '0';

  // Background - handle both formats (background from broadcast, bgColor from state)
  const bg = style.background || style.bgColor || state.style.bgColor;
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

  // Always use configured color (no warning states)
  timerEl.style.color = state.style.color;
  timerEl.style.opacity = FIXED_STYLE.opacity;
}

/**
 * Handle display state updates from control window
 * This makes the output a pure mirror of the live preview
 */
function handleDisplayUpdate(newState) {
  displayState = { ...displayState, ...newState };

  // Apply style if provided
  if (newState.style) {
    applyStyle(newState.style);
  }
}

/**
 * Auto-fit timer text to fill 90% of viewport width
 * Dynamically adjusts font size so text always fills available space
 */
function autoFitTimer() {
  // Reset to measure natural size at a base font size
  timerEl.style.fontSize = '100px';
  timerEl.style.transform = 'scale(1)';

  const containerWidth = window.innerWidth;
  const targetWidth = containerWidth * 0.9; // 5% margin each side
  const naturalWidth = timerEl.scrollWidth;

  if (naturalWidth > 0 && containerWidth > 0) {
    // Calculate font size to achieve target width
    const ratio = targetWidth / naturalWidth;
    const newFontSize = Math.max(10, 100 * ratio); // Min 10px for readability
    timerEl.style.fontSize = newFontSize + 'px';
  }
}

/**
 * Main render loop - now just applies display state from control
 */
function render() {
  // Handle visibility
  if (!displayState.visible) {
    timerEl.style.visibility = 'hidden';
    requestAnimationFrame(render);
    return;
  } else {
    timerEl.style.visibility = 'visible';
  }

  // Apply display text from control
  timerEl.textContent = displayState.text;

  // Auto-fit to viewport
  autoFitTimer();

  // Apply color state (skip during flash animation)
  if (!isFlashing) {
    timerEl.style.color = displayState.color;
    timerEl.style.opacity = displayState.opacity;

    // Apply color state classes
    timerEl.classList.remove('warning', 'danger', 'overtime');
    if (displayState.colorState === 'warning') {
      timerEl.classList.add('warning');
    } else if (displayState.colorState === 'danger') {
      timerEl.classList.add('danger');
    } else if (displayState.colorState === 'overtime' || displayState.overtime) {
      timerEl.classList.add('overtime');
    }
  }

  // Handle blackout from control
  if (displayState.blackout !== isBlackedOut) {
    isBlackedOut = displayState.blackout;
    if (isBlackedOut) {
      blackoutEl.style.pointerEvents = 'auto';
      blackoutEl.style.opacity = '1';
    } else {
      blackoutEl.style.opacity = '0';
      blackoutEl.style.pointerEvents = 'none';
    }
  }

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

  // Setup IPC listener for timer commands (sounds, flash, etc.)
  window.hawkario.onTimerUpdate(handleTimerUpdate);

  // Setup display state listener (main sync from control window)
  window.hawkario.onDisplayUpdate(handleDisplayUpdate);

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

  // Signal to main process that viewer is fully initialized and ready
  window.hawkario.signalViewerReady();
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

/**
 * Ninja Timer - Viewer Window
 * Output display for the timer
 * Uses shared renderer for StageTimer-style sync with control window
 */

import { formatTime, formatTimeOfDay, hexToRgba } from '../shared/timer.js';
import { playWarningSound, playEndSound, initAudio } from '../shared/sounds.js';
import { FIXED_STYLE } from '../shared/timerState.js';
import { computeDisplay, getShadowCSS, getCombinedShadowCSS, autoFitText, FlashAnimator } from '../shared/renderTimer.js';

// DOM Elements
const timerEl = document.getElementById('timer');
const stageEl = document.querySelector('.stage');
const fsHintEl = document.getElementById('fsHint');
const messageOverlayEl = document.getElementById('messageOverlay');

// Canonical timer state from control window
let canonicalState = null;
let lastSeq = -1;

// Flash animator instance
let flashAnimator = null;

// Blackout state
let isBlackedOut = false;

// Display state from control window (legacy, for backwards compatibility)
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

// Blackout overlay element
const blackoutEl = document.createElement('div');
blackoutEl.className = 'blackout-overlay';
blackoutEl.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.5s ease;';
document.body.appendChild(blackoutEl);

/**
 * Set blackout state (ABSOLUTE, not toggle)
 */
function setBlackout(isBlacked) {
  isBlackedOut = isBlacked;
  if (isBlackedOut) {
    blackoutEl.style.pointerEvents = 'auto';
    blackoutEl.style.opacity = '1';
  } else {
    blackoutEl.style.opacity = '0';
    blackoutEl.style.pointerEvents = 'none';
  }
}

/**
 * Toggle blackout (legacy, for backwards compatibility)
 */
function toggleBlackout() {
  setBlackout(!isBlackedOut);
}

// Current message state
let currentMessage = null;

/**
 * Handle message updates from control window
 */
function handleMessageUpdate(message) {
  if (!message || !message.visible) {
    // Hide message and restore full layout
    currentMessage = null;
    messageOverlayEl.classList.remove('visible', 'bold', 'italic', 'uppercase');
    stageEl.classList.remove('with-message');
    return;
  }

  // Store message state
  currentMessage = message;

  // Apply message content and styling
  messageOverlayEl.textContent = message.text || '';
  messageOverlayEl.style.color = message.color || '#ffffff';
  messageOverlayEl.classList.toggle('bold', !!message.bold);
  messageOverlayEl.classList.toggle('italic', !!message.italic);
  messageOverlayEl.classList.toggle('uppercase', !!message.uppercase);
  messageOverlayEl.classList.add('visible');

  // Enable split layout
  stageEl.classList.add('with-message');

  // Auto-fit the message
  autoFitMessage();
}

/**
 * Auto-fit message text using transform scale
 * Uses fixed font size and max-width to maintain consistent line wrapping,
 * then scales the entire block to fit the container
 */
function autoFitMessage() {
  if (!currentMessage) return;

  // Fixed base size for consistent line wrapping
  messageOverlayEl.style.fontSize = '48px';
  messageOverlayEl.style.maxWidth = '600px';
  messageOverlayEl.style.transform = 'scale(1)';
  messageOverlayEl.style.transformOrigin = 'center top';

  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;
  const targetWidth = containerWidth * 0.75;
  const targetHeight = containerHeight * 0.48;
  const naturalWidth = messageOverlayEl.scrollWidth;
  const naturalHeight = messageOverlayEl.scrollHeight;

  if (naturalWidth > 0 && naturalHeight > 0) {
    const widthRatio = targetWidth / naturalWidth;
    const heightRatio = targetHeight / naturalHeight;
    const scale = Math.min(widthRatio, heightRatio);
    messageOverlayEl.style.transform = `scale(${scale})`;
  }
}

/**
 * Apply style configuration to timer element
 */
function applyStyle(style) {
  if (!style) return;

  // Skip style changes during flash animation
  if (flashAnimator?.isFlashing) return;

  timerEl.style.fontFamily = FIXED_STYLE.fontFamily;
  timerEl.style.fontWeight = FIXED_STYLE.fontWeight;
  timerEl.style.color = style.color || '#ffffff';
  timerEl.style.opacity = FIXED_STYLE.opacity;

  // Handle both broadcast format (textShadow) and state format (shadowSize)
  // Use shadow-based stroke instead of -webkit-text-stroke to avoid intersection artifacts
  timerEl.style.webkitTextStrokeWidth = '0px';

  if (style.textShadow) {
    timerEl.style.textShadow = style.textShadow;
  } else {
    timerEl.style.textShadow = getCombinedShadowCSS(
      style.strokeWidth ?? 0,
      style.strokeColor || '#000000',
      style.shadowSize ?? 0,
      style.shadowColor
    );
  }

  timerEl.style.letterSpacing = FIXED_STYLE.letterSpacing + 'em';
  timerEl.style.textAlign = FIXED_STYLE.align;

  // Always centered
  stageEl.style.placeItems = 'center';
  timerEl.style.justifySelf = 'center';

  // Background
  const bg = style.background || style.bgColor || '#000000';
  document.body.style.background = bg;
  stageEl.style.background = bg;
}

/**
 * Handle canonical timer state from control window (new StageTimer-style sync)
 * This is the primary sync mechanism
 */
function handleTimerState(state) {
  // Ignore old states (sequence number check)
  if (state.seq <= lastSeq) return;
  lastSeq = state.seq;

  canonicalState = state;

  // Apply style
  if (state.style) {
    applyStyle(state.style);
  }

  // Handle blackout (ABSOLUTE state)
  if (state.blackout !== isBlackedOut) {
    setBlackout(state.blackout);
  }

  // Handle flash - use startedAt from state for sync
  if (state.flash?.active && !flashAnimator?.isFlashing) {
    flashAnimator = new FlashAnimator(timerEl, stageEl, () => {
      // Flash complete
    });
    flashAnimator.start(state.flash.startedAt);
  }
}

/**
 * Handle display state updates from control window (LEGACY)
 * Kept for backwards compatibility during migration
 */
function handleDisplayUpdate(newState) {
  displayState = { ...displayState, ...newState };

  // Apply style if provided (legacy format)
  if (newState.style) {
    applyStyle(newState.style);
  }
}

/**
 * Auto-fit timer text to fill viewport (90% width, 85% height)
 */
function autoFitTimer() {
  timerEl.style.fontSize = '100px';
  timerEl.style.transform = 'scale(1)';

  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;
  const targetWidth = containerWidth * 0.9;
  // Use 45% height when message is visible (50/50 split), otherwise 85%
  const targetHeight = containerHeight * (currentMessage ? 0.45 : 0.85);
  const naturalWidth = timerEl.scrollWidth;
  const naturalHeight = timerEl.scrollHeight;

  if (naturalWidth > 0 && containerWidth > 0) {
    // Calculate ratios for both width and height constraints
    const widthRatio = targetWidth / naturalWidth;
    const heightRatio = targetHeight / naturalHeight;

    // Use the smaller ratio to ensure it fits both constraints
    const ratio = Math.min(widthRatio, heightRatio);
    const newFontSize = Math.max(10, 100 * ratio);
    timerEl.style.fontSize = newFontSize + 'px';
  }
}

/**
 * Main render loop
 * Uses canonical state if available, falls back to legacy displayState
 */
function render() {
  let visible = true;
  let text = '00:00';
  let color = '#ffffff';
  let overtime = false;

  if (canonicalState) {
    // New: Use shared computeDisplay for identical rendering
    const display = computeDisplay(canonicalState, Date.now());
    visible = display.visible;
    text = display.text;
    overtime = display.overtime || canonicalState.overtime;

    // Calculate warning color based on remaining time
    const baseColor = canonicalState.style?.color || '#ffffff';
    const warnYellowSec = canonicalState.warnYellowSec ?? 60;
    const warnOrangeSec = canonicalState.warnOrangeSec ?? 15;
    const remainingSec = Math.ceil(display.remainingMs / 1000);
    const isCountdown = canonicalState.mode === 'countdown' || canonicalState.mode === 'countdown-tod';

    if (overtime) {
      color = '#dc2626'; // Red for overtime
    } else if (isCountdown && remainingSec <= warnOrangeSec && remainingSec > 0) {
      color = '#E64A19'; // Orange for critical warning
    } else if (isCountdown && remainingSec <= warnYellowSec) {
      color = '#eab308'; // Yellow for warning
    } else {
      color = baseColor;
    }
  } else {
    // Legacy fallback
    visible = displayState.visible;
    text = displayState.text;
    color = displayState.color;
    overtime = displayState.overtime;
  }

  // Handle visibility
  if (!visible) {
    timerEl.style.visibility = 'hidden';
    requestAnimationFrame(render);
    return;
  } else {
    timerEl.style.visibility = 'visible';
  }

  // Apply display text (use innerHTML for ToD line breaks)
  timerEl.innerHTML = text;

  // Auto-fit to viewport
  autoFitTimer();
  autoFitMessage();

  // Apply color and stroke (skip during flash animation)
  if (!flashAnimator?.isFlashing) {
    timerEl.style.color = color;
    timerEl.style.opacity = FIXED_STYLE.opacity;

    // Reapply stroke shadow (ensures it persists across resize)
    if (canonicalState?.style) {
      const style = canonicalState.style;
      timerEl.style.textShadow = getCombinedShadowCSS(
        style.strokeWidth ?? 0,
        style.strokeColor || '#000000',
        style.shadowSize ?? 0,
        style.shadowColor
      );
    }

    // Apply overtime class
    timerEl.classList.toggle('overtime', overtime);
  }

  // Handle blackout sync from legacy displayState (if canonical not available)
  if (!canonicalState && displayState.blackout !== isBlackedOut) {
    setBlackout(displayState.blackout);
  }

  requestAnimationFrame(render);
}

/**
 * Handle incoming timer commands from control window (legacy)
 */
function handleTimerUpdate(data) {
  const { command, config } = data;

  // Handle flash command
  if (command === 'flash') {
    if (!flashAnimator?.isFlashing) {
      flashAnimator = new FlashAnimator(timerEl, stageEl, () => {
        // Flash complete
      });
      flashAnimator.start();
    }
  }

  // Apply style if provided
  if (config?.style) {
    applyStyle(config.style);
  }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        window.ninja.sendKeyboardShortcut('toggle');
        break;

      case 'r':
        window.ninja.sendKeyboardShortcut('reset');
        break;

      case 'b':
        window.ninja.sendKeyboardShortcut('blackout');
        break;

      case 'escape':
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
      hintTimeout = setTimeout(fadeOutHint, 2000);
    }
  };

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      hideHintFast();
      hasInteracted = true;
    }
  });

  document.addEventListener('mousemove', () => {
    if (!hasInteracted) {
      showHint();
    }
  });

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
  applyStyle({ color: '#ffffff', bgColor: '#000000', strokeWidth: 0, strokeColor: '#000000', shadowSize: 0 });

  // Setup canonical timer state listener (new StageTimer-style sync)
  window.ninja.onTimerState(handleTimerState);

  // Setup blackout state listener (ABSOLUTE state)
  window.ninja.onBlackoutState(setBlackout);

  // Setup legacy listeners for backwards compatibility
  window.ninja.onTimerUpdate(handleTimerUpdate);
  window.ninja.onDisplayUpdate(handleDisplayUpdate);
  window.ninja.onBlackoutToggle(toggleBlackout);

  // Setup message listener
  window.ninja.onMessageUpdate(handleMessageUpdate);

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Setup fullscreen hint behavior
  setupFullscreenHint();

  // Setup audio initialization
  setupAudioInit();

  // Start render loop
  render();

  // Signal to main process that viewer is fully initialized
  window.ninja.signalViewerReady();

  // Request current timer state from control window
  window.ninja.requestTimerState();
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

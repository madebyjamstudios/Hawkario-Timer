/**
 * Ninja Timer - Output Window
 * Output display for the timer
 * Uses shared renderer for StageTimer-style sync with control window
 *
 * Production Safety: This file includes defensive programming patterns
 * to prevent crashes and ensure reliable operation during productions.
 */

import { formatTime, formatTimeOfDay, hexToRgba } from '../shared/timer.js';
import { playWarningSound, playEndSound, initAudio } from '../shared/sounds.js';
import { FIXED_STYLE } from '../shared/timerState.js';
import { computeDisplay, getShadowCSS, getCombinedShadowCSS, FlashAnimator } from '../shared/renderTimer.js';
import { autoFitMessage, applyMessageStyle } from '../shared/renderMessage.js';
import {
  safeTimeout,
  safeClearTimeout,
  clearAllTimers,
  clearAllListeners,
  watchdogHeartbeat,
  stopWatchdog
} from '../shared/safeUtils.js';

// ============================================================================
// DOM SAFEGUARDING (Production Safety)
// ============================================================================

/**
 * Create a safe fallback element that absorbs operations without crashing
 */
function createSafeFallback(tagName = 'div') {
  const el = document.createElement(tagName);
  el._isFallback = true;
  el.classList.add = () => {};
  el.classList.remove = () => {};
  el.classList.toggle = () => false;
  return el;
}

// DOM Elements with safe fallbacks
const timerEl = document.getElementById('timer') || createSafeFallback('div');
const stageEl = document.querySelector('.stage') || createSafeFallback('div');
const virtualCanvasEl = document.getElementById('virtualCanvas') || createSafeFallback('div');
const fsHintEl = document.getElementById('fsHint') || createSafeFallback('div');
const messageOverlayEl = document.getElementById('messageOverlay') || createSafeFallback('div');
const resolutionEl = document.getElementById('resolutionDisplay') || createSafeFallback('span');

// Log any missing elements for debugging
const missingEls = [];
if (!document.getElementById('timer')) missingEls.push('timer');
if (!document.querySelector('.stage')) missingEls.push('.stage');
if (!document.getElementById('virtualCanvas')) missingEls.push('virtualCanvas');
if (!document.getElementById('fsHint')) missingEls.push('fsHint');
if (!document.getElementById('messageOverlay')) missingEls.push('messageOverlay');
if (!document.getElementById('resolutionDisplay')) missingEls.push('resolutionDisplay');
if (missingEls.length > 0) {
  console.warn('[DOM Safety] Missing output elements (using fallbacks):', missingEls.join(', '));
}

// Virtual canvas reference dimensions
const REF_WIDTH = 1920;
const REF_HEIGHT = 1080;

// Update resolution display
function updateResolution() {
  if (resolutionEl) {
    resolutionEl.textContent = `${window.innerWidth} x ${window.innerHeight}`;
  }
}

/**
 * Update virtual canvas scale based on window size
 * This is the ONLY thing that changes on resize - no font recalculation
 */
function updateCanvasScale() {
  const scale = Math.min(window.innerWidth / REF_WIDTH, window.innerHeight / REF_HEIGHT);
  virtualCanvasEl.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', () => {
  updateResolution();
  updateCanvasScale();
});
updateResolution();
updateCanvasScale();

// Canonical timer state from control window
let canonicalState = null;
let lastSeq = -1;

// Timer zoom (from app settings)
let timerZoom = 100;

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

// Track last rendered text/format/mode to only refit when needed
let lastTimerText = '';
let lastMessageText = '';
let lastTimerFormat = '';
let lastTimerMode = '';
let lastTimerLength = 0;

// Cache for shadow CSS to avoid recalculating every frame
let cachedShadowCSS = '';
let cachedShadowKey = '';

/**
 * Get reference text for timer sizing based on format and duration
 * Uses 8s because 8 is typically the widest digit
 */
function getRefText(format, durationMs) {
  const durationSec = Math.floor(durationMs / 1000);
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
 * Fit timer text to reference canvas size
 * All times of same format have identical width (height can vary)
 */
function fitTimerContent() {
  const zoom = timerZoom / 100;

  // Check if message is visible to determine available height
  const hasMessage = virtualCanvasEl?.classList.contains('with-message');

  // Target dimensions
  const targetWidth = REF_WIDTH * 0.95;
  const targetHeight = REF_HEIGHT * (hasMessage ? 0.45 : 0.90);

  // Reference string based on format AND duration
  const format = canonicalState?.format || 'MM:SS';
  const durationMs = canonicalState?.durationMs || 600000;
  const refText = getRefText(format, durationMs);
  const refHTML = refText.split(':').join('<span class="colon">:</span>');

  // Save actual content
  const actualContent = timerEl.innerHTML;

  // Reset transform and set fixed measurement font size
  timerEl.style.transform = 'translate(-50%, -50%)';
  timerEl.style.fontSize = '100px';

  // Measure reference width at 100px
  timerEl.innerHTML = refHTML;
  const refWidth100 = timerEl.scrollWidth;
  const refHeight100 = timerEl.scrollHeight;

  // Measure actual width at 100px
  timerEl.innerHTML = actualContent;
  const actualWidth100 = timerEl.scrollWidth;

  // Calculate font size where reference would fit target width
  const baseFontSize = 100 * (targetWidth / refWidth100) * zoom;

  // Calculate font size for actual to have same width as reference
  // (shorter text gets larger font)
  const actualFontSize = baseFontSize * (refWidth100 / actualWidth100);

  // Apply font size first
  timerEl.style.fontSize = actualFontSize + 'px';
  timerEl.style.transform = 'translate(-50%, -50%)';

  // Measure reference at actual font size (padding doesn't scale, so must measure at final size)
  timerEl.innerHTML = refHTML;
  const targetRefWidth = timerEl.scrollWidth;

  // Measure actual at same font size
  timerEl.innerHTML = actualContent;
  const renderedWidth = timerEl.scrollWidth;
  const renderedHeight = timerEl.scrollHeight;

  // Fine-tune with scale for pixel-perfect precision
  const scaleX = targetRefWidth / renderedWidth;
  const scaleY = Math.min(targetHeight / renderedHeight, 1); // Don't scale up height, only down if needed
  timerEl.style.transform = `translate(-50%, -50%) scale(${scaleX}, ${scaleY})`;
}

/**
 * Fit message text to reference canvas size
 * Only called when message content changes, NOT on resize
 * No max-width constraint - text flows naturally, transform: scale() handles resizing
 */
function fitMessageContent() {
  if (!currentMessage || !currentMessage.visible) return;

  // Target: 90% of reference width, 45% height (bottom half of 50/50 split)
  const targetWidth = REF_WIDTH * 0.9;
  const targetHeight = REF_HEIGHT * 0.45;

  // No max-width - let text flow naturally
  messageOverlayEl.style.maxWidth = 'none';

  // Measure at 100px base to calculate needed font-size
  messageOverlayEl.style.fontSize = '100px';

  const naturalWidth = messageOverlayEl.scrollWidth;
  const naturalHeight = messageOverlayEl.scrollHeight;

  if (naturalWidth > 0 && naturalHeight > 0) {
    const widthRatio = targetWidth / naturalWidth;
    const heightRatio = targetHeight / naturalHeight;
    const ratio = Math.min(widthRatio, heightRatio);
    const newFontSize = Math.max(8, 100 * ratio);
    messageOverlayEl.style.fontSize = newFontSize + 'px';
  }
}

/**
 * Handle message updates from control window
 */
function handleMessageUpdate(message) {
  const wasVisible = currentMessage?.visible;

  if (!message || !message.visible) {
    // Hide message and restore full layout
    currentMessage = null;
    lastMessageText = '';
    messageOverlayEl.classList.remove('visible', 'bold', 'italic', 'uppercase');
    virtualCanvasEl.classList.remove('with-message');

    // Refit timer since it now has full height
    if (wasVisible) {
      fitTimerContent();
    }
    return;
  }

  // Store message state
  currentMessage = message;

  // Apply message content and styling
  applyMessageStyle(messageOverlayEl, message);
  messageOverlayEl.classList.add('visible');

  // Enable split layout on virtual canvas
  virtualCanvasEl.classList.add('with-message');

  // Fit message content (only when text changes)
  if (message.text !== lastMessageText) {
    lastMessageText = message.text;
    fitMessageContent();
  }

  // Refit timer if message just became visible (area changed)
  if (!wasVisible) {
    fitTimerContent();
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

  // Background
  const bg = style.background || style.bgColor || '#000000';
  document.body.style.background = bg;
  stageEl.style.background = bg;
  virtualCanvasEl.style.background = bg;
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

  // Handle timer zoom change
  const newZoom = state.timerZoom ?? 100;
  if (newZoom !== timerZoom) {
    timerZoom = newZoom;
    fitTimerContent();
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
 * Main render loop
 * Uses canonical state if available, falls back to legacy displayState
 *
 * Production Safety: Wrapped in try-catch to prevent render errors from crashing the app
 */
let renderLoopActive = true;  // Flag to stop render loop on cleanup

function render() {
  // Check if we should stop
  if (!renderLoopActive) return;

  // Record heartbeat for watchdog monitoring
  watchdogHeartbeat('output');

  try {
    renderInternal();
  } catch (err) {
    console.error('[OutputRender] Error (recovered):', err);
  }

  // Schedule next frame if still active
  if (renderLoopActive) {
    requestAnimationFrame(render);
  }
}

function renderInternal() {
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
    return; // Next frame scheduled by wrapper
  } else {
    timerEl.style.visibility = 'visible';
  }

  // Apply display text (use innerHTML for ToD line breaks)
  timerEl.innerHTML = text;

  // Refit when format, mode, or text length changes (font scales to fill fixed width)
  const currentFormat = canonicalState?.format || 'MM:SS';
  const currentMode = canonicalState?.mode || 'countdown';
  const textLength = text.replace(/<[^>]*>/g, '').length;
  if (currentFormat !== lastTimerFormat || currentMode !== lastTimerMode || textLength !== lastTimerLength) {
    lastTimerFormat = currentFormat;
    lastTimerMode = currentMode;
    lastTimerLength = textLength;
    fitTimerContent();
  }

  // Apply color and stroke (skip during flash animation)
  if (!flashAnimator?.isFlashing) {
    timerEl.style.color = color;
    timerEl.style.opacity = FIXED_STYLE.opacity;

    // Reapply stroke shadow (ensures it persists across resize)
    // Performance: Cache shadow CSS to avoid recalculating every frame
    if (canonicalState?.style) {
      const style = canonicalState.style;
      const shadowKey = `${style.strokeWidth ?? 0}|${style.strokeColor || '#000000'}|${style.shadowSize ?? 0}|${style.shadowColor || '#000000'}`;

      if (shadowKey !== cachedShadowKey) {
        cachedShadowKey = shadowKey;
        cachedShadowCSS = getCombinedShadowCSS(
          style.strokeWidth ?? 0,
          style.strokeColor || '#000000',
          style.shadowSize ?? 0,
          style.shadowColor
        );
      }
      timerEl.style.textShadow = cachedShadowCSS;
    }

    // Apply overtime class
    timerEl.classList.toggle('overtime', overtime);
  }

  // Handle blackout sync from legacy displayState (if canonical not available)
  if (!canonicalState && displayState.blackout !== isBlackedOut) {
    setBlackout(displayState.blackout);
  }
  // Next frame scheduled by wrapper
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
        window.ninja.fullscreenOutput();
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
 * Initialize output window
 */
function init() {
  // Apply initial styles
  applyStyle({ color: '#ffffff', bgColor: '#000000', strokeWidth: 0, strokeColor: '#000000', shadowSize: 0 });

  // Click anywhere to bring window to top (focus)
  document.addEventListener('click', () => {
    window.ninja.focusOutput();
  });

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

  // Signal to main process that output window is fully initialized
  window.ninja.signalOutputReady();

  // Request current timer state from control window
  window.ninja.requestTimerState();

  // Request current message state from control window
  window.ninja.requestMessageState();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Cleanup on window close (Production Safety)
window.addEventListener('beforeunload', () => {
  // Stop the render loop
  renderLoopActive = false;

  // Stop watchdog monitoring
  stopWatchdog();

  // Clear all tracked timers
  clearAllTimers();

  // Clear all tracked event listeners
  clearAllListeners();

  // Stop flash animation if running
  if (flashAnimator?.isFlashing) {
    try {
      flashAnimator.stop();
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  // Remove IPC listeners
  window.ninja.removeAllListeners();

  console.log('[Cleanup] Output window cleanup complete');
});

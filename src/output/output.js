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
const todEl = document.getElementById('tod') || createSafeFallback('div');
const stageEl = document.querySelector('.stage') || createSafeFallback('div');
const contentBoxEl = document.getElementById('contentBox') || createSafeFallback('div');
const timerSectionEl = document.querySelector('.timer-section') || createSafeFallback('div');
const timerBoxEl = document.querySelector('.timer-box') || createSafeFallback('div');
const todBoxEl = document.querySelector('.tod-box') || createSafeFallback('div');
const messageSectionEl = document.querySelector('.message-section') || createSafeFallback('div');
const fsHintEl = document.getElementById('fsHint') || createSafeFallback('div');
const messageOverlayEl = document.getElementById('messageOverlay') || createSafeFallback('div');
const resolutionEl = document.getElementById('resolutionDisplay') || createSafeFallback('span');

// Log any missing elements for debugging
const missingEls = [];
if (!document.getElementById('timer')) missingEls.push('timer');
if (!document.querySelector('.stage')) missingEls.push('.stage');
if (!document.getElementById('fsHint')) missingEls.push('fsHint');
if (!document.getElementById('messageOverlay')) missingEls.push('messageOverlay');
if (!document.getElementById('resolutionDisplay')) missingEls.push('resolutionDisplay');
if (missingEls.length > 0) {
  console.warn('[DOM Safety] Missing output elements (using fallbacks):', missingEls.join(', '));
}

// Update resolution display
function updateResolution() {
  if (resolutionEl) {
    resolutionEl.textContent = `${window.innerWidth} x ${window.innerHeight}`;
  }
}

// Track last known dimensions for change detection
let lastWidth = window.innerWidth;
let lastHeight = window.innerHeight;

// Continuous RAF loop to detect size changes (more reliable than events during drag)
function checkSizeLoop() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (w !== lastWidth || h !== lastHeight) {
    lastWidth = w;
    lastHeight = h;
    updateResolution();
    fitTimerContent();
    fitToDContent();
    fitMessageContent();
  }

  requestAnimationFrame(checkSizeLoop);
}
// Start the size check loop
requestAnimationFrame(checkSizeLoop);
updateResolution();

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
let lastMessageBold = false;
let lastMessageItalic = false;
let lastMessageUppercase = false;
let lastTimerFormat = '';
let lastTimerMode = '';
let lastTimerLength = 0;
let lastContainerWidth = 0;
let lastContainerHeight = 0;

// Cache for shadow CSS to avoid recalculating every frame
let cachedShadowCSS = '';
let cachedShadowKey = '';

/**
 * Fit timer to fill its container - scale until box touches edge
 * Respects message mode (34% height) and ToD mode (75% of that)
 */
function fitTimerContent() {
  const hasToD = timerSectionEl.classList.contains('with-tod');
  const hasMessage = contentBoxEl.classList.contains('with-message');

  // Calculate container dimensions from window size (more reliable during drag)
  // Content-box is 90% width × 64% height of window
  const contentBoxWidth = window.innerWidth * 0.9;
  const contentBoxHeight = window.innerHeight * 0.64;

  // Container width is always content-box width (timer-section fills it)
  const containerWidth = contentBoxWidth;

  // Container height depends on mode:
  // - Timer only (no message): content-box height (64% of window)
  // - Timer only (with message): timer-section height (34% of content-box)
  // - Timer+ToD (no message): timer-box height (75% of content-box)
  // - Timer+ToD (with message): timer-box height (75% of 34% of content-box)
  let containerHeight;
  if (hasToD && hasMessage) {
    containerHeight = contentBoxHeight * 0.34 * 0.75;
  } else if (hasToD) {
    containerHeight = contentBoxHeight * 0.75;
  } else if (hasMessage) {
    containerHeight = contentBoxHeight * 0.34;
  } else {
    containerHeight = contentBoxHeight;
  }

  // If layout not ready, retry after short delay
  if (containerWidth <= 0 || containerHeight <= 0) {
    setTimeout(fitTimerContent, 50);
    return;
  }

  const zoom = timerZoom / 100;
  const maxWidth = containerWidth * zoom;
  const maxHeight = containerHeight * 0.95;

  // Temporarily center for consistent measurement
  const savedJustify = timerSectionEl.style.justifyContent;
  timerSectionEl.style.justifyContent = 'center';

  // Measure timer at base font size
  timerEl.style.fontSize = '100px';
  void timerEl.offsetWidth;

  const naturalWidth = timerEl.offsetWidth;
  const naturalHeight = timerEl.offsetHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    timerSectionEl.style.justifyContent = savedJustify;
    return;
  }

  // Scale to fill, cap at edges
  const scaleW = maxWidth / naturalWidth;
  const scaleH = maxHeight / naturalHeight;
  const scale = Math.min(scaleW, scaleH);

  const fontSize = Math.floor(100 * scale);
  timerEl.style.fontSize = fontSize + 'px';
  // Force repaint (helps with Electron/macOS resize rendering)
  void timerEl.offsetWidth;

  // Restore alignment
  timerSectionEl.style.justifyContent = savedJustify;
}

/**
 * Fit ToD to fill its container (tod-box, 25% of content-box)
 * Scale until tod-box touches edge
 */
function fitToDContent() {
  if (!timerSectionEl.classList.contains('with-tod')) return;

  const hasMessage = contentBoxEl.classList.contains('with-message');

  // Calculate container dimensions from window size (more reliable during drag)
  // Content-box is 90% width × 64% height of window
  // ToD-box is 25% of content-box height (or 25% of 34% if message is visible)
  const contentBoxWidth = window.innerWidth * 0.9;
  const contentBoxHeight = window.innerHeight * 0.64;

  const containerWidth = contentBoxWidth;
  const containerHeight = hasMessage
    ? contentBoxHeight * 0.34 * 0.25
    : contentBoxHeight * 0.25;

  // If layout not ready, retry after short delay
  if (containerWidth <= 0 || containerHeight <= 0) {
    setTimeout(fitToDContent, 50);
    return;
  }

  const zoom = timerZoom / 100;
  const maxWidth = containerWidth * zoom;
  const maxHeight = containerHeight * 0.90;

  // Temporarily center for consistent measurement
  const savedJustify = timerSectionEl.style.justifyContent;
  timerSectionEl.style.justifyContent = 'center';

  // Measure ToD at base font size
  todEl.style.fontSize = '100px';
  void todEl.offsetWidth;

  const naturalWidth = todEl.offsetWidth;
  const naturalHeight = todEl.offsetHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    timerSectionEl.style.justifyContent = savedJustify;
    return;
  }

  // Scale to fill, cap at edges
  const scaleW = maxWidth / naturalWidth;
  const scaleH = maxHeight / naturalHeight;
  const scale = Math.min(scaleW, scaleH);

  const fontSize = Math.floor(100 * scale);
  todEl.style.fontSize = fontSize + 'px';

  // Restore alignment
  timerSectionEl.style.justifyContent = savedJustify;
}

/**
 * Fit message text to message-section container
 * Tries different word-wrap widths to find optimal layout that maximizes text size
 */
function fitMessageContent() {
  if (!currentMessage || !currentMessage.visible) return;

  const containerWidth = messageSectionEl.offsetWidth;
  const containerHeight = messageSectionEl.offsetHeight;

  // If layout not ready, retry after short delay
  if (containerWidth <= 0 || containerHeight <= 0) {
    setTimeout(fitMessageContent, 50);
    return;
  }

  // Target 95% of container
  const targetWidth = containerWidth * 0.95;
  const targetHeight = containerHeight * 0.95;

  // Temporarily center for consistent measurement
  const savedJustify = messageSectionEl.style.justifyContent;
  messageSectionEl.style.justifyContent = 'center';

  // Set maxWidth to container width - text wraps at container boundary
  messageOverlayEl.style.maxWidth = targetWidth + 'px';

  // Binary search for largest font that fits (textFit algorithm)
  let min = 8;
  let max = 500;
  let bestFit = min;

  while (min <= max) {
    const mid = Math.floor((min + max) / 2);
    messageOverlayEl.style.fontSize = mid + 'px';
    void messageOverlayEl.offsetWidth; // Force reflow

    const textHeight = messageOverlayEl.scrollHeight;
    const textWidth = messageOverlayEl.scrollWidth;

    if (textHeight <= targetHeight && textWidth <= targetWidth) {
      bestFit = mid;
      min = mid + 1; // Try larger
    } else {
      max = mid - 1; // Too big, try smaller
    }
  }

  messageOverlayEl.style.fontSize = bestFit + 'px';

  // Restore alignment
  messageSectionEl.style.justifyContent = savedJustify;
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
    lastMessageBold = false;
    lastMessageItalic = false;
    lastMessageUppercase = false;
    messageOverlayEl.classList.remove('visible', 'bold', 'italic', 'uppercase');

    // Shrink timer before layout change to prevent flash
    if (wasVisible) {
      timerEl.style.fontSize = '10px';
      todEl.style.fontSize = '10px';
    }
    contentBoxEl.classList.remove('with-message');
    // Force layout recalculation
    void contentBoxEl.offsetHeight;

    // Refit timer and ToD since they now have full height
    if (wasVisible) {
      fitTimerContent();
      fitToDContent();
    }
    return;
  }

  // Store message state
  currentMessage = message;

  // Apply message content and styling
  applyMessageStyle(messageOverlayEl, message);
  messageOverlayEl.classList.add('visible');

  // Shrink timer before layout change to prevent "big then small" flash
  if (!wasVisible) {
    timerEl.style.fontSize = '10px';
    todEl.style.fontSize = '10px';
  }

  // Enable split layout on content box
  contentBoxEl.classList.add('with-message');
  // Force layout recalculation
  void contentBoxEl.offsetHeight;

  // Wait for layout to update, then fit content (matches preview behavior)
  requestAnimationFrame(() => {
    // Fit message content (when text or formatting changes, or message just became visible)
    const boldChanged = message.bold !== lastMessageBold;
    const italicChanged = message.italic !== lastMessageItalic;
    const uppercaseChanged = message.uppercase !== lastMessageUppercase;
    const formattingChanged = boldChanged || italicChanged || uppercaseChanged;
    if (message.text !== lastMessageText || formattingChanged || !wasVisible) {
      lastMessageText = message.text;
      lastMessageBold = message.bold;
      lastMessageItalic = message.italic;
      lastMessageUppercase = message.uppercase;
      fitMessageContent();
    }

    // Refit timer and ToD if message just became visible (area changed)
    if (!wasVisible) {
      fitTimerContent();
      fitToDContent();
    }
  });
}

/**
 * Apply style configuration to timer element
 */
function applyStyle(style) {
  if (!style) return;

  // Skip style changes during flash animation
  if (flashAnimator?.isFlashing) return;

  // Use font from style with fallback to FIXED_STYLE
  const fontFamily = style.fontFamily || 'Inter';
  timerEl.style.fontFamily = `'${fontFamily}', ${FIXED_STYLE.fontFamily}`;
  timerEl.style.fontWeight = style.fontWeight ?? FIXED_STYLE.fontWeight;
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

  // Content alignment
  const align = style.align || 'center';
  const justifyMap = {
    'left': 'flex-start',
    'center': 'center',
    'right': 'flex-end'
  };
  const justifyContent = justifyMap[align] || 'center';

  // Apply alignment to timer-section and message-section
  if (timerSectionEl) {
    timerSectionEl.style.justifyContent = justifyContent;
  }
  if (messageSectionEl) {
    messageSectionEl.style.justifyContent = justifyContent;
  }
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
  // Flash includes ToD (if visible) in sync with timer, message never flashes
  if (state.flash?.active && !flashAnimator?.isFlashing) {
    const elementsToFlash = [timerEl];
    const hasToD = timerSectionEl.classList.contains('with-tod');
    if (hasToD && todEl) {
      elementsToFlash.push(todEl);
    }

    flashAnimator = new FlashAnimator(elementsToFlash, stageEl, () => {
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

// Track previous ToD state for refit
let lastShowToD = false;

function renderInternal() {
  let visible = true;
  let text = '00:00';
  let todText = null;
  let showToD = false;
  let color = '#ffffff';
  let todColor = '#ffffff'; // ToD always uses base color, never warning colors
  let overtime = false;

  if (canonicalState) {
    // New: Use shared computeDisplay for identical rendering
    const display = computeDisplay(canonicalState, Date.now());
    visible = display.visible;
    text = display.text;
    todText = display.todText;
    showToD = display.showToD;
    overtime = display.overtime || canonicalState.overtime;

    // Calculate warning color based on remaining time (skip for pure ToD mode)
    const baseColor = canonicalState.style?.color || '#ffffff';
    todColor = baseColor; // ToD always uses base color
    const warnYellowSec = canonicalState.warnYellowSec ?? 60;
    const warnOrangeSec = canonicalState.warnOrangeSec ?? 15;
    const remainingSec = Math.ceil(display.remainingMs / 1000);
    const isCountdown = canonicalState.mode === 'countdown' || canonicalState.mode === 'countdown-tod';
    const isPureToD = canonicalState.mode === 'tod';

    if (isPureToD) {
      // Pure ToD mode - just use base color, no warnings or overtime colors
      color = baseColor;
      overtime = false; // Don't show overtime state for pure ToD
    } else if (overtime) {
      color = '#dc2626'; // Red for overtime
    } else if (isCountdown && remainingSec <= 0) {
      color = '#dc2626'; // Red for timer ended
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
    todColor = displayState.color; // Legacy: use same color
    overtime = displayState.overtime;
  }

  // Handle visibility
  if (!visible) {
    timerEl.style.visibility = 'hidden';
    todEl.style.visibility = 'hidden';
    return; // Next frame scheduled by wrapper
  } else {
    timerEl.style.visibility = 'visible';
  }

  // Handle ToD mode toggle (75/25 split)
  const todModeChanged = showToD !== lastShowToD;
  if (todModeChanged) {
    lastShowToD = showToD;
    // Shrink timer before layout change to prevent "big then small" flash
    timerEl.style.fontSize = '10px';
    todEl.style.fontSize = '10px';
    if (showToD) {
      timerSectionEl.classList.add('with-tod');
    } else {
      timerSectionEl.classList.remove('with-tod');
    }
    // Force layout recalculation
    void timerSectionEl.offsetHeight;
  }

  // Check if text or container size changed (optimization: avoid refit every frame)
  const textChanged = text !== lastTimerText;
  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;
  const sizeChanged = containerWidth !== lastContainerWidth || containerHeight !== lastContainerHeight;
  const needsRefit = textChanged || sizeChanged || todModeChanged;

  // Update tracking variables
  if (textChanged) lastTimerText = text;
  if (sizeChanged) {
    lastContainerWidth = containerWidth;
    lastContainerHeight = containerHeight;
  }

  // Apply timer text (only update DOM if changed to avoid unnecessary reflows)
  if (textChanged) {
    timerEl.innerHTML = text;
  }

  // Apply ToD text (separate element, uses innerHTML for colon spans)
  if (showToD && todText) {
    todEl.innerHTML = todText;
    todEl.style.visibility = 'visible';
    todEl.style.color = todColor; // ToD always uses base color, never warning colors
  } else {
    todEl.style.visibility = 'hidden';
  }

  // Only refit when text, container size, or ToD mode changes (not every frame)
  if (needsRefit) {
    fitTimerContent();
    if (showToD) fitToDContent();
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
  // Flash includes ToD (if visible) in sync with timer, message never flashes
  if (command === 'flash') {
    if (!flashAnimator?.isFlashing) {
      const elementsToFlash = [timerEl];
      const hasToD = timerSectionEl.classList.contains('with-tod');
      if (hasToD && todEl) {
        elementsToFlash.push(todEl);
      }

      flashAnimator = new FlashAnimator(elementsToFlash, stageEl, () => {
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

  // Initial fit after layout settles (handles first open sizing)
  setTimeout(() => {
    fitTimerContent();
    fitToDContent();
    fitMessageContent();
  }, 100);

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

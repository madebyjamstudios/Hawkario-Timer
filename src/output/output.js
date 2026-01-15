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
import { getFontFormat } from '../shared/fontManager.js';
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

// ResizeObserver for reliable resize detection (works with window snapping)
const resizeObserver = new ResizeObserver(() => {
  updateResolution();
  // Double RAF to ensure all layouts have recalculated
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fitTimerContent();
      fitToDContent();
      fitMessageContent();
    });
  });
});
// Observe stage element (outermost) to catch all resize events
resizeObserver.observe(stageEl);

// Also listen to window resize for resolution display
window.addEventListener('resize', updateResolution);
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
 * Fit timer to fill its container - scale until box touches edge
 * Respects message mode (34% height) and ToD mode (75% of that)
 */
function fitTimerContent() {
  const hasToD = timerSectionEl.classList.contains('with-tod');
  const hasMessage = contentBoxEl.classList.contains('with-message');

  // Container width is always timer-section width
  const containerWidth = timerSectionEl.offsetWidth;

  // Container height depends on mode:
  // - Timer only (no message): content-box height
  // - Timer only (with message): timer-section height (34%)
  // - Timer+ToD (no message): timer-box height (75%)
  // - Timer+ToD (with message): timer-box height (75% of 34%)
  let containerHeight;
  if (hasToD) {
    containerHeight = timerBoxEl.offsetHeight;
  } else if (hasMessage) {
    containerHeight = timerSectionEl.offsetHeight;
  } else {
    containerHeight = contentBoxEl.offsetHeight;
  }

  // If layout not ready, retry after short delay
  if (containerWidth <= 0 || containerHeight <= 0) {
    setTimeout(fitTimerContent, 50);
    return;
  }

  const zoom = timerZoom / 100;
  const maxWidth = containerWidth * zoom;
  const maxHeight = containerHeight * 0.95;

  // Measure timer at base font size
  timerEl.style.fontSize = '100px';
  void timerEl.offsetWidth;

  const naturalWidth = timerEl.offsetWidth;
  const naturalHeight = timerEl.offsetHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) return;

  // Scale to fill, cap at edges
  const scaleW = maxWidth / naturalWidth;
  const scaleH = maxHeight / naturalHeight;
  const scale = Math.min(scaleW, scaleH);

  const fontSize = Math.floor(100 * scale);
  timerEl.style.fontSize = fontSize + 'px';
}

/**
 * Fit ToD to fill its container (tod-box, 25% of content-box)
 * Scale until tod-box touches edge
 */
function fitToDContent() {
  if (!timerSectionEl.classList.contains('with-tod')) return;

  const containerWidth = todBoxEl.offsetWidth;
  const containerHeight = todBoxEl.offsetHeight;

  // If layout not ready, retry after short delay
  if (containerWidth <= 0 || containerHeight <= 0) {
    setTimeout(fitToDContent, 50);
    return;
  }

  const zoom = timerZoom / 100;
  const maxWidth = containerWidth * zoom;
  const maxHeight = containerHeight * 0.90;

  // Measure ToD at base font size
  todEl.style.fontSize = '100px';
  void todEl.offsetWidth;

  const naturalWidth = todEl.offsetWidth;
  const naturalHeight = todEl.offsetHeight;
  if (naturalWidth <= 0 || naturalHeight <= 0) return;

  // Scale to fill, cap at edges
  const scaleW = maxWidth / naturalWidth;
  const scaleH = maxHeight / naturalHeight;
  const scale = Math.min(scaleW, scaleH);

  const fontSize = Math.floor(100 * scale);
  todEl.style.fontSize = fontSize + 'px';
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

  // Use fixed maxWidth at base size - this controls wrapping behavior
  // Text will wrap at ~1600px wide when measured at 100px font
  const baseMaxWidth = 1600;

  // Measure at 100px base font with fixed maxWidth
  messageOverlayEl.style.fontSize = '100px';
  messageOverlayEl.style.maxWidth = baseMaxWidth + 'px';
  void messageOverlayEl.offsetWidth;

  const textWidth = messageOverlayEl.scrollWidth;
  const textHeight = messageOverlayEl.scrollHeight;
  if (textWidth <= 0 || textHeight <= 0) return;

  // Scale to fit container (both width and height)
  const scaleW = targetWidth / textWidth;
  const scaleH = targetHeight / textHeight;
  const scale = Math.min(scaleW, scaleH);

  // Apply scaled font size and scaled maxWidth
  const fontSize = Math.max(8, Math.floor(100 * scale));
  messageOverlayEl.style.fontSize = fontSize + 'px';
  messageOverlayEl.style.maxWidth = (baseMaxWidth * scale) + 'px';
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
    contentBoxEl.classList.remove('with-message');

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

  // Enable split layout on content box
  contentBoxEl.classList.add('with-message');

  // Wait for layout to update, then fit content
  requestAnimationFrame(() => {
    // Fit message content (when text changes or message just became visible)
    if (message.text !== lastMessageText || !wasVisible) {
      lastMessageText = message.text;
      fitMessageContent();
    }

    // Refit timer if message just became visible (area changed)
    if (!wasVisible) {
      fitTimerContent();
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

// Track previous ToD state for refit
let lastShowToD = false;

function renderInternal() {
  let visible = true;
  let text = '00:00';
  let todText = null;
  let showToD = false;
  let color = '#ffffff';
  let overtime = false;

  if (canonicalState) {
    // New: Use shared computeDisplay for identical rendering
    const display = computeDisplay(canonicalState, Date.now());
    visible = display.visible;
    text = display.text;
    todText = display.todText;
    showToD = display.showToD;
    overtime = display.overtime || canonicalState.overtime;

    // Calculate warning color based on remaining time
    const baseColor = canonicalState.style?.color || '#ffffff';
    const warnYellowSec = canonicalState.warnYellowSec ?? 60;
    const warnOrangeSec = canonicalState.warnOrangeSec ?? 15;
    const remainingSec = Math.ceil(display.remainingMs / 1000);
    const isCountdown = canonicalState.mode === 'countdown' || canonicalState.mode === 'countdown-tod';

    if (overtime) {
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
    if (showToD) {
      timerSectionEl.classList.add('with-tod');
    } else {
      timerSectionEl.classList.remove('with-tod');
    }
  }

  // Apply timer text FIRST (before measuring for fit)
  timerEl.innerHTML = text;

  // Apply ToD text (separate element, uses innerHTML for colon spans)
  if (showToD && todText) {
    todEl.innerHTML = todText;
    todEl.style.visibility = 'visible';
    todEl.style.color = color;
  } else {
    todEl.style.visibility = 'hidden';
  }

  // Always refit on every frame to handle window resizes
  // MUST be called AFTER innerHTML is set so we measure the new content
  fitTimerContent();
  if (showToD) fitToDContent();

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
 * Load custom fonts from font storage
 */
async function loadCustomFonts() {
  try {
    const fonts = await window.ninja.fontsList();
    for (const font of fonts) {
      try {
        const fontData = await window.ninja.fontsGetData(font.id);
        if (!fontData) continue;

        const format = getFontFormat(font.fileName);
        const fontFace = new FontFace(font.family, `url(data:font/${format};base64,${fontData})`, {
          weight: '100 900',
          style: 'normal'
        });

        await fontFace.load();
        document.fonts.add(fontFace);
      } catch (e) {
        console.error('Failed to load custom font:', font.family, e);
      }
    }
  } catch (e) {
    console.error('Failed to load custom fonts:', e);
  }
}

/**
 * Initialize output window
 */
function init() {
  // Load custom fonts
  loadCustomFonts();

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

  // Disconnect ResizeObserver
  try {
    resizeObserver.disconnect();
  } catch (err) {
    // Ignore cleanup errors
  }

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

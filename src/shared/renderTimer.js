/**
 * Ninja Timer - Shared Timer Renderer
 * Identical rendering logic for both preview and output windows
 */

import { formatTime, formatTimeOfDay } from './timer.js';
import { FIXED_STYLE } from './timerState.js';

/**
 * Compute display values from canonical timer state
 * Both preview and output MUST use this function for identical results
 *
 * @param {Object} state - Canonical timer state
 * @param {number} now - Current timestamp (Date.now())
 * @returns {Object} Display values { text, elapsedMs, remainingMs, overtime, visible }
 */
export function computeDisplay(state, now = Date.now()) {
  const { mode, durationMs, format, startedAt, pausedAccMs, isRunning, ended, overtime, overtimeStartedAt, todFormat } = state;

  // Hidden mode
  if (mode === 'hidden') {
    return {
      visible: false,
      text: '',
      elapsedMs: 0,
      remainingMs: 0,
      overtime: false
    };
  }

  // Time of Day only mode
  if (mode === 'tod') {
    return {
      visible: true,
      text: formatTimeOfDay(todFormat),
      elapsedMs: 0,
      remainingMs: 0,
      overtime: false
    };
  }

  // Determine mode type
  const isCountdown = mode === 'countdown' || mode === 'countdown-tod';
  const isCountup = mode === 'countup' || mode === 'countup-tod';
  const showToD = mode === 'countdown-tod' || mode === 'countup-tod';

  let elapsedMs = 0;
  let remainingMs = 0;
  let displayText = '';

  if (!isRunning && pausedAccMs === 0 && startedAt === null) {
    // Timer has never been started - show initial state
    if (isCountdown) {
      remainingMs = durationMs;
      elapsedMs = 0;
    } else {
      remainingMs = durationMs;
      elapsedMs = 0;
    }
  } else if (!isRunning && pausedAccMs > 0) {
    // Timer is paused
    if (isCountdown) {
      remainingMs = Math.max(0, durationMs - pausedAccMs);
      elapsedMs = pausedAccMs;
    } else {
      elapsedMs = pausedAccMs;
      remainingMs = Math.max(0, durationMs - pausedAccMs);
    }
  } else if (isRunning && startedAt !== null) {
    // Timer is running
    const runningTime = now - startedAt + pausedAccMs;

    if (isCountdown) {
      remainingMs = Math.max(0, durationMs - runningTime);
      elapsedMs = runningTime;
    } else {
      elapsedMs = runningTime;
      remainingMs = Math.max(0, durationMs - runningTime);
    }
  }

  // Handle overtime display
  if (overtime && overtimeStartedAt) {
    const overtimeMs = now - overtimeStartedAt;
    const overtimeSec = Math.floor(overtimeMs / 1000);
    const mins = Math.floor(overtimeSec / 60);
    const secs = overtimeSec % 60;
    displayText = '+' + mins + ':' + String(secs).padStart(2, '0');
  } else {
    // Format based on mode
    if (isCountdown) {
      // Use ceil for countdown so timer shows full duration for the first second
      displayText = formatTime(remainingMs, format, true);
    } else {
      displayText = formatTime(elapsedMs, format, false);
    }
  }

  // Append time of day if needed
  if (showToD) {
    displayText += '  |  ' + formatTimeOfDay(todFormat);
  }

  return {
    visible: true,
    text: displayText,
    elapsedMs,
    remainingMs,
    overtime
  };
}

/**
 * Compute glow/shadow metrics relative to font size
 * This ensures glow looks identical at any window size
 *
 * @param {HTMLElement} timerEl - The timer text element
 * @returns {Object} Glow metrics { fontSize, glowBlur, glowSpread, strokeWidth }
 */
export function computeGlowMetrics(timerEl) {
  const fontSize = parseFloat(getComputedStyle(timerEl).fontSize) || 100;

  return {
    fontSize,
    // Flash glow scales with font size
    glowBlur1: fontSize * 0.02,    // Tight bright core
    glowBlur2: fontSize * 0.04,    // Inner glow
    glowBlur3: fontSize * 0.08,    // Medium spread
    glowBlur4: fontSize * 0.15,    // Wide halo
    glowBlur5: fontSize * 0.25,    // Large outer glow
    glowSpread: fontSize * 0.01,
    strokeWidth: Math.max(1, fontSize * 0.01)
  };
}

/**
 * Generate flash glow CSS based on font-relative metrics
 *
 * @param {Object} metrics - Glow metrics from computeGlowMetrics
 * @returns {string} CSS text-shadow value
 */
export function getFlashGlowCSS(metrics) {
  const { glowBlur1, glowBlur2, glowBlur3, glowBlur4, glowBlur5 } = metrics;

  return `
    0 0 ${glowBlur1}px #fff,
    0 0 ${glowBlur1}px #fff,
    0 0 ${glowBlur2}px #fff,
    0 0 ${glowBlur2}px rgba(255,255,255,0.9),
    0 0 ${glowBlur3}px rgba(255,255,255,0.8),
    0 0 ${glowBlur4}px rgba(255,255,255,0.6),
    0 0 ${glowBlur5}px rgba(255,255,255,0.3)
  `.replace(/\s+/g, ' ').trim();
}

/**
 * Generate standard shadow CSS from size value
 * Used for the regular timer shadow (not flash)
 *
 * @param {number} sizePx - Shadow size in pixels
 * @returns {string} CSS text-shadow value
 */
export function getShadowCSS(sizePx) {
  if (sizePx === 0) return 'none';
  const blur = sizePx;
  const spread = Math.round(sizePx * 0.3);
  return `0 ${spread}px ${blur}px rgba(0,0,0,0.5)`;
}

/**
 * Apply style to timer element
 *
 * @param {HTMLElement} timerEl - The timer text element
 * @param {HTMLElement} containerEl - The container/stage element
 * @param {Object} style - Style configuration
 * @param {boolean} isFlashing - Whether flash animation is active
 */
export function applyStyle(timerEl, containerEl, style, isFlashing = false) {
  if (!style || isFlashing) return;

  timerEl.style.fontFamily = FIXED_STYLE.fontFamily;
  timerEl.style.fontWeight = FIXED_STYLE.fontWeight;
  timerEl.style.color = style.color || '#ffffff';
  timerEl.style.opacity = FIXED_STYLE.opacity;
  timerEl.style.letterSpacing = FIXED_STYLE.letterSpacing + 'em';
  timerEl.style.webkitTextStrokeWidth = (style.strokeWidth ?? 2) + 'px';
  timerEl.style.webkitTextStrokeColor = style.strokeColor || '#000000';
  timerEl.style.textShadow = getShadowCSS(style.shadowSize ?? 10);
  timerEl.style.textAlign = FIXED_STYLE.align;

  // Background
  const bg = style.bgColor || '#000000';
  if (containerEl) {
    containerEl.style.background = bg;
  }
  document.body.style.background = bg;
}

/**
 * Auto-fit timer text to fill container width
 *
 * @param {HTMLElement} timerEl - The timer text element
 * @param {HTMLElement} containerEl - The container element
 * @param {number} targetRatio - Target width ratio (0.9 = 90% of container)
 */
export function autoFitText(timerEl, containerEl, targetRatio = 0.9) {
  // Reset to measure natural size
  timerEl.style.fontSize = '100px';

  const containerWidth = containerEl?.clientWidth || window.innerWidth;
  const targetWidth = containerWidth * targetRatio;
  const naturalWidth = timerEl.scrollWidth;

  if (naturalWidth > 0 && containerWidth > 0) {
    const ratio = targetWidth / naturalWidth;
    const newFontSize = Math.max(10, 100 * ratio);
    timerEl.style.fontSize = newFontSize + 'px';
  }
}

/**
 * Flash animation - timestamp-driven for sync across windows
 * Both preview and output use the same startedAt to stay in phase
 */
export class FlashAnimator {
  constructor(timerEl, containerEl, onComplete) {
    this.timerEl = timerEl;
    this.containerEl = containerEl;
    this.onComplete = onComplete;

    this.originalColor = '';
    this.originalShadow = '';
    this.originalStroke = '';
    this.originalStrokeWidth = '';

    this.maxFlashes = 3;
    this.glowDuration = 400;
    this.greyDuration = 300;
    this.cycleDuration = this.glowDuration + this.greyDuration; // 700ms per cycle
    // Pattern: glow→grey→glow→grey→glow→restore (hard cut at end)
    this.totalDuration = (this.maxFlashes - 1) * this.cycleDuration + this.glowDuration;

    this.isFlashing = false;
    this.startedAt = null;
    this.rafId = null;
    this.lastPhase = null;
  }

  start(startedAt = Date.now()) {
    if (this.isFlashing) return;

    // Store original styles
    this.originalColor = this.timerEl.style.color;
    this.originalShadow = this.timerEl.style.textShadow;
    this.originalStroke = this.timerEl.style.webkitTextStrokeColor;
    this.originalStrokeWidth = this.timerEl.style.webkitTextStrokeWidth;

    this.startedAt = startedAt;
    this.isFlashing = true;
    this.lastPhase = null;
    this.tick();
  }

  tick() {
    if (!this.isFlashing) return;

    const now = Date.now();
    const elapsed = now - this.startedAt;

    // Animation complete?
    if (elapsed >= this.totalDuration) {
      this.restore();
      return;
    }

    // Compute current phase from timestamp
    const cyclePosition = elapsed % this.cycleDuration;
    const phase = cyclePosition < this.glowDuration ? 'glow' : 'grey';

    // Only update DOM if phase changed (performance)
    if (phase !== this.lastPhase) {
      if (phase === 'glow') {
        this.applyGlow();
      } else {
        this.applyGrey();
      }
      this.lastPhase = phase;
    }

    this.rafId = requestAnimationFrame(() => this.tick());
  }

  applyGlow() {
    const metrics = computeGlowMetrics(this.timerEl);
    const glowCSS = getFlashGlowCSS(metrics);

    this.timerEl.style.color = '#ffffff';
    this.timerEl.style.webkitTextStrokeColor = '#ffffff';
    this.timerEl.style.webkitTextStrokeWidth = metrics.strokeWidth + 'px';
    this.timerEl.style.textShadow = glowCSS;
  }

  applyGrey() {
    this.timerEl.style.color = '#666666';
    this.timerEl.style.webkitTextStrokeColor = '#666666';
    this.timerEl.style.webkitTextStrokeWidth = '0px';
    this.timerEl.style.textShadow = 'none';
  }

  restore() {
    this.timerEl.style.color = this.originalColor;
    this.timerEl.style.textShadow = this.originalShadow;
    this.timerEl.style.webkitTextStrokeColor = this.originalStroke;
    this.timerEl.style.webkitTextStrokeWidth = this.originalStrokeWidth;

    this.isFlashing = false;
    this.startedAt = null;
    this.lastPhase = null;

    if (this.onComplete) {
      this.onComplete();
    }
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.isFlashing) {
      this.restore();
    }
  }
}

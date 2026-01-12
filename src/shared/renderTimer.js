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

  // Append time of day if needed (on new line)
  if (showToD) {
    displayText += '<br><span class="tod-line">' + formatTimeOfDay(todFormat) + '</span>';
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
    // Flash glow scales with font size - tighter to text
    glowBlur1: fontSize * 0.01,    // Tight bright core
    glowBlur2: fontSize * 0.02,    // Inner glow
    glowBlur3: fontSize * 0.04,    // Medium spread
    glowBlur4: fontSize * 0.06,    // Outer glow
    strokeWidth: Math.max(1, fontSize * 0.008)
  };
}

/**
 * Generate flash glow CSS based on font-relative metrics
 *
 * @param {Object} metrics - Glow metrics from computeGlowMetrics
 * @returns {string} CSS text-shadow value
 */
export function getFlashGlowCSS(metrics) {
  const { glowBlur1, glowBlur2, glowBlur3, glowBlur4 } = metrics;

  return `
    0 0 ${glowBlur1}px #fff,
    0 0 ${glowBlur2}px rgba(255,255,255,0.9),
    0 0 ${glowBlur3}px rgba(255,255,255,0.6),
    0 0 ${glowBlur4}px rgba(255,255,255,0.3)
  `.replace(/\s+/g, ' ').trim();
}

/**
 * Get CSS text-shadow for stroke outline effect
 * Uses 8 shadows at cardinal/diagonal directions to create a solid outline
 * This avoids the intersection artifacts of -webkit-text-stroke
 *
 * @param {number} width - Stroke width in pixels
 * @param {string} color - Stroke color in hex format
 * @returns {string} CSS text-shadow value for outline
 */
export function getStrokeShadowCSS(width, color = '#000000') {
  if (width === 0) return '';

  // Create shadows at 8 directions for a solid outline
  const shadows = [];
  const offsets = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1]
  ];

  // Layer multiple passes for thicker strokes
  for (let i = 1; i <= width; i++) {
    for (const [dx, dy] of offsets) {
      shadows.push(`${dx * i}px ${dy * i}px 0 ${color}`);
    }
  }

  return shadows.join(', ');
}

/**
 * Generate standard shadow CSS from size and color
 * Used for the regular timer shadow (not flash)
 *
 * @param {number} sizePx - Shadow size in pixels
 * @param {string} color - Shadow color in hex format (default #000000)
 * @returns {string} CSS text-shadow value
 */
export function getShadowCSS(sizePx, color = '#000000') {
  if (sizePx === 0) return 'none';
  const blur = sizePx;
  const spread = Math.round(sizePx * 0.3);
  // Convert hex to rgba with 0.5 opacity
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `0 ${spread}px ${blur}px rgba(${r},${g},${b},0.5)`;
}

/**
 * Get combined text-shadow for stroke and glow effects
 *
 * @param {number} strokeWidth - Stroke width in pixels
 * @param {string} strokeColor - Stroke color in hex
 * @param {number} shadowSize - Glow shadow size in pixels
 * @param {string} shadowColor - Glow shadow color in hex
 * @returns {string} Combined CSS text-shadow value
 */
export function getCombinedShadowCSS(strokeWidth, strokeColor, shadowSize, shadowColor) {
  const strokeShadow = getStrokeShadowCSS(strokeWidth, strokeColor);
  const glowShadow = getShadowCSS(shadowSize, shadowColor);

  if (strokeShadow && glowShadow && glowShadow !== 'none') {
    return `${strokeShadow}, ${glowShadow}`;
  } else if (strokeShadow) {
    return strokeShadow;
  } else {
    return glowShadow;
  }
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
  // Use shadow-based stroke instead of -webkit-text-stroke to avoid intersection artifacts
  timerEl.style.webkitTextStrokeWidth = '0px';
  timerEl.style.textShadow = getCombinedShadowCSS(
    style.strokeWidth ?? 0,
    style.strokeColor || '#000000',
    style.shadowSize ?? 0,
    style.shadowColor
  );
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

    this.maxFlashes = 2;
    this.glowDuration = 400;
    this.greyDuration = 300;
    this.cycleDuration = this.greyDuration + this.glowDuration; // 700ms per cycle
    // Pattern: grey→glow→grey→glow→grey→restore (transition from grey back to white)
    this.totalDuration = this.maxFlashes * this.cycleDuration + this.greyDuration;

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

    // Add smooth transition for phase changes
    this.timerEl.style.transition = 'color 100ms ease, text-shadow 100ms ease';

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

    // Compute current phase from timestamp (grey first, then glow)
    const cyclePosition = elapsed % this.cycleDuration;
    const phase = cyclePosition < this.greyDuration ? 'grey' : 'glow';

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
    this.timerEl.style.textShadow = glowCSS;
  }

  applyGrey() {
    this.timerEl.style.color = '#666666';
    this.timerEl.style.textShadow = 'none';
  }

  restore() {
    // Add quick fade transition for color (grey -> original)
    this.timerEl.style.transition = 'color 200ms ease-out';

    // Restore color with fade
    this.timerEl.style.color = this.originalColor;

    // Restore shadow instantly (no transition - looks weird animated)
    this.timerEl.style.textShadow = this.originalShadow;

    // Clear transition after animation completes
    setTimeout(() => {
      this.timerEl.style.transition = '';
    }, 250);

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
    this.timerEl.style.transition = '';
    if (this.isFlashing) {
      this.restore();
    }
  }
}

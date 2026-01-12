/**
 * Ninja Timer - Timer Utilities
 * Shared functions for time parsing and formatting
 */

/**
 * Parse HH:MM:SS or MM:SS or SS string to total seconds
 * @param {string} str - Time string
 * @returns {number} Total seconds
 */
export function parseHMS(str) {
  if (!str || typeof str !== 'string') return 0;

  const parts = str.trim().split(':').map(s => {
    const num = parseInt(s, 10);
    return isNaN(num) ? 0 : num;
  });

  let h = 0, m = 0, s = 0;

  if (parts.length === 3) {
    [h, m, s] = parts;
  } else if (parts.length === 2) {
    [m, s] = parts;
  } else if (parts.length === 1) {
    [s] = parts;
  }

  // Clamp values to valid ranges
  h = Math.max(0, Math.min(99, h));
  m = Math.max(0, Math.min(59, m));
  s = Math.max(0, Math.min(59, s));

  return (h * 3600) + (m * 60) + s;
}

/**
 * Convert total seconds to HH:MM:SS string
 * @param {number} total - Total seconds
 * @returns {string} Formatted time string
 */
export function secondsToHMS(total) {
  total = Math.max(0, Math.floor(total));

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = n => String(n).padStart(2, '0');

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Format milliseconds according to display format
 * @param {number} ms - Milliseconds
 * @param {string} format - Display format ('HH:MM:SS', 'MM:SS', 'SS')
 * @param {boolean} roundUp - If true, use ceil instead of floor (for countdowns)
 * @returns {string} Formatted time string
 */
// Centered colon for time display (HTML)
const COLON_HTML = '<span class="colon">:</span>';

/**
 * Format time as plain text (for inputs and textContent)
 * First segment is not padded (9:00 not 09:00), rest are padded (0:09 not 0:9)
 */
export function formatTimePlain(ms, format = 'MM:SS', roundUp = false) {
  const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = n => String(n).padStart(2, '0');

  switch (format) {
    case 'HH:MM:SS':
      return `${h}:${pad(m)}:${pad(s)}`;
    case 'MM:SS':
    default:
      return `${m + (h * 60)}:${pad(s)}`;
  }
}

/**
 * Format time as HTML (with centered colons for display)
 * First segment is not padded (9:00 not 09:00), rest are padded (0:09 not 0:9)
 */
export function formatTime(ms, format = 'MM:SS', roundUp = false) {
  const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = n => String(n).padStart(2, '0');

  switch (format) {
    case 'HH:MM:SS':
      return `${h}${COLON_HTML}${pad(m)}${COLON_HTML}${pad(s)}`;
    case 'MM:SS':
    default:
      return `${m + (h * 60)}${COLON_HTML}${pad(s)}`;
  }
}

/**
 * Convert hex color to rgba string
 * @param {string} hex - Hex color string
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, opacity = 1) {
  if (!hex || typeof hex !== 'string') return 'rgba(0, 0, 0, 1)';

  const h = hex.replace('#', '');
  const bigint = parseInt(h, 16);

  if (isNaN(bigint)) return 'rgba(0, 0, 0, 1)';

  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Format current time of day
 * @param {string} format - '12h' or '24h' (default: '12h')
 * @returns {string} Formatted time string
 */
export function formatTimeOfDay(format = '12h') {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  const pad = n => String(n).padStart(2, '0');

  if (format === '12h') {
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12; // Convert 0 to 12 for midnight
    return `${h}${COLON_HTML}${pad(m)}${COLON_HTML}${pad(s)} ${period}`;
  }

  // 24-hour format
  return `${h}${COLON_HTML}${pad(m)}${COLON_HTML}${pad(s)}`;
}

/**
 * Create a debounced function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 100) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Hawkario - Timer Utilities
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
 * @param {string} format - Display format ('H:MM:SS', 'MM:SS', 'SS')
 * @returns {string} Formatted time string
 */
export function formatTime(ms, format = 'MM:SS') {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const pad = n => String(n).padStart(2, '0');

  switch (format) {
    case 'H:MM:SS':
      return `${h}:${pad(m)}:${pad(s)}`;
    case 'SS':
      return String(total);
    case 'MM:SS':
    default:
      return `${pad(m + (h * 60))}:${pad(s)}`;
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

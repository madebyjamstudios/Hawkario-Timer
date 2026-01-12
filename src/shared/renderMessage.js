/**
 * Ninja Timer - Shared Message Renderer
 * Used by BOTH preview and output for identical rendering
 */

// Reference size for consistent layout (like a virtual canvas)
const REF_FONT_SIZE = 100;
const REF_MAX_WIDTH = 1200; // Fixed pixel width for line wrapping at reference size

/**
 * Auto-fit message text using pure font-size scaling (like timer does)
 * Uses fixed pixel max-width so scaling is smooth and predictable
 *
 * @param {HTMLElement} messageEl - The message text element
 * @param {HTMLElement} containerEl - The container element
 */
export function autoFitMessage(messageEl, containerEl) {
  if (!messageEl || !containerEl) return;

  const containerWidth = containerEl.clientWidth || containerEl.offsetWidth;
  const containerHeight = containerEl.clientHeight || containerEl.offsetHeight;

  // Target area for the message (90% width, 45% height for 50/50 split)
  const targetWidth = containerWidth * 0.9;
  const targetHeight = containerHeight * 0.45;

  // Measure at reference size with fixed pixel max-width
  messageEl.style.fontSize = REF_FONT_SIZE + 'px';
  messageEl.style.maxWidth = REF_MAX_WIDTH + 'px';
  messageEl.style.transform = 'none';

  const naturalWidth = messageEl.scrollWidth;
  const naturalHeight = messageEl.scrollHeight;

  if (naturalWidth > 0 && naturalHeight > 0) {
    // Calculate scale ratio (same as timer)
    const widthRatio = targetWidth / naturalWidth;
    const heightRatio = targetHeight / naturalHeight;
    const ratio = Math.min(widthRatio, heightRatio);

    // Apply new font size and scale max-width proportionally
    const newFontSize = Math.max(8, REF_FONT_SIZE * ratio);
    messageEl.style.fontSize = newFontSize + 'px';
    messageEl.style.maxWidth = (REF_MAX_WIDTH * ratio) + 'px';
  }
}

/**
 * Apply message styling (text, color, formatting)
 *
 * @param {HTMLElement} messageEl - The message text element
 * @param {Object} message - Message object with text, color, bold, italic, uppercase
 */
export function applyMessageStyle(messageEl, message) {
  if (!messageEl || !message) return;

  messageEl.textContent = message.text || '';
  messageEl.style.color = message.color || '#ffffff';
  messageEl.classList.toggle('bold', !!message.bold);
  messageEl.classList.toggle('italic', !!message.italic);
  messageEl.classList.toggle('uppercase', !!message.uppercase);
}

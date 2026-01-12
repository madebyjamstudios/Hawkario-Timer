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

  // Target width for the message (90% of container)
  const targetWidth = containerWidth * 0.9;

  // Measure at reference size with fixed pixel max-width
  messageEl.style.fontSize = REF_FONT_SIZE + 'px';
  messageEl.style.maxWidth = REF_MAX_WIDTH + 'px';
  messageEl.style.transform = 'none';

  const naturalWidth = messageEl.scrollWidth;

  if (naturalWidth > 0) {
    // Scale based on width only (like timer) - no sudden height jumps
    const ratio = targetWidth / naturalWidth;

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

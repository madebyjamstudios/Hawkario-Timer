/**
 * Ninja Timer - Shared Message Renderer
 * Used by BOTH preview and output for identical rendering
 */

// Line width in em units - ensures consistent character count per line
// regardless of font size (roughly 16-20 characters per line)
const LINE_WIDTH_EM = 16;

/**
 * Auto-fit message text using font-size scaling with em-based width
 * Uses em units for max-width so line breaks happen at the same words
 * regardless of container size
 *
 * @param {HTMLElement} messageEl - The message text element
 * @param {HTMLElement} containerEl - The container element
 */
export function autoFitMessage(messageEl, containerEl) {
  if (!messageEl || !containerEl) return;

  // Reset to measure at base size
  messageEl.style.fontSize = '100px';
  messageEl.style.maxWidth = LINE_WIDTH_EM + 'em';  // em-based = consistent line breaks
  messageEl.style.transform = 'none';

  const containerWidth = containerEl.clientWidth || containerEl.offsetWidth;
  const containerHeight = containerEl.clientHeight || containerEl.offsetHeight;
  const targetWidth = containerWidth * 0.85;
  // Message gets 40% of container (60/40 split), use 35% for padding
  const targetHeight = containerHeight * 0.35;
  const naturalWidth = messageEl.scrollWidth;
  const naturalHeight = messageEl.scrollHeight;

  if (naturalWidth > 0 && naturalHeight > 0) {
    const widthRatio = targetWidth / naturalWidth;
    const heightRatio = targetHeight / naturalHeight;
    const ratio = Math.min(widthRatio, heightRatio);
    const newFontSize = Math.max(8, 100 * ratio);
    messageEl.style.fontSize = newFontSize + 'px';
    // maxWidth stays in em, so it scales with font size = same line breaks
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

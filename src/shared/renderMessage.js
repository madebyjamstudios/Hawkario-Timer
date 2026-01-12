/**
 * Ninja Timer - Shared Message Renderer
 * Used by BOTH preview and output for identical rendering
 */

// Fixed reference dimensions - ensures identical line wrapping
const REF_WIDTH = 800;   // Reference width for line wrapping
const REF_FONT = 48;     // Reference font size

/**
 * Auto-fit message text using transform scale
 * Uses fixed reference size so line breaks are identical regardless of container size
 *
 * @param {HTMLElement} messageEl - The message text element
 * @param {HTMLElement} containerEl - The container element
 */
export function autoFitMessage(messageEl, containerEl) {
  if (!messageEl || !containerEl) return;

  // Fixed reference size for consistent line breaks
  messageEl.style.fontSize = REF_FONT + 'px';
  messageEl.style.maxWidth = REF_WIDTH + 'px';
  messageEl.style.transform = 'scale(1)';
  messageEl.style.transformOrigin = 'center center';

  const containerWidth = containerEl.clientWidth || containerEl.offsetWidth;
  const containerHeight = containerEl.clientHeight || containerEl.offsetHeight;
  const targetWidth = containerWidth * 0.85;
  const targetHeight = containerHeight * 0.45;
  const naturalWidth = messageEl.scrollWidth;
  const naturalHeight = messageEl.scrollHeight;

  if (naturalWidth > 0 && naturalHeight > 0) {
    const widthRatio = targetWidth / naturalWidth;
    const heightRatio = targetHeight / naturalHeight;
    const scale = Math.min(widthRatio, heightRatio);
    messageEl.style.transform = `scale(${scale})`;
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

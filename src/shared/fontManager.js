/**
 * Font Manager - Built-in fonts and utilities for custom font support
 */

// Built-in Google Fonts available for timer display
export const BUILT_IN_FONTS = [
  { family: 'Inter', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Roboto', weights: [300, 400, 500, 700, 900] },
  { family: 'Open Sans', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Montserrat', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Lato', weights: [300, 400, 700, 900] },
  { family: 'Oswald', weights: [300, 400, 500, 600, 700] }
];

// Weight labels for UI display
export const WEIGHT_LABELS = {
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black'
};

// Default font settings
export const DEFAULT_FONT = {
  family: 'Inter',
  weight: 700
};

/**
 * Get available weights for a font family
 * @param {string} family - Font family name
 * @param {Array} customFonts - Array of custom font objects
 * @returns {Array<number>} Available weights
 */
export function getAvailableWeights(family, customFonts = []) {
  // Check built-in fonts first
  const builtIn = BUILT_IN_FONTS.find(f => f.family === family);
  if (builtIn) {
    return builtIn.weights;
  }

  // Check custom fonts
  const custom = customFonts.find(f => f.family === family);
  if (custom) {
    return custom.weights || [400, 700]; // Default weights for custom fonts
  }

  // Fallback - return common weights
  return [400, 700];
}

/**
 * Get weight label for display
 * @param {number} weight - Font weight value
 * @returns {string} Human-readable label
 */
export function getWeightLabel(weight) {
  return WEIGHT_LABELS[weight] || `Weight ${weight}`;
}

/**
 * Check if a font family is a built-in font
 * @param {string} family - Font family name
 * @returns {boolean}
 */
export function isBuiltInFont(family) {
  return BUILT_IN_FONTS.some(f => f.family === family);
}

/**
 * Get font format from file extension
 * @param {string} fileName - Font file name
 * @returns {string} CSS font format
 */
export function getFontFormat(fileName) {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'ttf': return 'truetype';
    case 'otf': return 'opentype';
    case 'woff': return 'woff';
    case 'woff2': return 'woff2';
    default: return 'truetype';
  }
}

/**
 * Generate a unique font ID
 * @returns {string}
 */
export function generateFontId() {
  return `font-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract font family name from file name
 * @param {string} fileName - Font file name
 * @returns {string} Font family name
 */
export function extractFontName(fileName) {
  // Remove extension
  let name = fileName.replace(/\.(ttf|otf|woff|woff2)$/i, '');

  // Remove common suffixes like -Regular, -Bold, etc.
  name = name.replace(/[-_](Regular|Bold|Light|Medium|SemiBold|ExtraBold|Black|Thin|Italic)$/i, '');

  // Convert to title case and replace separators with spaces
  name = name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return name.trim();
}

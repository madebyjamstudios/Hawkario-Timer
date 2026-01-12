/**
 * Icon Generator Script
 * Generates all required icon sizes for macOS .icns file from icon.svg
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const SVG_PATH = path.join(ROOT_DIR, 'icon.svg');
const ICONSET_DIR = path.join(ROOT_DIR, 'icon.iconset');
const ICNS_PATH = path.join(ROOT_DIR, 'icon.icns');
const PNG_PATH = path.join(ROOT_DIR, 'icon.png');

// Required sizes for macOS iconset
const SIZES = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 }
];

async function generateIcons() {
  console.log('Generating icons from SVG...');

  // Read SVG
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Create iconset directory
  if (fs.existsSync(ICONSET_DIR)) {
    fs.rmSync(ICONSET_DIR, { recursive: true });
  }
  fs.mkdirSync(ICONSET_DIR);

  // Generate each size
  // Use a fixed high density for crisp rendering, then resize
  const density = 144; // 2x standard 72 DPI

  for (const { name, size } of SIZES) {
    const outputPath = path.join(ICONSET_DIR, name);

    await sharp(svgBuffer, { density })
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);

    console.log(`  Created ${name} (${size}x${size})`);
  }

  // Also generate the main icon.png (1024x1024)
  await sharp(svgBuffer, { density })
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(PNG_PATH);
  console.log('  Created icon.png (1024x1024)');

  // Generate .icns using iconutil
  console.log('Building icon.icns...');
  try {
    execSync(`iconutil -c icns "${ICONSET_DIR}" -o "${ICNS_PATH}"`, { stdio: 'inherit' });
    console.log('  Created icon.icns');
  } catch (error) {
    console.error('Failed to create .icns file:', error.message);
    process.exit(1);
  }

  // Cleanup iconset folder
  fs.rmSync(ICONSET_DIR, { recursive: true });
  console.log('Done!');
}

generateIcons().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

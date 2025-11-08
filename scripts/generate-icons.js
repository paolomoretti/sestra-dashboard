// Simple script to generate PWA icons
// Run with: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#2d5aa0" rx="80"/>
  <circle cx="256" cy="256" r="120" fill="#FFC107" opacity="0.9"/>
  <circle cx="256" cy="256" r="80" fill="#ffffff"/>
  <path d="M 256 180 L 280 240 L 340 240 L 290 280 L 310 340 L 256 300 L 202 340 L 222 280 L 172 240 L 232 240 Z" fill="#2d5aa0"/>
</svg>`;

// Convert SVG to PNG using a simple approach
// Note: This requires a headless browser or image library
// For now, we'll create the SVG and document the conversion

const publicDir = path.join(__dirname, '..', 'public');

// Create icon-192.svg as a fallback
fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), svgIcon);
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), svgIcon);

console.log('✅ Created SVG icons in public/');
console.log('📝 To convert to PNG, you can:');
console.log('   1. Use an online SVG to PNG converter');
console.log('   2. Use ImageMagick: convert icon-192.svg -resize 192x192 icon-192.png');
console.log('   3. Use a design tool to export PNGs from the SVG');
console.log('');
console.log('Required sizes:');
console.log('  - icon-192.png (192x192)');
console.log('  - icon-512.png (512x512)');


#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

// Bundle configurations - logically grouped modules
const bundles = [
  {
    name: 'core',
    modules: [
      'modules/feature-style-core.js',
      'modules/feature-bulma-layer.js',
      'modules/feature-layout.js'
    ]
  },
  {
    name: 'chat',
    modules: [
      'modules/feature-chat.js',
      'modules/feature-chat-tools.js',
      'modules/feature-chat-filters.js',
      'modules/feature-chat-username-colors.js',
      'modules/feature-chat-media.js',
      'modules/feature-chat-avatars.js',
      'modules/feature-chat-timestamps.js',
      'modules/feature-chat-ignore.js',
      'modules/feature-chat-commands.js'
    ]
  },
  {
    name: 'player',
    modules: [
      'modules/feature-player.js',
      'modules/feature-stack.js',
      'modules/feature-video-overlay.js',
      'modules/feature-video-enhancements.js',
      'modules/feature-ambient.js',
      'modules/feature-pip.js',
      'modules/feature-resize.js'
    ]
  },
  {
    name: 'playlist',
    modules: [
      'modules/feature-nowplaying.js',
      'modules/feature-playlist-performance.js',
      'modules/feature-playlist-tools.js',
      'modules/feature-playlist-search.js'
    ]
  },
  {
    name: 'admin',
    modules: [
      'modules/feature-channel-theme-admin.js',
      'modules/feature-theme-settings.js',
      'modules/feature-motd-editor.js'
    ]
  },
  {
    name: 'features',
    modules: [
      'modules/feature-channels.js',
      'modules/feature-footer.js',
      'modules/feature-navbar.js',
      'modules/feature-modal-skin.js',
      'modules/feature-emotes.js',
      'modules/feature-emoji-compat.js',
      'modules/feature-emoji-loader.js',
      'modules/feature-gifs.js',
      'modules/feature-poll-overlay.js',
      'modules/feature-notify.js',
      'modules/feature-sync-guard.js',
      'modules/feature-local-subs.js',
      'modules/feature-billcast.js',
      'modules/feature-billcaster.js',
      'modules/feature-overlays.js',
      'modules/feature-userlist-overlay.js'
    ]
  }
];

// Build output directory
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Simple concatenation and minification
function minifyJS(code) {
  // Basic minification: remove comments and extra whitespace
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\/\/.*/g, '') // Remove line comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*([{};,:])\s*/g, '$1') // Remove space around punctuation
    .trim();
}

function buildBundle(bundle) {
  const rootDir = path.join(__dirname, '..');
  const parts = [`/*! BillTube ${bundle.name} bundle */`];
  
  for (const modulePath of bundle.modules) {
    const fullPath = path.join(rootDir, modulePath);
    
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠ Skipping missing module: ${modulePath}`);
      continue;
    }
    
    const code = fs.readFileSync(fullPath, 'utf-8');
    parts.push(`\n/* ${modulePath} */`);
    parts.push(code);
  }
  
  const combined = parts.join('\n');
  const minified = minifyJS(combined);
  
  const outPath = path.join(distDir, `${bundle.name}.bundle.js`);
  fs.writeFileSync(outPath, minified, 'utf-8');
  
  const originalSize = combined.length;
  const minifiedSize = minified.length;
  const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
  
  console.log(`✓ Built ${bundle.name}.bundle.js (${(minifiedSize / 1024).toFixed(1)}KB, ${savings}% smaller)`);
}

function build() {
  console.log('🔨 Building BillTube modules...\n');
  
  for (const bundle of bundles) {
    try {
      buildBundle(bundle);
    } catch (err) {
      console.error(`✗ Failed to build ${bundle.name}:`, err.message);
      process.exit(1);
    }
  }
  
  console.log('\n✨ Build complete!');
}

// Watch mode
if (isWatch) {
  console.log('👀 Watching for changes...\n');
  
  build();
  
  const rootDir = path.join(__dirname, '..');
  const modulesDir = path.join(rootDir, 'modules');
  
  fs.watch(modulesDir, { recursive: false }, (eventType, filename) => {
    if (filename && filename.endsWith('.js')) {
      console.log(`\n📝 Change detected in ${filename}, rebuilding...`);
      build();
    }
  });
} else {
  build();
}


#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { minify } from "terser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

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
      'modules/feature-resize.js',
      'modules/feature-audio-boost.js',
      'modules/feature-auto-subs.js',
      'modules/feature-movie-info.js',
      'modules/feature-movie-suggestions.js'
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
      'modules/feature-notification-sounds.js',
      'modules/feature-sync-guard.js',
      'modules/feature-local-subs.js',
      'modules/feature-billcast.js',
      'modules/feature-billcaster.js',
      'modules/feature-overlays.js',
      'modules/feature-userlist-overlay.js',
      'modules/feature-ratings.js'
    ]
  }
];

async function buildBundle(bundle) {
  const rootDir = path.join(__dirname, "..");
  let code = `/*! BillTube ${bundle.name} bundle */\n`;

  for (const modulePath of bundle.modules) {
    const fullPath = path.join(rootDir, modulePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠ Skipping missing module: ${modulePath}`);
      continue;
    }
    code += `\n/* ${modulePath} */\n` + fs.readFileSync(fullPath, "utf8");
  }

  // Pass combined code to Terser for minification
  const result = await minify(code, {
    compress: true,
    mangle: true,
    format: {
      comments: false
    }
  });

  const outPath = path.join(distDir, `${bundle.name}.bundle.js`);
  fs.writeFileSync(outPath, result.code, "utf-8");
  console.log(`✓ Built ${bundle.name}.bundle.js (${(result.code.length / 1024).toFixed(1)}KB)`);
}

(async function build() {
  console.log("🔨 Building BillTube bundles with Terser...\n");
  for (const bundle of bundles) {
    await buildBundle(bundle);
  }
  console.log("\n✨ Build complete!");
})();
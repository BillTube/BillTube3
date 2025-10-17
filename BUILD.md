# BillTube Build System

## Overview

BillTube uses esbuild to bundle modules for production, significantly improving load times by reducing HTTP requests from 33 to 6.

## Bundle Strategy

Modules are grouped into logical bundles:

- **core.bundle.js** - Style core, Bulma layer, layout
- **chat.bundle.js** - All chat-related features
- **player.bundle.js** - Player, video, ambient, PIP features
- **playlist.bundle.js** - Playlist and now-playing features
- **admin.bundle.js** - Theme admin and settings
- **features.bundle.js** - All remaining features

## Usage

### Install Dependencies

```bash
npm install
```

### Build for Production

```bash
npm run build
# or if PowerShell execution policy blocks npm:
node scripts/build.js
```

This creates optimized bundles in the `dist/` directory.

### Development Mode

```bash
npm run build:watch
# or:
node scripts/build.js --watch
```

Watches for changes and rebuilds automatically.

### Testing Modes

- **Production (bundled)**: `https://your-site.com/`
- **Dev (individual modules)**: `https://your-site.com/?dev=1`

The framework auto-detects based on the `?dev=1` query parameter.

## Performance Gains

- **Before**: 33 sequential module loads (~1500-2000ms)
- **After**: 6 parallel bundle loads (~400-600ms)
- **Improvement**: ~70-80% faster initial load

## File Structure

```
BillTube3-slim/
├── modules/              # Source modules (for dev mode)
├── dist/                 # Built bundles (gitignored)
├── scripts/
│   ├── build.js         # Build script
│   └── bundles/         # Generated entry files (gitignored)
└── billtube-fw.js       # Framework loader
```

## Notes

- Bundles are minified for production
- Source modules remain available for dev mode
- Build artifacts are gitignored
- CDN should serve bundles with proper cache headers


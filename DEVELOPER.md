# Mezofill Motion Studio 1.0

Local template-based product motion editor. No remote API, telemetry, CDN assets, AI generation, audio processing, or database. Windows x64 launchers install a portable Node 24 runtime, locked npm dependencies, FFmpeg, and Playwright Chromium. After setup, all operations run locally.

## Run from source

Node >=22. `npm ci`, then `npm run install:browser`. The browser installer and runtime share `.runtime/browsers` unless PLAYWRIGHT_BROWSERS_PATH is set. `npm start` launches the server bound to 127.0.0.1 and opens the editor. The default port is 4318; the next 20 ports are tried if occupied.

Development overrides: PORT, STUDIO_NO_OPEN=1, STUDIO_FFMPEG (executable path), STUDIO_CHROMIUM (executable path), PLAYWRIGHT_BROWSERS_PATH. These are environment variables, not user-uploaded project fields.

## Files

- public/model.js: shared schema validation and six-scene example. Version 1 project JSON.
- public/renderer.js + renderer.css: deterministic time-driven DOM/canvas renderer shared by preview, standalone HTML, and MP4.
- public/app.js + studio.css: Persian RTL editor, asset controls, history, autosave, playback, export UI.
- server.js: standard-library HTTP server, local assets, serial atomic project writes, portable import/export and frame capture pipeline.
- scripts/runtime.js: renderer browser selection and FFmpeg resolution.
- scripts/doctor.js: browser screenshot + real libx264 encoding check.

## Render

A validated project snapshot is retained in a render job. A headless Chromium page loads local fonts and images, then seeks to frameIndex/fps. Frames are captured with Chromium Page.captureScreenshot (lossless PNG, optimizeForSpeed) and stream with backpressure into FFmpeg. Encoder: libx264, preset fast, CRF 23/18/15, yuv420p, faststart, no audio. Output frame count is round(duration \* fps), so duration is quantized to one output frame. Only one job runs at a time. Cancellation closes browser/encoder and removes partial output. File names are timestamped and unique. CPU encoding is used; GPU/NVENC is not required.

The renderer uses seeded particles and no CSS or real-clock animations. Scene start times are cumulative; transitions happen inside the incoming scene's duration. Preview and exported HTML scale the stage uniformly to fit. There are compact and landscape arrangements; very extreme aspect ratios and long copy need visual review.

## Persistence and local security

Only 127.0.0.1 is bound. Host and Origin headers are checked. Mutations require a session token issued from /api/config. Uploaded file types are limited to still raster images and fonts; executable HTML/SVG uploads are rejected. Asset URLs in project data must stay under /assets/. Server paths are constrained. All visible user text is escaped or assigned using textContent. Standalone JSON escapes '<' before embedding in a script. Render requests are restricted to the local server and embedded data. This is a single-user local app, not a multi-user internet service.

Projects reference assets by relative URL. Portable backup embeds only used assets as data URLs and remaps them into hashed local files on import. Back up assets and projects together, or use the portable backup action.

## Dependencies and attribution

- Node.js: https://nodejs.org (runtime licenses included in downloaded distribution)
- Playwright: https://playwright.dev/docs/browsers and https://playwright.dev/docs/screenshots (Apache-2.0; package licenses retained by npm)
- ffmpeg-static: https://github.com/eugeneware/ffmpeg-static (GPL-3.0 wrapper; downloaded FFmpeg binaries have their own licenses/build sources)
- FFmpeg: https://ffmpeg.org

Runtime binaries, personal projects, images and fonts are excluded from Git. Setup downloads dependencies locally. The starter project uses placeholders and system fonts. Existing local EPTQ media and Yekan fonts belong to the original workspace and are not part of the source distribution.

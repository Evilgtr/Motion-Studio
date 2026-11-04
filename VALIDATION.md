# Validation

## Source cleanup checks (2026-11-04)

Executed on Windows with Node 24.22.2:

- `npm test`: three passing tests covering an asset-free default, invalid project inputs, token/origin checks, save/load, missing-project recovery, HTML escaping, and empty-file responses. Server tests use a temporary workspace.
- `npm run doctor`: Chromium screenshot capture and FFmpeg H.264 encoding passed.
- `npm run format:check`: source formatting checked with pinned Prettier.

Full editor interactions and complete MP4 exports were not rerun during this cleanup. The notes below describe earlier validation, not new results.

## Earlier validation

The application was exercised in a Linux test environment with Node.js, Playwright, local Chromium and FFmpeg. The Windows .cmd/.ps1 installers were reviewed, but were not executed on Windows here. Run Check-System.cmd on the target PC after setup.

Passed:

- Persian editor load, live editing, disk autosave, scene duplication and undo.
- Seek position retained after edits; visible initial preview.
- All six layouts inspected at portrait, square, and landscape dimensions.
- Repeated non-sequential seeks produce identical PNG frames at the same timestamp.
- Image upload with Persian filename; font upload; portable project backup/import with embedded assets.
- Standalone HTML opens offline with zero HTTP requests.
- Rejected unauthenticated mutation and invalid odd output dimensions.
- A complete 20-second MP4: H.264, 1080x1920, yuv420p, 30fps, exactly 600 frames; no audio stream. An extracted video frame was visually inspected.
- Custom-size MP4: 640x360, 24fps, exactly 96 frames / 4 seconds. All four scene transitions exercised.
- Video byte-range response for in-browser playback.
- Render cancellation removes partial output and permits a new successful render.
- The editor's MP4 export dialog completes and exposes the video and download link.
- No page JavaScript errors in the editor workflow.

4K dimensions are accepted by schema and renderer, but a full 4K export was not part of this run. Encoding is CPU-based and performance depends on the target computer. Browser/runtime installation and offline execution on the user's Windows PC remain environment-specific.

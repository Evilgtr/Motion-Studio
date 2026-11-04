# Contributing

Follow the source setup in README.md. Keep changes focused and preserve Persian RTL behavior, existing project JSON compatibility, and deterministic rendering.

Before submitting a change, run `npm test` and `npm run format:check`. For renderer changes, also run `npm run doctor`, inspect portrait/square/landscape previews, and export a short MP4. Describe what changed and which checks you actually ran.

Never include private projects, uploaded media, fonts, exports, credentials, `node_modules`, or `.runtime` in a contribution. Use synthetic fixtures in tests. Discuss project-format changes before changing version 1 compatibility.

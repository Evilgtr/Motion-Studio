"use strict";
const { spawnSync } = require("node:child_process");
require("./runtime");
const path = require("node:path");
const cli = path.join(
  path.dirname(require.resolve("playwright/package.json")),
  "cli.js",
);
const result = spawnSync(process.execPath, [cli, "install", "chromium"], {
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;

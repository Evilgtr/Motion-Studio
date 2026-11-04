"use strict";
const { spawnSync } = require("node:child_process");
const { browserOptions, ffmpegPath } = require("./runtime");
(async () => {
  let failed = false;
  console.log("Motion Studio - System Check\n");
  console.log("Node:", process.version);
  if (Number(process.versions.node.split(".")[0]) < 22) {
    console.error("Node 22+ is required.");
    failed = true;
  }
  try {
    const { chromium } = require("playwright");
    const browser = await chromium.launch(browserOptions());
    const page = await browser.newPage();
    await page.setContent("<p>Render check</p>");
    const img = await page.screenshot();
    console.log("Browser: OK (" + img.length + " bytes captured)");
    await browser.close();
  } catch (e) {
    console.error("Browser: FAILED\n" + e.message);
    failed = true;
  }
  const ff = spawnSync(
    ffmpegPath(),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x64:r=24",
      "-frames:v",
      "1",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-f",
      "null",
      "-",
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  if (ff.status === 0) console.log("FFmpeg / H.264: OK");
  else {
    console.error("FFmpeg: FAILED\n" + (ff.error?.message || ff.stderr));
    failed = true;
  }
  console.log(
    failed
      ? "\nRun Setup-Windows.cmd to repair, or see README-FA.html."
      : "\nAll checks passed. Run Start-Studio.cmd.",
  );
  process.exitCode = failed ? 1 : 0;
})();

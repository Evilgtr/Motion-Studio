"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH)
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
    root,
    ".runtime",
    "browsers",
  );
function browserOptions() {
  const options = {
    headless: true,
    args: ["--disable-background-timer-throttling"],
  };
  if (process.env.STUDIO_CHROMIUM) {
    options.executablePath = process.env.STUDIO_CHROMIUM;
    return options;
  }
  const { chromium } = require("playwright");
  if (fs.existsSync(chromium.executablePath())) return options;
  if (process.platform === "win32") {
    const candidates = [
      ["PROGRAMFILES(X86)", "Microsoft/Edge/Application/msedge.exe"],
      ["PROGRAMFILES", "Microsoft/Edge/Application/msedge.exe"],
      ["PROGRAMFILES", "Google/Chrome/Application/chrome.exe"],
      ["LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"],
    ];
    for (const [env, rel] of candidates) {
      const base = process.env[env] || process.env[env.toLowerCase()];
      if (base && fs.existsSync(path.join(base, rel))) {
        options.executablePath = path.join(base, rel);
        return options;
      }
    }
  }
  return options;
}
function ffmpegPath() {
  if (process.env.STUDIO_FFMPEG) return process.env.STUDIO_FFMPEG;
  const manual = path.join(root, ".runtime", "ffmpeg.exe");
  if (fs.existsSync(manual)) return manual;
  try {
    return require("ffmpeg-static");
  } catch {
    return "ffmpeg";
  }
}
module.exports = { browserOptions, ffmpegPath };

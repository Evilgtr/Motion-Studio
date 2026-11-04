"use strict";
const http = require("node:http"),
  fs = require("node:fs"),
  fsp = fs.promises,
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawn } = require("node:child_process");
const ROOT = __dirname,
  PUBLIC = path.join(ROOT, "public"),
  M = require("./public/model");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH)
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
    ROOT,
    ".runtime",
    "browsers",
  );
const token = crypto.randomBytes(24).toString("hex"),
  jobs = new Map();
let activeJob = null,
  server,
  port;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
};
const assetExt = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
];
for (const dir of ["assets/images", "assets/fonts", "projects", "exports"])
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
const safePath = (base, relative) => {
  if (relative.includes("\0")) throw Error("Invalid path");
  const p = path.resolve(base, relative);
  if (!p.startsWith(path.resolve(base) + path.sep)) throw Error("Invalid path");
  return p;
};
function assetPath(url) {
  if (!url.startsWith("/assets/")) throw Error("Invalid asset");
  return safePath(path.join(ROOT, "assets"), url.slice(8));
}
async function body(req, limit = 50 * 1024 * 1024) {
  let size = 0,
    chunks = [];
  for await (const b of req) {
    size += b.length;
    if (size > limit) {
      throw Error("حجم فایل بیش از حد مجاز است.");
    }
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}
async function payload(req, limit) {
  return JSON.parse((await body(req, limit)).toString("utf8"));
}
async function atomicWrite(file, data) {
  const tmp = file + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
  try {
    await fsp.writeFile(tmp, data);
    await fsp.rename(tmp, file);
  } finally {
    await fsp.rm(tmp, { force: true }).catch(() => {});
  }
}
async function assets() {
  let items = [];
  async function walk(dir) {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (assetExt.includes(path.extname(entry.name).toLowerCase())) {
        items.push({
          name: entry.name,
          url:
            "/assets/" +
            path
              .relative(path.join(ROOT, "assets"), full)
              .split(path.sep)
              .join("/"),
          type: /\.(woff2?|ttf|otf)$/i.test(entry.name) ? "font" : "image",
        });
      }
    }
  }
  await walk(path.join(ROOT, "assets"));
  return items;
}
async function checkAssets(p) {
  for (const url of new Set(
    [
      p.theme.font,
      p.theme.bold,
      ...p.scenes.flatMap((s) => [s.image, s.logo]),
    ].filter(Boolean),
  )) {
    const file = assetPath(url);
    if (!assetExt.includes(path.extname(file).toLowerCase()))
      throw Error("نوع فایل پشتیبانی نمی‌شود.");
    await fsp.access(file).catch(() => {
      throw Error("فایل پیدا نشد: " + url);
    });
  }
}
const { browserOptions, ffmpegPath } = require("./scripts/runtime");
const publicJob = (j) => ({
  id: j.id,
  status: j.status,
  progress: j.progress,
  frames: j.frames,
  totalFrames: j.totalFrames,
  elapsed: Math.round((Date.now() - j.started) / 1000),
  eta: j.frames
    ? Math.round(
        ((j.totalFrames - j.frames) * (Date.now() - j.started)) /
          1000 /
          j.frames,
      )
    : null,
  error: j.error || "",
  filename: j.filename || "",
  url: j.status === "done" ? "/exports/" + j.filename : "",
});
async function renderVideo(j) {
  let browser,
    encoder,
    exitPromise,
    stderr = "",
    finalStatus = "error";
  try {
    const { chromium } = require("playwright"),
      p = j.project;
    await checkAssets(p);
    j.status = "preparing";
    browser = await chromium.launch(browserOptions());
    j.browser = browser;
    if (j.cancelled) throw Error("cancelled");
    const context = await browser.newContext({
      viewport: { width: p.width, height: p.height },
      deviceScaleFactor: 1,
    });
    await context.route("**/*", (route) => {
      const u = new URL(route.request().url());
      return ["data:", "blob:"].includes(u.protocol) ||
        u.origin === `http://127.0.0.1:${port}`
        ? route.continue()
        : route.abort();
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/player.html?job=${j.id}`, {
      waitUntil: "load",
    });
    await page.evaluate(() => window.motion.ready);
    const capture = await context.newCDPSession(page);
    await capture.send("Page.enable");
    j.status = "rendering";
    const crf = { standard: "23", high: "18", ultra: "15" }[p.quality];
    encoder = spawn(
      ffmpegPath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-framerate",
        String(p.fps),
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        crf,
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-f",
        "mp4",
        j.temp,
      ],
      { windowsHide: true },
    );
    j.encoder = encoder;
    let encError = null;
    encoder.on("error", (e) => (encError = e));
    encoder.stdin.on("error", (e) => (encError = e));
    encoder.stderr.on(
      "data",
      (b) => (stderr = (stderr + b.toString()).slice(-4000)),
    );
    exitPromise = new Promise((resolve) => {
      encoder.once("error", () => resolve(-1));
      encoder.once("close", resolve);
    });
    for (let f = 0; f < j.totalFrames; f++) {
      if (j.cancelled) throw Error("cancelled");
      if (encError || encoder.exitCode !== null)
        throw encError || Error(stderr || "FFmpeg stopped");
      await page.evaluate((t) => window.motion.seek(t), f / p.fps);
      const frame = await capture.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
        optimizeForSpeed: true,
      });
      const png = Buffer.from(frame.data, "base64");
      await new Promise((resolve, reject) =>
        encoder.stdin.write(png, (e) => (e ? reject(e) : resolve())),
      );
      j.frames = f + 1;
      j.progress = Math.round((j.frames / j.totalFrames) * 98);
    }
    j.status = "encoding";
    encoder.stdin.end();
    const code = await exitPromise;
    if (j.cancelled) throw Error("cancelled");
    if (code !== 0) throw Error(stderr || "FFmpeg failed");
    await fsp.rename(j.temp, path.join(ROOT, "exports", j.filename));
    j.progress = 100;
    finalStatus = "done";
  } catch (e) {
    finalStatus = j.cancelled ? "cancelled" : "error";
    j.error = j.cancelled ? "رندر لغو شد." : String(e.message);
    if (encoder && !encoder.killed) {
      encoder.stdin.destroy();
      encoder.kill("SIGKILL");
    }
    if (exitPromise) await exitPromise;
    await fsp.rm(j.temp, { force: true }).catch(() => {});
  } finally {
    if (browser) await browser.close().catch(() => {});
    j.browser = null;
    j.encoder = null;
    j.project = null;
    activeJob = null;
    j.status = finalStatus;
  }
}
async function embed(p) {
  const result = M.clone(p),
    map = {};
  for (const url of new Set(
    [
      p.theme.font,
      p.theme.bold,
      ...p.scenes.flatMap((s) => [s.image, s.logo]),
    ].filter(Boolean),
  )) {
    const file = assetPath(url);
    map[url] =
      `data:${MIME[path.extname(file).toLowerCase()]};base64,${(await fsp.readFile(file)).toString("base64")}`;
  }
  return { project: result, assets: map };
}
async function writeAsset(name, data) {
  const ext = path.extname(name).toLowerCase();
  if (!assetExt.includes(ext))
    throw Error("فرمت مجاز: PNG، JPG، WebP، AVIF یا WOFF، WOFF2، TTF، OTF");
  if (data.length > 30 * 1024 * 1024)
    throw Error("حداکثر حجم هر فایل ۳۰ مگابایت است.");
  const kind = /\.(woff2?|ttf|otf)$/.test(ext) ? "fonts" : "images";
  const hash = crypto
    .createHash("sha256")
    .update(data)
    .digest("hex")
    .slice(0, 16);
  const stem =
    path
      .basename(name, ext)
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}_-]/gu, "-")
      .slice(0, 50) || "asset";
  const url = `/assets/${kind}/${stem}-${hash}${ext}`;
  await fsp.writeFile(assetPath(url), data);
  return url;
}
async function importPortable(data) {
  const p = M.validate(data.project || data);
  if (data.assets) {
    const map = {};
    for (const [key, value] of Object.entries(data.assets)) {
      if (
        typeof value !== "string" ||
        !/^data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+$/.test(value)
      )
        throw Error("فایل پشتیبان نامعتبر است.");
      map[key] = await writeAsset(
        path.basename(key),
        Buffer.from(value.split(",")[1], "base64"),
      );
    }
    for (const k of ["font", "bold"])
      p.theme[k] = map[p.theme[k]] || p.theme[k];
    for (const s of p.scenes)
      for (const k of ["image", "logo"]) s[k] = map[s[k]] || s[k];
  }
  p.id = crypto.randomUUID();
  await checkAssets(p);
  await atomicWrite(
    path.join(ROOT, "projects", p.id + ".json"),
    JSON.stringify(p, null, 2),
  );
  return p;
}
async function serveFile(req, res, file, download = false) {
  const stat = await fsp.stat(file);
  if (!stat.isFile()) throw Error("Not a file");
  let start = 0,
    end = stat.size - 1,
    status = 200;
  const headers = {
    "Content-Type":
      MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  if (download)
    headers["Content-Disposition"] =
      `attachment; filename="${path.basename(file)}"`;
  if (req.headers.range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if (!match) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      return res.end();
    }
    start = +match[1];
    end = match[2] ? Math.min(+match[2], end) : end;
    if (start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      return res.end();
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
  }
  headers["Content-Length"] = end - start + 1;
  res.writeHead(status, headers);
  if (req.method === "HEAD" || stat.size === 0) return res.end();
  const stream = fs.createReadStream(file, { start, end });
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}
async function handler(req, res) {
  try {
    if (
      ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)
    ) {
      return json(res, 403, { error: "Local access only" });
    }
    const origin = req.headers.origin;
    if (
      origin &&
      ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(origin)
    )
      return json(res, 403, { error: "Origin blocked" });
    const u = new URL(req.url, `http://127.0.0.1:${port}`),
      url = decodeURIComponent(u.pathname);
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-studio-token"] !== token
    )
      return json(res, 403, { error: "این صفحه را دوباره باز کنید." });
    if (url === "/api/config" && req.method === "GET")
      return json(res, 200, {
        token,
        defaultProject: M.makeDefault(),
        activeJob: activeJob?.id || null,
      });
    if (url === "/api/assets" && req.method === "GET")
      return json(res, 200, await assets());
    if (url === "/api/assets" && req.method === "POST") {
      const dest = await writeAsset(
        u.searchParams.get("name") || "",
        await body(req, 30 * 1024 * 1024),
      );
      return json(res, 200, { url: dest });
    }
    if (url === "/api/projects" && req.method === "GET") {
      const files = await fsp.readdir(path.join(ROOT, "projects"));
      const list = [];
      for (const name of files.filter((n) => n.endsWith(".json"))) {
        try {
          const p = JSON.parse(
            await fsp.readFile(path.join(ROOT, "projects", name), "utf8"),
          );
          list.push({
            id: p.id,
            name: p.name,
            updated: (await fsp.stat(path.join(ROOT, "projects", name)))
              .mtimeMs,
          });
        } catch {}
      }
      return json(
        res,
        200,
        list.sort((a, b) => b.updated - a.updated),
      );
    }
    if (url === "/api/projects" && req.method === "POST") {
      const p = M.validate(await payload(req));
      await checkAssets(p);
      await atomicWrite(
        path.join(ROOT, "projects", p.id + ".json"),
        JSON.stringify(p, null, 2),
      );
      return json(res, 200, { id: p.id });
    }
    if (/^\/api\/projects\/[a-zA-Z0-9_-]+$/.test(url) && req.method === "GET")
      return await serveFile(
        req,
        res,
        path.join(ROOT, "projects", url.split("/").pop() + ".json"),
      );
    if (url === "/api/import" && req.method === "POST")
      return json(
        res,
        200,
        await importPortable(await payload(req, 250 * 1024 * 1024)),
      );
    if (url === "/api/portable" && req.method === "POST") {
      const p = M.validate(await payload(req));
      await checkAssets(p);
      return json(res, 200, await embed(p));
    }
    if (url === "/api/html" && req.method === "POST") {
      const p = M.validate(await payload(req));
      await checkAssets(p);
      const bundle = await embed(p),
        q = bundle.project;
      for (const k of ["font", "bold"])
        q.theme[k] = bundle.assets[q.theme[k]] || "";
      for (const s of q.scenes)
        for (const k of ["image", "logo"]) s[k] = bundle.assets[s[k]] || "";
      const css = await fsp.readFile(path.join(PUBLIC, "renderer.css"), "utf8"),
        model = await fsp.readFile(path.join(PUBLIC, "model.js"), "utf8"),
        js = await fsp.readFile(path.join(PUBLIC, "renderer.js"), "utf8");
      const data = JSON.stringify(q).replace(/</g, "\\u003c");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(
        `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Product motion</title><style>${css}</style></head><body><main id="stage"></main><script>${model}</script><script>window.EXPORT_PROJECT=${data};</script><script>${js}</script></body></html>`,
      );
    }
    if (url === "/api/render" && req.method === "POST") {
      if (activeJob) return json(res, 409, { error: "یک رندر در حال اجراست." });
      const p = M.validate(await payload(req));
      await checkAssets(p);
      const id = crypto.randomUUID(),
        filename = `motion-${new Date().toISOString().replace(/[:.]/g, "-")}-${id.slice(0, 6)}.mp4`,
        j = {
          id,
          project: p,
          status: "queued",
          progress: 0,
          frames: 0,
          totalFrames: Math.round(M.duration(p) * p.fps),
          started: Date.now(),
          filename,
          temp: path.join(ROOT, "exports", id + ".partial.mp4"),
          cancelled: false,
        };
      jobs.set(id, j);
      while (jobs.size > 20) jobs.delete(jobs.keys().next().value);
      activeJob = j;
      json(res, 202, publicJob(j));
      void renderVideo(j);
      return;
    }
    const jobMatch = /^\/api\/(jobs|render-project)\/([a-z0-9-]+)$/.exec(url);
    if (jobMatch && req.method === "GET") {
      const j = jobs.get(jobMatch[2]);
      if (!j) return json(res, 404, { error: "رندر پیدا نشد." });
      return json(res, 200, jobMatch[1] === "jobs" ? publicJob(j) : j.project);
    }
    if (/^\/api\/cancel\/[a-z0-9-]+$/.test(url) && req.method === "POST") {
      const j = jobs.get(url.split("/").pop());
      if (
        j &&
        ["queued", "preparing", "rendering", "encoding"].includes(j.status)
      ) {
        j.cancelled = true;
        if (j.encoder) {
          j.encoder.stdin.destroy();
          j.encoder.kill("SIGKILL");
        }
        await j.browser?.close().catch(() => {});
      }
      return json(res, 200, { ok: true });
    }
    if (["GET", "HEAD"].includes(req.method)) {
      if (url.startsWith("/assets/"))
        return await serveFile(req, res, assetPath(url));
      if (
        url.startsWith("/exports/") &&
        /\.mp4$/.test(url) &&
        !url.endsWith(".partial.mp4")
      )
        return await serveFile(
          req,
          res,
          safePath(path.join(ROOT, "exports"), url.slice(9)),
          u.searchParams.get("download") === "1",
        );
      if (
        [
          "/",
          "/index.html",
          "/app.js",
          "/studio.css",
          "/model.js",
          "/renderer.js",
          "/renderer.css",
          "/player.html",
        ].includes(url)
      )
        return await serveFile(
          req,
          res,
          path.join(PUBLIC, url === "/" ? "index.html" : url.slice(1)),
        );
    }
    return json(res, 404, { error: "پیدا نشد." });
  } catch (e) {
    if (!res.headersSent)
      json(res, e.code === "ENOENT" ? 404 : 400, { error: e.message });
    else res.destroy();
  }
}
function openBrowser(url) {
  if (process.platform === "win32")
    spawn("explorer.exe", [url], { detached: true, stdio: "ignore" }).unref();
  else if (process.platform === "darwin")
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  else
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" })
      .on("error", () => {})
      .unref();
}
function start(attempt = 0) {
  port = Number(process.env.PORT || 4318) + attempt;
  server = http.createServer(handler);
  server.requestTimeout = 300000;
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE" && attempt < 20) start(attempt + 1);
    else {
      console.error(e.message);
      process.exitCode = 1;
    }
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(
      `\nMotion Studio\nhttp://127.0.0.1:${port}\nKeep this window open. Ctrl+C to stop.\n`,
    );
    if (!process.env.STUDIO_NO_OPEN) openBrowser(`http://127.0.0.1:${port}`);
  });
}
function shutdown() {
  if (activeJob) {
    activeJob.cancelled = true;
    activeJob.encoder?.stdin.destroy();
    activeJob.encoder?.kill("SIGKILL");
    void activeJob.browser?.close().catch(() => {});
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
start();

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const M = require("../public/model");

test("starter project needs no private assets and validation preserves its input", () => {
  const project = M.makeDefault();
  const before = M.clone(project);
  assert.deepEqual(M.validate(project), before);
  assert.equal(project.theme.font, "");
  assert.equal(project.theme.bold, "");
  assert.ok(project.scenes.every((s) => !s.image && !s.logo));
  assert.deepEqual(project, before);
});

test("validation rejects unsafe paths, invalid dimensions and excessive duration", () => {
  for (const image of [
    "/assets/../server.js",
    "/assets/a\\b.png",
    "https://example.com/a.png",
  ]) {
    const p = M.makeDefault();
    p.scenes[0].image = image;
    assert.throws(() => M.validate(p));
  }
  const p = M.makeDefault();
  p.width = 241;
  assert.throws(() => M.validate(p));
  p.width = 1080;
  p.scenes = Array.from({ length: 7 }, () => ({ ...M.scene(), duration: 30 }));
  assert.throws(() => M.validate(p));
});

test(
  "isolated server: access controls, persistence, missing files and HTML export",
  { timeout: 15000 },
  async (t) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "motion-studio-test-"),
    );
    for (const file of ["server.js", "public", "scripts"]) {
      await fs.cp(path.join(__dirname, "..", file), path.join(root, file), {
        recursive: true,
      });
    }
    const child = spawn(process.execPath, ["server.js"], {
      cwd: root,
      env: { ...process.env, PORT: "14318", STUDIO_NO_OPEN: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const closed = once(child, "close");
        child.kill();
        await closed;
      }
      await fs.rm(root, { recursive: true, force: true });
    });
    const base = await new Promise((resolve, reject) => {
      let output = "";
      child.on("error", reject);
      child.on("exit", (code) => reject(Error(`Server exited: ${code}`)));
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) resolve(match[0]);
      });
    });
    const config = await (await fetch(base + "/api/config")).json();
    const post = (route, data, headers = {}) =>
      fetch(base + route, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(data),
      });
    assert.equal(
      (await post("/api/projects", config.defaultProject)).status,
      403,
    );
    const headers = { "X-Studio-Token": config.token };
    assert.equal(
      (
        await post("/api/projects", config.defaultProject, {
          ...headers,
          Origin: "https://example.com",
        })
      ).status,
      403,
    );
    assert.equal(
      (await post("/api/projects", config.defaultProject, headers)).status,
      200,
    );
    assert.deepEqual(
      await (await fetch(base + "/api/projects/starter-demo")).json(),
      config.defaultProject,
    );
    assert.equal((await fetch(base + "/api/projects/missing")).status, 404);
    assert.equal((await fetch(base + "/api/config")).status, 200);
    config.defaultProject.scenes[0].title =
      "</script><script>alert(1)</script>";
    const html = await (
      await post("/api/html", config.defaultProject, headers)
    ).text();
    assert.ok(!html.includes(config.defaultProject.scenes[0].title));
    assert.ok(html.includes("\\u003c/script>"));
    await fs.writeFile(path.join(root, "exports", "empty.mp4"), "");
    const empty = await fetch(base + "/exports/empty.mp4");
    assert.equal(empty.status, 200);
    assert.equal((await empty.arrayBuffer()).byteLength, 0);
  },
);

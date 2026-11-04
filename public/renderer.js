(function () {
  "use strict";
  const M = window.StudioModel,
    clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)),
    smooth = (x) => {
      x = clamp(x);
      return x * x * (3 - 2 * x);
    },
    ease = (x, k) =>
      k === "linear"
        ? clamp(x)
        : k === "smooth"
          ? smooth(x)
          : 1 - Math.pow(1 - clamp(x), 3);
  const e = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  let project,
    stage,
    refs = [],
    total = 0,
    now = 0,
    playing = false,
    raf,
    last = 0,
    guide = false,
    loadId = 0;
  function textGroup(
    s,
    cls,
    {
      kicker = true,
      title = true,
      subtitle = true,
      rule = true,
      footer = false,
    } = {},
  ) {
    const g = e("div", cls);
    if (kicker && s.kicker) g.append(e("div", "kicker", s.kicker));
    if (title && s.title) g.append(e("h2", "title", s.title));
    if (rule && s.showRule) g.append(e("div", "rule"));
    if (subtitle && s.subtitle) g.append(e("p", "subtitle", s.subtitle));
    if (footer && s.footer) g.append(e("div", "footer", s.footer));
    return g;
  }
  function move(n, x = 0, y = 0, z = 1, r = 0) {
    n.style.transform = `translate3d(${x}px,${y}px,0) scale(${z}) rotate(${r}deg)`;
  }
  async function load(p) {
    pause();
    const lid = ++loadId;
    project = M.clone(p);
    total = M.duration(p);
    now = 0;
    refs = [];
    stage = document.querySelector("#stage");
    stage.replaceChildren();
    const ratio = p.height / p.width,
      logicalH = 1080 * ratio;
    stage.style.width = "1080px";
    stage.style.height = logicalH + "px";
    stage.className =
      ratio < 0.85 ? "landscape" : ratio < 1.45 ? "compact" : "";
    stage.style.setProperty("--bg", p.theme.bg);
    stage.style.setProperty("--accent", p.theme.accent);
    stage.style.setProperty("--text", p.theme.text);
    // Font URLs only come from validated local assets or embedded exports.
    for (const f of [...document.fonts])
      if (f.family === "MotionFont") document.fonts.delete(f);
    const fonts = [];
    for (const [weight, url] of [
      ["400", p.theme.font],
      ["700", p.theme.bold || p.theme.font],
    ])
      if (url) {
        const face = new FontFace("MotionFont", `url(${JSON.stringify(url)})`, {
          weight,
        });
        document.fonts.add(face);
        fonts.push(face.load());
      }
    const ambient = e("div", "ambient");
    ambient.style.opacity = p.theme.glow / 100;
    stage.append(ambient, e("div", "beam"));
    if (p.theme.orbit) stage.append(e("div", "orbit"));
    const canvas = e("canvas", "dust");
    canvas.width = 1080;
    canvas.height = Math.ceil(logicalH);
    stage.append(canvas);
    let seed = 52;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const particles = Array.from(
      { length: Math.round(p.theme.particles) },
      () => ({
        x: rand() * 1080,
        y: rand() * logicalH,
        r: 0.5 + rand() * 1.5,
        v: 4 + rand() * 10,
        a: rand() * 6.28,
      }),
    );
    let start = 0;
    for (const s of p.scenes) {
      const n = e(
        "section",
        "scene " + (s.layout === "specs" ? "specs-layout" : s.layout),
      );
      n.style.setProperty("--ts", s.textScale);
      n.style.setProperty("--align", s.textAlign);
      if (s.watermark && ["hero", "spotlight"].includes(s.layout))
        n.append(e("div", "watermark", s.watermark));
      n.append(e("div", "floor"));
      const photo = e("div", "photo-wrap");
      if (s.image) {
        const img = e("img", "product");
        img.src = s.image;
        img.alt = "";
        img.draggable = false;
        img.style.objectFit = s.fit;
        photo.append(img);
      } else photo.append(e("div", "no-image", "عکس محصول"));
      n.append(photo);
      const groups = [];
      if (s.layout === "intro") {
        groups.push(textGroup(s, "intro-copy"));
      } else if (s.layout === "outro") {
        groups.push(
          textGroup(s, "scene-head", {
            title: false,
            subtitle: false,
            rule: false,
          }),
        );
        if (s.logo) {
          const logo = e("img", "brand-logo");
          logo.src = s.logo;
          logo.alt = "";
          n.append(logo);
          groups.push(logo);
        }
        groups.push(textGroup(s, "contact", { kicker: false, footer: true }));
      } else {
        groups.push(
          textGroup(s, "scene-head", {
            title: s.layout !== "spotlight",
            subtitle: false,
          }),
        );
        if (s.layout === "specs") {
          const specs = e("div", "specs");
          for (let i = 1; i <= 2; i++) {
            if (i === 2) specs.append(e("div", "spec-sep"));
            const spec = e("div", "spec");
            spec.append(
              e("div", "spec-value", s["value" + i]),
              e("div", "spec-label", s["label" + i]),
            );
            specs.append(spec);
          }
          groups.push(specs);
        } else
          groups.push(
            textGroup(s, "scene-bottom", {
              kicker: false,
              title: s.layout === "spotlight",
              rule: s.layout === "spotlight",
              subtitle: true,
              footer: s.layout === "origin",
            }),
          );
      }
      n.append(...groups);
      let scan;
      if (s.layout === "origin") {
        scan = e("div", "scan");
        n.append(scan);
      }
      stage.append(n);
      refs.push({ n, photo, groups, scan, s, start, end: start + s.duration });
      start += s.duration;
    }
    const v = e("div", "vignette");
    v.style.opacity = p.theme.vignette / 100;
    stage.append(v);
    if (p.theme.grain) stage.append(e("div", "grain"));
    stage.append(e("div", "end-shade"));
    const g = e("div", "safe-guide");
    g.hidden = !guide;
    stage.append(g);
    window.motion._ctx = { ambient, canvas, particles, logicalH };
    fit();
    await Promise.all([
      ...fonts,
      ...[...stage.querySelectorAll("img")].map((im) => im.decode()),
    ]);
    if (lid !== loadId) return;
    render(0);
    return true;
  }
  function fit() {
    if (stage)
      stage.style.transform = `scale(${Math.min(innerWidth / 1080, innerHeight / parseFloat(stage.style.height))})`;
  }
  function render(t) {
    if (!project) return;
    now = clamp(t, 0, total);
    const ctxdata = window.motion._ctx;
    const { ambient, canvas, particles, logicalH } = ctxdata;
    move(ambient, Math.sin(now * 0.22) * 60, Math.cos(now * 0.19) * 30, 1.04);
    const beam = stage.querySelector(".beam");
    move(beam, Math.sin(now * 0.18) * 300);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 1080, logicalH);
    ctx.fillStyle = project.theme.accent;
    for (const a of particles) {
      ctx.globalAlpha = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(now * 0.65 + a.a));
      ctx.beginPath();
      ctx.arc(
        a.x + Math.sin(now * 0.25 + a.a) * 17,
        ((((a.y - now * a.v) % (logicalH + 100)) + logicalH + 100) %
          (logicalH + 100)) -
          50,
        a.r,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < refs.length; i++) {
      const r = refs[i],
        s = r.s;
      const trans =
        s.transition === "cut" ? 0 : Math.min(s.transitionTime, s.duration / 2);
      const local = now - r.start;
      let alpha = 1,
        sceneX = 0;
      if (local < 0 || now >= r.end + (refs[i + 1]?.s.transitionTime || 0))
        alpha = 0;
      if (local >= 0 && local < trans) {
        const a = smooth(local / trans);
        alpha = s.transition === "black" ? smooth((a - 0.5) * 2) : a;
        if (s.transition === "slide") sceneX = 1080 * (1 - a);
      }
      if (now >= r.end) {
        const next = refs[i + 1]?.s;
        if (!next) alpha = now <= total ? 1 : 0;
        else {
          const nt = next.transition === "cut" ? 0 : next.transitionTime;
          const out = nt ? smooth((now - r.end) / nt) : 1;
          alpha = next.transition === "black" ? 1 - smooth(out * 2) : 1 - out;
          if (next.transition === "slide") sceneX = -1080 * out;
        }
      }
      r.n.style.visibility = alpha > 0.0001 ? "visible" : "hidden";
      r.n.style.opacity = alpha;
      r.n.style.transform = `translateX(${sceneX}px)`;
      if (alpha <= 0.0001) continue;
      const q = Math.max(0, local),
        p = ease(q / (s.duration / s.speed), s.easing),
        a = s.strength;
      let x = 0,
        y = 0,
        z = 1,
        rot = 0;
      switch (s.motion) {
        case "cinematic":
          x = -120 * (1 - p) * a;
          y = -25 * (1 - p) * a;
          z = 1 + 1.5 * (1 - p) * a;
          rot = -7 * (1 - p) * a;
          break;
        case "dolly":
          z = 1 + (p - 0.5) * 0.12 * a;
          break;
        case "rise":
          y = 100 * (1 - ease(q / (1.3 / s.speed), s.easing)) * a;
          z = 1 - 0.1 * (1 - p) * a;
          break;
        case "left":
          x = -130 * (1 - p) * a;
          break;
        case "right":
          x = 130 * (1 - p) * a;
          break;
        case "float":
          y = Math.sin(q * 1.2 * s.speed) * 18 * a;
          rot = Math.sin(q * 0.65 * s.speed) * 1.6 * a;
          break;
      }
      move(
        r.photo,
        x + s.imageX,
        y + s.imageY,
        z * s.imageScale,
        rot + s.rotation,
      );
      r.photo.style.opacity = s.imageOpacity;
      r.groups.forEach((g, j) => {
        const reveal = ease(
          (q - s.textDelay - j * 0.12) / (0.7 / s.speed),
          s.easing,
        );
        g.style.opacity = reveal;
        move(g, 0, 30 * (1 - reveal));
      });
      if (r.scan) {
        const sp = clamp((q - 0.5) / 2.3);
        r.scan.style.opacity = Math.sin(sp * Math.PI) * 0.7;
        move(r.scan, sp * 1600);
      }
    }
    stage.querySelector(".end-shade").style.opacity = project.theme.fadeEnd
      ? smooth((now - (total - 0.35)) / 0.35)
      : 0;
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
  }
  function tick(ts) {
    if (!playing) return;
    now += (ts - last) / 1000;
    last = ts;
    if (now >= total) now = 0;
    render(now);
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (!project) return;
    pause();
    playing = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  window.motion = {
    load,
    seek(t) {
      pause();
      render(t);
    },
    play,
    pause,
    get time() {
      return now;
    },
    get duration() {
      return total;
    },
    get playing() {
      return playing;
    },
    safe(v) {
      guide = !!v;
      const el = stage?.querySelector(".safe-guide");
      if (el) el.hidden = !guide;
    },
    ready: Promise.resolve(),
  };
  addEventListener("resize", fit);
  if (window.EXPORT_PROJECT) {
    window.motion.ready = load(window.EXPORT_PROJECT).then(play);
  } else {
    const job = new URLSearchParams(location.search).get("job");
    if (job)
      window.motion.ready = fetch(
        "/api/render-project/" + encodeURIComponent(job),
      )
        .then((r) => {
          if (!r.ok) throw Error("Render project unavailable");
          return r.json();
        })
        .then(load);
  }
})();

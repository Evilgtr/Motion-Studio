"use strict";
const M = StudioModel,
  $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  fa = (n) => Number(n).toLocaleString("fa-IR"),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let project,
  token,
  assetList = [],
  selected = 0,
  tab = "scene",
  currentTime = 0.8,
  history = [],
  future = [],
  saveTimer,
  previewTimer,
  toastTimer,
  assetTarget,
  renderJob = null,
  previewRunning = false,
  previewPending = false,
  saveChain = Promise.resolve(),
  revision = 0;
const player = () => $("#preview").contentWindow.motion;
async function api(url, { method = "GET", data, raw } = {}) {
  const headers = {};
  if (method !== "GET") headers["X-Studio-Token"] = token;
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(url, {
    method,
    headers,
    body: raw || (data === undefined ? undefined : JSON.stringify(data)),
  });
  if (!r.ok) {
    let e;
    try {
      e = await r.json();
    } catch {}
    throw Error(
      e?.error || "ارتباط با برنامه قطع شد؛ پنجرهٔ اجرا را بررسی کنید.",
    );
  }
  return r;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function snapshot() {
  history.push(M.clone(project));
  if (history.length > 35) history.shift();
  future = [];
  updateHistory();
}
function updateHistory() {
  $("#undo").disabled = !history.length;
  $("#redo").disabled = !future.length;
}
function changed() {
  revision++;
  $("#save-state").textContent = "در حال ذخیره…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save().catch((err) => toast(err.message)), 900);
  schedulePreview();
  renderScenes();
}
function save() {
  clearTimeout(saveTimer);
  const data = M.clone(project),
    rev = revision;
  saveChain = saveChain
    .catch(() => {})
    .then(async () => {
      try {
        M.validate(data);
        await api("/api/projects", { method: "POST", data });
        if (rev === revision)
          $("#save-state").textContent = "ذخیره شد · روی همین سیستم";
        localStorage.setItem("motion-studio-last-project", data.id);
      } catch (err) {
        if (rev === revision)
          $("#save-state").textContent = "ذخیره نشد؛ تنظیمات را بررسی کن";
        throw err;
      }
    });
  return saveChain;
}
function setProject(p) {
  project = M.validate(p);
  selected = 0;
  history = [];
  future = [];
  currentTime = 0.8;
  revision++;
  $("#project-name").value = project.name;
  renderScenes();
  renderInspector();
  updateHistory();
  schedulePreview();
  save().catch((e) => toast(e.message));
}
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    previewTimer = null;
    refreshPreview();
  }, 170);
}
async function refreshPreview() {
  if (!player() || !project) return;
  if (previewRunning) {
    previewPending = true;
    return;
  }
  previewRunning = true;
  const wasPlaying = player().playing,
    targetTime = currentTime;
  try {
    const p = M.validate(project);
    await player().load(p);
    player().seek(Math.min(targetTime, M.duration(p) - 0.01));
    player().safe($("#safe-area").checked);
    if (wasPlaying) player().play();
    resizePreview();
  } catch (err) {
    toast("پیش‌نمایش: " + err.message);
  } finally {
    previewRunning = false;
    if (previewPending) {
      previewPending = false;
      schedulePreview();
    }
  }
}
function resizePreview() {
  if (!project) return;
  const box = $("#preview-area"),
    w = box.clientWidth - 40,
    h = box.clientHeight - 38,
    ratio = project.width / project.height;
  let width = Math.min(w, h * ratio),
    height = width / ratio;
  $("#preview-shell").style.width = Math.max(1, width) + "px";
  $("#preview-shell").style.height = Math.max(1, height) + "px";
  $("#dimensions").textContent =
    `${project.width} × ${project.height} · ${project.fps} FPS`;
}
new ResizeObserver(resizePreview).observe($("#preview-area"));
function renderScenes() {
  if (!project) return;
  $("#scene-list").innerHTML = project.scenes
    .map(
      (s, i) =>
        `<button class="scene-card ${i === selected ? "active" : ""}" data-scene="${i}"><div class="scene-thumb" style="background:${project.theme.bg}">${s.image ? `<img src="${esc(s.image)}" alt="">` : ""}<span>${fa(i + 1)}</span></div><div><b>${esc(s.title || M.layouts[s.layout])}</b><small>${M.layouts[s.layout]} · ${fa(s.duration)} ثانیه</small></div></button>`,
    )
    .join("");
  $("#scene-count").textContent = fa(project.scenes.length);
  $("#timeline").innerHTML = project.scenes
    .map(
      (s, i) =>
        `<button data-scene="${i}" class="${i === selected ? "active" : ""}" style="flex:${s.duration}" title="${esc(s.title)}">${fa(i + 1)} · ${fa(s.duration)}s</button>`,
    )
    .join("");
  $("#scrub").max = M.duration(project);
}
function selectScene(i) {
  selected = i;
  currentTime =
    project.scenes.slice(0, i).reduce((a, s) => a + s.duration, 0) +
    Math.min(0.9, project.scenes[i].duration * 0.7);
  player()?.seek(currentTime);
  renderScenes();
  renderInspector();
}
function opts(map, val) {
  return Object.entries(map)
    .map(
      ([v, l]) =>
        `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`,
    )
    .join("");
}
function field(
  label,
  key,
  { scope = "scene", type = "text", min, max, step, options } = {},
) {
  const o =
      scope === "scene"
        ? project.scenes[selected]
        : scope === "theme"
          ? project.theme
          : project,
    v = o[key],
    attrs = `data-scope="${scope}" data-key="${key}"`,
    bounds = `${min !== undefined ? ` min="${min}"` : ""}${max !== undefined ? ` max="${max}"` : ""}${step !== undefined ? ` step="${step}"` : ""}`;
  if (type === "checkbox")
    return `<label class="field check"><input type="checkbox" ${attrs} ${v ? "checked" : ""}><span>${label}</span></label>`;
  return `<label class="field"><span>${label}${type === "range" ? `<output>${v}</output>` : ""}</span>${options ? `<select ${attrs}>${opts(options, v)}</select>` : type === "textarea" ? `<textarea ${attrs} maxlength="500">${esc(v)}</textarea>` : `<input type="${type}" ${attrs} value="${esc(v)}" ${bounds} ${type === "text" ? 'maxlength="500"' : ""}>`}</label>`;
}
function imagePicker(key, label) {
  const s = project.scenes[selected];
  return `<div class="asset-picker"><div class="asset-heading">${label}</div>${s[key] ? `<div class="asset-preview"><img src="${esc(s[key])}" alt="${label}"></div>` : ""}${field("انتخاب از فایل‌ها", key, { options: { "": "بدون تصویر", ...Object.fromEntries(assetList.filter((a) => a.type === "image").map((a) => [a.url, a.name])) } })}<div class="asset-buttons"><button data-upload="${key}">＋ آپلود عکس</button>${key === "image" ? '<button data-action="image-all" title="عکس محصول همهٔ صحنه‌ها عوض می‌شود">برای همه</button>' : ""}</div></div>`;
}
function renderInspector() {
  if (!project) return;
  const s = project.scenes[selected];
  $$("[data-tab]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab),
  );
  let h = "";
  if (tab === "scene") {
    h = `<div class="section-title"><b>صحنهٔ ${fa(selected + 1)}</b><small>${M.layouts[s.layout]}</small></div><div class="form-section">${field("چیدمان", "layout", { options: M.layouts })}<div class="grid2">${field("مدت (ثانیه)", "duration", { type: "number", min: 1, max: 30, step: 0.1 })}${field("جهت متن", "textAlign", { options: { center: "وسط", right: "راست", left: "چپ" } })}</div><div class="minor-actions"><button data-action="up" ${selected === 0 ? "disabled" : ""}>↑ جلوتر</button><button data-action="down" ${selected === project.scenes.length - 1 ? "disabled" : ""}>↓ عقب‌تر</button><button data-action="duplicate">تکثیر</button><button data-action="delete" class="danger" ${project.scenes.length === 1 ? "disabled" : ""}>حذف</button></div></div><div class="form-section"><h3 class="section-title">متن‌ها</h3>${field("برچسب بالای صحنه", "kicker")}${field(s.layout === "outro" ? "متن دعوت به اقدام" : "عنوان اصلی", "title", { type: "textarea" })}${field("توضیح کوتاه", "subtitle", { type: "textarea" })}${["hero", "spotlight"].includes(s.layout) ? field("نوشتهٔ بزرگ پس‌زمینه", "watermark") : ""}${s.layout === "specs" ? `<div class="grid2">${field("عدد اول", "value1")}${field("عدد دوم", "value2")}</div>${field("شرح عدد اول", "label1")}${field("شرح عدد دوم", "label2")}` : ""}${["origin", "outro"].includes(s.layout) ? field(s.layout === "origin" ? "نام سازنده" : "آدرس یا اطلاعات تماس", "footer") : ""}${field("اندازهٔ نوشته‌ها", "textScale", { type: "range", min: 0.5, max: 1.5, step: 0.05 })}${field("خط تزئینی", "showRule", { type: "checkbox" })}</div>${imagePicker("image", "تصویر محصول")}${s.layout === "outro" ? imagePicker("logo", "لوگو") : ""}<details><summary>تنظیم تصویر و جای‌گذاری</summary>${field("اندازهٔ تصویر", "imageScale", { type: "range", min: 0.3, max: 1.8, step: 0.05 })}${field("جابجایی افقی", "imageX", { type: "range", min: -300, max: 300, step: 5 })}${field("جابجایی عمودی", "imageY", { type: "range", min: -300, max: 300, step: 5 })}${field("چرخش (درجه)", "rotation", { type: "range", min: -30, max: 30, step: 1 })}${field("شفافیت", "imageOpacity", { type: "range", min: 0, max: 1, step: 0.05 })}${field("نمایش عکس", "fit", { options: { contain: "کامل، بدون برش", cover: "پرکردن قاب با برش" } })}<p class="hint">جابجایی بر مبنای عرض طراحی ۱۰۸۰ است و با خروجی مقیاس می‌شود.</p><button data-action="reset-image">بازنشانی تصویر</button></details><div class="form-section"><h3 class="section-title">حرکت و زمان‌بندی</h3>${field("مدل حرکت", "motion", { options: M.motions })}${field("شدت حرکت", "strength", { type: "range", min: 0, max: 2, step: 0.1 })}${field("سرعت حرکت", "speed", { type: "range", min: 0.25, max: 3, step: 0.25 })}${field("نرمی حرکت", "easing", { options: M.easings })}${field("تأخیر ورود متن (ثانیه)", "textDelay", { type: "range", min: 0, max: 2, step: 0.1 })}${field("ورود به این صحنه", "transition", { options: M.transitions })}${field("مدت ترنزیشن (ثانیه)", "transitionTime", { type: "range", min: 0, max: 1, step: 0.05 })}<button data-action="motion-all">اعمال حرکت به همهٔ صحنه‌ها</button></div><button data-action="refresh-assets" class="text-button">بازخوانی فایل‌های پوشهٔ assets ↻</button>`;
  } else if (tab === "theme") {
    const fonts = {
      "": "فونت سیستم",
      ...Object.fromEntries(
        assetList.filter((a) => a.type === "font").map((a) => [a.url, a.name]),
      ),
    };
    h = `<h3 class="section-title">هویت بصری</h3><div class="form-section"><div class="swatches">${Object.entries(
      M.palettes,
    )
      .map(
        ([k, v]) =>
          `<button class="swatch" data-palette="${k}" style="background:${v.bg};--swatch:${v.accent}" title="${v.label}" aria-label="${v.label}"></button>`,
      )
      .join(
        "",
      )}</div><div class="grid2">${field("پس‌زمینه", "bg", { scope: "theme", type: "color" })}${field("رنگ تأکیدی", "accent", { scope: "theme", type: "color" })}</div>${field("رنگ نوشته", "text", { scope: "theme", type: "color" })}</div><div class="form-section"><h3 class="section-title">فونت پروژه</h3>${field("فونت معمولی", "font", { scope: "theme", options: fonts })}${field("فونت ضخیم", "bold", { scope: "theme", options: fonts })}<button data-upload="font">＋ آپلود فونت</button><p class="hint">WOFF، WOFF2، TTF و OTF پذیرفته می‌شوند. فونت دلخواه را می‌توانی در assets/fonts هم کپی کنی.</p></div><div class="form-section"><h3 class="section-title">فضا و نور</h3>${field("شدت نور پس‌زمینه", "glow", { scope: "theme", type: "range", min: 0, max: 100, step: 5 })}${field("تیرگی حاشیه‌ها", "vignette", { scope: "theme", type: "range", min: 0, max: 100, step: 5 })}${field("تعداد ذرات", "particles", { scope: "theme", type: "range", min: 0, max: 100, step: 5 })}${field("حلقهٔ پس‌زمینه", "orbit", { scope: "theme", type: "checkbox" })}${field("بافت دانه‌دار", "grain", { scope: "theme", type: "checkbox" })}${field("محو شدن در پایان ویدیو", "fadeEnd", { scope: "theme", type: "checkbox" })}</div><button data-action="refresh-assets" class="text-button">بازخوانی فایل‌های پوشهٔ assets ↻</button>`;
  } else {
    h = `<h3 class="section-title">اندازه و کیفیت</h3><div class="form-section"><label class="field"><span>اندازه‌های آماده</span><select id="size-preset">${opts({ "": "انتخاب اندازه…", "1080x1920": "استوری و ریلز · 1080 × 1920", "1080x1080": "مربع · 1080 × 1080", "1080x1350": "پست عمودی · 1080 × 1350", "1920x1080": "افقی · 1920 × 1080", "720x1280": "عمودی سبک · 720 × 1280", "2160x3840": "عمودی 4K · 2160 × 3840" }, project.width + "x" + project.height)}</select></label><div class="grid2">${field("عرض (پیکسل)", "width", { scope: "project", type: "number", min: 240, max: 3840, step: 2 })}${field("ارتفاع (پیکسل)", "height", { scope: "project", type: "number", min: 240, max: 3840, step: 2 })}</div><p class="hint">هر بُعد: ۲۴۰ تا ۳۸۴۰ پیکسل؛ عدد زوج. برای نسبت‌های خیلی کشیده، پیش‌نمایش را بررسی کن.</p>${field("نرخ فریم", "fps", { scope: "project", options: { 24: "24 FPS", 25: "25 FPS", 30: "30 FPS", 50: "50 FPS", 60: "60 FPS" } })}${field("کیفیت MP4", "quality", { scope: "project", options: { standard: "استاندارد · حجم کمتر", high: "بالا · پیشنهادی", ultra: "بسیار بالا · حجم بیشتر" } })}<p class="hint">زمان کل: ${fa(M.duration(project).toFixed(1))} ثانیه · خروجی H.264 بدون صدا<br>4K و 60fps زمان رندر بیشتری نیاز دارند.</p></div><div class="form-section"><h3 class="section-title">دریافت خروجی</h3><button id="inspector-render" class="primary">خروجی MP4 ↗</button><p class="hint">پیش‌نمایش و رندر از یک موتور حرکت استفاده می‌کنند.</p><button id="export-html">دریافت HTML مستقل</button><p class="hint">HTML همراه عکس و فونت، بدون دکمه یا کنترل روی موشن.</p></div>`;
  }
  $("#inspector-content").innerHTML = h;
}
let lastEditKey = "",
  lastEditTime = 0;
$("#inspector-content").addEventListener("input", (e) => {
  const el = e.target;
  if (!el.dataset.key) return;
  const scope = el.dataset.scope,
    key = el.dataset.key,
    obj =
      scope === "scene"
        ? project.scenes[selected]
        : scope === "theme"
          ? project.theme
          : project;
  let val = el.type === "checkbox" ? el.checked : el.value;
  if (["number", "range"].includes(el.type) || key === "fps") {
    if (el.value === "" || !el.validity.valid) return;
    val = Number(val);
  }
  const editKey = scope + selected + key;
  if (editKey !== lastEditKey || Date.now() - lastEditTime > 800) snapshot();
  lastEditKey = editKey;
  lastEditTime = Date.now();
  obj[key] = val;
  const out = el.closest(".field")?.querySelector("output");
  if (out) out.textContent = val;
  changed();
  if (key === "layout") renderInspector();
});
$("#inspector-content").addEventListener("change", (e) => {
  if (e.target.id === "size-preset" && e.target.value) {
    snapshot();
    const [w, h] = e.target.value.split("x").map(Number);
    project.width = w;
    project.height = h;
    changed();
    renderInspector();
  }
});
$("#inspector-content").addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    const s = project.scenes[selected];
    if (b.dataset.upload) {
      assetTarget = { key: b.dataset.upload, sceneId: s.id };
      $("#asset-file").accept =
        b.dataset.upload === "font"
          ? ".woff,.woff2,.ttf,.otf"
          : ".png,.jpg,.jpeg,.webp,.avif";
      $("#asset-file").click();
      return;
    }
    if (b.dataset.palette) {
      snapshot();
      const c = M.palettes[b.dataset.palette];
      Object.assign(project.theme, {
        bg: c.bg,
        accent: c.accent,
        text: c.text,
      });
      changed();
      renderInspector();
      return;
    }
    const action = b.dataset.action;
    if (action === "refresh-assets") {
      assetList = await (await api("/api/assets")).json();
      renderInspector();
      toast("فهرست فایل‌ها به‌روز شد.");
      return;
    }
    if (b.id === "inspector-render") {
      showExport();
      return;
    }
    if (b.id === "export-html") {
      await downloadHTML();
      return;
    }
    if (!action) return;
    if (action === "delete" && !confirm("این صحنه حذف شود؟")) return;
    snapshot();
    if (action === "up" || action === "down") {
      const n = selected + (action === "up" ? -1 : 1);
      [project.scenes[selected], project.scenes[n]] = [
        project.scenes[n],
        project.scenes[selected],
      ];
      selected = n;
    } else if (action === "duplicate") {
      if (project.scenes.length >= 30) throw Error("حداکثر ۳۰ صحنه");
      const copy = M.clone(s);
      copy.id = crypto.randomUUID();
      project.scenes.splice(selected + 1, 0, copy);
      selected++;
    } else if (action === "delete") {
      project.scenes.splice(selected, 1);
      selected = Math.min(selected, project.scenes.length - 1);
    } else if (action === "reset-image") {
      Object.assign(s, {
        imageScale: 1,
        imageX: 0,
        imageY: 0,
        rotation: 0,
        imageOpacity: 1,
        fit: "contain",
      });
    } else if (action === "image-all")
      project.scenes.forEach((x) => (x.image = s.image));
    else if (action === "motion-all")
      project.scenes.forEach((x) => {
        for (const k of [
          "motion",
          "strength",
          "easing",
          "speed",
          "transition",
          "transitionTime",
          "textDelay",
        ])
          x[k] = s[k];
      });
    changed();
    selectScene(selected);
  } catch (err) {
    toast(err.message);
  }
});
$("#asset-file").addEventListener("change", async () => {
  const file = $("#asset-file").files[0];
  if (!file) return;
  try {
    if (file.size > 30 * 1024 * 1024)
      throw Error("حداکثر حجم فایل ۳۰ مگابایت است.");
    toast("در حال افزودن فایل…");
    const target = assetTarget,
      data = await (
        await api("/api/assets?name=" + encodeURIComponent(file.name), {
          method: "POST",
          raw: file,
        })
      ).json();
    assetList = await (await api("/api/assets")).json();
    snapshot();
    if (target.key === "font")
      project.theme.font = project.theme.bold = data.url;
    else {
      const scene = project.scenes.find((s) => s.id === target.sceneId);
      if (scene) scene[target.key] = data.url;
    }
    changed();
    renderInspector();
    toast("فایل اضافه شد.");
  } catch (err) {
    toast(err.message);
  }
  $("#asset-file").value = "";
});
$$("[data-tab]").forEach(
  (b) =>
    (b.onclick = () => {
      tab = b.dataset.tab;
      renderInspector();
    }),
);
for (const container of ["#scene-list", "#timeline"])
  $(container).onclick = (e) => {
    const b = e.target.closest("[data-scene]");
    if (b) selectScene(+b.dataset.scene);
  };
$("#add-scene").onclick = () => {
  if (project.scenes.length >= 30) return toast("حداکثر ۳۰ صحنه");
  snapshot();
  const s = M.scene("hero");
  s.image = project.scenes[selected].image;
  project.scenes.splice(selected + 1, 0, s);
  selected++;
  changed();
  selectScene(selected);
};
$("#project-name").onchange = () => {
  snapshot();
  project.name = $("#project-name").value || "پروژهٔ جدید";
  changed();
};
$("#play").onclick = () => {
  if (player()?.playing) player().pause();
  else player()?.play();
};
$("#restart").onclick = () => {
  currentTime = 0;
  player()?.seek(0);
};
$("#scrub").oninput = () => {
  currentTime = +$("#scrub").value;
  player()?.seek(currentTime);
};
$("#safe-area").onchange = () => player()?.safe($("#safe-area").checked);
$("#fullscreen").onclick = () => $("#preview-shell").requestFullscreen?.();
$("#undo").onclick = () => {
  if (!history.length) return;
  future.push(M.clone(project));
  project = history.pop();
  selected = Math.min(selected, project.scenes.length - 1);
  $("#project-name").value = project.name;
  changed();
  renderInspector();
  updateHistory();
};
$("#redo").onclick = () => {
  if (!future.length) return;
  history.push(M.clone(project));
  project = future.pop();
  selected = Math.min(selected, project.scenes.length - 1);
  $("#project-name").value = project.name;
  changed();
  renderInspector();
  updateHistory();
};
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$("#backup-project").onclick = async () => {
  try {
    await save();
    const r = await api("/api/portable", { method: "POST", data: project });
    download(await r.blob(), project.id + ".motion.json");
    toast("پشتیبان همراه عکس و فونت آماده شد.");
  } catch (e) {
    toast(e.message);
  }
};
async function downloadHTML() {
  try {
    M.validate(project);
    toast("آماده‌سازی HTML…");
    const r = await api("/api/html", { method: "POST", data: project });
    download(await r.blob(), project.id + ".html");
    toast("HTML مستقل آماده شد.");
  } catch (e) {
    toast(e.message);
  }
}
$("#new-project").onclick = async () => {
  try {
    await save();
    const p = M.clone(project);
    p.id = crypto.randomUUID();
    p.name = project.name + " — نسخهٔ جدید";
    setProject(p);
    toast("نسخهٔ مستقل ساخته شد.");
  } catch (e) {
    toast(e.message);
  }
};
$("#open-projects").onclick = async () => {
  try {
    await save();
    const ps = await (await api("/api/projects")).json();
    $("#projects-list").innerHTML =
      ps
        .map(
          (p) =>
            `<div class="project-row"><div><b>${esc(p.name)}</b><small>${new Date(p.updated).toLocaleString("fa-IR")}</small></div><button data-open="${esc(p.id)}">بازکردن</button></div>`,
        )
        .join("") || '<p class="muted">هنوز پروژه‌ای ذخیره نشده.</p>';
    $("#projects-dialog").showModal();
  } catch (e) {
    toast(e.message);
  }
};
$("#projects-list").onclick = async (e) => {
  const b = e.target.closest("[data-open]");
  if (!b) return;
  try {
    setProject(await (await api("/api/projects/" + b.dataset.open)).json());
    $("#projects-dialog").close();
  } catch (e) {
    toast(e.message);
  }
};
$("#reset-demo").onclick = () => {
  const p = M.makeDefault();
  p.id = crypto.randomUUID();
  setProject(p);
  $("#projects-dialog").close();
};
$("#load-backup").onclick = () => $("#backup-file").click();
$("#backup-file").onchange = async () => {
  const f = $("#backup-file").files[0];
  if (!f) return;
  try {
    const p = await (
      await api("/api/import", {
        method: "POST",
        data: JSON.parse(await f.text()),
      })
    ).json();
    setProject(p);
    assetList = await (await api("/api/assets")).json();
    renderInspector();
    $("#projects-dialog").close();
    toast("پروژه وارد شد.");
  } catch (e) {
    toast(e.message);
  }
  $("#backup-file").value = "";
};
$$("[data-close]").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
$("#help-button").onclick = () => $("#help-dialog").showModal();
function showExport() {
  try {
    M.validate(project);
  } catch (e) {
    return toast(e.message);
  }
  $("#export-summary").innerHTML =
    `<strong>${esc(project.name)}</strong><br><span dir="ltr">${project.width} × ${project.height} · ${project.fps} FPS · ${M.duration(project).toFixed(1)}s</span><br><span class="muted">${fa(project.scenes.length)} صحنه · بدون صدا · MP4 / H.264</span>`;
  $("#start-render").hidden = !!renderJob;
  $("#render-dialog").showModal();
}
$("#render-button").onclick = showExport;
$("#start-render").onclick = async () => {
  try {
    await save();
    $("#start-render").disabled = true;
    $("#render-error").hidden = true;
    $("#render-result").hidden = true;
    $("#render-progress").hidden = false;
    $("#progress-bar").style.width = "0%";
    $("#progress-label").textContent = "آماده‌سازی…";
    const j = await (
      await api("/api/render", { method: "POST", data: project })
    ).json();
    renderJob = j.id;
    $("#start-render").hidden = true;
    $("#cancel-render").hidden = false;
    pollJob();
  } catch (e) {
    $("#render-error").textContent = e.message;
    $("#render-error").hidden = false;
  } finally {
    $("#start-render").disabled = false;
  }
};
async function pollJob() {
  if (!renderJob) return;
  try {
    const j = await (await api("/api/jobs/" + renderJob)).json();
    $("#progress-bar").style.width = j.progress + "%";
    $("#progress-value").textContent = fa(j.progress) + "٪";
    $("#progress-label").textContent = {
      queued: "در صف",
      preparing: "آماده‌سازی موتور رندر…",
      rendering: "در حال ساخت فریم‌ها…",
      encoding: "نهایی‌سازی MP4…",
      done: "ویدیو آماده است",
      cancelled: "رندر لغو شد",
      error: "رندر انجام نشد",
    }[j.status];
    $("#progress-detail").textContent =
      `${fa(j.frames)} از ${fa(j.totalFrames)} فریم · گذشته: ${fa(j.elapsed)} ثانیه${j.eta && j.frames > 8 ? " · باقی‌ماندهٔ تقریبی: " + fa(j.eta) + " ثانیه" : ""}`;
    if (["done", "error", "cancelled"].includes(j.status)) {
      renderJob = null;
      $("#cancel-render").hidden = true;
      $("#start-render").hidden = false;
      if (j.status === "done") {
        $("#render-result").hidden = false;
        $("#result-video").src = j.url;
        $("#download-video").href = j.url + "?download=1";
        $("#download-video").download = j.filename;
        toast("خروجی MP4 آماده شد.");
      } else {
        $("#render-error").hidden = false;
        $("#render-error").textContent =
          j.error +
          (j.status === "error"
            ? "\nاگر ابزار رندر نصب نیست، Setup-Windows.cmd یا Check-System.cmd را اجرا کن."
            : "");
      }
      return;
    }
    setTimeout(pollJob, 800);
  } catch (e) {
    $("#progress-detail").textContent = "ارتباط قطع شد؛ در حال تلاش دوباره…";
    setTimeout(pollJob, 3000);
  }
}
$("#cancel-render").onclick = async () => {
  if (!renderJob) return;
  try {
    await api("/api/cancel/" + renderJob, { method: "POST" });
  } catch (e) {
    toast(e.message);
  }
};
function tick() {
  const p = player();
  if (p && project && p.duration > 0 && !previewRunning && !previewTimer) {
    currentTime = p.time;
    $("#scrub").value = currentTime;
    const fmt = (t) =>
      String(Math.floor(t / 60)).padStart(2, "0") +
      ":" +
      String(Math.floor(t % 60)).padStart(2, "0");
    $("#clock").textContent =
      fmt(currentTime) + " / " + fmt(M.duration(project));
    $("#play").textContent = p.playing ? "Ⅱ" : "▶";
  }
  requestAnimationFrame(tick);
}
addEventListener("keydown", (e) => {
  const input = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save()
      .then(() => toast("پروژه ذخیره شد."))
      .catch((e) => toast(e.message));
  } else if (!input && !$("dialog[open]")) {
    if (e.code === "Space") {
      e.preventDefault();
      $("#play").click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      $("#undo").click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      $("#redo").click();
    }
  }
});
addEventListener("beforeunload", (e) => {
  if ($("#save-state").textContent === "در حال ذخیره…") {
    e.preventDefault();
    e.returnValue = "";
  }
});
async function init() {
  try {
    const conf = await (await api("/api/config")).json();
    token = conf.token;
    assetList = await (await api("/api/assets")).json();
    let p = conf.defaultProject;
    const id =
      localStorage.getItem("motion-studio-last-project") ||
      localStorage.getItem("mezofill-last-project");
    if (id) {
      localStorage.setItem("motion-studio-last-project", id);
      localStorage.removeItem("mezofill-last-project");
      try {
        p = await (await api("/api/projects/" + id)).json();
      } catch {}
    }
    setProject(p);
    $("#preview").addEventListener("load", schedulePreview);
    if (conf.activeJob) {
      renderJob = conf.activeJob;
      pollJob();
    }
    tick();
  } catch (e) {
    toast(e.message);
    $("#save-state").textContent = "خطا در شروع برنامه";
  }
}
init();

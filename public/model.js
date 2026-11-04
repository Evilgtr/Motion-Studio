(function (root, factory) {
  if (typeof module === "object") module.exports = factory();
  else root.StudioModel = factory();
})(this, function () {
  "use strict";
  const layouts = {
    intro: "معرفی",
    hero: "نمای محصول",
    specs: "مشخصات بسته",
    origin: "برند و سازنده",
    spotlight: "نمای ویژه",
    outro: "پایان و تماس",
  };
  const motions = {
    cinematic: "سینمایی",
    dolly: "زوم آرام",
    rise: "ورود از پایین",
    left: "ورود از چپ",
    right: "ورود از راست",
    float: "شناوری",
    still: "بدون حرکت",
  };
  const transitions = {
    fade: "محو متقاطع",
    black: "محو به سیاهی",
    slide: "حرکت افقی",
    cut: "برش مستقیم",
  };
  const easings = {
    out: "شروع سریع، پایان آرام",
    smooth: "نرم",
    linear: "یکنواخت",
  };
  const palettes = {
    teal: {
      label: "فیروزه‌ای و طلایی",
      bg: "#0f4c5c",
      accent: "#d3b67b",
      text: "#ffffff",
    },
    purple: {
      label: "بنفش و شامپاینی",
      bg: "#382b55",
      accent: "#e8ce9b",
      text: "#ffffff",
    },
    midnight: {
      label: "سرمه‌ای و نقره‌ای",
      bg: "#101d38",
      accent: "#aacce9",
      text: "#ffffff",
    },
    black: {
      label: "مشکی و طلایی",
      bg: "#151719",
      accent: "#ddbd7e",
      text: "#ffffff",
    },
    rose: {
      label: "زرشکی و رزگلد",
      bg: "#482732",
      accent: "#efbfaa",
      text: "#ffffff",
    },
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function scene(layout = "hero") {
    return {
      id:
        globalThis.crypto?.randomUUID?.() ||
        Math.random().toString(36).slice(2),
      layout,
      duration: 3.2,
      kicker: "PRODUCT SPOTLIGHT",
      title: "نام محصول",
      subtitle: "توضیح کوتاه محصول",
      watermark: "PRODUCT",
      image: "",
      logo: "",
      value1: "۳",
      label1: "سرنگ در هر بسته",
      value2: "۳",
      label2: "میلی‌لیتر در هر سرنگ",
      footer: "",
      motion: "dolly",
      strength: 1,
      easing: "out",
      speed: 1,
      transition: "fade",
      transitionTime: 0.45,
      textDelay: 0.2,
      textScale: 1,
      imageScale: 1,
      imageX: 0,
      imageY: 0,
      rotation: 0,
      imageOpacity: 1,
      fit: "contain",
      textAlign: "center",
      showRule: true,
    };
  }
  function makeDefault() {
    const scenes = Object.keys(layouts).map(scene);
    for (const s of scenes) {
      s.kicker = layouts[s.layout];
      s.title = "نام محصول";
      s.subtitle = "توضیحات محصول را اینجا وارد کنید";
      s.watermark = "PRODUCT";
    }
    scenes[5].title = "برای اطلاعات بیشتر با ما تماس بگیرید";
    return {
      version: 1,
      id: "starter-demo",
      name: "پروژهٔ نمونه",
      width: 1080,
      height: 1920,
      fps: 30,
      quality: "high",
      theme: {
        bg: "#0f4c5c",
        accent: "#d3b67b",
        text: "#ffffff",
        font: "",
        bold: "",
        particles: 45,
        glow: 60,
        vignette: 45,
        orbit: true,
        grain: true,
        fadeEnd: true,
      },
      scenes,
    };
  }
  const duration = (p) => p.scenes.reduce((n, s) => n + s.duration, 0);
  function validate(input) {
    if (!input || input.version !== 1)
      throw Error("نسخه یا ساختار فایل پروژه پشتیبانی نمی‌شود.");
    const p = clone(input);
    const num = (v, min, max, label) => {
      if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
        throw Error(`${label}: عددی بین ${min} و ${max} وارد کنید.`);
      return v;
    };
    const str = (v, max = 500) => {
      if (typeof v !== "string" || v.length > max)
        throw Error("متن نامعتبر یا بیش از حد طولانی است.");
      return v;
    };
    const asset = (v) => {
      str(v, 300);
      if (v && !/^\/assets\/(?!.*(?:\.\.|[\\?#]))[^\x00-\x1f]+$/.test(v))
        throw Error("عکس و فونت باید از فایل‌های همین برنامه انتخاب شوند.");
      return v;
    };
    const option = (v, opts) => {
      if (!opts.includes(v)) throw Error("گزینهٔ تنظیمات نامعتبر است.");
      return v;
    };
    p.id = str(p.id, 80);
    if (!/^[a-zA-Z0-9_-]+$/.test(p.id)) throw Error("شناسه پروژه نامعتبر است.");
    p.name = str(p.name, 120);
    for (const key of ["width", "height"]) {
      num(p[key], 240, 3840, "ابعاد");
      if (p[key] % 2 !== 0)
        throw Error("عرض و ارتفاع باید عدد صحیح زوج باشند.");
    }
    option(p.fps, [24, 25, 30, 50, 60]);
    option(p.quality, ["standard", "high", "ultra"]);
    if (
      !p.theme ||
      !Array.isArray(p.scenes) ||
      p.scenes.length < 1 ||
      p.scenes.length > 30
    )
      throw Error("پروژه باید بین ۱ و ۳۰ صحنه داشته باشد.");
    for (const k of ["bg", "accent", "text"]) {
      if (!/^#[a-f0-9]{6}$/i.test(p.theme[k])) throw Error("رنگ نامعتبر است.");
    }
    for (const k of ["font", "bold"]) asset(p.theme[k]);
    for (const k of ["particles", "glow", "vignette"])
      num(p.theme[k], 0, 100, k);
    for (const k of ["orbit", "grain", "fadeEnd"]) p.theme[k] = !!p.theme[k];
    p.scenes = p.scenes.map((s) => {
      const o = { ...scene(), ...s };
      str(o.id, 80);
      option(o.layout, Object.keys(layouts));
      option(o.motion, Object.keys(motions));
      option(o.transition, Object.keys(transitions));
      option(o.easing, Object.keys(easings));
      option(o.fit, ["contain", "cover"]);
      option(o.textAlign, ["center", "right", "left"]);
      asset(o.image);
      asset(o.logo);
      for (const k of [
        "kicker",
        "title",
        "subtitle",
        "watermark",
        "value1",
        "label1",
        "value2",
        "label2",
        "footer",
      ])
        str(o[k]);
      for (const [k, min, max] of [
        ["duration", 1, 30],
        ["strength", 0, 2],
        ["speed", 0.25, 3],
        ["textDelay", 0, 2],
        ["textScale", 0.5, 1.5],
        ["imageScale", 0.3, 1.8],
        ["imageX", -300, 300],
        ["imageY", -300, 300],
        ["rotation", -30, 30],
        ["imageOpacity", 0, 1],
        ["transitionTime", 0, 1],
      ])
        num(o[k], min, max, k);
      o.showRule = !!o.showRule;
      return o;
    });
    if (duration(p) > 180) throw Error("حداکثر زمان پروژه ۱۸۰ ثانیه است.");
    return p;
  }
  return {
    layouts,
    motions,
    transitions,
    easings,
    palettes,
    clone,
    scene,
    makeDefault,
    duration,
    validate,
  };
});

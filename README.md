# Mezofill Motion Studio

ویرایشگر محلی ساخت موشن محصول با رابط فارسی و راست‌به‌چپ. صحنه‌ها، نوشته‌ها، تصویرها، فونت‌ها و حرکت را تنظیم کنید و خروجی بگیرید؛ بدون حساب کاربری یا سرویس ابری.

**اگر این پروژه به شما ایده داد یا از آن در سیستم خودتان استفاده کردید، با زدن ⭐ Star از آن حمایت کنید.** ستاره‌دادن کمک می‌کند افراد بیشتری پروژه را پیدا کنند و به ادامهٔ توسعه‌اش انگیزه می‌دهد.

> **مجوز:** کد منبع این پروژه تحت مجوز MIT منتشر می‌شود؛ متن کامل در فایل [LICENSE](LICENSE) است. این مجوز شامل حقوق بازنشر تصویرها، لوگوها یا فونت‌های متعلق به پروژه‌های محلی موجود نمی‌شود.

## امکانات

- ویرایش صحنه‌ها، متن‌ها، تصویرها، فونت‌ها و حرکت در یک رابط فارسی و RTL
- خروجی ویدیوی MP4 با H.264، فایل HTML مستقل یا پشتیبان قابل انتقال
- اجرای محلی با Chromium و FFmpeg؛ بدون API میزبانی‌شده یا نیاز به حساب
- نگهداری پروژه‌ها و خروجی‌ها روی دستگاه خودتان

## شروع سریع در ویندوز

در ویندوز x64، `Setup-Windows.cmd` را اجرا کنید و پس از پایان نصب `Start-Studio.cmd` را باز کنید. برای بررسی مشکلات مرورگر یا رمزگذار، `Check-System.cmd` را اجرا کنید.

برای اجرای نسخهٔ توسعه، Node.js نسخهٔ ۲۲ یا جدیدتر لازم است:

```sh
npm ci
npm run install:browser
npm start
```

نشانی‌ای را که در ترمینال نمایش داده می‌شود باز کنید (معمولاً `http://127.0.0.1:4318`) و تا پایان کار ترمینال را باز نگه دارید. نصب اولیه به اینترنت نیاز دارد؛ پس از آن ویرایش و رندر روی سیستم خودتان انجام می‌شود. قالب آغازین از فونت‌های سیستمی و تصویرهای جایگزین استفاده می‌کند؛ تصویرها و فونت‌های خودتان را از داخل ویرایشگر اضافه کنید.

## توسعه و آزمون

```sh
npm test
npm run format:check
npm run format
npm run doctor
```

`npm test` از تست‌رانر Node و یک فضای موقت جداگانه استفاده می‌کند؛ به Chromium یا FFmpeg نیاز ندارد و فایل‌های پروژهٔ شما را تغییر نمی‌دهد. `npm run doctor` نصب مرورگر و رمزگذار H.264 را بررسی می‌کند. برای آشنایی با معماری، [راهنمای توسعه](DEVELOPER.md) و برای شیوهٔ مشارکت، [راهنمای مشارکت](CONTRIBUTING.md) را ببینید.

## مشارکت

گزارش باگ، پیشنهاد قابلیت و بهبود مستندات به رشد پروژه کمک می‌کند. پیش از ارسال تغییر، راهنمای مشارکت را بخوانید و آزمون‌های مرتبط را اجرا کنید.

## داده‌ها و حریم خصوصی

پروژه‌ها در `projects/`، فایل‌های بارگذاری‌شده در `assets/images/` و `assets/fonts/` و رندرها در `exports/` ذخیره می‌شوند. این پوشه‌ها از Git مستثنا هستند و فایل‌های محلی موجود حفظ می‌شوند. برای انتقال پروژه از گزینهٔ پشتیبان قابل حمل استفاده کنید تا فایل‌های وابسته نیز همراه آن باشند.

فایل ZIP از کل پوشهٔ کاری منتشر نکنید؛ ممکن است پروژه‌ها و رسانه‌های خصوصی، runtimeهای دانلودشده یا وابستگی‌ها را در بر بگیرد. فقط فایل‌های منبع بررسی‌شده را منتشر کنید.

## پیکربندی

| متغیر محیطی                | کاربرد                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| `PORT`                     | درگاه آغازین؛ پیش‌فرض `4318` است و در صورت اشغال، ۲۰ درگاه بعدی بررسی می‌شود. |
| `STUDIO_NO_OPEN=1`         | باز شدن خودکار مرورگر را غیرفعال می‌کند.                                      |
| `STUDIO_CHROMIUM`          | مسیر مرورگر سازگار با Chromium را مشخص می‌کند.                                |
| `STUDIO_FFMPEG`            | مسیر اجرایی FFmpeg را مشخص می‌کند.                                            |
| `PLAYWRIGHT_BROWSERS_PATH` | مسیر cache مرورگر؛ پیش‌فرض `.runtime/browsers` است.                           |

این برنامه برای استفادهٔ تک‌کاربره و اتصال loopback طراحی شده است؛ آن را پشت پراکسی عمومی قرار ندهید. خروجی MP4 با H.264 و پردازش CPU ساخته می‌شود و صدا ندارد.

## مجوز و رسانه‌ها

کد منبع تحت مجوز MIT است؛ متن کامل را در [LICENSE](LICENSE) بخوانید. تصویرها، لوگوها و فونت‌های Yekan متعلق به پروژه‌های محلی موجود از مجوز بازنشر کد مستثنا هستند و این مخزن حق بازنشر آن فایل‌ها را ایجاد نمی‌کند. مجوز وابستگی‌ها را نیز در بسته‌های مربوطه بررسی کنید.

---

## English

Mezofill Motion Studio is a local product-motion editor with a Persian, right-to-left interface. Arrange scenes, text, images, fonts, and motion, then export an MP4 video, standalone HTML, or portable backup. It runs on your computer and does not require an account or hosted API.

**If this project gave you an idea or you use it in your own system, please support it with a ⭐ Star.** It helps others discover the project and encourages further development.

> **License:** The source code is released under the MIT License; see [LICENSE](LICENSE) for the full text. This license does not grant redistribution rights to images, logos, or fonts from existing local projects.

### Features

- Edit scenes, text, images, fonts, and motion in a Persian RTL interface.
- Export H.264 MP4, standalone HTML, or a portable backup.
- Render locally with Chromium and FFmpeg; no hosted API or account is required.
- Keep projects and exports on your own device.

### Quick start on Windows

On Windows x64, run `Setup-Windows.cmd`, then launch `Start-Studio.cmd`. Run `Check-System.cmd` to diagnose browser or encoder issues.

For source development, install Node.js 22 or newer:

```sh
npm ci
npm run install:browser
npm start
```

Open the address printed in the terminal (usually `http://127.0.0.1:4318`) and leave the terminal running. Installation requires internet access; editing and rendering run locally afterward. The starter template uses system fonts and placeholder images. Add your own images and fonts in the editor.

### Development and tests

```sh
npm test
npm run format:check
npm run format
npm run doctor
```

`npm test` uses Node's test runner and an isolated temporary workspace. It does not modify your projects or require Chromium/FFmpeg. `npm run doctor` checks the installed browser and H.264 encoder. See [DEVELOPER.md](DEVELOPER.md) for architecture and [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance.

### Local data and safety

Projects are stored in `projects/`, uploads in `assets/images/` and `assets/fonts/`, and renders in `exports/`. These directories are excluded from Git, and existing local files are preserved. Use the portable backup action to include a project's referenced assets.

Do not publish a ZIP of your working directory; it may contain private projects and media, downloaded runtimes, or dependencies. Publish reviewed source files only. This is a single-user loopback application; do not expose it through a public proxy. MP4 export is CPU-based H.264 without audio.

### Configuration

| Environment variable       | Purpose                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `PORT`                     | Starting port, default `4318`; tries 20 subsequent ports if busy. |
| `STUDIO_NO_OPEN=1`         | Disable automatic browser opening.                                |
| `STUDIO_CHROMIUM`          | Explicit Chromium-compatible executable.                          |
| `STUDIO_FFMPEG`            | Explicit FFmpeg executable.                                       |
| `PLAYWRIGHT_BROWSERS_PATH` | Browser cache; defaults to `.runtime/browsers`.                   |

### License and media

The source code is licensed under MIT; see [LICENSE](LICENSE) for the full text. Images, logos, and Yekan fonts from existing local projects are excluded, and this repository does not grant redistribution rights to those files. Check dependency licenses in their respective packages.

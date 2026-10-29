// نطبخ إيه؟ — Service Worker
// غيّر رقم النسخة عند أي تحديث للملفات علشان الكاش القديم يتمسح.
const VERSION = "v2.4.1";
const CACHE = "notbokh-eh-" + VERSION;
const ASSETS = ["./", "./index.html", "./styles.css", "./data.js", "./app.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/logo-mark.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"];
// خط Cairo: بنحاول نخزن ملف الـ CSS بتاعه من أول تثبيت (لو فشل مش مشكلة)
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    // كل ملف لوحده: لو ملف واحد فشل، باقي الملفات تتخزن عادي ومش بيفشل التثبيت كله
    await Promise.all(ASSETS.map(u => c.add(u).catch(() => {})));
    await fetch(FONT_CSS, { mode: "no-cors" }).then(r => c.put(FONT_CSS, r)).catch(() => {});
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  if (url.pathname.startsWith("/.well-known/") || url.pathname.startsWith("/wk/")) return; // لا تتدخل في ملفات التحقق

  // الصفحات: الشبكة أولًا (علشان التحديثات توصل) ثم الكاش بدون إنترنت
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
        return res;
      }).catch(() => caches.match("./index.html").then(hit => hit || caches.match("./")))
    );
    return;
  }

  // باقي الملفات والخطوط: من الكاش فورًا وتتحدث في الخلفية
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res && (res.status === 200 || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});

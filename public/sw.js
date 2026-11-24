// ---- تطبيق ويب قابل للتثبيت: تخزين الواجهة الثابتة فقط (لا يُخزَّن أي شيء من /api) ----
const CACHE = 'musaed-shell-v42';
const SHELL = ['/', '/app.css', '/app.js', '/qr.js', '/splash.js','/logo.png', '/hand.png', '/icon-192.png'];
const OFFLINE_HTML = '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>المساعد</title><body style="font-family:Tahoma,sans-serif;background:#fbfaff;color:#5331b6;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><h1 style="margin:0 0 8px">لا يوجد اتصال بالإنترنت</h1><p style="color:#625a76">تأكد من اتصالك ثم أعد المحاولة.</p><button onclick="location.reload()" style="font:inherit;background:#5331b6;color:#fff;border:0;border-radius:12px;padding:12px 24px;min-height:44px">إعادة المحاولة</button></div></body></html>';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api') || req.headers.has('range')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('/', cp)); } return r; })
      .catch(() => caches.match('/').then((r) => r || new Response(OFFLINE_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } }))));
    return;
  }
  if (/\.(css|js|png|webp|woff2|webmanifest)$/.test(url.pathname)) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req).then((r) => r || Response.error())));
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch {}
  const n = Number(d.count) || 0;
  const badge = (self.navigator && self.navigator.setAppBadge) ? (n > 0 ? self.navigator.setAppBadge(n) : self.navigator.clearAppBadge()) : null;
  e.waitUntil(Promise.resolve(badge).catch(() => {}).then(() => self.registration.showNotification(String(d.title || 'المساعد'), {
    body: String(d.body || ''),
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    lang: 'ar',
    dir: 'rtl',
    vibrate: [200, 100, 200],
    tag: 'musaed-' + (d.count || 0),
    renotify: true,
    data: { url: String(d.url || '/') },
  })));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ('focus' in c) { c.focus(); return c.navigate ? c.navigate(url) : undefined; }
    }
    return self.clients.openWindow(url);
  }));
});

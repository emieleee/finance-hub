/* Finance Hub service worker
   - Opens instantly and works offline (app shell is cached).
   - Checks for newer app files (index.html, styles.css, app.js, firebase.js) in the background; when any changes,
     the page shows "New version available – tap to refresh".
   - Caches the Firebase and Chart.js libraries so offline cold starts work.
   Your financial data is NOT cached here – Firebase keeps its own offline copy. */
const SHELL_CACHE = 'fh-shell-v2';
const LIB_CACHE = 'fh-libs-v1';
const META_CACHE = 'fh-meta';
const SHELL = ['./', './index.html', './styles.css', './app.js', './firebase.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com'];
const PAGE_KEY = new URL('./index.html', self.registration.scope).href;
// App code files checked for updates (any change shows the update banner).
const CODE_FILES = ['./index.html', './styles.css', './app.js', './firebase.js'].map(p => new URL(p, self.registration.scope).href);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![SHELL_CACHE, LIB_CACHE, META_CACHE].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Fetch the latest app code files; if any differ from the cached copies, store them and tell open pages.
// All files are fetched first and only then written, so the cache never mixes old and new versions.
let checking = null;
function revalidatePage() {
  if (!checking) checking = (async () => {
    try {
      const cache = await caches.open(SHELL_CACHE);
      const fresh = await Promise.all(CODE_FILES.map(async url => {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error('fetch failed');
        const old = await cache.match(url);
        const text = await res.clone().text();
        const prev = old ? await old.text() : null;
        return { url, res, changed: prev !== text, existed: prev !== null };
      }));
      const changed = fresh.filter(f => f.changed);
      if (!changed.length) return;
      for (const f of changed) await cache.put(f.url, f.res);
      if (changed.some(f => f.existed)) {
        const meta = await caches.open(META_CACHE);
        await meta.put('./__updated', new Response(String(Date.now())));
        for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'UPDATE_READY' });
      }
    } catch (_) { /* offline or a file failed – keep the cached version */ }
    finally { checking = null; }
  })();
  return checking;
}

self.addEventListener('message', e => {
  if (e.data === 'CHECK_UPDATE') e.waitUntil(revalidatePage());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App pages: serve the cached copy instantly, check for a newer one in the background.
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(PAGE_KEY);
      const update = revalidatePage();
      if (cached) { e.waitUntil(update); return cached; }
      try { return await fetch(req); } catch (_) { return (await caches.match('./')) || Response.error(); }
    })());
    return;
  }
  // Other files on this site (icons, manifest): cache first.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(m => m || fetch(req)));
    return;
  }
  // Libraries (Firebase SDK, Chart.js): use cache, refresh in background.
  if (LIB_HOSTS.includes(url.hostname) && (url.hostname === 'cdn.jsdelivr.net' || url.pathname.startsWith('/firebasejs/'))) {
    e.respondWith((async () => {
      const cache = await caches.open(LIB_CACHE);
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    })());
  }
  // Everything else (Firebase/Google APIs) goes straight to the network.
});

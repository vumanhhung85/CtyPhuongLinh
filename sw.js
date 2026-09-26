/* Service Worker tối giản: đủ điều kiện để Android/Chrome cho "Cài đặt ứng dụng" (PWA), nhưng KHÔNG giữ bản cũ.
   - Trang (HTML/JS/CSS cùng tên miền): luôn lấy bản mới nhất từ mạng trước, chỉ dùng bản lưu tạm khi mất mạng
     -> đẩy code mới lên GitHub là máy anh thấy ngay, không bị kẹt bản cũ.
   - Gọi API (Cloudflare Worker, khác tên miền) và thư viện CDN: không can thiệp, để trình duyệt tự xử lý.
   - Khi cài bản sw.js mới: xoá sạch mọi bộ nhớ đệm cũ (kể cả của sw.js bản Apps Script trước đây). */
const CACHE = 'pl-erp-v20260926';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(req).then(r => r || Response.error()))
  );
});

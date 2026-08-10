// Service Worker tối thiểu — chỉ để trình duyệt cho phép "Cài đặt ứng dụng" trên Android.
// KHÔNG cache dữ liệu từ Apps Script (script.google.com) — luôn lấy dữ liệu mới nhất,
// vì đây là app quản lý bán hàng, dữ liệu tồn kho/công nợ phải luôn chính xác theo thời gian thực.

const CACHE_NAME = 'qlbh-shell-v1';
const APP_SHELL = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Không bao giờ can thiệp vào các lệnh gọi tới Apps Script (dữ liệu thật) — luôn lấy trực tiếp từ mạng.
  if (url.includes('script.google.com') || url.includes('googleusercontent.com') || url.includes('vietqr.io')) {
    return; // để trình duyệt tự xử lý bình thường, không qua cache
  }
  // Với khung giao diện: ưu tiên mạng trước, nếu mất mạng thì lấy bản đã lưu trong cache (chỉ để đỡ trắng trang).
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

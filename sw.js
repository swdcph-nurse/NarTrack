const CACHE_NAME = 'narcotic-ward-v4';
const ASSETS = [
  './',
  'index.html',
  'dashboard.html',
  'stock.html',
  'disbursement.html',
  'shiftcount.html',
  'report.html',
  'settings.html',
  'style.css',
  'api.js',
  'app.js',
  'fixes.js',
  'navbar.html',
  'manifest.json',
  'icon-app.png'
];

// ติดตั้ง Service Worker และทำการเก็บ Cache ไฟล์พื้นฐาน
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// เปิดการใช้งานและล้าง Cache เก่า
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// จัดการ Fetch Request แบบ Network First (เพื่ออัปเดตข้อมูลจริงก่อน ถ้าออฟไลน์ค่อยดึง Cache)
self.addEventListener('fetch', event => {
  // ข้ามการยิงดึงข้อมูล API จาก Google
  if (event.request.url.includes('google.com') || event.request.url.includes('script.google')) {
    return; // ปล่อยให้เบราว์เซอร์จัดการ (ไม่ต้องจัดการใน SW)
  }

  event.respondWith(
    fetch(event.request).then(response => {
      // เซฟข้อมูลเข้า cache เพื่อใช้งานต่อ แต่ต้องกรองเฉพาะ http/https requests
      try {
        if (response && response.status === 200) {
          // ตรวจสอบ protocol ก่อนจะเก็บ
          let url;
          try {
            url = new URL(event.request.url);
          } catch (e) {
            url = null;
          }

          if (url && (url.protocol === 'http:' || url.protocol === 'https:')) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseCopy).catch(err => {
                // ไม่ให้ Uncaught rejection หยุดการทำงาน
                console.warn('Cache put failed for', event.request.url, err);
              });
            }).catch(err => {
              console.warn('Open cache failed:', err);
            });
          } else {
            // ข้าม caching สำหรับ non-http(s) requests
            // เช่น chrome-extension://, file://, data: ฯลฯ
          }
        }
      } catch (e) {
        console.warn('Error while attempting to cache response for', event.request.url, e);
      }

      return response;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});

// รับ push จาก server แต่ไม่แสดง notification ของระบบ (ไม่ต้องการ popup)
self.addEventListener('push', (event) => {
  const payload = event.data ? (() => {
    try { return event.data.json(); } catch (e) { return { title: 'New', body: event.data.text() || '' }; }
  })() : { title: 'New', body: 'You have a message' };

  // ส่งข้อความไปยัง client ให้หน้าเว็บแอปแสดง in-app toast แทนการเรียก showNotification
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
      for (const client of clients) {
        client.postMessage({ type: 'push', payload });
      }
    })
  );
});

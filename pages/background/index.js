(() => {
  const CACHE_NAME = 'v4-dynamic-content';
  const DEFAULT_ICON_URL = chrome.runtime.getURL('pages/newtab/imgs/unraid-icon.png');

  function isIconRequest(url) {
    const lowercasedUrl = url.toLowerCase();
    return lowercasedUrl.includes('/favicon.') ||
           lowercasedUrl.endsWith('.ico') ||
           lowercasedUrl.endsWith('.png') ||
           lowercasedUrl.includes('favicon') ||
           lowercasedUrl.includes('icon');
  }

  async function getDefaultIconResponse() {
    try {
      const response = await fetch(DEFAULT_ICON_URL);
      if (!response.ok) {
        throw new Error('默认图标加载失败');
      }
      return response;
    } catch (error) {
      return null;
    }
  }

  self.addEventListener('install', (event) => {
    console.log('ServiceWorker: install event in progress.');
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', (event) => {
    console.log('ServiceWorker: activate event in progress.');
    event.waitUntil(
      Promise.all([
        self.clients.claim(),
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.filter((cacheName) => cacheName !== CACHE_NAME)
              .map((cacheName) => {
                return caches.delete(cacheName);
              })
          );
        })
      ])
    );
  });

  self.addEventListener('fetch', (event) => {
    const { request } = event;
    const isGet = request.method === 'GET';
    const isCacheable = isGet && request.url.startsWith('http');

    if (isCacheable) {
      event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          try {
            const networkResponse = await fetch(request);
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch (error) {
            
            console.error('ServiceWorker: 网络请求失败:', event.request.url, error);

            if (isIconRequest(request.url)) {
              const defaultIconResponse = await getDefaultIconResponse();
              if (defaultIconResponse) {
                return defaultIconResponse;
              }
            }
            
            throw error;
          }
        })
      );
    }
  });

  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({});
  });

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.tabs.create({});
    }
  });

  try {
    chrome.runtime.setUninstallURL('');
  } catch (e) {
    console.error('Setting uninstall URL failed:', e);
  }
})();

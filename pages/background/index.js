(() => {
  const CACHE_NAME = 'v3-dynamic-content'; // Bump version to trigger update
  const DEFAULT_ICON = '../newtab/imgs/unraid-icon.png'; // 默认图标路径

  // 检查响应是否是图标请求
  function isIconRequest(url) {
    return url.includes('/favicon.') || // favicon
           url.endsWith('.ico') ||      // .ico文件
           url.endsWith('.png') ||      // .png文件
           url.includes('favicon') ||    // 包含favicon的URL
           url.includes('icon');         // 包含icon的URL
  }

  // 获取默认图标的响应
  async function getDefaultIconResponse() {
    try {
      const cache = await caches.open(CACHE_NAME);
      let response = await cache.match(DEFAULT_ICON);
      
      if (!response) {
        // 如果缓存中没有默认图标，尝试获取并缓存它
        response = await fetch(DEFAULT_ICON);
        if (response.ok) {
          cache.put(DEFAULT_ICON, response.clone());
        }
      }
      
      return response;
    } catch (error) {
      console.error('获取默认图标失败:', error);
      return null;
    }
  }

  // On install, the service worker is activated.
  self.addEventListener('install', function (event) {
    console.log('ServiceWorker: install event in progress.');
    event.waitUntil(self.skipWaiting());
  });

  // On fetch, use a cache-first strategy for remote resources (like wallpapers and favicons).
  self.addEventListener('fetch', function (event) {
    const isGet = event.request.method === 'GET';
    // Only cache requests to http/https protocols (i.e., network requests).
    // This avoids trying to cache chrome-extension:// URLs, which is not supported and not necessary.
    const isCacheable = isGet && event.request.url.startsWith('http');

    if (isCacheable) {
      event.respondWith(
        caches.match(event.request, {
          ignoreSearch: false,  // 精确匹配 URL，包括查询参数
          ignoreMethod: false,  // 精确匹配 HTTP 方法
          ignoreVary: false     // 考虑 Vary 头
        })
        .then(async function (response) {
          // 如果在缓存中找到响应，直接返回
          if (response) {
            return response;
          }

          try {
            // 启动网络请求
            const networkResponse = await fetch(event.request);
              
            // 检查响应是否成功
            if (!networkResponse || !networkResponse.ok) {
              throw new Error('网络响应无效');
            }

            // 克隆响应用于缓存
            const responseToCache = networkResponse.clone();
              
            // 更新缓存
            caches.open(CACHE_NAME)
              .then(function (cache) {
                cache.put(event.request, responseToCache);
              })
              .catch(function(err) {
                console.warn('缓存更新失败:', err);
              });

            return networkResponse;
          } catch (error) {
            console.error('ServiceWorker: 网络请求失败:', event.request.url, error);
            
            // 如果有缓存的响应，返回缓存
            if (response) {
              return response;
            }
            
            // 如果是图标请求且失败了，返回默认图标
            if (isIconRequest(event.request.url)) {
              const defaultIconResponse = await getDefaultIconResponse();
              if (defaultIconResponse) {
                return defaultIconResponse;
              }
            }
            
            throw error;
          }

          // 如果有缓存，立即返回缓存的响应
          // 同时在后台更新缓存（Stale-While-Revalidate 模式）
          return response || fetchPromise;
        })
      );
    }
    // For non-cacheable requests (e.g., local extension files), do nothing.
    // The browser will handle them normally by loading them from the extension package.
  });

  // On activate, clean up old caches and take control of clients.
  self.addEventListener('activate', function (event) {
    console.log('ServiceWorker: activate event in progress.');
    event.waitUntil(
      Promise.all([
        // Take control of all open clients without waiting for a reload.
        self.clients.claim(),
        // Clean up old caches.
        caches.keys().then(function (cacheNames) {
          return Promise.all(
            cacheNames.filter(function (cacheName) {
              // Delete any cache that is not our current one.
              return cacheName !== CACHE_NAME;
            }).map(function (cacheName) {
              console.log('ServiceWorker: deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
          );
        })
      ])
    );
  });
  
  // In Manifest V3, 'browser_action' is replaced by 'action'.
  chrome.action.onClicked.addListener(() => {
    // When the action icon is clicked, open a new tab.
    // An empty create call will open the page defined in 'chrome_url_overrides.newtab'.
    chrome.tabs.create({});
  });

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
      // On first install, open a new tab to show the extension's page.
      chrome.tabs.create({});
    }
  });

  // setUninstallURL is supported in V3. It's good practice to wrap this in a
  // try-catch as it might not be available in all contexts (e.g. some browsers).
  try {
    chrome.runtime.setUninstallURL('');
  } catch (e) {
    console.error('Setting uninstall URL failed:', e);
  }
})();
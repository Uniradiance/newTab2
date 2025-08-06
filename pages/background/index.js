(() => {
  const CACHE_NAME = 'v4-dynamic-content'; // Zwiększ wersję, aby wywołać aktualizację
  const DEFAULT_ICON_URL = chrome.runtime.getURL('pages/newtab/imgs/unraid-icon.png');

  // Sprawdza, czy żądanie dotyczy ikony
  function isIconRequest(url) {
    const lowercasedUrl = url.toLowerCase();
    return lowercasedUrl.includes('/favicon.') ||
           lowercasedUrl.endsWith('.ico') ||
           lowercasedUrl.endsWith('.png') ||
           lowercasedUrl.includes('favicon') ||
           lowercasedUrl.includes('icon');
  }

  // Pobiera domyślną odpowiedź z ikoną
  async function getDefaultIconResponse() {
    try {
      const response = await fetch(DEFAULT_ICON_URL);
      if (!response.ok) {
        throw new Error('Nie udało się załadować domyślnej ikony');
      }
      return response;
    } catch (error) {
      console.error('Nie udało się pobrać domyślnej ikony:', error);
      return null;
    }
  }

  // Po instalacji Service Worker jest aktywowany.
  self.addEventListener('install', (event) => {
    console.log('ServiceWorker: zdarzenie instalacji w toku.');
    event.waitUntil(self.skipWaiting());
  });

  // Po aktywacji wyczyść stare pamięci podręczne.
  self.addEventListener('activate', (event) => {
    console.log('ServiceWorker: zdarzenie aktywacji w toku.');
    event.waitUntil(
      Promise.all([
        self.clients.claim(),
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.filter((cacheName) => cacheName !== CACHE_NAME)
              .map((cacheName) => {
                console.log('ServiceWorker: usuwanie starej pamięci podręcznej:', cacheName);
                return caches.delete(cacheName);
              })
          );
        })
      ])
    );
  });

  // Dla zdarzenia fetch użyj strategii "cache-first".
  self.addEventListener('fetch', (event) => {
    const { request } = event;
    const isGet = request.method === 'GET';
    const isCacheable = isGet && request.url.startsWith('http');

    if (isCacheable) {
      event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
          // Najpierw spróbuj znaleźć odpowiedź w pamięci podręcznej
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // Jeśli nie ma w pamięci podręcznej, spróbuj pobrać z sieci
          try {
            const networkResponse = await fetch(request);
            // Jeśli odpowiedź jest poprawna, zapisz ją w pamięci podręcznej
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch (error) {
            console.error('ServiceWorker: Błąd pobierania sieciowego:', request.url, error);

            // Jeśli żądanie o ikonę nie powiodło się, zwróć domyślną ikonę
            if (isIconRequest(request.url)) {
              const defaultIconResponse = await getDefaultIconResponse();
              if (defaultIconResponse) {
                return defaultIconResponse;
              }
            }
            
            // Rzuć błąd, aby zasygnalizować, że zasób jest niedostępny
            throw error;
          }
        })
      );
    }
  });

  // Obsługa kliknięcia ikony rozszerzenia
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({});
  });

  // Otwórz nową kartę po instalacji
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.tabs.create({});
    }
  });

  // Ustaw URL deinstalacji
  try {
    chrome.runtime.setUninstallURL('');
  } catch (e) {
    console.error('Ustawienie adresu URL deinstalacji nie powiodło się:', e);
  }
})();

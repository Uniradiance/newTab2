
(function(){
	
	const CACHE_NAME = 'v1';

	this.addEventListener('install', function (event) {
		// Ensures the install event waits until the cache is opened.
		event.waitUntil(
			caches.open(CACHE_NAME)
		);
	});
						
	
	self.addEventListener('fetch', function(event) {
		// For GET requests, use a cache-first strategy.
		// The Cache API only supports http/https schemes, so we must filter for those.
		if (event.request.method === 'GET' && (event.request.url.startsWith('http:') || event.request.url.startsWith('https://'))) {
			event.respondWith(
				caches.match(event.request)
				.then(function(response) {
					// Cache hit - return response
					if (response) {
						return response;
					}
			
					// Not in cache, so fetch from network.
					return fetch(event.request).then(
						function(networkResponse) {
							// A response is a stream and can only be consumed once.
							// We need to clone it to put one copy in cache and return one to the browser.
							const responseToCache = networkResponse.clone();
							
							caches.open(CACHE_NAME)
							.then(function(cache) {
								// Cache the new response.
								// This will also cache opaque responses (e.g., for cross-origin favicons).
								cache.put(event.request, responseToCache);
							});
				
							return networkResponse;
						}
					).catch(function(error) {
						console.error('Fetching failed:', event.request.url, error);
						// If a fetch error occurs, we throw it to be handled by the browser.
						throw error;
					});
				})
			);
		}
		// For other requests (like POST or chrome-extension:// scheme), let the browser handle them normally.
	});

	this.addEventListener('message', function(event){
		console.log("SW Received Message: " + event.data);
	});


	this.addEventListener('activate', function(event){
		console.log('ServiceWorker activated!');
		// Clean up old caches to save space and remove outdated data.
		event.waitUntil(
			caches.keys().then(function(cacheNames) {
			  return Promise.all(
				cacheNames.filter(function(cacheName) {
				  // Return true to remove this cache if it's not our current CACHE_NAME.
				  return cacheName !== CACHE_NAME;
				}).map(function(cacheName) {
				  console.log('ServiceWorker: deleting old cache:', cacheName);
				  return caches.delete(cacheName);
				})
			  );
			})
		  );
	});
})();

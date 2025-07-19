
(function(){
	
	const CACHE_NAME = 'v3-dynamic-content'; // Bump version to trigger update

	// On install, the service worker is activated.
	// Pre-caching of local extension files is not needed (and unsupported) as they are part of the package.
	// We'll use skipWaiting to activate the new SW immediately.
	self.addEventListener('install', function (event) {
		console.log('ServiceWorker: install event in progress.');
		event.waitUntil(self.skipWaiting());
	});
						
	// On fetch, use a cache-first strategy for remote resources (like wallpapers and favicons).
	self.addEventListener('fetch', function(event) {
		const isGet = event.request.method === 'GET';
		// Only cache requests to http/https protocols (i.e., network requests).
		// This avoids trying to cache chrome-extension:// URLs, which is not supported and not necessary.
		const isCacheable = isGet && event.request.url.startsWith('http');
	
		if (isCacheable) {
			event.respondWith(
				caches.match(event.request)
				.then(function(response) {
					// If a response is found in cache, return it.
					if (response) {
						return response;
					}
			
					// If not in cache, fetch it from the network.
					return fetch(event.request).then(
						function(networkResponse) {
							// Clone the response because it's a stream and can only be used once.
							const responseToCache = networkResponse.clone();
							
							caches.open(CACHE_NAME)
							.then(function(cache) {
								// Cache the newly fetched resource. This is runtime caching for wallpapers, etc.
								cache.put(event.request, responseToCache);
							});
				
							// Return the network response to the page.
							return networkResponse;
						}
					).catch(function(error) {
						console.error('ServiceWorker: Fetching failed:', event.request.url, error);
						// If fetch fails (e.g., offline and not in cache), the request will fail.
						// A fallback could be returned here if desired.
						throw error;
					});
				})
			);
		}
		// For non-cacheable requests (e.g., local extension files), do nothing.
		// The browser will handle them normally by loading them from the extension package.
	});

	// On activate, clean up old caches and take control of clients.
	self.addEventListener('activate', function(event){
		console.log('ServiceWorker: activate event in progress.');
		event.waitUntil(
			Promise.all([
				// Take control of all open clients without waiting for a reload.
				self.clients.claim(),
				// Clean up old caches.
				caches.keys().then(function(cacheNames) {
				  return Promise.all(
					cacheNames.filter(function(cacheName) {
					  // Delete any cache that is not our current one.
					  return cacheName !== CACHE_NAME;
					}).map(function(cacheName) {
					  console.log('ServiceWorker: deleting old cache:', cacheName);
					  return caches.delete(cacheName);
					})
				  );
				})
			])
		  );
	});

})();

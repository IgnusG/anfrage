interface CleanupCachesParams {
	requestCache: Cache;
	metaCache: Cache;
	removeCache: (cacheKey: string) => boolean;
	removeCacheEntry?: (cacheRequest: Request, cacheResponse: Response) => Promise<boolean>;
}

export async function cleanupCaches({
	requestCache,
	metaCache,
	removeCache,
	removeCacheEntry,
}: CleanupCachesParams) {
	// Collect old request cache keys - caches with lower (other) version numbers
	const oldCacheKeys = (await caches.keys()).filter(removeCache);

	// Delete old caches asynchronously - they won't be opened so there will be no conflicts
	oldCacheKeys.forEach((oldCacheKey) => {
		caches.delete(oldCacheKey);
	});

	if (removeCacheEntry) {
		// Remove stale requests from current caches - these might be matches so we need to parse these synchronously
		await metaCache.keys().then(async (requests) => {
			const promises = requests.map(async (request) => {
				const response = await requestCache.match(request);
				const remove = response === undefined || (await removeCacheEntry(request, response));

				if (remove) {
					await requestCache.delete(request);
				}
			});

			await Promise.all(promises);
		});
	}
}

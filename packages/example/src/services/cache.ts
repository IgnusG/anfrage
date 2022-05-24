import { createRequestCache, initializeRequestCache } from "@ignsg/anfrage/cache";

export async function createCacheService() {
	const caches = await initializeRequestCache({ cacheVersion: "v1" });
	const { cache } = await createRequestCache(caches);

	return { cache };
}

export type CacheService = Awaited<ReturnType<typeof createCacheService>>;

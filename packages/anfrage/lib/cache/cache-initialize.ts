import { cleanupCaches } from "./cache-cleanup";

export const REQUEST_CACHE_BASE_KEY = "requestCache";
export const META_CACHE_BASE_KEY = "metaCache";

interface SerializedMetaInformation {
	date: number;
}

export interface MetaInformation {
	date: Date;
}

interface IsFreshParams {
	maxCacheAge?: number;
}

export function isFresh(meta: MetaInformation | undefined, { maxCacheAge }: IsFreshParams) {
	if (maxCacheAge === undefined || !meta) return true;

	const now = new Date().getTime();

	return now - meta.date?.getTime() < maxCacheAge;
}

export async function parseMeta(response: Response | undefined) {
	if (!response) return undefined;

	const result = (await response.json()) as SerializedMetaInformation;
	const date = new Date(result.date);

	// Check if response was MetaInformation
	if (isNaN(date.getTime())) return undefined;

	return { date } as MetaInformation;
}

export function serializeMeta(meta: MetaInformation) {
	const serialized = JSON.stringify(meta);

	return new Response(serialized);
}

function isCacheStale(cacheName: string, cacheVersion: string) {
	return (cacheKey: string) => {
		if (cacheKey.startsWith(cacheName)) {
			return !cacheKey.endsWith(cacheVersion);
		}

		return false;
	};
}

function isCacheEntryStale({ maxCacheAge }: { maxCacheAge: number | undefined }) {
	return async (_: Request, response: Response) => {
		const meta = await parseMeta(response);
		return !isFresh(meta, { maxCacheAge });
	};
}

export interface InitializeRequestCacheOptions {
	maxCacheAge?: number;

	cacheNamePrefix?: string;
	cacheVersion: string;
}

export async function initializeRequestCache({
	cacheVersion,
	cacheNamePrefix,
	maxCacheAge,
}: InitializeRequestCacheOptions) {
	const prefix = cacheNamePrefix ? `${cacheNamePrefix}-` : "";

	const requestCacheName = `${prefix}${REQUEST_CACHE_BASE_KEY}`;
	const metaCacheName = `${prefix}${META_CACHE_BASE_KEY}`;

	const requestCacheKey = `${requestCacheName}-${cacheVersion}`;
	const metaCacheKey = `${metaCacheName}-${cacheVersion}`;

	const requestCache = await caches.open(requestCacheKey);
	const metaCache = await caches.open(metaCacheKey);

	const initialCacheClean = cleanupCaches({
		requestCache,
		metaCache,
		removeCache: isCacheStale(requestCacheName, cacheVersion),
		removeCacheEntry: isCacheEntryStale({ maxCacheAge }),
	});

	return { requestCache, metaCache, initialCacheClean };
}

export type InitializedRequestCaches = Awaited<ReturnType<typeof initializeRequestCache>>;

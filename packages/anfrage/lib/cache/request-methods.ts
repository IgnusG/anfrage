import { CacheCompatibleQuery } from "../types";
import { serializeMeta } from "./cache-initialize";

export interface RequestMethods {
	getCachedResponse: (request: Request, options: RequestInit) => Promise<Response | undefined>;
	fetchAndCacheResponse: (request: Request, options: RequestInit) => Promise<Response>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	parseResponse: (response: Response, options: RequestInit) => Promise<any>;
	purgeCache: (request: Request, options: RequestInit) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CreateRequestMethodsParams<Query extends CacheCompatibleQuery<any, any>> {
	initialCacheClean: Promise<unknown>;
	requestCache: Cache;
	metaCache: Cache;
	query: Query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRequestMethods<Query extends CacheCompatibleQuery<any, any>>({
	initialCacheClean,
	requestCache,
	metaCache,
	query,
}: CreateRequestMethodsParams<Query>) {
	const requestLocks = new Map<string, Promise<void>>();

	async function lockRequest(request: Request) {
		await Promise.all([initialCacheClean, requestLocks.get(request.url)]);

		let completeOperation: () => void;

		const operationPromise = new Promise<void>((resolve) => {
			completeOperation = resolve;
		});

		requestLocks.set(request.url, operationPromise);

		return function release() {
			completeOperation();
		};
	}

	const getCachedResponse: RequestMethods["getCachedResponse"] = async (request, options) => {
		options.signal?.throwIfAborted();

		// Wait for any write operations to finish
		await requestLocks.get(request.url);

		const result = await requestCache.match(request);

		options.signal?.throwIfAborted();

		return result;
	};

	const fetchAndCacheResponse: RequestMethods["fetchAndCacheResponse"] = async (
		request,
		options,
	) => {
		const response = await query.fetch(request, options);
		const cacheResponse = response.clone();

		lockRequest(request).then(async (release) => {
			const requestCacheUpdated = requestCache.put(request, cacheResponse);
			const metaCacheUpdated = metaCache.put(request, serializeMeta({ date: new Date() }));

			await Promise.all([requestCacheUpdated, metaCacheUpdated]);

			release();
		});

		return response;
	};

	const parseResponse: RequestMethods["parseResponse"] = async (response, options) => {
		options.signal?.throwIfAborted();

		const result = await query.parseResponse(response);

		options.signal?.throwIfAborted();

		return result;
	};

	const purgeCache: RequestMethods["purgeCache"] = async (request) => {
		lockRequest(request).then(async (release) => {
			const requestCacheDeleted = requestCache.delete(request);
			const metaCacheDeleted = metaCache.delete(request);

			await Promise.all([requestCacheDeleted, metaCacheDeleted]);

			release();
		});
	};

	return {
		getCachedResponse,
		fetchAndCacheResponse,
		parseResponse,
		purgeCache,
	};
}

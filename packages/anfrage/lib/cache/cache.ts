import { CacheCompatibleQuery } from "../types";
import { InitializedRequestCaches, isFresh, parseMeta } from "./cache-initialize";
import { createRequestMethods } from "./request-methods";

export type CacheMethod = "swr" | "no-cache-reload" | "no-cache" | "cache-first";

export interface CacheRequestOptions {
	cacheMethod?: CacheMethod;
	maxCacheAge?: number;
	signal?: AbortSignal;
}

export interface CacheWrapper<K> {
	onResponsePromise: (
		updateResponse: (response: Promise<K>, info: Promise<{ stale: boolean }>) => void,
	) => Promise<void>;
}

export interface CachedQuery<T, R> {
	(parameters: T, options?: CacheRequestOptions & RequestInit): CacheWrapper<R>;
}

export type CreateRequestCacheOptions = Omit<InitializedRequestCaches, "initialCacheClean"> &
	Partial<Pick<InitializedRequestCaches, "initialCacheClean">>;

export async function createRequestCache({
	metaCache,
	requestCache,
	initialCacheClean = Promise.resolve(),
}: CreateRequestCacheOptions) {
	function cache<T, K>(query: CacheCompatibleQuery<T, K>, cacheOptions?: CacheRequestOptions) {
		type Result = void extends K ? unknown : K;

		const { fetchAndCacheResponse, getCachedResponse, parseResponse, purgeCache } =
			createRequestMethods({
				query,
				metaCache,
				requestCache,
				initialCacheClean,
			});

		const createGenerator = async function* (
			parameters: T,
			requestOptionsWithCacheOptions?: CacheRequestOptions & RequestInit,
		): AsyncGenerator<Result, Result, never | undefined> {
			const {
				cacheMethod = "no-cache",
				maxCacheAge,
				...options
			} = {
				...cacheOptions,
				...requestOptionsWithCacheOptions,
			};

			const request = query.createRequest(parameters, options);

			switch (cacheMethod) {
				// Fetch resouce without cache - Do not update cache
				case "no-cache": {
					return await query(parameters, options);
				}
				// Fetch resource without cache - Update cache
				case "no-cache-reload": {
					const response = await fetchAndCacheResponse(request, options);

					try {
						return await parseResponse(response, options);
					} catch (error) {
						purgeCache(request, options);

						throw error;
					}
				}
				// Check cache first, request after - Update cache
				case "cache-first": {
					const cached = await getCachedResponse(request, options);

					if (cached) {
						try {
							const metaResponse = await metaCache.match(request);
							const meta = await parseMeta(metaResponse);

							if (isFresh(meta, { maxCacheAge })) {
								return await parseResponse(cached, options);
							}
							// eslint-disable-next-line no-empty
						} catch (error) {}
					}

					const response = await fetchAndCacheResponse(request, options);

					try {
						return await parseResponse(response, options);
					} catch (error) {
						purgeCache(request, options);

						throw error;
					}
				}
				// Yield cache result first, fetch fresh after - Update cache
				case "swr": {
					const responsePromise = fetchAndCacheResponse(request, options);
					const cached = await getCachedResponse(request, options);

					if (cached) {
						try {
							yield await parseResponse(cached, options);
							// eslint-disable-next-line no-empty
						} catch (error) {}
					}

					const response = await responsePromise;

					try {
						return await parseResponse(response, options);
					} catch (error) {
						purgeCache(request, options);

						throw error;
					}
				}
			}
		};

		/**
		 * Returns the:
		 * - `onResponse` handler which calls the callback function with the response:
		 * 	- Twice for the stale-while-revalidate ("swr") cache method
		 * 	- Once for all the other cache methods
		 */
		const cachedQuery: CachedQuery<T, Result> = (parameters, options?): CacheWrapper<Result> => {
			const generator = createGenerator(parameters, options);

			const onResponsePromise: CacheWrapper<Result>["onResponsePromise"] = async (
				updateResponse,
			) => {
				await new Promise<void>((resolve, reject) => {
					const initial = generator.next().then((result) => {
						if (!result.done) {
							generator
								.next()
								.then((revalidated) => {
									updateResponse(
										Promise.resolve(revalidated.value),
										Promise.resolve({ stale: false }),
									);
									resolve();
								})
								.catch(reject);
						} else {
							resolve();
						}

						return result;
					});

					const valuePromise = initial.then(({ value }) => value);
					const infoPromise = initial.then(({ done }) => ({ stale: !done }));

					updateResponse(valuePromise, infoPromise);
					initial.catch(reject);
				});
			};

			return { onResponsePromise };
		};

		return cachedQuery;
	}

	return { cache };
}

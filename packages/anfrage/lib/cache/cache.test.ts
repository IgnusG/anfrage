import { afterEach, describe, expect, test, vi } from "vitest";

import { initializeRequestCache } from "~/lib/cache/cache-initialize";
import { CacheCompatibleQuery } from "~/lib/types";
import { caches } from "~/test/cache-mock";
import { getImmediatePromiseValue } from "~/test/promises";
import { SpyRecord, unwrapSpy } from "~/test/spy-record";

import { CachedQuery, CacheMethod, CacheRequestOptions, createRequestCache } from "./cache";

vi.stubGlobal("caches", caches);

describe(createRequestCache.name, () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	/** Explains how a cache compatible query should be structured */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function createQueryStub<Params extends Record<any, any>>() {
		/**
		 * Each query should be specified as an arrow function assigned to a constant typed as
		 *
		 * `const query: CacheCompatibleQuery<RequestParameters, Promise<RequestResponse>> = ...`
		 */
		const query: SpyRecord<CacheCompatibleQuery<Params, string>> = async (params, options) => {
			const request = query.createRequest(params, options);
			const response = await query.fetch(request);

			return await query.parseResponse(response);
		};

		// There are 3 methods that must be attached to the query
		// They allow the cache to call them individually and in different order depending on the cache method's requirements

		// `createRequest` accepts the parameters and must return a Request object
		query.createRequest = vi.fn((params) => {
			const options = { method: "POST", body: JSON.stringify(params) };

			return new Request(new URL("http://test.url"), options);
		});

		// `fetch` accepts the above created Request and should call `fetch` and then return the Response
		query.fetch = vi.fn(async (request) => {
			const number = query.fetch.mock.calls.length;

			return new Response(JSON.stringify(`request ${(request as Request).body} ${number}`));
		});

		// `parseResponse` accepts the above fetched Response and either just calls `.json()` on it or performs additional data validation (eg. zod, yup etc.)
		query.parseResponse = vi.fn(async (response) => response.json());

		return query;
	}

	/** This helper just collects all the responses in one array - in practice you want to use them as they come in */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async function collectAllResults<T, R>(
		cachedQuery: CachedQuery<T, R>,
		parameters: T,
		options: CacheRequestOptions,
	): Promise<R[]> {
		// This cached query can be called in place of the original query
		const { onResponsePromise } = cachedQuery(parameters, options);
		const results: R[] = [];

		// Results are returned through a callback because there can be multiple of them (swr)
		await onResponsePromise(async (result) => {
			// The result is still a promise that is not yet resolved - you can either await it before using it or you can make use of React.Suspense etc.
			results.push(await result);
		});

		return results;
	}

	test.each(["cache-first", "no-cache", "no-cache-reload", "swr"] as CacheMethod[])(
		"'%s' - fetches the query and returns the result on empty cache",
		async (cacheMethod) => {
			const query = createQueryStub<{ cacheMethod: string }>();

			// First we need to initialize (& clean) the 2 used caches - you would preferably do this just once (in a service or root of your project)
			const caches = await initializeRequestCache({ cacheVersion: "v1" });
			const { cache } = await createRequestCache(caches);
			// We then wrap our original query with `cache` which will return a cached query - same as above (service or root)
			const cachedQuery = cache(unwrapSpy(query));

			const results = await collectAllResults(cachedQuery, { cacheMethod }, { cacheMethod });

			expect(results).toEqual([`request ${JSON.stringify({ cacheMethod })} 1`]);
			expect(query.fetch).toHaveBeenCalledTimes(1);
		},
	);

	test.each(["cache-first", "no-cache", "no-cache-reload", "swr"] as CacheMethod[])(
		"'%s' - immediately returns a promise before a result is available (undefined=default)",
		async (cacheMethod) => {
			const query = createQueryStub<{ cacheMethod: string }>();

			const caches = await initializeRequestCache({ cacheVersion: "v1" });
			const { cache } = await createRequestCache(caches);
			const cachedQuery = cache(unwrapSpy(query));

			const { onResponsePromise } = cachedQuery({ cacheMethod }, { cacheMethod });

			let resultPromise: Promise<string> | undefined;
			const resolved = onResponsePromise(async (result) => {
				resultPromise = result;
			});

			// Promise is immediately available
			expect(resultPromise).not.toBeUndefined();

			// But it's not ready yet
			await expect(
				getImmediatePromiseValue(resultPromise as Promise<string>),
			).resolves.toBeUndefined();

			await resolved;

			await expect(resultPromise as Promise<string>).resolves.toBe(
				`request ${JSON.stringify({ cacheMethod })} 1`,
			);
		},
	);

	test.each(["no-cache", "no-cache-reload", undefined] as (CacheMethod | undefined)[])(
		"'%s' - does not return results from the cache (undefined=default)",
		async (cacheMethod) => {
			const query = createQueryStub<{ cacheMethod: string; kind: string }>();

			const caches = await initializeRequestCache({ cacheVersion: "v1" });
			const { cache } = await createRequestCache(caches);
			const cachedQuery = cache(unwrapSpy(query));

			// First we make a request to store a result in cache
			const cacheStoreParams = { cacheMethod: `${cacheMethod}`, kind: "cache store" };
			const cacheStoreResults = await collectAllResults(cachedQuery, cacheStoreParams, {
				cacheMethod: "cache-first",
			});

			// We make the same request again to check if we get the result from the cache or a new one
			const freshParams = { cacheMethod: `${cacheMethod}`, kind: "fresh" };
			const freshResults = await collectAllResults(cachedQuery, freshParams, { cacheMethod });

			expect(freshResults).not.toEqual(cacheStoreResults);
			expect(query.fetch).toHaveBeenCalledTimes(2);
		},
	);

	test.each(["no-cache", undefined] as (CacheMethod | undefined)[])(
		"'%s' - does not store the result in the cache after fetch (undefined=default)",
		async (cacheMethod) => {
			const query = createQueryStub<{ cacheMethod: string; kind: string }>();

			const caches = await initializeRequestCache({ cacheVersion: "v1" });
			const { cache } = await createRequestCache(caches);
			const cachedQuery = cache(unwrapSpy(query));

			// First we make a request to see if it gets stored in the cache
			const freshParams = { cacheMethod: `${cacheMethod}`, kind: "fresh" };
			const freshResults = await collectAllResults(cachedQuery, freshParams, { cacheMethod });

			// We make a cache-first request to check if a response has been stored in the cache
			const cacheParams = { cacheMethod: `${cacheMethod}`, kind: "cache" };
			const cacheResults = await collectAllResults(cachedQuery, cacheParams, {
				cacheMethod: "cache-first",
			});

			expect(cacheResults).not.toEqual(freshResults);
			expect(query.fetch).toHaveBeenCalledTimes(2);
		},
	);

	test.each(["cache-first", "no-cache-reload", "swr"] as (CacheMethod | undefined)[])(
		"'%s' - stores the result of the fetch in cache",
		async (cacheMethod) => {
			const query = createQueryStub<{ cacheMethod: string; kind: string }>();

			const caches = await initializeRequestCache({ cacheVersion: "v1" });
			const { cache } = await createRequestCache(caches);
			const cachedQuery = cache(unwrapSpy(query));

			// First we make a request to see if it gets stored in the cache
			const freshParams = { cacheMethod: `${cacheMethod}`, kind: "fresh" };
			const freshResults = await collectAllResults(cachedQuery, freshParams, { cacheMethod });

			// We make a cache-first request to check if a response has been stored in the cache
			const cacheParams = { cacheMethod: `${cacheMethod}`, kind: "cache" };
			const cacheResults = await collectAllResults(cachedQuery, cacheParams, {
				cacheMethod: "cache-first",
			});

			expect(cacheResults).toEqual(freshResults);
			expect(query.fetch).toHaveBeenCalledTimes(1);
		},
	);

	test("'cache-first' - returns the result from cache if available", async () => {
		const query = createQueryStub<{ kind: string }>();

		const caches = await initializeRequestCache({ cacheVersion: "v1" });
		const { cache } = await createRequestCache(caches);
		const cachedQuery = cache(unwrapSpy(query));

		// First we make a request to store a result in cache
		const cacheStoreParams = { kind: "cache store" };
		const cacheStoreResults = await collectAllResults(cachedQuery, cacheStoreParams, {
			cacheMethod: "cache-first",
		});

		// We make the same request again to check if we get the result from the cache or a new one
		const cachedParams = { kind: "fresh" };
		const cachedResults = await collectAllResults(cachedQuery, cachedParams, {
			cacheMethod: "cache-first",
		});

		expect(cachedResults).toEqual(cacheStoreResults);
		expect(query.fetch).toHaveBeenCalledTimes(1);
	});

	test.todo(
		"'cache-first' - checks if result is still fresh otherwise fetches & returns a fresh one",
	);

	test.todo(
		"'cache-first' - checks if result is still fresh otherwise fetches & updates the stale cache entry",
	);

	test.todo(
		"'cache-first' - deals with the meta information missing for a cache hit (3rd party action)",
	);

	test.todo("'swr' - deals with the meta information missing for a cache hit (3rd party action)");

	test.todo("'no-cache-reload' - deletes the cache entry if parsing fails (corrupted)");
	test.todo("'cache-first' - deletes the cache entry if parsing fails (corrupted)");
	test.todo("'swr' - deletes the cache entry if parsing fails (corrupted)");

	test("'swr' - returns the result from cache if available (stale) and then returns the fresh response (while-revalidate)", async () => {
		const query = createQueryStub<{ kind: string }>();

		const caches = await initializeRequestCache({ cacheVersion: "v1" });
		const { cache } = await createRequestCache(caches);
		const cachedQuery = cache(unwrapSpy(query));

		// First we make a request to store a result in cache
		const cacheStoreParams = { kind: "cache store" };
		const cacheStoreResults = await collectAllResults(cachedQuery, cacheStoreParams, {
			cacheMethod: "cache-first",
		});

		// We make the same request again to get the cached result and a revalidated result
		const swrParams = { kind: "swr" };
		const swrResults = await collectAllResults(cachedQuery, swrParams, { cacheMethod: "swr" });

		expect(swrResults).toEqual([
			...cacheStoreResults,
			`request ${JSON.stringify({ kind: "swr" })} 2`,
		]);

		expect(query.fetch).toHaveBeenCalledTimes(2);
	});

	test.todo(
		"'swr' - returns the second value wrapped in a resolved promise only after it's available - so as to not interrupt UI showing the first stale result",
	);

	test("creates a new cache if the cache version changes", async () => {
		const query = createQueryStub<{ kind: string }>();

		const v1Caches = await initializeRequestCache({ cacheVersion: "v1" });
		const { cache: v1Cache } = await createRequestCache(v1Caches);
		const v1CachedQuery = v1Cache(unwrapSpy(query));

		// First we make a request to store a result in cache
		const v1CacheStoreParams = { kind: "cache store v1" };
		const v1CacheStoreResults = await collectAllResults(v1CachedQuery, v1CacheStoreParams, {
			cacheMethod: "cache-first",
		});

		// We then create a second version of the cache
		const v2Caches = await initializeRequestCache({ cacheVersion: "v2" });
		const { cache: v2Cache } = await createRequestCache(v2Caches);
		const v2CachedQuery = v2Cache(unwrapSpy(query));

		// We make another request this time to see if we get the result from the v1 cache or a fresh one
		const v2CacheStoreParams = { kind: "cache store v2" };
		const v2CacheStoreResults = await collectAllResults(v2CachedQuery, v2CacheStoreParams, {
			cacheMethod: "cache-first",
		});

		expect(v1CacheStoreResults).not.toEqual(v2CacheStoreResults);
		expect(query.fetch).toHaveBeenCalledTimes(2);
	});

	test("cleans up old versions of the cache if the version changes", async () => {
		const query = createQueryStub<{ kind: string }>();

		const v1_1Caches = await initializeRequestCache({ cacheVersion: "v1" });
		const { cache: v1_1Cache } = await createRequestCache(v1_1Caches);
		const v1_1CachedQuery = v1_1Cache(unwrapSpy(query));

		const v1CacheStoreParams = { kind: "cache store v1" };

		// First we make a request to store a result in cache
		const v1_1CacheStoreResults = await collectAllResults(v1_1CachedQuery, v1CacheStoreParams, {
			cacheMethod: "cache-first",
		});

		// Wrap in block for garbage collector
		{
			// We then create a second version of the cache - we just have to create it for the cleanup to run
			const v2Caches = await initializeRequestCache({ cacheVersion: "v2" });
			const { cache: v2Cache } = await createRequestCache(v2Caches);

			v2Cache(unwrapSpy(query));
		}

		const v1_2Caches = await initializeRequestCache({ cacheVersion: "v1" });
		const { cache: v1_2Cache } = await createRequestCache(v1_2Caches);
		const v1_2CachedQuery = v1_2Cache(unwrapSpy(query));

		// First we make a request to store a result in cache
		const v1_2CacheStoreResults = await collectAllResults(v1_2CachedQuery, v1CacheStoreParams, {
			cacheMethod: "cache-first",
		});

		expect(v1_1CacheStoreResults).not.toEqual(v1_2CacheStoreResults);
		expect(query.fetch).toHaveBeenCalledTimes(2);
	});

	test("allows creating separate caches with different prefixes if needed (to avoid conflicts)", async () => {
		const query = createQueryStub<{ kind: string }>();

		const customCaches = await initializeRequestCache({
			cacheNamePrefix: "custom",
			cacheVersion: "v1",
		});
		const { cache: customCache } = await createRequestCache(customCaches);
		const customCachedQuery = customCache(unwrapSpy(query));

		const cacheStoreParams = { kind: "cache store v1" };

		// We make a request to the v1 `custom` cache first
		const customCacheStoreResults = await collectAllResults(customCachedQuery, cacheStoreParams, {
			cacheMethod: "cache-first",
		});

		const otherCaches = await initializeRequestCache({
			cacheNamePrefix: "other",
			cacheVersion: "v1",
		});
		const { cache: otherCache } = await createRequestCache(otherCaches);
		const otherCachedQuery = otherCache(unwrapSpy(query));

		// Then we make another request this time to the v1 `other` cache
		const otherCacheStoreResults = await collectAllResults(otherCachedQuery, cacheStoreParams, {
			cacheMethod: "cache-first",
		});

		expect(customCacheStoreResults).not.toEqual(otherCacheStoreResults);
		expect(query.fetch).toHaveBeenCalledTimes(2);
	});

	test.todo("cleans up request cache entries which have no corresponding meta information");
	test.todo("cleans up meta cache entries which have no corresponding request information");
	test.todo("cleans up entries which exceed the max age passed to the cache");
});

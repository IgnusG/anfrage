import { vi } from "vitest";

// NodeJS doesn't support Cache
export class CacheMock implements Cache {
	cache = new Map<string, { request: Request; response: undefined | Response }>();

	key: string;
	deleted = false;

	constructor(cacheKey: string) {
		this.key = cacheKey;
	}

	async add(request: Request): Promise<void> {
		this.cache.set(request.url, { request, response: undefined });
	}

	async delete(request: Request): Promise<boolean> {
		return this.cache.delete(request.url);
	}

	async keys(): Promise<Request[]> {
		return [...this.cache.values()].map(({ request }) => request);
	}

	async match(request: Request): Promise<Response | undefined> {
		return this.cache.get(request.url)?.response?.clone();
	}

	async put(request: Request, response: Response): Promise<void> {
		this.cache.set(request.url, { request, response });
	}

	addAll(): Promise<void> {
		throw new Error("Method not implemented.");
	}
	matchAll(): Promise<readonly Response[]> {
		throw new Error("Method not implemented.");
	}
}

// Using vite mock functions for automatic restoration of mocks between tests
const mockCache = vi.fn((cacheName: string) => new CacheMock(cacheName));

// NodeJS does not support CacheStorage either
export const caches: CacheStorage = {
	open: async (cacheName) => {
		const existingCache = mockCache.mock.results.find(
			({ value: instance }) => !instance.deleted && instance.key === cacheName,
		);

		if (existingCache) return existingCache.value;

		return new mockCache(cacheName);
	},
	delete: async (cacheName) => {
		const existingCache = mockCache.mock.results.find(
			({ value: instance }) => instance.key === cacheName,
		);

		if (!existingCache) return false;

		existingCache.value.deleted = true;

		return true;
	},
	has: async (_) => false,
	keys: async () => {
		return mockCache.mock.results.flatMap(({ value: instance }) =>
			instance.deleted ? [] : [instance.key],
		);
	},
	match: async (_) => undefined,
};

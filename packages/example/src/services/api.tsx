import React from "react";

import { getWeather } from "~/src/data/weather/query";
import { CacheService } from "~/src/services/cache";

interface APIServiceDependencies {
	cacheService: CacheService;
}

export async function createAPIService({ cacheService }: APIServiceDependencies) {
	return {
		getWeather: cacheService.cache(getWeather),
	};
}

export type APIService = Awaited<ReturnType<typeof createAPIService>>;

export const APIServiceContext = React.createContext<APIService | null>(null);

export function APIServiceProvider(props: { service: APIService; children: React.ReactNode }) {
	return (
		<APIServiceContext.Provider value={props.service}>{props.children}</APIServiceContext.Provider>
	);
}

export function useAPIService() {
	const availableService = React.useContext(APIServiceContext);

	if (!availableService)
		throw new Error(
			"No API service available. Perhaps you forgot to wrap this component in <APIServiceProvider/>?",
		);

	return availableService;
}

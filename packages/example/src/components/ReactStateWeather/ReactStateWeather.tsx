import fetchState, { FetchState } from "@ignsg/anfrage/fetch-state";
import React from "react";

import { Weather } from "~/src/data/weather/type";
import { useAPIService } from "~/src/services/api";

export function ReactStateWeather() {
	const API = useAPIService();

	// Track the current weather in a simple React State
	const [weather, setWeather] = React.useState<FetchState<Weather>>(fetchState.initial());

	React.useEffect(() => {
		// We can use fetchState to denote what stage of the fetch process we are in (or don't - up to you)
		setWeather(fetchState.loading());

		// We call our API which had it's signature slightly altered for the cache support
		// It returns an object with onResponsePromise to "subscribe" to our data
		const { onResponsePromise: onWeatherPromise } = API.getWeather(
			{ city: "Amsterdam" },
			// It accepts additional cache options
			{ cacheMethod: "cache-first" },
		);

		// We pass a callback to it which will get our response wrapped in a Promise
		// Callbacks are used because some cacheMethods such as "swr" can return multiple results
		// The cache methods themselves decide when they give or promise you the data so you don't have to worry about it
		onWeatherPromise(async (weatherPromise) => {
			// We wait for it (it resolves when fetch/cache has completed)
			const weather = await weatherPromise;

			// And we set the state to the response wrapped in a fetchStatus
			setWeather(fetchState.success(weather));
			// onResponsePromise returns a Promise<void> which will reject if anything goes wrong
		}).catch((error: Error) => {
			// You can use this to centralize error handling
			setWeather(fetchState.failure(error));
		});
		// Or to await until the request has completed entirely
	}, []);

	return (
		<React.Fragment>
			{/* You can check which fetchState the weather state is in and render its value */}
			{fetchState.isSuccess(weather) && <div>Amsterdam: {weather.result.temperature}</div>}
			{fetchState.isLoading(weather) && <div>Loading weather...</div>}
			{fetchState.isFailure(weather) && <div>Something weather wrong...</div>}
		</React.Fragment>
	);
}

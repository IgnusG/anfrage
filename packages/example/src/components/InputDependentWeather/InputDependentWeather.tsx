import fetchState, { FetchState } from "@ignsg/anfrage/fetch-state";
import React from "react";

import { Weather } from "~/src/data/weather/type";
import { useAPIService } from "~/src/services/api";

function useCycleCities(cities: string[]) {
	const [cityIndex, setCityIndex] = React.useState(0);
	const city = React.useMemo(() => cities[cityIndex], [cityIndex]);

	React.useEffect(() => {
		const cycleCityIndices = setInterval(() => {
			setCityIndex((previous) => (previous + 1) % cities.length);
		}, 1000);

		return () => {
			clearInterval(cycleCityIndices);
		};
	}, []);

	return city;
}

const CITIES = ["Amsterdam", "Paris", "Munich", "Krakow", "Barcelona"];

export function InputDependentWeather() {
	const API = useAPIService();

	const city = useCycleCities(CITIES);
	const [weather, setWeather] = React.useState<FetchState<Weather>>(fetchState.initial());

	// If your query depends on an input - like eg. this one does on city
	React.useEffect(() => {
		// Delay the loading state to avoid flicker - just an example of what you can do
		const triggerLoading = setTimeout(() => {
			setWeather(fetchState.loading());
		}, 100);

		// We need to make sure to abort previous queries before making a new one
		// To do that just create a regular AbortController
		const control = new AbortController();

		const { onResponsePromise: onWeatherPromise } = API.getWeather(
			{ city },
			// And pass its signal to the query like you would for a normal fetch
			// The cache will also listen to this signal and would abort if the signal aborts
			{ cacheMethod: "cache-first", signal: control.signal },
		);

		// Remember that onWeatherPromise can call multiple times so just because you have a successful result doesn't mean more results won't be provided later
		// This is why we would need to abort the query even when we already received the first value
		onWeatherPromise(async (weatherPromise) => {
			const weather = await weatherPromise;

			// The first result could be stale and revalidation can be happening in the background
			setWeather(fetchState.success(weather));
		})
			.then(() => {
				// Don't forget to clear the timeout if the query is faster
				clearTimeout(triggerLoading);
			})
			.catch((error: Error) => {
				setWeather(fetchState.failure(error));
			});

		// We make use of React's useEffect cleanup functions to finally abort the query before we make a new one
		return () => control.abort();
	}, [city]);

	return (
		<React.Fragment>
			{fetchState.isSuccess(weather) && (
				<div>
					{city}: {weather.result.temperature}
				</div>
			)}

			{fetchState.isLoading(weather) && <div>Loading weather...</div>}
			{fetchState.isFailure(weather) && <div>Something weather wrong...</div>}
		</React.Fragment>
	);
}

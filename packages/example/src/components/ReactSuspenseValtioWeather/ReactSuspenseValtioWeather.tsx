import fetchState, { Initial, Success } from "@ignsg/anfrage/fetch-state";
import React from "react";
import { useErrorHandler } from "react-error-boundary";
import { proxy, useSnapshot } from "valtio";

import { Weather } from "~/src/data/weather/type";
import { useAPIService } from "~/src/services/api";

interface WeatherState {
	// We can make use of the fetchState wrapper to handle data availability
	// You could also mark this as optional (or undefined or provide default data below) if you prefer
	weather: Initial | Success<Weather> | Promise<Success<Weather>>;
	// We don't use loading and failure from fetchState since we delegate that to parent components through Suspense and ErrorBoundaries
}

// We prepare our component state as a Valtio proxy - along with the default initial data
const weatherState = proxy<WeatherState>({ weather: fetchState.initial() });

// These methods are just helpers
const weatherStateMutations = {
	updateWeather: (nextWeatherPromise: Promise<Weather>) => {
		// We want our weather state to stay a promise so Valtio can suspend until it resolves
		weatherState.weather = fetchState.success(nextWeatherPromise);
	},
};

export function ReactSuspenseValtioWeather() {
	const API = useAPIService();

	// The weatherSnap no longer contains promises - otherwise the component would have suspended
	const weatherSnap = useSnapshot(weatherState);
	const handleError = useErrorHandler();

	React.useEffect(() => {
		// Call our API
		const { onResponsePromise: onWeatherPromise } = API.getWeather(
			{ city: "Amsterdam" },
			{ cacheMethod: "cache-first" },
		);

		// And provide the callback to collect our results
		// Valtio will suspend while our query is being resolved so the loading state can be handled by a parent component
		// We also make use of React ErrorBoundaries to move the responsiblity of error handling out of the component as well
		onWeatherPromise(weatherStateMutations.updateWeather).catch(handleError);
		// You can do both, either one or just go with the simpler ReactStateWeather example
	}, []);

	// Our state will not be initiated on the first render - React still has to call useEffect
	// Depending on where you want to call the API method you might have different requirements
	if (fetchState.isInitial(weatherSnap.weather)) return null;

	return <div>Amsterdam: {weatherSnap.weather.result.temperature}</div>;
}

// These helpers just co-locate this component's UI for loading and error handling
// You might want to move Suspense or ErrorBoundary higher up the tree in which case you probs wouldn't use this way "pattern"
ReactSuspenseValtioWeather.Loading = () => {
	return <div>Loading...</div>;
};

ReactSuspenseValtioWeather.Failed = ({ error }: { error: Error }) => {
	return <div>Something went wrong: {error.message}</div>;
};

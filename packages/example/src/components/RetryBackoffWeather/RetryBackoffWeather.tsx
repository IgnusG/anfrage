import { createBackoff } from "@ignsg/anfrage/backoff";
import fetchState, { FetchState } from "@ignsg/anfrage/fetch-state";
import { retry } from "@ignsg/anfrage/retry";
import React from "react";

import { Weather } from "~/src/data/weather/type";
import { useAPIService } from "~/src/services/api";

export function RetryBackoffWeather() {
	const API = useAPIService();

	const [weather, setWeather] = React.useState<FetchState<Weather>>(fetchState.initial());

	React.useEffect(() => {
		setWeather(fetchState.loading());

		// Create a backoff function - you can either use a constant function (return 300) or make use of the arguments passed to the callback to create linear, square, quadratic etc. functions
		const squareBackoff = createBackoff((previousTime) => (previousTime ? previousTime * 2 : 300));

		// Retry is the outermost function which will call its child function in a loop until the retry conditions are met (or the child doesn't throw)
		retry(
			// The backoff function will wait the calculated backoff time after its child fails before it allows it to be invoked again
			squareBackoff(async () => {
				const { onResponsePromise: onWeatherPromise } = API.getWeather(
					{ city: "Amsterdam" },
					{ cacheMethod: "cache-first" },
				);

				await onWeatherPromise(async (weatherPromise) => {
					const weather = await weatherPromise;

					setWeather(fetchState.success(weather));
				});
			}),
			// Options for the retry - retry will automatically throw for certain errors (like the AbortError) - you can adjust this if you wish
			{ maxRetries: 3 },
			// Retry returns a void Promise that rejects with the last thrown error when retry conditions are met (retry gives up)
		).catch((error: Error) => {
			setWeather(fetchState.failure(error));
		});
	}, []);

	return (
		<React.Fragment>
			{fetchState.isSuccess(weather) && <div>Amsterdam: {weather.result.temperature}</div>}
			{fetchState.isLoading(weather) && <div>Loading weather...</div>}
			{fetchState.isFailure(weather) && <div>Something weather wrong...</div>}
		</React.Fragment>
	);
}

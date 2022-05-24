import { Query } from "~/src/data/types";

import { Weather } from "./type";

const BASE_URL = "https://goweather.herokuapp.com";

export interface WeatherAPIParameters {
	city: string;
}

export type WeatherAPIResponse = Weather;

export const getWeather: Query<WeatherAPIParameters, WeatherAPIResponse> = async (
	parameters,
	options = {},
) => {
	const request = getWeather.createRequest(parameters, options);
	const response = await getWeather.fetch(request);

	return getWeather.parseResponse(response);
};

getWeather.createRequest = (parameters, options) => {
	const url = new URL(BASE_URL);

	url.pathname = `weather/${parameters.city}`;

	return new Request(url.toString(), options);
};

getWeather.fetch = (...args) => fetch(...args);
getWeather.parseResponse = async (response) => Weather.parse(await response.json());

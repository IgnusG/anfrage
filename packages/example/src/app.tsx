import React from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";

import { InputDependentWeather } from "~/src/components/InputDependentWeather/InputDependentWeather";
import { ReactStateWeather } from "~/src/components/ReactStateWeather";
import { ReactSuspenseValtioWeather } from "~/src/components/ReactSuspenseValtioWeather/index";
import { RetryBackoffWeather } from "~/src/components/RetryBackoffWeather/RetryBackoffWeather";
import { APIServiceProvider, createAPIService } from "~/src/services/api";
import { createCacheService } from "~/src/services/cache";

const cacheService = await createCacheService();
const apiService = await createAPIService({ cacheService });

const container = document.getElementById("app");

if (!container) {
	throw new Error("The app cannot start since #app container is missing");
}

const root = createRoot(container);

function App() {
	return (
		<React.Fragment>
			<APIServiceProvider service={apiService}>
				{/* Simple self-contained React State based component with client-cached data fetching */}
				<ReactStateWeather />
				{/* Component that re-runs the query when its inputs change */}
				<InputDependentWeather />
				{/* Component that retries the query with the provided backoff if it fails the first time */}
				<RetryBackoffWeather />
				{/* More advanced React Suspense and ErrorBoundary based component with library state management and client-cached data fetching */}
				<ErrorBoundary fallbackRender={ReactSuspenseValtioWeather.Failed}>
					<React.Suspense fallback={<ReactSuspenseValtioWeather.Loading />}>
						<ReactSuspenseValtioWeather />
					</React.Suspense>
				</ErrorBoundary>
			</APIServiceProvider>
		</React.Fragment>
	);
}

root.render(<App />);

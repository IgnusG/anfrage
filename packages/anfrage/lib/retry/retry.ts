import { matchError } from "./match-error";

export const ABORT_ERROR = new DOMException(undefined, "AbortError");

function retriesReached(retries: number, maxRetries: number | undefined) {
	if (maxRetries === undefined) return false;

	return retries >= maxRetries;
}

function durationReached(
	startedAt: number,
	failedAt: number | undefined,
	maxDuration: number | undefined,
) {
	if (failedAt === undefined || maxDuration === undefined) return false;

	return failedAt - startedAt >= maxDuration;
}

type RetryIfFailedOptions = {
	throwError?: (error: Error) => boolean;
};

type RetryIfFailedMaxTimes = {
	maxRetries: number;
	maxDuration?: RetryIfFailedMaxDuration["maxDuration"];
};

type RetryIfFailedMaxDuration = {
	maxRetries?: RetryIfFailedMaxTimes["maxRetries"];
	maxDuration: number;
};

export type RetryIfFailedParams = (RetryIfFailedMaxDuration | RetryIfFailedMaxTimes) &
	RetryIfFailedOptions;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function retry<Method extends () => any>(
	method: Method,
	options: RetryIfFailedParams,
): Promise<Awaited<ReturnType<Method>>> {
	let lastError: Error | undefined;

	const { maxRetries, maxDuration, throwError = matchError([ABORT_ERROR]) } = options;

	const startedAt = performance.now();
	let failedAt: number | undefined;

	let retries = 0;

	while (
		// Execute at least once
		lastError === undefined ||
		// Retry if there are still retries left
		!(retriesReached(retries, maxRetries) || durationReached(startedAt, failedAt, maxDuration))
	) {
		try {
			return await method();
		} catch (error) {
			if (throwError(error as Error)) throw error;

			failedAt = performance.now();
			lastError = error as Error;

			retries++;
		}
	}

	throw lastError;
}

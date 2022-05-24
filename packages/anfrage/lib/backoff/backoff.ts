export interface WaitForTime {
	(lastWaitTime: number | undefined, lastRuntime: number): number;
}

export function createBackoff(waitForTime: WaitForTime) {
	let lastStamp: number;
	let lastWaitTime: number;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return function backoff<Method extends () => any>(method: Method) {
		return async (): Promise<Awaited<ReturnType<Method>>> => {
			if (lastStamp) {
				const lastRuntime = performance.now() - lastStamp;

				lastWaitTime = waitForTime(lastWaitTime, lastRuntime);

				await new Promise((resolve) => setTimeout(resolve, lastWaitTime));
			}

			lastStamp = performance.now();

			return await method();
		};
	};
}

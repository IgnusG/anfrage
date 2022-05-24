import { vi } from "vitest";

/** Drains the macro and micro-task queues - all awaits with resolved promises continue */
export async function drainMacroTaskQueue() {
	const macroTaskQueueDrained = new Promise((resolve) => setTimeout(resolve, 0));

	// In case we use fake timers - triggers the above timeout of 0
	vi.advanceTimersByTime(0);

	await macroTaskQueueDrained;
}

/** Returns the value of the promise (if finished) without waiting for it - otherwise returns undefined */
export async function getImmediatePromiseValue<T>(promise: Promise<T>) {
	return await Promise.race([promise, Promise.resolve()]);
}

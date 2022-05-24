import { describe, expect, test, vi } from "vitest";

import { drainMacroTaskQueue, getImmediatePromiseValue } from "~/test/promises";

import { createBackoff } from ".";

describe(createBackoff.name, () => {
	test("runs the function immediately and returns the result if it doesn't fail", async () => {
		vi.useFakeTimers();

		const waitTimeInMs = 1000;
		const backoff = createBackoff(() => waitTimeInMs);

		const fn = vi.fn(() => {
			// Heavy computation
			return 2 ** 2;
		});

		const heavyComputation = backoff(fn);
		const resultPromise = heavyComputation();

		await drainMacroTaskQueue();

		// Check if heavyComputation already finished - it won't if the backoff timer is waiting
		const result = await getImmediatePromiseValue(resultPromise);

		expect(result).toBe(4);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("if function fails throws the error", async () => {
		vi.useFakeTimers();

		const waitTimeInMs = 1000;
		const backoff = createBackoff(() => waitTimeInMs);

		const fn = vi.fn(() => {
			if (fn.mock.calls.length === 1) throw new Error("Custom");

			// Heavy computation
			return 2 ** 2;
		});

		const heavyComputation = backoff(fn);

		expect(heavyComputation).rejects.toThrow(new Error("Custom"));
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("runs the function and if it throws waits before it runs it again on next invocation", async () => {
		vi.useFakeTimers();

		const waitTimeInMs = 1000;
		const backoff = createBackoff(() => waitTimeInMs);

		const fn = vi.fn(() => {
			if (fn.mock.calls.length === 1) throw new Error();

			// Heavy computation
			return 2 ** 2;
		});

		const heavyComputation = backoff(fn);

		// Ignore initial call's result - throws
		await heavyComputation().catch((): void => undefined);
		// Second call
		const resultPromise = heavyComputation();

		await drainMacroTaskQueue();
		// heavyComputation should still be waiting (pending) for the backoff timer
		const resultBeforeTimers = await getImmediatePromiseValue(resultPromise);

		vi.advanceTimersByTime(waitTimeInMs);

		await drainMacroTaskQueue();
		// heavyComputationit should have finished (resolved) returning a result by now
		const resultAfterTimers = await getImmediatePromiseValue(resultPromise);

		expect(resultBeforeTimers).toBeUndefined();
		expect(resultAfterTimers).toBe(4);

		expect(fn).toHaveBeenCalledTimes(2);
	});
});

import { afterEach, describe, expect, test, vi } from "vitest";

import { matchError, retry } from ".";

const performance = {
	now: vi.fn(() => 0),
};

vi.stubGlobal("performance", performance);

describe(retry.name, () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("runs the action just once if it doesn't fail", async () => {
		const fn = vi.fn(() => {
			return "Hello World!";
		});

		const result = await retry(fn, { maxRetries: 3 });

		expect(result).toBe("Hello World!");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("re-runs the function if it fails", async () => {
		const fn = vi.fn(() => {
			if (fn.mock.calls.length === 1) throw new Error("Failed");

			return "Hello World!";
		});

		const result = await retry(fn, { maxRetries: 3 });

		expect(result).toBe("Hello World!");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	test("re-runs the function up to maxRetries if it keeps failing", async () => {
		const maxRetries = 3;

		const fn = vi.fn(() => {
			throw new Error("Failed");
		});

		await expect(() => retry(fn, { maxRetries })).rejects.toThrow(new Error("Failed"));

		expect(fn).toHaveBeenCalledTimes(maxRetries);
	});

	test("re-runs the function up until maxDuration if it keeps failing", async () => {
		const fakeFunctionDuration = 400;
		const maxDuration = 1000;

		const expectedDurationRetries = Math.ceil(maxDuration / fakeFunctionDuration);

		let currentTimestamp = 0;

		const fn = vi.fn(async () => {
			currentTimestamp += fakeFunctionDuration;

			performance.now.mockImplementation(() => currentTimestamp); // Advance performance timer

			throw new Error("Failed");
		});

		await expect(() => retry(fn, { maxDuration })).rejects.toThrow(new Error("Failed"));

		// First run 400ms -> second 800ms -> third 1200ms > 1000ms
		expect(fn).toHaveBeenCalledTimes(expectedDurationRetries);
	});

	test("re-runs the function up until maxDuration and maxRetries (first) if it keeps failing", async () => {
		const fakeFunctionDuration = 400;

		const maxDuration = 1000;
		const maxRetries = 2;

		const expectedDurationRetries = Math.ceil(maxDuration / fakeFunctionDuration);

		let currentTimestamp = 0;

		const fn = vi.fn(async () => {
			currentTimestamp += fakeFunctionDuration;

			performance.now.mockImplementation(() => currentTimestamp); // Advance performance timer

			throw new Error("Failed");
		});

		// Sanity check
		expect(maxRetries).toBeLessThan(expectedDurationRetries);

		await expect(() => retry(fn, { maxDuration, maxRetries })).rejects.toThrow(new Error("Failed"));

		// First run 400ms -> second 800ms -> retries 2 >= maxRetries 2
		expect(fn).toHaveBeenCalledTimes(maxRetries);
	});

	test("re-runs the function up until maxDuration (first) and maxRetries if it keeps failing", async () => {
		const fakeFunctionDuration = 400;

		const maxDuration = 600;
		const maxRetries = 5;

		const expectedDurationRetries = Math.ceil(maxDuration / fakeFunctionDuration);

		let currentTimestamp = 0;

		const fn = vi.fn(async () => {
			currentTimestamp += fakeFunctionDuration;

			performance.now.mockImplementation(() => currentTimestamp); // Advance performance timer

			throw new Error("Failed");
		});

		// Sanity check
		expect(expectedDurationRetries).toBeLessThan(maxRetries);

		await expect(() => retry(fn, { maxDuration, maxRetries })).rejects.toThrow(new Error("Failed"));

		// First run 400ms -> second 800ms > 600ms
		expect(fn).toHaveBeenCalledTimes(expectedDurationRetries);
	});

	test("re-runs the function up until maxDuration and maxRetries (both reached) if it keeps failing", async () => {
		const fakeFunctionDuration = 400;

		const maxDuration = 600;
		const maxRetries = 2;

		const expectedDurationRetries = Math.ceil(maxDuration / fakeFunctionDuration);

		let currentTimestamp = 0;

		const fn = vi.fn(async () => {
			currentTimestamp += fakeFunctionDuration;

			performance.now.mockImplementation(() => currentTimestamp); // Advance performance timer

			throw new Error("Failed");
		});

		// Sanity check
		expect(maxRetries).toBe(expectedDurationRetries);

		await expect(() => retry(fn, { maxDuration, maxRetries })).rejects.toThrow(new Error("Failed"));

		// First run 400ms -> second 800ms > 600ms and retries 2 >= maxRetries 2
		expect(fn).toHaveBeenCalledTimes(maxRetries);
	});

	test("by default fails immediately when AbortError is thrown", async () => {
		const fn = vi.fn(() => {
			throw new DOMException(undefined, "AbortError"); // Same as what fetch throws when AbortController signal aborts
		});

		await expect(() => retry(fn, { maxRetries: 3 })).rejects.toThrow(
			new DOMException(undefined, "AbortError"),
		);

		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("allows customizing the matcher which decides when to abort the retries and throw instead", async () => {
		class CustomError extends Error {
			name = "CustomError";
		}

		const throwError = matchError([new CustomError()]);

		const fn = vi.fn(() => {
			throw new CustomError();
		});

		await expect(() => retry(fn, { maxRetries: 3, throwError })).rejects.toThrow(new CustomError());

		expect(fn).toHaveBeenCalledTimes(1);
	});

	test("allows disabling the matcher to prevent AbortError exiting until the defined limits are reached", async () => {
		const maxRetries = 3;
		const throwError = () => false;

		const fn = vi.fn(() => {
			throw new DOMException(undefined, "AbortError");
		});

		await expect(() => retry(fn, { maxRetries, throwError })).rejects.toThrow();

		expect(fn).toHaveBeenCalledTimes(maxRetries);
	});
});

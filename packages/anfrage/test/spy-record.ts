import { SpyInstanceFn } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SpyRecord<S extends Record<any, any>> = S & {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key in keyof S]: S[key] extends (...args: any[]) => any
		? SpyInstanceFn<Parameters<S[key]>, ReturnType<S[key]>>
		: S[key];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrapSpy<S extends SpyRecord<Record<any, any>>>(spy: S) {
	return spy as S extends SpyRecord<infer R> ? R : never;
}

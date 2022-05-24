const InitialSymbol = Symbol();

export interface Initial {
	readonly type: typeof InitialSymbol;
}

export function initial(): Initial {
	return { type: InitialSymbol };
}

const LoadingSymbol = Symbol();

export interface Loading {
	readonly type: typeof LoadingSymbol;
}

export function loading(): Loading {
	return { type: LoadingSymbol };
}

const SuccessSymbol = Symbol();

export interface Success<Value> {
	readonly type: typeof SuccessSymbol;
	result: Value;
	stale: boolean;
}

export interface SuccessInfo {
	stale: boolean;
}

export function success<Value>(result: Promise<Value>, info?: SuccessInfo): Promise<Success<Value>>;
export function success<Value>(result: Value, info?: SuccessInfo): Success<Value>;

export function success<Value>(
	result: Value | Promise<Value>,
	{ stale }: SuccessInfo = { stale: false },
): Success<Value> | Promise<Success<Value>> {
	if (result instanceof Promise) {
		return result.then((value) => success(value, { stale }));
	} else {
		return { type: SuccessSymbol, result, stale };
	}
}

const FailureSymbol = Symbol();

export interface Failure<ErrorType extends Error> {
	readonly type: typeof FailureSymbol;
	error: ErrorType;
}

export function failure<ErrorType extends Error>(error: ErrorType): Failure<ErrorType> {
	return { type: FailureSymbol, error };
}

export type FetchState<Value = unknown, ErrorType extends Error = Error> =
	| Initial
	| Loading
	| Success<Value>
	| Failure<ErrorType>;

export function isInitial(fetchState: FetchState): fetchState is Initial {
	return fetchState.type === InitialSymbol;
}

export function isLoading(fetchState: FetchState): fetchState is Loading {
	return fetchState.type === LoadingSymbol;
}

export function isSuccess<Value>(fetchState: FetchState<Value>): fetchState is Success<Value> {
	return fetchState.type === SuccessSymbol;
}

export function isFailure<ErrorType extends Error>(
	fetchState: FetchState<unknown, ErrorType>,
): fetchState is Failure<ErrorType> {
	return fetchState.type === FailureSymbol;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CacheCompatibleQuery<Parameters, QueryResponse = void> {
	(parameters: Parameters, options?: RequestInit): Promise<
		void extends QueryResponse ? unknown : QueryResponse
	>;
	createRequest: (parameters: Parameters, options?: RequestInit) => Request;
	fetch: typeof fetch;
	parseResponse: (response: Response) => Promise<QueryResponse>;
}

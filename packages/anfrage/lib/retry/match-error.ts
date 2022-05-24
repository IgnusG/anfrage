export function matchError(matchErrors: Error[]) {
	return (error: Error) => {
		return matchErrors.some((matchedError) => {
			if (error instanceof matchedError.constructor) {
				return error.name === matchedError.name;
			}

			return false;
		});
	};
}

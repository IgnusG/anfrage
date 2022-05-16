import { generateDtsBundle } from "dts-bundle-generator";
import { resolve } from "path";
import type { Plugin } from "vite";

export default function dts(): Plugin {
	return {
		name: "vite:dts",
		apply: "build",
		async configResolved(config) {
			const inputs = Object.entries(config.build.rollupOptions.input);

			const bundles = generateDtsBundle(
				inputs.map(([, entryPath]) => ({
					filePath: entryPath,
				})),
				{ preferredConfigPath: resolve("./tsconfig.json") },
			);

			this.generateBundle = function () {
				for (let index = 0; index < inputs.length; index++) {
					const [name] = inputs[index];
					const bundle = bundles[index];

					this.emitFile({
						type: "asset",
						fileName: `${name}.d.ts`,
						source: bundle,
					});
				}
			};
		},
	};
}

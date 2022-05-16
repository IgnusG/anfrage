import { parse } from "path";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { exports } from "./package.json";
import dts from "./vite/vite-dts";

export default defineConfig({
	plugins: [dts(), tsconfigPaths()],
	define: {
		"process.env.NODE_ENV": "process.env.NODE_ENV",
	},
	cacheDir: ".vite/cache",
	build: {
		lib: {
			entry: "lib",
			formats: ["es"],
			fileName: `[name].js`,
		},
		outDir: "dist",
		rollupOptions: {
			input: Object.fromEntries(
				Object.entries(exports).map(([, values]) => {
					const bundlePath = parse(values["import"]);

					return [`${bundlePath.name}`, values["#source"]];
				}),
			),
			// Make sure to externalize deps that shouldn't be bundled into your library
			external: [],
		},
	},
});

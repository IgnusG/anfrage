import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	base: "./",
	cacheDir: ".vite/cache",
	plugins: [react(), tsconfigPaths()],
});

import baseConfig from "@ignsg/anfrage-monorepo/.lintstagedrc.mjs";

export default {
	...baseConfig,
	"**/*.{ts,tsx}": [...(baseConfig["**/*.{ts,tsx}"] ?? []), "yarn test:related"],
};

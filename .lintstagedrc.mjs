export default {
	"**/*": ["prettier --write --ignore-unknown"],
	"**/*.{ts,tsx}": ["eslint --fix"],
};

import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

/**
 * Mirrors the checks the Obsidian community directory runs, so the scorecard
 * holds no surprises.
 *
 * Scope is the shipped plugin source. Everything under scripts/ and test/ is
 * Node tooling that never reaches a vault, so rules about Node built-ins and
 * console output would be judging it against the wrong target.
 */
export default tseslint.config(
	{
		ignores: [
			"main.js",
			"node_modules/",
			"test/",
			"scripts/",
			"*.mjs",
		],
	},
	...tseslint.configs.recommendedTypeChecked,
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			/*
			 * Reports the product name as "Taskloops" and tag literals such as
			 * "#task" as "#Task". Proper nouns and literals are not sentence
			 * case, so here it fires only on false positives.
			 */
			"obsidianmd/ui/sentence-case": "off",
		},
	}
);

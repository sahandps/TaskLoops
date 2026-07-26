import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

/**
 * Mirrors the checks the Obsidian community directory runs, so the scorecard
 * holds no surprises.
 *
 * The plugin source gets full type-aware linting plus the Obsidian rules. The
 * Node tooling under scripts/ and test/ is linted for syntax and obvious
 * mistakes only: it never ships to a vault, so the mobile-safety and console
 * rules would be judging it against the wrong target.
 */
export default tseslint.config(
	{
		ignores: ["main.js", "node_modules/", "test/.bundle.mjs"],
	},

	// --- the plugin ----------------------------------------------------------
	...tseslint.configs.recommendedTypeChecked,
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				project: ["./tsconfig.json"],
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
	},

	// --- build tooling and tests ---------------------------------------------
	{
		files: ["**/*.mjs"],
		extends: [tseslint.configs.disableTypeChecked],
		languageOptions: {
			parserOptions: { project: null, projectService: false },
			globals: { process: "readonly", console: "readonly" },
		},
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			"obsidianmd/rule-custom-message": "off",
			"no-unsanitized/method": "off",
			"no-undef": "off",
			/*
			 * The rule's fix is Vault#configDir, which only exists inside a
			 * running Obsidian. deploy.mjs is a shell script, so it takes
			 * OBSIDIAN_CONFIG_DIR instead and only defaults to ".obsidian".
			 */
			"obsidianmd/hardcoded-config-path": "off",
		},
	}
);

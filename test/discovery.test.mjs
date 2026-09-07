import { createSuite } from "./harness.mjs";

export default async function run(mod) {
	const { scanFile } = mod;
	const { eq, results } = createSuite("task discovery");

	const content = [
		"- [ ] Open checkbox",
		"- [x] Completed checkbox",
		"A tagged thought #task",
		"- An ordinary bullet",
	].join("\n");
	const cache = {
		listItems: [
			{ task: " ", position: { start: { line: 0 } } },
			{ task: "x", position: { start: { line: 1 } } },
			{ position: { start: { line: 3 } } },
		],
		tags: [{ tag: "#task", position: { start: { line: 2 } } }],
	};
	const app = {
		metadataCache: { getFileCache: () => cache },
		vault: { cachedRead: async () => content },
	};
	const file = { path: "Work.md" };

	const checkboxes = await scanFile(app, file, "#task", "checkboxes");
	eq(checkboxes.map((task) => task.text), ["Open checkbox", "Completed checkbox"], "checkbox mode finds native tasks");
	eq(checkboxes.map((task) => task.checked), [false, true], "checkbox state is preserved");

	const tagged = await scanFile(app, file, "#task", "tagged");
	eq(tagged.map((task) => task.text), ["A tagged thought"], "tag mode finds tagged lines only");

	const both = await scanFile(app, file, "#task", "both");
	eq(both.map((task) => task.text), ["Open checkbox", "Completed checkbox", "A tagged thought"], "combined mode merges without unrelated bullets");

	return results;
}

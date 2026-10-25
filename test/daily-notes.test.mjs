import { createSuite } from "./harness.mjs";

export default async function run({ DailyNotes, TestFile: TFile }) {
	const { eq, results } = createSuite("core Daily Notes integration");
	const files = new Map();
	const contents = new Map();
	const core = {
		enabled: true,
		instance: { options: { folder: "Journal", format: "YYYY/MM/DD", template: "Templates/Daily" } },
	};
	const makeFile = (path, content = "") => {
		const file = new TFile();
		file.path = path;
		files.set(path, file);
		contents.set(path, content);
		return file;
	};
	makeFile("Templates/Daily.md", "# {{date:dddd, YYYY-MM-DD}}\n{{title}}\n{{time:HH:mm}}");
	let creates = 0;
	const app = {
		internalPlugins: { getPluginById: () => core },
		vault: {
			getAbstractFileByPath: (path) => files.get(path),
			read: async (file) => contents.get(file.path),
			createFolder: async (path) => {
				files.set(path, {});
			},
			create: async (path, content) => {
				creates++;
				return makeFile(path, content);
			},
		},
	};
	const daily = new DailyNotes(() => app);
	eq(daily.enabled, true, "requires enabled core plugin");
	eq(daily.path("2026-10-25"), "Journal/2026/10/25.md", "core folder and nested filename format");
	eq(daily.exists("2026-10-25"), false, "no dot before note exists");
	await Promise.all([daily.ensure("2026-10-25"), daily.ensure("2026-10-25")]);
	eq(creates, 1, "concurrent creation creates only one note");
	eq(daily.exists("2026-10-25"), true, "dot after note creation");
	eq(
		contents.get("Journal/2026/10/25.md").startsWith("# Sunday, 2026-10-25\n25\n"),
		true,
		"template date is selected day",
	);
	contents.set("Journal/2026/10/25.md", "Existing writing");
	await daily.ensure("2026-10-25");
	eq(contents.get("Journal/2026/10/25.md"), "Existing writing", "existing note untouched");
	eq(creates, 1, "reuse existing note");
	eq(files.has("Journal/2026/10"), true, "nested daily folders created");
	core.instance.options.folder = "New Daily";
	eq(daily.path("2026-10-25"), "New Daily/2026/10/25.md", "uses changed core settings");
	core.enabled = false;
	let disabled = false;
	try {
		await daily.ensure("2026-10-26");
	} catch {
		disabled = true;
	}
	eq(disabled, true, "disabled core plugin prevents creation");
	eq(creates, 1, "disabled plugin never writes a note");
	return results;
}

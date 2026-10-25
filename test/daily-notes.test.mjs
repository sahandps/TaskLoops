import { createSuite } from "./harness.mjs";

export default async function run({ DailyNotes, TestFile: TFile, TaskLoopsPlugin, normalizeSettings }) {
	const { eq, results } = createSuite("core Daily Notes and standalone storage");
	const files = new Map();
	const contents = new Map();
	const calls = [];
	const makeFile = (path, content = "") => {
		const file = Object.assign(new TFile(), { path, extension: "md" });
		files.set(path, file);
		contents.set(path, content);
		return file;
	};
	const core = {
		enabled: true,
		instance: {
			options: { folder: "Journal", format: "YYYY/MM/DD", template: "Templates/Daily" },
			async getDailyNote(date) {
				calls.push(date.format("YYYY-MM-DD"));
				const path = `${this.options.folder}/${date.format(this.options.format)}.md`;
				return files.get(path) ?? makeFile(path, "# Core template content\n\n# Tasks\n");
			},
		},
	};
	const app = {
		internalPlugins: { getPluginById: () => core },
		fileManager: { getNewFileParent: () => ({ path: "Default Notes" }) },
		vault: {
			getAbstractFileByPath: (path) => files.get(path),
			read: async (file) => contents.get(file.path),
			cachedRead: async (file) => contents.get(file.path),
			process: async (file, transform) => {
				contents.set(file.path, transform(contents.get(file.path)));
			},
			create: async () => {
				throw new Error("TaskLoops must let core Daily Notes create the note");
			},
		},
		metadataCache: { getFileCache: () => ({ listItems: [] }) },
		workspace: { getLeavesOfType: () => [] },
	};
	const daily = new DailyNotes(() => app);
	eq(normalizeSettings().standaloneDestination, "note", "existing users retain standalone note default");
	eq(
		normalizeSettings({ standaloneDestination: "daily" }).standaloneDestination,
		"daily",
		"daily note preference persists",
	);
	eq(
		normalizeSettings({ standaloneDestination: "invalid" }).standaloneDestination,
		"note",
		"invalid preference falls back safely",
	);
	eq(daily.path("2026-10-25"), "Journal/2026/10/25.md", "core folder and nested filename format");
	eq(daily.exists("2026-10-25"), false, "no dot before note exists");
	await Promise.all([daily.ensure("2026-10-25"), daily.ensure("2026-10-25")]);
	eq(calls, ["2026-10-25"], "concurrent requests call core creation once with the selected date");
	eq(daily.exists("2026-10-25"), true, "dot after core creates note");
	contents.set("Journal/2026/10/25.md", "Existing writing");
	await daily.ensure("2026-10-25");
	eq(contents.get("Journal/2026/10/25.md"), "Existing writing", "existing note untouched");
	eq(calls.length, 1, "existing note requires no creation");
	const plugin = new TaskLoopsPlugin();
	plugin.app = app;
	plugin.settings = normalizeSettings({ standaloneDestination: "daily" });
	eq(
		await plugin.dailyNotes.createTask("2026-10-26", "First daily task", {}),
		true,
		"task saves after core note creation",
	);
	eq(calls, ["2026-10-25", "2026-10-26"], "task save delegates missing note to core");
	eq(
		contents.get("Journal/2026/10/26.md"),
		"# Core template content\n\n# Tasks\n- [ ] First daily task\n",
		"task appended after core template content",
	);
	eq(
		await plugin.dailyNotes.createTask("2026-10-26", "Second task", {}),
		true,
		"next task reuses daily note",
	);
	eq(calls.length, 2, "second task does not recreate note");
	eq(
		contents.get("Journal/2026/10/26.md").includes("First daily task\n- [ ] Second task"),
		true,
		"existing tasks preserved",
	);
	plugin.report = () => {};
	eq(await plugin.dailyNotes.createTask("2026-10-27", "", {}), false, "invalid task rejected");
	eq(calls.length, 2, "invalid task never creates an empty daily note");
	const create = core.instance.getDailyNote;
	core.instance.getDailyNote = async () => undefined;
	eq(
		await plugin.dailyNotes.createTask("2026-10-27", "Failed creation", {}),
		false,
		"core creation failure rejects task save",
	);
	eq(files.has("Journal/2026/10/27.md"), false, "no independent fallback file on core failure");
	core.instance.getDailyNote = create;
	core.instance.options.folder = "";
	eq(
		daily.path("2026-10-25"),
		"Default Notes/2026/10/25.md",
		"empty daily folder uses core new-file parent",
	);
	core.enabled = false;
	let disabled = false;
	try {
		await daily.ensure("2026-10-28");
	} catch {
		disabled = true;
	}
	eq(disabled, true, "disabled core plugin prevents creation");
	eq(calls.length, 2, "disabled plugin never writes a note");
	return results;
}

import { createSuite } from "./harness.mjs";

export default async function run({
	TaskLoopsPlugin,
	TestFile,
	TaskLoopsSettingTab,
	normalizeSettings,
	checkboxState,
	todayISO,
}) {
	const { eq, results } = createSuite("configurable task tags and Markdown round trip");
	const file = Object.assign(new TestFile(), { path: "Tasks.md", extension: "md" });
	let content = [
		"- [ ] Regular checkbox",
		"- [x] Tagged checkbox #task #ACTION/work",
		"Call the supplier #Action ^supplier",
		"Near match #actionable",
		"`Ignore this #action`",
		"#action",
		"",
	].join("\n");
	let saved;
	const plugin = new TaskLoopsPlugin();
	plugin.saveData = async (data) => {
		saved = data;
	};
	plugin.app = {
		metadataCache: {
			getFileCache: () => {
				const listItems = [],
					tags = [];
				for (const [line, raw] of content.split("\n").entries()) {
					const position = { start: { line } };
					const check = checkboxState(raw);
					if (check !== null) listItems.push({ task: check ? "x" : " ", position });
					for (const [tag] of raw.replace(/`[^`]*`/g, "").matchAll(/#[a-z][\w/-]*/gi))
						tags.push({ tag, position });
				}
				return { listItems, tags, frontmatter: { tags: ["action"] } };
			},
		},
		vault: {
			getMarkdownFiles: () => [file],
			getAbstractFileByPath: () => file,
			cachedRead: async () => content,
			process: async (_file, transform) => {
				content = transform(content);
			},
		},
		workspace: { getLeavesOfType: () => [], updateOptions: () => {} },
	};
	const titles = () => plugin.allTasks().map((task) => task.text);
	await plugin.rescan();
	eq(titles(), ["Regular checkbox", "Tagged checkbox #ACTION/work"], "default stays checkbox-only");
	eq(
		normalizeSettings({ tag: "Action/Work" }).taskTags,
		["#action/work"],
		"upgrades retain the older single tag",
	);

	const definitions = new TaskLoopsSettingTab(plugin.app, plugin).getSettingDefinitions();
	let setMode;
	const dropdown = {
		addOption: () => dropdown,
		setValue: () => dropdown,
		onChange: (fn) => {
			setMode = fn;
		},
	};
	definitions.find((item) => item.name === "Task detection").render({ addDropdown: (fn) => fn(dropdown) });
	const input = {
		value: "",
		inputEl: {},
		setPlaceholder: () => input,
		setValue: (value) => {
			input.value = value;
			return input;
		},
		getValue: () => input.value,
	};
	definitions.find((item) => item.name === "Task tags").render({ addText: (fn) => fn(input) });
	const refresh = plugin.refreshTaskDiscovery.bind(plugin);
	let applied;
	plugin.refreshTaskDiscovery = () => {
		applied = refresh();
		return applied;
	};
	input.value = "Action, #task, #ACTION";
	input.inputEl.onblur();
	await applied;
	await setMode("both");
	eq(saved.settings.taskTags, ["#action", "#task"], "settings save normalized, unique tags in entry order");
	eq(
		titles(),
		["Regular checkbox", "Tagged checkbox", "Call the supplier"],
		"both merges overlapping checkbox and tag matches, skipping standalone tags and examples",
	);
	await setMode("tagged");
	eq(titles(), ["Tagged checkbox", "Call the supplier"], "tagged-only hides the untagged checkbox");
	eq(
		plugin.allTasks().map(({ checkbox, checked }) => [checkbox, checked]),
		[
			[true, true],
			[false, false],
		],
		"a tagged checkbox retains its native checked state",
	);

	const original = plugin.allTasks()[1];
	const due = todayISO();
	eq(await plugin.deferTask(original, "Waiting for a reply"), true, "tagged prose can be deferred");
	eq(plugin.allTasks()[1].deferral?.reason, "Waiting for a reply", "the deferral is read from Markdown");
	await plugin.schedule(original, { due, time: "14:30" });
	eq(
		await plugin.editTask(original, "Call the backup supplier", file.path, { due, time: "14:30" }),
		true,
		"tagged prose can be renamed after scheduling",
	);
	const renamed = plugin.allTasks().find((task) => task.text === "Call the backup supplier");
	eq(renamed?.taskTags, ["#Action"], "renaming preserves the original tag");
	eq(renamed?.deferral?.scheduledFor, due, "scheduling the task resolves its deferral");
	eq(await plugin.complete(renamed), true, "tagged prose can be completed in the planner");
	const completed = plugin.allTasks().find((task) => task.id === renamed.id);
	eq(
		[completed?.checked, completed?.due, completed?.checkbox],
		[true, due, false],
		"completion preserves identity, schedule and prose format",
	);
	eq(
		completed?.raw.includes("#Action *(Handled)* - Due date:"),
		true,
		"completion marker stays before the schedule",
	);
	eq(completed?.raw.trimEnd().endsWith(" ^supplier"), true, "completion preserves the block ID");
	eq(await plugin.deleteTask(completed), true, "tagged prose can be deleted by exact source line");
	eq(content.includes("Near match #actionable"), true, "deleting a task leaves unrelated prose");

	eq(await plugin.createTask("Book a room", file.path, {}), true, "creation works in tagged-only mode");
	const created = plugin.allTasks().find((task) => task.text === "Book a room");
	eq(created?.raw, "- [ ] Book a room #action", "new checkbox gets the first configured tag");
	await plugin.editTask(created, "Book a room", file.path, {}, ["Check availability"]);
	eq(
		plugin.allTasks().find((task) => task.text === "Check availability")?.parentId,
		created.id,
		"a new subtask is tagged and stays under its parent",
	);
	return results;
}

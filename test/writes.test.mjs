import { createSuite } from "./harness.mjs";

export default async function run(mod) {
	const { TestFile, setTaskSchedule, setCheckboxDone, scanFile, TaskLoopsPlugin } = mod;
	const { eq, results } = createSuite("safe vault writes and planner integration");
	const file = Object.assign(new TestFile(), { path: "Project.md", extension: "md" });
	let content = "---\r\nstatus: active\r\n---\r\n\r\n## Tasks:\r\n- [ ] Call Ada\r\n- [ ] Other\r\n";
	const data = { settings: { dateFormat: "YYYY-MM-DD", standaloneNote: "Standalone Tasks.md", lastScale: "week" }, items: {} };
	const app = {
		metadataCache: { getFileCache: () => ({ listItems: content.split("\n").flatMap((line, i) => /^- \[.\]/.test(line) ? [{ task: line[3], position: { start: { line: i } } }] : []) }) },
		vault: {
			getMarkdownFiles: () => [file],
			getAbstractFileByPath: (path) => path === file.path ? file : null,
			cachedRead: async () => content,
			process: async (_file, fn) => { content = fn(content); },
		},
		workspace: { getLeavesOfType: () => [] },
	};
	const first = (await scanFile(app, file, "#task"))[0];
	const original = content;
	eq(await setTaskSchedule(app, first, { due: "2026-10-16", time: "09:30", duration: 65 }, "YYYY-MM-DD"), true, "schedule exact task");
	eq(content, original.replace("Call Ada", "Call Ada - Due date: 2026-10-16 Time: 09:30 Duration: 1 Hour 5 Minutes"), "only task suffix changed, CRLF and properties intact");
	const scheduled = (await scanFile(app, file, "#task"))[0];
	content = "Introduction\r\n" + content;
	eq(await setCheckboxDone(app, scheduled), true, "follow uniquely moved task");
	eq(content.includes("- [x] Call Ada - Due date: 2026-10-16 Time: 09:30 Duration: 1 Hour 5 Minutes"), true, "completion preserves schedule");
	content = "- [ ] Call Ada\n- [ ] Call Ada\n";
	eq(await setCheckboxDone(app, { ...first, line: 9, raw: "- [ ] Call Ada" }), false, "reject ambiguous moved duplicates");
	eq(content, "- [ ] Call Ada\n- [ ] Call Ada\n", "ambiguous write changes nothing");
	content = "- [ ] Reworded\n";
	eq(await setTaskSchedule(app, first, { due: "2026-10-16" }, "YYYY-MM-DD"), false, "reject stale text");
	eq(content, "- [ ] Reworded\n", "stale write changes nothing");

	content = "# Project\n\n## Tasks:\n- [ ] Existing\n\n## Notes\nLeave this alone.\n";
	const plugin = new TaskLoopsPlugin();
	plugin.app = app;
	plugin.settings = data.settings;
	plugin.saveData = async (value) => { Object.assign(data, value); };
	await plugin.rescan();
	eq(await plugin.createTask("New task", "Project.md", { due: "2026-10-16", time: "14:00", duration: 65 }), true, "create directly in project note");
	eq(content, "# Project\n\n## Tasks:\n- [ ] Existing\n- [ ] New task - Due date: 2026-10-16 Time: 14:00 Duration: 1 Hour 5 Minutes\n\n## Notes\nLeave this alone.\n", "project insertion uses Tasks heading");
	const task = plugin.allTasks().find((task) => task.text === "New task");
	await Promise.all([plugin.schedule(task, { due: "2026-10-17", time: "10:00", duration: 90 }), plugin.complete(task)]);
	eq(content.includes("- [x] New task - Due date: 2026-10-17 Time: 10:00 Duration: 1 Hour 30 Minutes"), true, "queued reschedule and completion both survive");
	eq(plugin.allTasks().find((task) => task.text === "New task").checked, true, "Markdown completion is source of truth");
	const existing = plugin.allTasks().find((task) => task.text === "Existing");
	plugin.items = { [existing.id]: { id: existing.id, path: existing.path, text: existing.text, due: "2026-10-20", bucket: "waiting" } };
	eq(plugin.allTasks().find((task) => task.id === existing.id).due, "2026-10-20", "legacy date remains visible");
	await plugin.schedule(existing, {});
	eq(plugin.allTasks().find((task) => task.id === existing.id).due, undefined, "clearing schedule clears legacy fallback");
	eq(data.items[existing.id].bucket, "waiting", "legacy GTD data retained as backup");
	eq(content.includes("Due date: 2026-10-20"), false, "legacy metadata never auto-written to note");

	const standaloneFile = Object.assign(new TestFile(), { path: "Planning/Standalone Tasks.md", extension: "md" });
	let standaloneContent = null;
	const createdFolders = [];
	const standaloneApp = {
		metadataCache: { getFileCache: () => ({ listItems: (standaloneContent ?? "").split("\n").flatMap((line, i) => /^- \[.\]/.test(line) ? [{ task: " ", position: { start: { line: i } } }] : []) }) },
		vault: {
			getMarkdownFiles: () => standaloneContent === null ? [] : [standaloneFile],
			getAbstractFileByPath: (path) => path === standaloneFile.path && standaloneContent !== null ? standaloneFile : null,
			cachedRead: async () => standaloneContent,
			createFolder: async (path) => { createdFolders.push(path); },
			create: async (_path, body) => { standaloneContent = body; return standaloneFile; },
			process: async (_file, transform) => { standaloneContent = transform(standaloneContent); },
		},
		workspace: { getLeavesOfType: () => [] },
	};
	const standalonePlugin = new TaskLoopsPlugin();
	standalonePlugin.app = standaloneApp;
	standalonePlugin.settings = { ...data.settings, standaloneNote: standaloneFile.path, dateFormat: "DD.MM.YYYY" };
	await Promise.all([
		standalonePlugin.createTask("First thought", standaloneFile.path, { due: "2026-10-16" }),
		standalonePlugin.createTask("Second thought", standaloneFile.path, {}),
	]);
	eq(createdFolders, ["Planning"], "standalone parent folder created once");
	eq(standaloneContent, "# Tasks\n- [ ] First thought - Due date: 16.10.2026\n- [ ] Second thought\n", "rapid standalone captures share one note and heading");
	eq(standalonePlugin.allTasks().map((task) => task.text), ["First thought", "Second thought"], "new standalone tasks discovered");
	await standalonePlugin.createTask("Typed date 2026-10-18", standaloneFile.path, {});
	eq(standaloneContent.includes("- [ ] Typed date 2026-10-18"), true, "capture preserves a date typed in task text");
	eq(standalonePlugin.allTasks().find((task) => task.text === "Typed date").due, "2026-10-18", "typed capture date appears on calendar");
	return results;
}

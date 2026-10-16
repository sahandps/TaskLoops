import { createSuite } from "./harness.mjs";

export default async function run(mod) {
	const { TestFile, TaskLoopsPlugin, taskWording, taskBlock, editedBlock, replaceTaskBlock, appendTaskBlock, resizedDuration } = mod;
	const { eq, results } = createSuite("task editor, subtasks, project moves and resizing");
	const raw = "  1. [ ] **Plan launch** #work Due date: 2026-10-16 Time: 10:00 Duration: 1 Hour ^launch\r";
	const task = { path: "Source.md", raw, line: 2 };
	const content = "## Tasks:\r\n\r\n" + raw + "\n      - [ ] Prepare assets\r\n        Details stay here.\r\n\r\n  - [ ] Unrelated sibling\r\n## Notes\r\nLeave this here.\r\n";
	eq(taskWording(raw), "**Plan launch** #work", "editor preserves formatting and tags, protects block id");
	eq(taskBlock(content, task).lines.length, 3, "task block includes child and continuation, excludes sibling and trailing blanks");
	const edited = editedBlock(content, task, "**Launch site** #work", { due: "2026-10-17", time: "11:00", duration: 65 }, "YYYY-MM-DD", ["Check links"]);
	eq(edited[0], "  1. [ ] **Launch site** #work Due date: 2026-10-17 Time: 11:00 Duration: 1 Hour 5 Minutes ^launch\r", "editing preserves numbered checkbox, indentation, block id and CRLF");
	eq(edited[3], "      - [ ] Check links\r", "new subtask is indented beneath parent");
	const replaced = replaceTaskBlock(content, task, edited);
	eq(replaced.includes("  - [ ] Unrelated sibling\r\n## Notes\r\nLeave this here.\r\n"), true, "unrelated task and following section untouched");
	eq(appendTaskBlock("# Destination\n", edited), "# Destination\n\n## Tasks:\n1. [ ] **Launch site** #work Due date: 2026-10-17 Time: 11:00 Duration: 1 Hour 5 Minutes ^launch\n    - [ ] Prepare assets\n      Details stay here.\n    - [ ] Check links\n", "project move normalizes root indentation and destination line endings");
	eq(editedBlock(content, task, taskWording(raw), { due: "2026-10-16", time: "10:00", duration: 60 }, "DD.MM.YYYY", [])[0], raw, "saving unchanged wording and schedule preserves source bytes");
	let staleRejected = false;
	try { replaceTaskBlock(content.replace("Prepare assets", "Updated assets"), task, [], taskBlock(content, task).lines); } catch { staleRejected = true; }
	eq(staleRejected, true, "changed child blocks a stale move");
	const quoted = { raw: "> - [ ] Parent", line: 0 };
	eq(editedBlock("> - [ ] Parent\n>     - [ ] Existing\n> Other text\n", quoted, "Parent", {}, "YYYY-MM-DD", ["New"]), ["> - [ ] Parent", ">     - [ ] Existing", ">     - [ ] New"], "quoted subtasks keep quote container");
	for (const [initial, pixels, expected] of [[60, 64, 120], [60, -32, 30], [65, 0, 65], [60, 6, 65], [30, -1000, 5]]) eq(resizedDuration(initial, pixels), expected, "duration resize " + initial + "/" + pixels);

	const files = new Map(["Source.md", "Project.md"].map((path) => [path, Object.assign(new TestFile(), { path, extension: "md" })]));
	const notes = new Map([
		["Source.md", "---\nstatus: active\n---\n## Tasks:\n- [ ] Plan launch Due date: 2026-10-16 Time: 10:00 Duration: 1 Hour ^launch\n    - [ ] Prepare assets\n\n- [ ] Sibling\n"],
		["Project.md", "---\nproject: Website\n---\n## Tasks:\n- [ ] Existing\n\n## Notes\nKeep.\n"],
	]);
	let failRemoval = false;
	let changeDestination = false;
	let failAfterRemoval = false;
	let failRollback = false;
	const app = {
		metadataCache: { getFileCache: (file) => ({ listItems: notes.get(file.path).split("\n").flatMap((line, i) => /^\s*- \[.\]/.test(line) ? [{ task: line.match(/\[(.)\]/)[1], position: { start: { line: i } } }] : []) }) },
		vault: {
			getMarkdownFiles: () => [...files.values()],
			getAbstractFileByPath: (path) => files.get(path) ?? null,
			cachedRead: async (file) => notes.get(file.path),
			read: async (file) => notes.get(file.path),
			process: async (file, transform) => {
				if (failRemoval && file.path === "Source.md") {
					if (changeDestination) notes.set("Project.md", notes.get("Project.md") + "External change.\n");
					throw new Error("Source temporarily unavailable");
				}
				const next = transform(notes.get(file.path));
				if (failRollback && file.path === "Project.md" && next === destinationBefore) throw new Error("Rollback write failed");
				notes.set(file.path, next);
				if (failAfterRemoval && file.path === "Source.md") throw new Error("Failure after source write");
			},
		},
		workspace: { getLeavesOfType: () => [] },
	};
	const plugin = new TaskLoopsPlugin();
	plugin.app = app;
	plugin.settings = { dateFormat: "YYYY-MM-DD", standaloneNote: "Standalone Tasks.md", lastScale: "day" };
	const errors = [];
	plugin.report = (error) => errors.push(error.message);
	await plugin.rescan();
	let parent = plugin.allTasks().find((task) => task.text === "Plan launch");
	eq(await plugin.editTask(parent, "Launch website", "Source.md", { due: parent.due, time: parent.time, duration: 90 }, ["Check links"]), true, "save wording, duration and child in same note");
	eq(notes.get("Source.md").includes("- [ ] Launch website Due date: 2026-10-16 Time: 10:00 Duration: 1 Hour 30 Minutes ^launch"), true, "save writes edited text and duration");
	parent = plugin.allTasks().find((task) => task.text === "Launch website");
	eq(plugin.allTasks().filter((task) => task.parentId === parent.id).map((task) => task.text), ["Prepare assets", "Check links"], "subtask relationships survive parent rename");
	const sourceBefore = notes.get("Source.md");
	const destinationBefore = notes.get("Project.md");
	failRemoval = true;
	eq(await plugin.editTask(parent, "Launch website", "Project.md", { due: parent.due, time: parent.time, duration: 90 }), false, "failed source removal reports failed move");
	eq(notes.get("Source.md"), sourceBefore, "failed move retains source subtree");
	eq(notes.get("Project.md"), destinationBefore, "failed move rolls back destination exactly");
	changeDestination = true;
	eq(await plugin.editTask(parent, "Launch website", "Project.md", { due: parent.due, time: parent.time, duration: 90 }), false, "concurrent destination change reports incomplete move");
	eq(notes.get("Source.md"), sourceBefore, "concurrent change never loses original");
	eq(notes.get("Project.md").endsWith("External change.\n"), true, "rollback never overwrites external edit");
	eq(errors.at(-1).includes("Both notes retain a copy"), true, "incomplete move clearly reports duplicate copies");
	notes.set("Project.md", destinationBefore);
	changeDestination = false;
	failRollback = true;
	eq(await plugin.editTask(parent, "Launch website", "Project.md", { due: parent.due, time: parent.time, duration: 90 }), false, "rollback storage failure reports incomplete move");
	eq(errors.at(-1).includes("Both notes retain a copy"), true, "rollback is confirmed only after the write succeeds");
	eq(notes.get("Source.md"), sourceBefore, "failed rollback preserves source");
	failRollback = failRemoval = false;
	notes.set("Project.md", destinationBefore);
	failAfterRemoval = true;
	eq(await plugin.editTask(parent, "Launch website", "Project.md", { due: parent.due, time: parent.time, duration: 90 }), false, "uncertain source write reports incomplete move");
	eq(notes.get("Project.md").includes("Launch website"), true, "destination copy survives failure after source removal");
	eq(notes.get("Source.md").includes("Launch website"), false, "simulate source removal completing before failure");
	eq(errors.at(-1).includes("destination copy has been kept"), true, "uncertain move explains where task is retained");
	failAfterRemoval = false;
	notes.set("Source.md", sourceBefore);

	notes.set("Project.md", destinationBefore);
	failRemoval = changeDestination = false;
	eq(await plugin.editTask(parent, "Launch website", "Project.md", { due: parent.due, time: parent.time, duration: 90 }), true, "move parent and children to selected project");
	eq(notes.get("Source.md"), "---\nstatus: active\n---\n## Tasks:\n\n- [ ] Sibling\n", "move removes only parent subtree");
	eq(notes.get("Project.md"), "---\nproject: Website\n---\n## Tasks:\n- [ ] Existing\n- [ ] Launch website Due date: 2026-10-16 Time: 10:00 Duration: 1 Hour 30 Minutes ^launch\n    - [ ] Prepare assets\n    - [ ] Check links\n\n## Notes\nKeep.\n", "move inserts subtree under Tasks, preserves properties and other sections");
	eq(plugin.allTasks().filter((task) => task.text === "Launch website").map((task) => task.path), ["Project.md"], "moved task appears only in destination group");
	const quotedFile = { path: "Quoted.md" };
	const quotedApp = {
		metadataCache: { getFileCache: () => ({ listItems: [0, 1].map((line) => ({ task: " ", position: { start: { line } } })) }) },
		vault: { cachedRead: async () => "> - [ ] Parent\n>     - [ ] Child\n" },
	};
	const quotedTasks = await mod.scanFile(quotedApp, quotedFile, "#task");
	eq(quotedTasks[1].parentId, quotedTasks[0].id, "quoted subtasks appear beneath parent in editor and sidebar");
	return results;
}

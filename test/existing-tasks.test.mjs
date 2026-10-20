import { createSuite } from "./harness.mjs";

export default async function run(mod) {
	const { TestFile, TaskLoopsPlugin, existingSubtaskCandidates, nestTaskBlock } = mod;
	const { eq, results } = createSuite("choosing existing subtasks and safe multi-note saves");
	const a = { id: "a", checkbox: true, checked: false, path: "a.md", line: 0 };
	const b = { ...a, id: "b", parentId: "a", line: 1 };
	const c = { ...a, id: "c", parentId: "b", line: 2 };
	const d = { ...a, id: "d", path: "b.md" };
	const e = { ...d, id: "e", parentId: "d", line: 1 };
	const f = { ...d, id: "f", checked: true, line: 2 };
	eq(existingSubtaskCandidates([a, b, c, d, e, f], b).map((task) => task.id), ["d", "e"], "exclude parent, ancestors, descendants and completed tasks");
	eq(existingSubtaskCandidates([a, b, c, d, e], b, [e]).map((task) => task.id), [], "exclude selected task and its ancestor subtree");
	eq(nestTaskBlock("- [ ] Parent", ["\t- [ ] Existing", "\t    - [ ] Child"]), ["    - [ ] Existing", "        - [ ] Child"], "nest an existing subtree relative to parent");
	eq(nestTaskBlock("> - [ ] Parent\r", ["- [ ] Existing", "    - [ ] Child"]), [">     - [ ] Existing\r", ">         - [ ] Child\r"], "inherit parent quote container and CRLF");
	eq(nestTaskBlock("- [ ] Parent", ["> - [ ] Existing", ">     - [ ] Child"]), ["    - [ ] Existing", "        - [ ] Child"], "remove source quote container when attaching to ordinary task");

	function fixture() {
		const notes = new Map([
			["Parent.md", "---\nstatus: active\n---\n## Tasks:\n- [ ] Parent Due date: 2026-10-16\n    - [ ] Already nested\n- [ ] Same note task\n\n## Notes\nKeep parent prose.\n"],
			["Other.md", "---\nproject: Other\n---\n## Tasks:\n- [ ] Existing action Due date: 2026-10-17 Time: 14:00 Duration: 1 Hour ^action\n    - [ ] Its child\n- [ ] Unrelated\n"],
			["Destination.md", "## Tasks:\n- [ ] Destination task\n"],
		]);
		const files = new Map([...notes.keys()].map((path) => [path, Object.assign(new TestFile(), { path, extension: "md" })]));
		const errors = [];
		let beforeProcess = () => {};
		let afterProcess = () => {};
		const app = {
			metadataCache: { getFileCache: (file) => ({ listItems: notes.get(file.path).split("\n").flatMap((line, i) => /^\s*- \[.\]/.test(line) ? [{ task: line.match(/\[(.)\]/)[1], position: { start: { line: i } } }] : []) }) },
			vault: {
				getMarkdownFiles: () => [...files.values()],
				getAbstractFileByPath: (path) => files.get(path) ?? null,
				read: async (file) => notes.get(file.path),
				cachedRead: async (file) => notes.get(file.path),
				process: async (file, transform) => { beforeProcess(file); notes.set(file.path, transform(notes.get(file.path))); afterProcess(file); },
			},
			workspace: { getLeavesOfType: () => [] },
		};
		const plugin = new TaskLoopsPlugin();
		plugin.app = app;
		plugin.saveData = async () => {};
		plugin.report = (error) => errors.push(error.message);
		const get = (text) => plugin.allTasks().find((task) => task.text === text);
		return { notes, plugin, errors, get, before: (fn) => { beforeProcess = fn; }, after: (fn) => { afterProcess = fn; } };
	}
	const standalone = fixture(); standalone.plugin.settings.standaloneNote = "Parent.md";
	await standalone.plugin.rescan();
	const untouchedDestination = standalone.notes.get("Destination.md");
	eq(await standalone.plugin.editTask(standalone.get("Parent"), "Standalone parent", "Destination.md", {due:"2026-10-20"}, ["Draft child"], [standalone.get("Existing action"),standalone.get("Unrelated")]), true, "standalone parent follows selected existing tasks instead of moving them out of their note");
	const moved = standalone.get("Standalone parent");
	eq(moved.path,"Other.md","subtask source overrides the old standalone/editor destination");
	for (const title of ["Already nested","Draft child","Existing action","Unrelated"]) {
	 eq(standalone.get(title).path,"Other.md","subtree stays with parent in the selected note: "+title);
	 eq(standalone.get(title).parentId,moved.id,"subtask remains nested under the moved parent: "+title);
	}
	eq(standalone.get("Its child").parentId,standalone.get("Existing action").id,"selected task preserves its own subtree");
	eq(standalone.get("Existing action").due,"2026-10-17","selected task keeps its schedule");
	eq(standalone.notes.get("Other.md").includes("^action"),true,"selected task retains block ID");
	eq(standalone.notes.get("Other.md").startsWith("---\nproject: Other\n---\n"),true,"project note properties remain intact");
	eq(standalone.notes.get("Parent.md").includes("Parent Due date"),false,"old standalone copy is removed");
	eq(standalone.get("Same note task").path,"Parent.md","unselected standalone tasks stay put");
	eq(standalone.notes.get("Destination.md"),untouchedDestination,"unrelated editor destination is never written");
	eq(standalone.plugin.allTasks().filter(t=>t.text==="Existing action").length,1,"no duplicate selected task");

	const mixed = fixture(); mixed.plugin.settings.standaloneNote = "Parent.md"; await mixed.plugin.rescan();
	const beforeMixed = [...mixed.notes];
	eq(await mixed.plugin.editTask(mixed.get("Parent"),"Parent","Parent.md",{},[],[mixed.get("Existing action"),mixed.get("Destination task")]),false,"standalone parent rejects a cross-note selection");
	eq([...mixed.notes],beforeMixed,"mixed-note rejection changes no note");
	eq(mixed.errors.at(-1).includes("one note"),true,"mixed-note error explains the required source");

	const rollback = fixture(); rollback.plugin.settings.standaloneNote="Parent.md"; await rollback.plugin.rescan();
	const beforeRollback=[...rollback.notes];
	rollback.before(file=>{if(file.path==="Parent.md")throw new Error("Standalone source locked");});
	eq(await rollback.plugin.editTask(rollback.get("Parent"),"Parent","Parent.md",{},[],[rollback.get("Existing action")]),false,"failed standalone removal aborts the move");
	eq([...rollback.notes],beforeRollback,"safe rollback restores both standalone and project notes");

	const same = fixture(); same.plugin.settings.standaloneNote="Parent.md"; await same.plugin.rescan();
	eq(await same.plugin.editTask(same.get("Parent"),"Parent","Other.md",{},[],[same.get("Same note task")]),true,"choosing an existing standalone task keeps both tasks in the standalone note");
	eq(same.get("Same note task").path,"Parent.md","same-note selection never exports the child");

	const waitingMove = fixture(); waitingMove.plugin.settings.standaloneNote="Parent.md"; await waitingMove.plugin.rescan();
	eq(await waitingMove.plugin.editTask(waitingMove.get("Parent"),"Waiting parent","Parent.md",{},[],[waitingMove.get("Existing action")],"Waiting for approval"),true,"reason-popup save uses the same parent-following rule");
	eq(waitingMove.get("Waiting parent").path,"Other.md","deferred parent follows the existing child");
	eq(waitingMove.get("Waiting parent").deferral,{reason:"Waiting for approval"},"parent reason survives note move");
	const deferred = fixture(); await deferred.plugin.rescan();
	eq(await deferred.plugin.editTask(deferred.get("Parent"), "Draft wording", "Destination.md", {due:"2026-10-23"}, ["Pending draft"], [deferred.get("Existing action")], "Waiting for approval"), true, "editor deferral saves wording, move, draft and selected subtasks together");
	const waiting = deferred.get("Draft wording");
	eq(waiting.path, "Destination.md", "deferral respects the editor destination");
	eq(waiting.due, undefined, "deferral clears the editor schedule");
	eq(waiting.deferral, {reason:"Waiting for approval"}, "editor deferral persists reason");
	for (const title of ["Already nested", "Pending draft", "Existing action"]) eq(deferred.get(title).parentId, waiting.id, "deferral preserves subtask: "+title);
	eq(deferred.get("Existing action").due, "2026-10-17", "selected child keeps its own schedule");
	const savedNotes = [...deferred.notes];
	eq(await deferred.plugin.editTask(waiting, "Rejected", "Destination.md", {}, [], [], "bad\nreason"), false, "invalid editor reason rejects before writes");
	eq([...deferred.notes], savedNotes, "invalid reason leaves notes untouched");
	await deferred.plugin.complete(waiting);
	const completedNotes = [...deferred.notes];
	eq(await deferred.plugin.editTask(waiting, "Rejected", "Destination.md", {}, [], [], "Waiting"), false, "editor cannot defer completed task");
	eq([...deferred.notes], completedNotes, "completed rejection preserves notes");
	let f1 = fixture();
	await f1.plugin.rescan();
	const selected = [f1.get("Existing action"), f1.get("Same note task")];
	eq(await f1.plugin.editTask(f1.get("Parent"), "Parent updated", "Parent.md", { due: "2026-10-16" }, ["New subtask"], selected), true, "save selected existing tasks and new draft together");
	eq(f1.notes.get("Parent.md"), "---\nstatus: active\n---\n## Tasks:\n- [ ] Parent updated - Due date: 2026-10-16\n    - [ ] Already nested\n    - [ ] New subtask\n    - [ ] Existing action Due date: 2026-10-17 Time: 14:00 Duration: 1 Hour ^action\n        - [ ] Its child\n    - [ ] Same note task\n\n## Notes\nKeep parent prose.\n", "existing tasks are moved once and indented, with nested children and schedules intact");
	eq(f1.notes.get("Other.md"), "---\nproject: Other\n---\n## Tasks:\n- [ ] Unrelated\n", "source retains frontmatter and unrelated task");
	eq(f1.get("Existing action").parentId, f1.get("Parent updated").id, "existing task becomes actual Markdown subtask");
	eq(f1.get("Its child").parentId, f1.get("Existing action").id, "selected task retains its own subtask relationship");
	eq(f1.plugin.allTasks().filter((task) => task.text === "Existing action").length, 1, "no duplicate on successful save");

	f1 = fixture(); await f1.plugin.rescan();
	eq(await f1.plugin.editTask(f1.get("Parent"), "Moved parent", "Other.md", {}, [], [f1.get("Existing action"), f1.get("Same note task")]), true, "move parent to a note that also supplies a selected subtask");
	eq(f1.get("Existing action").parentId, f1.get("Moved parent").id, "child is nested when destination and source coincide");
	eq(f1.get("Same note task").path, "Other.md", "same-source sibling moves with parent");
	eq(f1.notes.get("Parent.md"), "---\nstatus: active\n---\n## Tasks:\n\n## Notes\nKeep parent prose.\n", "parent source removal does not duplicate selected sibling");

	f1 = fixture(); await f1.plugin.rescan();
	const original = new Map(f1.notes);
	f1.before((file) => { if (file.path === "Other.md") throw new Error("Source locked"); });
	eq(await f1.plugin.editTask(f1.get("Parent"), "Parent", "Parent.md", { due: "2026-10-16" }, [], [f1.get("Existing action")]), false, "failed child removal fails the save");
	eq([...f1.notes], [...original], "all original notes restored when rollback is safe");

	f1 = fixture(); await f1.plugin.rescan();
	const threeNotes = [...f1.notes];
	f1.before((file) => { if (file.path === "Destination.md") throw new Error("Third source locked"); });
	eq(await f1.plugin.editTask(f1.get("Parent"), "Parent", "Parent.md", { due: "2026-10-16" }, [], [f1.get("Existing action"), f1.get("Destination task")]), false, "later source failure aborts a multi-source save");
	eq([...f1.notes], threeNotes, "restore previously removed source before restoring the assembled destination");

	f1 = fixture(); await f1.plugin.rescan();
	f1.after((file) => { if (file.path === "Other.md") throw new Error("Failure after source write"); });
	eq(await f1.plugin.editTask(f1.get("Parent"), "Parent", "Parent.md", { due: "2026-10-16" }, [], [f1.get("Existing action")]), false, "uncertain source write fails save");
	eq(f1.notes.get("Parent.md").includes("    - [ ] Existing action"), true, "destination copy kept when source restoration cannot be confirmed");
	eq(f1.errors.at(-1).includes("copies have been kept"), true, "partial recovery is explained");

	f1 = fixture(); await f1.plugin.rescan();
	let edited = false;
	f1.before((file) => {
		if (file.path === "Other.md" && !edited) { edited = true; f1.notes.set("Other.md", f1.notes.get("Other.md") + "External edit.\n"); }
	});
	eq(await f1.plugin.editTask(f1.get("Parent"), "Parent", "Parent.md", { due: "2026-10-16" }, [], [f1.get("Existing action")]), false, "concurrent source edit blocks stale overwrite");
	eq(f1.notes.get("Other.md").endsWith("External edit.\n"), true, "external source edit is retained");
	eq(f1.notes.get("Parent.md").includes("    - [ ] Existing action"), true, "task copy retained when safe rollback is unavailable");

	f1 = fixture(); await f1.plugin.rescan();
	const beforeCycle = [...f1.notes];
	eq(await f1.plugin.editTask(f1.get("Already nested"), "Already nested", "Parent.md", {}, [], [f1.get("Parent")]), false, "reject attaching an ancestor as a child");
	eq([...f1.notes], beforeCycle, "cycle rejection never changes notes");
	eq(await f1.plugin.editTask(f1.get("Parent"), "Parent", "Parent.md", {}, [], [f1.get("Existing action"), f1.get("Its child")]), false, "reject overlapping selected subtrees");
	eq([...f1.notes], beforeCycle, "overlap rejection never changes notes");
	return results;
}

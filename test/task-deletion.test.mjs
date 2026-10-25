import { createSuite } from "./harness.mjs";

export default async function run({
	removeTaskLine,
	noteTaskRows,
	TaskLoopsPlugin,
	TestFile,
	normalizeSettings,
}) {
	const { eq, results } = createSuite("task line deletion and safe queued writes");
	const task = (content, index = 0) => noteTaskRows(content, "Tasks.md")[index];
	const original =
		"---\r\nkind: project\r\n---\r\n\r\n# Tasks\r\n- [ ] Parent\r\n    - [ ] Child\r\n    Keep this explanation.\r\n- [ ] Other\r\n";
	const parent = task(original);
	eq(
		removeTaskLine(original, parent),
		original.replace("- [ ] Parent\r\n", ""),
		"only parent line removed, retaining CRLF, frontmatter, children and prose",
	);
	const child = task(original, 1);
	eq(
		removeTaskLine(original, child),
		original.replace("    - [ ] Child\r\n", ""),
		"nested task removal preserves parent and siblings",
	);
	const quoted = "> - [x] Completed\n>     Explanation\n> - [ ] Next\n";
	eq(
		removeTaskLine(quoted, task(quoted)),
		">     Explanation\n> - [ ] Next\n",
		"completed quoted task can be removed without removing quoted notes",
	);
	eq(removeTaskLine("- [ ] Only task", task("- [ ] Only task")), "", "only task leaves an empty note");
	const shifted = "Intro\n" + original;
	eq(
		removeTaskLine(shifted, parent),
		shifted.replace("- [ ] Parent\r\n", ""),
		"uniquely moved task is found",
	);
	const refuses = (content, stale) => {
		try {
			removeTaskLine(content, stale);
			return false;
		} catch {
			return true;
		}
	};
	eq(refuses("- [ ] Changed\n", task("- [ ] Original\n")), true, "changed wording is not deleted");
	eq(
		refuses("- [ ] Duplicate\n- [ ] Duplicate\n", { ...task("- [ ] Duplicate\n"), line: 10 }),
		true,
		"ambiguous moved duplicates rejected",
	);
	eq(
		refuses("```md\n- [ ] Example\n```\n", { ...task("- [ ] Example\n"), line: 1 }),
		true,
		"fenced example cannot become a deletion target",
	);
	const withExample = "```md\n- [ ] Duplicate\n```\n- [ ] Duplicate\n";
	eq(
		removeTaskLine(withExample, { ...task("- [ ] Duplicate\n"), line: 12 }),
		"```md\n- [ ] Duplicate\n```\n",
		"relocation ignores identical fenced example",
	);
	const file = Object.assign(new TestFile(), { path: "Tasks.md", extension: "md" });
	let content = "# Tasks\n- [ ] Delete me\n- [ ] Keep me\n";
	let exists = true;
	const reports = [];
	const plugin = new TaskLoopsPlugin();
	plugin.settings = normalizeSettings();
	let settingsSaves = 0;
	plugin.saveSettings = async () => {
		settingsSaves++;
	};
	plugin.report = (error) => reports.push(error.message);
	plugin.app = {
		metadataCache: {
			getFileCache: () => ({
				listItems: noteTaskRows(content, file.path).map((row) => ({
					task: row.checked ? "x" : " ",
					position: { start: { line: row.line } },
				})),
			}),
		},
		vault: {
			getAbstractFileByPath: (path) => (exists && path === file.path ? file : null),
			getMarkdownFiles: () => (exists ? [file] : []),
			cachedRead: async () => content,
			process: async (_file, fn) => {
				content = fn(content);
			},
		},
		workspace: { getLeavesOfType: () => [] },
	};
	await plugin.rescan();
	const current = plugin.allTasks()[0];
	plugin.items = { [current.id]: { due: "2026-10-25" } };
	eq(await plugin.deleteTask(current), true, "plugin delegates deletion to source-note write");
	eq(content, "# Tasks\n- [ ] Keep me\n", "unrelated task remains");
	eq(
		plugin.allTasks().map((row) => row.text),
		["Keep me"],
		"planner source refreshes after deletion",
	);
	eq(plugin.items[current.id], undefined, "legacy task data cleared after successful deletion");
	eq(settingsSaves, 1, "legacy cleanup persisted");
	eq(await plugin.deleteTask(current), false, "already missing task is not treated as deleted again");
	eq(content, "# Tasks\n- [ ] Keep me\n", "retry never removes another task");
	const keep = plugin.allTasks()[0];
	content = "# Tasks\n- [ ] Externally edited\n";
	eq(await plugin.deleteTask(keep), false, "stale popup cannot delete an externally edited task");
	eq(content, "# Tasks\n- [ ] Externally edited\n", "external changes preserved");
	exists = false;
	eq(await plugin.deleteTask(keep), false, "missing source note is reported");
	exists = true;
	content = "# Tasks\n- [ ] Queue me\n- [ ] Leave me\n";
	await plugin.rescan();
	const queued = plugin.allTasks()[0];
	await plugin.schedule(queued, { due: "2026-10-25" });
	eq(
		await plugin.deleteTask(queued),
		true,
		"task can be deleted after an earlier schedule updated its raw line",
	);
	eq(content, "# Tasks\n- [ ] Leave me\n", "queued edit and deletion preserve other tasks");
	const last = plugin.allTasks()[0];
	plugin.items = { [last.id]: { due: "2026-10-26" } };
	const process = plugin.app.vault.process;
	plugin.app.vault.process = async () => {
		throw new Error("Write failed");
	};
	eq(await plugin.deleteTask(last), false, "failed source write rejects deletion");
	eq(content, "# Tasks\n- [ ] Leave me\n", "failed write retains task line");
	eq(plugin.items[last.id].due, "2026-10-26", "failed deletion preserves legacy settings");
	plugin.app.vault.process = process;
	plugin.saveSettings = async () => {
		throw new Error("Backup unavailable");
	};
	eq(await plugin.deleteTask(last), true, "backup failure does not misreport successful source deletion");
	eq(content, "# Tasks\n", "source line stays deleted after backup failure");
	eq(plugin.allTasks().length, 0, "planner refreshes even when settings backup fails");
	eq(reports.length, 5, "refused writes and backup failure are reported");
	return results;
}

import { writeSchedule } from "../src/core/schedule.ts";

export function showNotePreview(path, tasks) {
	const dialog = document.createElement("dialog");
	dialog.createEl("h2", { text: path });
	const noteTasks = tasks.filter((task) => task.path === path);
	const ids = new Set(noteTasks.map((task) => task.id));
	const seen = new Set();
	const lines = [];
	const render = (task, depth) => {
		if (seen.has(task.id)) return;
		seen.add(task.id);
		const indent = "    ".repeat(depth);
		lines.push(
			indent +
				writeSchedule(`- [${task.checked ? "x" : " "}] ${task.text}`, task, "YYYY-MM-DD") +
				(task.continuations?.length ? "  " : ""),
		);
		for (const line of task.continuations ?? []) lines.push(indent + line);
		for (const child of noteTasks.filter((child) => child.parentId === task.id)) render(child, depth + 1);
	};
	for (const task of noteTasks.filter((task) => !ids.has(task.parentId))) render(task, 0);
	for (const task of noteTasks) if (!seen.has(task.id)) render(task, 0);
	dialog.createEl("pre", { text: lines.join("\n") });
	dialog.createEl("button", { text: "Close" }).onclick = () => {
		dialog.close();
		dialog.remove();
	};
	document.body.append(dialog);
	dialog.showModal();
	return true;
}

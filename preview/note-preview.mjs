import { writeSchedule } from "../src/core/schedule.ts";

export function showNotePreview(path, tasks) {
	const dialog = document.createElement("dialog");
	dialog.createEl("h2", { text: path });
	dialog.createEl("pre", {
		text: tasks
			.filter((t) => t.path === path)
			.map((t) => writeSchedule(`- [${t.checked ? "x" : " "}] ${t.text}`, t, "YYYY-MM-DD"))
			.join("\n"),
	});
	dialog.createEl("button", { text: "Close" }).onclick = () => {
		dialog.close();
		dialog.remove();
	};
	document.body.append(dialog);
	dialog.showModal();
	return true;
}

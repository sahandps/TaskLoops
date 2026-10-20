import type { ScannedTask } from "../../core/types";

/** Keep drag/edit handlers away from the checkbox; restore it if the write fails. */
export function renderCompletionCheckbox(
	parent: HTMLElement,
	task: ScannedTask,
	complete: (task: ScannedTask) => Promise<boolean>,
	onCompleted?: () => void,
): HTMLInputElement {
	const check = parent.createEl("input", {
		type: "checkbox",
		cls: "tl-completion-checkbox",
		attr: { "aria-label": "Complete " + task.text, title: "Mark complete" },
	});
	check.checked = task.checked;
	check.disabled = task.checked;
	for (const type of ["pointerdown", "mousedown", "click", "keydown", "keyup"])
		check.addEventListener(type, (event) => event.stopPropagation());
	check.onchange = () => {
		check.disabled = true;
		void complete(task)
			.then((ok) => {
				check.checked = ok;
				check.disabled = ok;
				if (ok) onCompleted?.();
			})
			.catch(() => {
				check.checked = false;
				check.disabled = false;
			});
	};
	return check;
}

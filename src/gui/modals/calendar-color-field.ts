/** Per-task calendar bar color, with project inheritance and an explicit reset. */
export function calendarColorField(
	parent: HTMLElement,
	initial: string | undefined,
	projectColor: () => string | undefined,
	parentColor: () => string | undefined = () => undefined,
): () => string {
	let value = initial ?? "";
	const row = parent.createDiv("tl-calendar-color-field");
	const label = row.createEl("label");
	label.createSpan({ text: "Calendar color" });
	const input = label.createEl("input", { type: "color", attr: { "aria-label": "Calendar color" } });
	input.value = value || parentColor() || projectColor() || "#547b68";
	const reset = row.createEl("button", {
		text: parentColor() ? "Use parent color" : "Use project color",
		cls: "tl-quiet-button",
	});
	const hint = row.createEl("small", { cls: "tl-field-hint" });
	const draw = () => {
		hint.textContent = value
			? "Custom calendar color. Subtasks inherit this unless they choose their own."
			: parentColor()
				? "Inherits its parent’s color. Pick a color to override it for this task and its subtasks."
				: "Uses the project color, or the planner’s default. Subtasks inherit your choice.";
		reset.disabled = !value;
	};
	input.oninput = () => {
		value = input.value;
		draw();
	};
	input.onchange = () => {
		value = input.value;
		draw();
	};
	reset.onclick = () => {
		value = "";
		input.value = parentColor() || projectColor() || "#547b68";
		draw();
	};
	draw();
	return () => value;
}

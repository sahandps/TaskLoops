import type { TaskActions } from "../../application/task-actions";
import { CANVAS_DAYS, canvasBoard, type CanvasFilters } from "../../core/canvas-board";
import { shiftISO, todayISO } from "../../core/dates";
import type { ScannedTask } from "../../core/types";
import { renderTaskCard } from "../components/task-card";

export interface CanvasViewState extends CanvasFilters {
	start?: string;
}

export function renderCanvasView(
	root: HTMLElement,
	actions: TaskActions,
	state: CanvasViewState,
	edit: (task: ScannedTask) => void,
	defer: (task: ScannedTask) => void,
) {
	const pane = root.createEl("main", { cls: "tl-canvas-pane", attr: { "aria-label": "Task canvas" } });
	const toolbar = pane.createDiv("tl-canvas-toolbar");
	function select(label: string, options: [string, string][], value: string) {
		const field = toolbar.createEl("label");
		field.createSpan({ text: label });
		const control = field.createEl("select", { attr: { "aria-label": label } });
		for (const [value, text] of options) control.createEl("option", { value, text });
		control.value = value;
		return control;
	}
	const group = select(
		"Group by",
		[
			["schedule", "Schedule"],
			["priority", "Priority"],
		],
		state.group,
	);
	const status = select(
		"Show",
		[
			["open", "Open tasks"],
			["completed", "Completed tasks"],
			["all", "All tasks"],
		],
		state.status,
	);
	const search = toolbar.createEl("input", {
		cls: "tl-canvas-search",
		type: "search",
		placeholder: "Search tasks or notes",
		attr: { "aria-label": "Search canvas tasks or notes" },
	});
	search.value = state.query;

	const priorities = actions.settings.priorities;
	const tasks = actions.allTasks();
	const archived = [
		...new Set(
			tasks.flatMap(({ priority }) =>
				priority && !priorities.some(({ id }) => id === priority) ? [priority] : [],
			),
		),
	];
	const priority = select(
		"Priority",
		[
			[":all", "All priorities"],
			["", "No priority"],
			...priorities.map(({ id, name }): [string, string] => [id, name]),
			...archived.map((id): [string, string] => [id, id + " (archived)"]),
		],
		state.priority ?? ":all",
	);
	if (!priority.value && state.priority) {
		state.priority = undefined;
		priority.value = ":all";
	}

	const nav = toolbar.createDiv("tl-canvas-nav");
	const previous = nav.createEl("button", { text: "←", attr: { "aria-label": "Previous seven days" } });
	const today = nav.createEl("button", { text: "Today" });
	const date = nav.createEl("input", { type: "date", attr: { "aria-label": "First day shown" } });
	date.value = state.start ?? todayISO();
	const next = nav.createEl("button", { text: "→", attr: { "aria-label": "Next seven days" } });
	const summary = pane.createDiv({ cls: "tl-canvas-summary", attr: { role: "status" } });
	const board = pane.createDiv({
		cls: "tl-canvas-board",
		attr: { tabindex: "0", "aria-label": "Task columns" },
	});

	function draw(resetScroll = false) {
		const left = resetScroll ? 0 : board.scrollLeft;
		const top = resetScroll ? 0 : board.scrollTop;
		board.empty();
		const bySchedule = state.group === "schedule";
		nav.hidden = !bySchedule;
		if (priority.parentElement) priority.parentElement.hidden = !bySchedule;
		const { columns, outsideRange } = canvasBoard(tasks, priorities, date.value, state);
		summary.hidden = outsideRange === 0;
		summary.setText(
			outsideRange === 1 ? "1 task outside these dates" : `${outsideRange} tasks outside these dates`,
		);
		for (const { label, schedule, color, archived, tasks } of columns) {
			const column = board.createEl("section", {
				cls: "tl-canvas-column",
				attr: { "aria-label": label },
			});
			const header = column.createDiv("tl-canvas-column-header");
			if (color) header.style.setProperty("--tl-canvas-color", color);
			header.createEl("h3", { text: label });
			header.createSpan({ cls: "tl-canvas-count", text: String(tasks.length) });
			if (!archived)
				header.createEl("button", {
					text: "+",
					attr: { "aria-label": "Add task to " + label },
				}).onclick = () =>
					actions.newTask({
						...schedule,
						...(bySchedule && state.priority ? { priority: state.priority } : {}),
					});
			const cards = column.createDiv("tl-canvas-cards");
			for (const task of tasks) renderTaskCard(cards, task, true, actions, edit, () => {}, defer);
			if (!tasks.length) cards.createDiv({ cls: "tl-empty", text: "No tasks" });
		}
		board.scrollLeft = left;
		board.scrollTop = top;
	}

	group.onchange = () => {
		state.group = group.value === "priority" ? "priority" : "schedule";
		draw(true);
	};
	status.onchange = () => {
		state.status = status.value === "completed" || status.value === "all" ? status.value : "open";
		draw();
	};
	search.oninput = () => {
		state.query = search.value;
		draw();
	};
	priority.onchange = () => {
		state.priority = priority.value === ":all" ? undefined : priority.value;
		draw();
	};
	function setStart(start?: string) {
		state.start = start;
		date.value = start ?? todayISO();
		draw(true);
	}
	previous.onclick = () => setStart(shiftISO(state.start ?? todayISO(), -CANVAS_DAYS));
	next.onclick = () => setStart(shiftISO(state.start ?? todayISO(), CANVAS_DAYS));
	today.onclick = () => setStart();
	date.onchange = () => setStart(/^\d{4}-\d{2}-\d{2}$/.test(date.value) ? date.value : undefined);
	draw();
	return { board, search };
}

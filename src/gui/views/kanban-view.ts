import type { TaskActions } from "../../application/task-actions";
import { KANBAN_DAYS, kanbanBoard, type KanbanFilters } from "../../core/kanban-board";
import { shiftISO, todayISO } from "../../core/dates";
import { moveTaskToDay } from "../../core/planner-schedule";
import type { ScannedTask, Schedule } from "../../core/types";
import { renderTaskCard } from "../components/task-card";
import type { TaskDragController } from "../interactions/task-drag-controller";
import { attachBoardDragScroll } from "../interactions/board-drag-scroll";

export interface KanbanViewState extends Omit<KanbanFilters, "status"> {
	start?: string;
}

export function captureKanbanScroll(board: HTMLElement) {
	const columns = new Map<string, number>();
	for (const cards of board.querySelectorAll<HTMLElement>("[data-kanban-scroll]"))
		if (cards.scrollTop && cards.dataset.kanbanScroll !== undefined)
			columns.set(cards.dataset.kanbanScroll, cards.scrollTop);
	return { left: board.scrollLeft, columns };
}

export function restoreKanbanScroll(board: HTMLElement, scroll: ReturnType<typeof captureKanbanScroll>) {
	board.scrollLeft = scroll.left;
	for (const cards of board.querySelectorAll<HTMLElement>("[data-kanban-scroll]"))
		cards.scrollTop = scroll.columns.get(cards.dataset.kanbanScroll ?? "") ?? 0;
}

export function renderKanbanView(
	root: HTMLElement,
	actions: TaskActions,
	state: KanbanViewState,
	edit: (task: ScannedTask) => void,
	defer: (task: ScannedTask) => void,
	drag: TaskDragController,
) {
	const pane = root.createEl("main", { cls: "tl-kanban-pane", attr: { "aria-label": "Task kanban" } });
	const toolbar = pane.createDiv("tl-kanban-toolbar");
	function select(label: string, options: [string, string][], value: string) {
		const field = toolbar.createEl("label");
		field.createSpan({ text: label });
		const control = field.createEl("select", { attr: { "aria-label": label } });
		for (const [value, text] of options) control.createEl("option", { attr: { value }, text });
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
		actions.settings.kanbanStatus,
	);
	const search = toolbar.createEl("input", {
		cls: "tl-kanban-search",
		type: "search",
		placeholder: "Search tasks or notes",
		attr: { "aria-label": "Search kanban tasks or notes" },
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

	const nav = toolbar.createDiv("tl-kanban-nav");
	const previous = nav.createEl("button", { text: "←", attr: { "aria-label": "Previous seven days" } });
	const today = nav.createEl("button", { text: "Today" });
	const date = nav.createEl("input", { type: "date", attr: { "aria-label": "First day shown" } });
	date.value = state.start ?? todayISO();
	const next = nav.createEl("button", { text: "→", attr: { "aria-label": "Next seven days" } });
	const summary = pane.createDiv({ cls: "tl-kanban-summary", attr: { role: "status" } });
	const board = pane.createDiv({
		cls: "tl-kanban-board",
		attr: { tabindex: "0", "aria-label": "Task columns" },
	});
	attachBoardDragScroll(board, () => drag.active);

	function draw(resetScroll = false) {
		const scroll = resetScroll ? undefined : captureKanbanScroll(board);
		board.empty();
		const bySchedule = state.group === "schedule";
		nav.hidden = !bySchedule;
		if (priority.parentElement) priority.parentElement.hidden = !bySchedule;
		const { columns, outsideRange } = kanbanBoard(tasks, priorities, date.value, {
			...state,
			status: actions.settings.kanbanStatus,
		});
		const key = (schedule: Schedule) => (bySchedule ? schedule.due : schedule.priority) ?? "";
		const move = (task: ScannedTask, target: Schedule) => {
			if (key(task) === key(target)) return;
			if (bySchedule) void actions.schedule(task, target.due ? moveTaskToDay(task, target.due) : {});
			else void actions.setTaskPriority(task, target.priority ?? "");
		};
		summary.hidden = outsideRange === 0;
		summary.setText(
			outsideRange === 1 ? "1 task outside these dates" : `${outsideRange} tasks outside these dates`,
		);
		for (const { id, label, schedule, color, archived, tasks } of columns) {
			const column = board.createEl("section", {
				cls: "tl-kanban-column",
				attr: { "aria-label": label },
			});
			if (!archived) drag.dropTarget(column, (task) => move(task, schedule));
			const header = column.createDiv("tl-kanban-column-header");
			if (color) header.style.setProperty("--tl-kanban-color", color);
			header.createEl("h3", { text: label });
			header.createSpan({ cls: "tl-kanban-count", text: String(tasks.length) });
			if (!archived)
				header.createEl("button", {
					text: "+",
					attr: { "aria-label": "Add task to " + label },
				}).onclick = () =>
					actions.newTask({
						...schedule,
						...(bySchedule && state.priority ? { priority: state.priority } : {}),
					});
			const cards = column.createDiv({
				cls: "tl-kanban-cards",
				attr: {
					"data-kanban-scroll": id,
					role: "group",
					"aria-label": label + " tasks",
					tabindex: tasks.length ? "0" : "-1",
				},
			});
			for (const task of tasks) {
				const card = renderTaskCard(cards, task, true, actions, edit, () => {}, defer);
				drag.makeDraggable(card, task);
				const targets = columns.filter(
					({ archived, schedule }) => !archived && key(schedule) !== key(task),
				);
				if (!targets.length) continue;
				const picker = card.createEl("select", {
					cls: "tl-kanban-move",
					attr: { "aria-label": "Move " + task.text },
				});
				picker.createEl("option", { text: "Move to…", value: ":pick" });
				for (const { label, schedule } of targets)
					picker.createEl("option", { text: label, attr: { value: key(schedule) } });
				picker.onchange = () => {
					const target = targets.find(({ schedule }) => key(schedule) === picker.value);
					picker.value = ":pick";
					if (target) move(task, target.schedule);
				};
			}
			if (!tasks.length) cards.createDiv({ cls: "tl-empty", text: "No tasks" });
		}
		if (scroll) restoreKanbanScroll(board, scroll);
		else board.scrollLeft = 0;
	}

	group.onchange = () => {
		state.group = group.value === "priority" ? "priority" : "schedule";
		draw(true);
	};
	status.onchange = () => {
		actions.settings.kanbanStatus =
			status.value === "completed" || status.value === "all" ? status.value : "open";
		draw();
		void actions.saveSettings();
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
	previous.onclick = () => setStart(shiftISO(state.start ?? todayISO(), -KANBAN_DAYS));
	next.onclick = () => setStart(shiftISO(state.start ?? todayISO(), KANBAN_DAYS));
	today.onclick = () => setStart();
	date.onchange = () => setStart(/^\d{4}-\d{2}-\d{2}$/.test(date.value) ? date.value : undefined);
	draw();
	return { board, search };
}

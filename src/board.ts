import { setIcon } from "obsidian";
import type { PanelHost } from "./host";
import { BUCKETS, Bucket, JoinedTask } from "./types";

/**
 * The Kanban board: one column per GTD bucket, cards dragged between them.
 *
 * Filing by dragging goes through the same path as the list view, so dropping
 * into Scheduled still asks for a date and Waiting still asks for a name — a
 * column that means nothing without them should not accept a silent drop.
 */
export function renderBoard(
	root: HTMLElement,
	host: PanelHost,
	all: JoinedTask[],
	matches: (task: JoinedTask) => boolean
): void {
	const board = root.createDiv("tl-board");
	const columns = host.plugin.settings.boardColumns;

	for (const id of columns) {
		const def = BUCKETS.find((b) => b.id === id);
		if (!def) continue;

		const tasks = all
			.filter((t) =>
				id === "done" ? t.item.done : t.item.bucket === id && !t.item.done
			)
			.filter(matches)
			.sort(host.compare);

		renderColumn(board, host, def.id, def.label, def.icon, def.empty, tasks);
	}
}

function renderColumn(
	board: HTMLElement,
	host: PanelHost,
	id: Bucket | "done",
	label: string,
	icon: string,
	empty: string,
	tasks: JoinedTask[]
): void {
	const column = board.createDiv("tl-column");

	const head = column.createDiv("tl-column-head");
	const iconEl = head.createSpan("tl-column-icon");
	setIcon(iconEl, icon);
	head.createSpan({ cls: "tl-column-title", text: label });
	head.createSpan({ cls: "tl-column-count", text: String(tasks.length) });

	const body = column.createDiv("tl-column-body");

	// The whole column accepts drops, including the empty space below the last
	// card, which is the natural place to aim for.
	host.dropTarget(column, (task) => {
		const alreadyHere = id === "done" ? task.item.done : task.item.bucket === id;
		if (alreadyHere) return;
		host.fileInto(task, id);
	});

	if (tasks.length === 0) {
		body.createDiv({ cls: "tl-column-empty", text: empty });
		return;
	}

	for (const task of tasks) {
		host.card(body, task, { nested: true, terse: true });
	}
}

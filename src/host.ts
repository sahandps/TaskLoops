import type { App } from "obsidian";
import type TaskLoopsPlugin from "./main";
import type { Bucket, JoinedTask } from "./types";

/**
 * What the board and calendar need from the panel.
 *
 * Kept to this narrow surface so each layout can be read on its own, and so
 * card rendering, dragging and filing behave identically in all three of them
 * rather than being reimplemented per view.
 */
export interface PanelHost {
	app: App;
	plugin: TaskLoopsPlugin;

	/** Redraw the whole panel. */
	rerender(): void;

	/** Render one task card into `parent`. */
	card(parent: HTMLElement, task: JoinedTask, opts?: CardOptions): void;

	/** Make an element a drag source for `task`. */
	draggable(el: HTMLElement, task: JoinedTask): void;

	/**
	 * Make an element accept dropped tasks. `onDrop` receives the task that was
	 * dropped; returning nothing is fine.
	 */
	dropTarget(el: HTMLElement, onDrop: (task: JoinedTask) => void): void;

	/** File a task into a bucket, prompting for a date or a name if needed. */
	fileInto(task: JoinedTask, bucket: Bucket | "done"): void;

	/** The id of the task currently being dragged, if any. */
	draggingId(): string | null;

	/**
	 * Sort comparator shared by every layout. A plain function rather than a
	 * method, so passing it straight to `Array#sort` cannot lose its binding.
	 */
	readonly compare: (a: JoinedTask, b: JoinedTask) => number;
}

export interface CardOptions {
	/** Compact styling for cards nested inside another card or a cell. */
	nested?: boolean;
	/** Omit the source-note line, where space is tight. */
	terse?: boolean;
	/** Suppress reorder drop handling, e.g. inside a calendar cell. */
	noReorder?: boolean;
}

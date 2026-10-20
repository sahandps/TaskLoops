import type { ScannedTask } from "../../core/types";

/** Owns sidebar drag state and drop wiring independently of view rendering. */
export class TaskDragController {
	private task: ScannedTask | null = null;
	constructor(
		private root: () => HTMLElement,
		private onSettled: () => void,
	) {}
	get active(): boolean {
		return this.task !== null;
	}
	clear(): void {
		this.task = null;
	}
	makeDraggable(card: HTMLElement, task: ScannedTask): void {
		card.draggable = true;
		card.addEventListener("dragstart", (event) => {
			this.task = task;
			event.dataTransfer?.setData("application/x-taskloops", task.id);
			if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
			card.addClass("is-dragging");
		});
		card.addEventListener("dragend", () => {
			this.task = null;
			card.removeClass("is-dragging");
			this.root()
				.querySelectorAll(".is-drop-target")
				.forEach((el) => el.removeClass("is-drop-target"));
			this.root()
				.querySelectorAll(".tl-drop-time")
				.forEach((el) => el.removeClass("is-visible"));
			this.onSettled();
		});
	}

	dropTarget(el: HTMLElement, onDrop: (task: ScannedTask, event: DragEvent) => void): void {
		el.addEventListener("dragover", (event) => {
			if (!this.task) return;
			event.preventDefault();
			event.stopPropagation();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
			el.addClass("is-drop-target");
		});
		el.addEventListener("dragleave", (event) => {
			if (!(event.relatedTarget instanceof Node) || !el.contains(event.relatedTarget))
				el.removeClass("is-drop-target");
		});
		el.addEventListener("drop", (event) => {
			if (!this.task) return;
			event.preventDefault();
			event.stopPropagation();
			const task = this.task;
			this.task = null;
			el.removeClass("is-drop-target");
			onDrop(task, event);
			this.onSettled();
		});
	}
}

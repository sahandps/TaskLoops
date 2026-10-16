import type { ScannedTask } from "./types";
import type { TaskLoopsView } from "./view";
import { formatDuration } from "./schedule";

/** Day/week timelines use 64 pixels per hour; resizing snaps to five minutes. */
export function resizedDuration(initial: number, pixels: number): number {
	return Math.max(5, Math.round((initial + pixels / 64 * 60) / 5) * 5);
}

export function addResizeHandle(card: HTMLElement, task: ScannedTask, view: TaskLoopsView, visibleHeight: (duration: number) => number): void {
	if (task.checked || !task.due || !task.time) return;
	const initial = task.duration ?? 30;
	const handle = card.createEl("button", {
		cls: "tl-resize-handle",
		attr: { "aria-label": "Resize duration of " + task.text, title: "Drag to resize · arrow keys adjust by 5 minutes" },
	});
	handle.onclick = (event) => event.stopPropagation();
	handle.addEventListener("dragstart", (event) => { event.preventDefault(); event.stopPropagation(); });
	let keyboardDuration = initial;
	handle.onkeydown = (event) => {
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
		event.preventDefault();
		event.stopPropagation();
		const delta = (event.shiftKey ? 15 : 5) * (event.key === "ArrowUp" ? -1 : 1);
		keyboardDuration = Math.max(5, keyboardDuration + delta);
		const document = handle.ownerDocument;
		const focused = document.activeElement === handle;
		void view.plugin.schedule(task, { due: task.due, time: task.time, duration: keyboardDuration }).then(() => {
			if (focused && document.activeElement === document.body) {
				Array.from(view.contentEl.querySelectorAll<HTMLButtonElement>(".tl-resize-handle"))
					.find((button) => button.getAttribute("aria-label") === handle.getAttribute("aria-label"))?.focus();
			}
		});
	};
	handle.onpointerdown = (event) => {
		if (event.button !== 0 || event.isPrimary === false) return;
		event.preventDefault();
		event.stopPropagation();
		const document = card.ownerDocument;
		const scroller = card.closest<HTMLElement>(".tl-calendar-content");
		const startScroll = scroller?.scrollTop ?? 0;
		const startY = event.clientY;
		const initialHeight = card.style.getPropertyValue("--tl-event-height");
		const wasDraggable = card.draggable;
		let duration = initial;
		let finished = false;
		card.draggable = false;
		card.addClass("is-resizing");
		const caption = card.createSpan({ cls: "tl-resize-caption", text: formatDuration(initial) });
		const move = (pointer: PointerEvent) => {
			if (pointer.pointerId !== event.pointerId) return;
			pointer.preventDefault();
			if (scroller) {
				const bounds = scroller.getBoundingClientRect();
				if (pointer.clientY > bounds.bottom - 24) scroller.scrollTop += 12;
				else if (pointer.clientY < bounds.top + 24) scroller.scrollTop -= 12;
			}
			duration = resizedDuration(initial, pointer.clientY - startY + (scroller?.scrollTop ?? 0) - startScroll);
			card.style.setProperty("--tl-event-height", Math.max(24, visibleHeight(duration)) + "px");
			caption.setText(formatDuration(duration));
		};
		const finish = (commit: boolean) => {
			if (finished) return;
			finished = true;
			document.removeEventListener("pointermove", move);
			document.removeEventListener("pointerup", up);
			document.removeEventListener("pointercancel", cancel);
			document.removeEventListener("keydown", key);
			document.defaultView?.removeEventListener("blur", cancel);
			card.draggable = wasDraggable;
			card.removeClass("is-resizing");
			caption.remove();
			card.style.setProperty("--tl-event-height", initialHeight);
			view.endResize();
			if (commit && duration !== initial) void view.plugin.schedule(task, { due: task.due, time: task.time, duration });
		};
		const up = (pointer: PointerEvent) => { if (pointer.pointerId === event.pointerId) finish(true); };
		const cancel = () => finish(false);
		const key = (keyboard: KeyboardEvent) => { if (keyboard.key === "Escape") { keyboard.preventDefault(); cancel(); } };
		document.addEventListener("pointermove", move, { passive: false });
		document.addEventListener("pointerup", up);
		document.addEventListener("pointercancel", cancel);
		document.addEventListener("keydown", key);
		document.defaultView?.addEventListener("blur", cancel);
		view.beginResize(cancel);
	};
}

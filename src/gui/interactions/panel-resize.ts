/** Keep both panels usable even when a saved size meets a smaller window. */
export function panelSize(requested: number, total: number, stacked: boolean): number {
	const minimum = Math.min(stacked ? 140 : 180, total * 0.4);
	const maximum = Math.max(minimum, total - (stacked ? 160 : 280) - 12);
	return Math.round(
		Math.min(maximum, Math.max(minimum, Number.isFinite(requested) ? requested : stacked ? 220 : 260)),
	);
}

interface PanelResizeOptions {
	width: number;
	height: number;
	begin: (cancel: () => void) => void;
	end: () => void;
	save: (size: number, stacked: boolean) => void;
}

/** A pointer/touch and keyboard divider; cancel restores the previous size. */
export function addPanelDivider(
	layout: HTMLElement,
	divider: HTMLElement,
	options: PanelResizeOptions,
): () => void {
	const doc = layout.ownerDocument;
	let width = options.width,
		height = options.height;
	let cancelActive: (() => void) | undefined;
	const stacked = () => doc.defaultView?.getComputedStyle(layout).flexDirection === "column";
	const apply = () => {
		const vertical = stacked();
		const total = vertical ? layout.clientHeight : layout.clientWidth;
		const size = panelSize(vertical ? height : width, total, vertical);
		layout.style.setProperty("--tl-panel-size", size + "px");
		divider.setAttribute("aria-orientation", vertical ? "horizontal" : "vertical");
		divider.setAttribute("aria-valuenow", String(size));
		divider.setAttribute("aria-valuemin", String(panelSize(0, total, vertical)));
		divider.setAttribute("aria-valuemax", String(panelSize(total, total, vertical)));
		return size;
	};
	const resize = (value: number, vertical: boolean) => {
		if (vertical) height = value;
		else width = value;
		return apply();
	};
	const reset = () => {
		if (cancelActive) return;
		const vertical = stacked();
		options.save(resize(vertical ? 220 : 260, vertical), vertical);
	};
	divider.ondblclick = reset;
	divider.onkeydown = (event) => {
		if (cancelActive) return;
		const vertical = stacked();
		const decrease = vertical ? "ArrowUp" : "ArrowLeft",
			increase = vertical ? "ArrowDown" : "ArrowRight";
		if (event.key !== decrease && event.key !== increase && event.key !== "Home" && event.key !== "End")
			return;
		event.preventDefault();
		const total = vertical ? layout.clientHeight : layout.clientWidth;
		const next =
			event.key === "Home"
				? 0
				: event.key === "End"
					? total
					: apply() + (event.key === decrease ? -1 : 1) * (event.shiftKey ? 50 : 10);
		options.save(resize(panelSize(next, total, vertical), vertical), vertical);
	};
	divider.onpointerdown = (event) => {
		if (event.button !== 0 || event.isPrimary === false || cancelActive) return;
		event.preventDefault();
		divider.focus();
		const vertical = stacked(),
			initial = apply(),
			origin = vertical ? event.clientY : event.clientX;
		let size = initial;
		const move = (pointer: PointerEvent) => {
			if (pointer.pointerId !== event.pointerId) return;
			pointer.preventDefault();
			if (stacked() !== vertical) {
				finish(false);
				return;
			}
			size = resize(initial + (vertical ? pointer.clientY : pointer.clientX) - origin, vertical);
		};
		const finish = (commit: boolean) => {
			if (!cancelActive) return;
			cancelActive = undefined;
			doc.removeEventListener("pointermove", move);
			doc.removeEventListener("pointerup", up);
			doc.removeEventListener("pointercancel", cancel);
			doc.removeEventListener("keydown", key);
			doc.defaultView?.removeEventListener("blur", cancel);
			layout.removeClass("is-panel-resizing");
			resize(commit ? size : initial, vertical);
			if (commit) options.save(size, vertical);
			options.end();
		};
		const up = (pointer: PointerEvent) => {
			if (pointer.pointerId === event.pointerId) finish(true);
		};
		const cancel = () => finish(false);
		const key = (keyboard: KeyboardEvent) => {
			if (keyboard.key === "Escape") {
				keyboard.preventDefault();
				cancel();
			}
		};
		cancelActive = cancel;
		options.begin(cancel);
		layout.addClass("is-panel-resizing");
		doc.addEventListener("pointermove", move, { passive: false });
		doc.addEventListener("pointerup", up);
		doc.addEventListener("pointercancel", cancel);
		doc.addEventListener("keydown", key);
		doc.defaultView?.addEventListener("blur", cancel);
	};
	const observer = new ResizeObserver(apply);
	observer.observe(layout);
	apply();
	return () => {
		observer.disconnect();
		cancelActive?.();
		divider.onpointerdown = divider.onkeydown = divider.ondblclick = null;
	};
}

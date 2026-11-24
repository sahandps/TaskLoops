const DEFAULT_SIDEBAR_SHARE = 0.25;

export function sidebarShare(requested: number): number {
	return Number.isFinite(requested) ? Math.min(0.55, Math.max(0.18, requested)) : DEFAULT_SIDEBAR_SHARE;
}

interface PanelResizeOptions {
	share?: number;
	legacyWidth?: number;
	begin: (cancel: () => void) => void;
	end: () => void;
	save: (share: number) => void;
}

export function addPanelDivider(
	layout: HTMLElement,
	divider: HTMLElement,
	options: PanelResizeOptions,
): () => void {
	const doc = layout.ownerDocument;
	let share = options.share;
	let cancelActive: (() => void) | undefined;
	const availableWidth = () => Math.max(0, layout.clientWidth - divider.offsetWidth);
	const apply = (requested: number) => {
		share = sidebarShare(requested);
		const percent = share * 100;
		layout.style.setProperty("--tl-panel-size", share + "fr");
		layout.style.setProperty("--tl-calendar-size", 1 - share + "fr");
		divider.setAttribute("aria-valuenow", String(Math.round(percent)));
		divider.setAttribute("aria-valuetext", Math.round(percent) + "%");
		return share;
	};
	const initialize = () => {
		const width = availableWidth();
		if (!divider.offsetWidth || !width) return;
		const legacyShare = options.legacyWidth === undefined ? NaN : options.legacyWidth / width;
		const initial = apply(share ?? legacyShare);
		if (options.share === undefined && Number.isFinite(legacyShare)) options.save(initial);
		observer.disconnect();
	};
	divider.setAttribute("aria-orientation", "vertical");
	divider.setAttribute("aria-valuemin", String(sidebarShare(0) * 100));
	divider.setAttribute("aria-valuemax", String(sidebarShare(1) * 100));
	divider.ondblclick = () => {
		if (!cancelActive) options.save(apply(DEFAULT_SIDEBAR_SHARE));
	};
	divider.onkeydown = (event) => {
		if (cancelActive) return;
		const step = event.shiftKey ? 0.05 : 0.01;
		const direction = doc.defaultView?.getComputedStyle(layout).direction === "rtl" ? -1 : 1;
		const current = share ?? DEFAULT_SIDEBAR_SHARE;
		const next = {
			Home: 0,
			End: 1,
			ArrowLeft: current - step * direction,
			ArrowRight: current + step * direction,
		}[event.key];
		if (next === undefined) return;
		event.preventDefault();
		options.save(apply(next));
	};
	divider.onpointerdown = (event) => {
		const width = availableWidth();
		if (!width || event.button !== 0 || event.isPrimary === false || cancelActive) return;
		event.preventDefault();
		divider.focus();
		const initial = share ?? DEFAULT_SIDEBAR_SHARE;
		const direction = doc.defaultView?.getComputedStyle(layout).direction === "rtl" ? -1 : 1;
		const move = (pointer: PointerEvent) => {
			if (pointer.pointerId !== event.pointerId) return;
			if (!divider.offsetWidth) {
				finish(false);
				return;
			}
			pointer.preventDefault();
			apply(initial + ((pointer.clientX - event.clientX) * direction) / width);
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
			if (commit && divider.offsetWidth && share !== undefined) options.save(share);
			else apply(initial);
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
	const observer = new ResizeObserver(initialize);
	observer.observe(layout);
	initialize();
	return () => {
		observer.disconnect();
		cancelActive?.();
		divider.onpointerdown = divider.onkeydown = divider.ondblclick = null;
	};
}

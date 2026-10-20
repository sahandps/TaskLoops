export interface TimeGridViewport {
	top: number;
	left: number;
	slotHeight: number;
}

/** Read the actual vendor scroller before a task save replaces its calendar. */
export function captureTimeGridViewport(root: HTMLElement): TimeGridViewport | undefined {
	const scroller = root.querySelector<HTMLElement>(".ec-time-grid > .ec-main");
	if (!scroller) return;
	const slotHeight = Number.parseFloat(scroller.style.getPropertyValue("--ec-slot-height"));
	if (!Number.isFinite(slotHeight) || slotHeight <= 0) return;
	return { top: scroller.scrollTop, left: scroller.scrollLeft, slotHeight };
}

/** EventCalendar's opening scroll uses (half-hour slots - 0.5) * slotHeight. */
export function viewportScrollTime(viewport: TimeGridViewport): { seconds: number } {
	return { seconds: (viewport.top / viewport.slotHeight + 0.5) * 1800 };
}

/** Restore before paint after the library's initial layout, including horizontal position. */
export function restoreTimeGridViewport(
	root: HTMLElement,
	viewport: TimeGridViewport | undefined,
	slotHeight: number,
): () => void {
	if (!viewport) return () => {};
	const win = root.ownerDocument.defaultView!;
	const frame = win.requestAnimationFrame(() => {
		const scroller = root.querySelector<HTMLElement>(".ec-time-grid > .ec-main");
		if (!scroller) return;
		scroller.scrollTop = (viewport.top * slotHeight) / viewport.slotHeight;
		scroller.scrollLeft = viewport.left;
	});
	return () => win.cancelAnimationFrame(frame);
}

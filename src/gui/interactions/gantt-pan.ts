/** Pan empty chart space without intercepting bar movement, resize handles or controls. */
export function attachGanttPan(scroller: HTMLElement): () => void {
	const doc = scroller.ownerDocument;
	let end: (() => void) | undefined;
	const down = (event: PointerEvent) => {
		const target = event.target as Element | null;
		if (
			event.button !== 0 ||
			event.isPrimary === false ||
			event.pointerType === "touch" ||
			typeof target?.closest !== "function"
		)
			return;
		if (!target.closest(".gantt") || target.closest(".bar-wrapper, .handle, button, select, a")) return;
		end?.();
		const x = event.clientX,
			y = event.clientY;
		let lastX = x,
			lastY = y;
		let moved = false;
		const move = (pointer: PointerEvent) => {
			if (pointer.pointerId !== event.pointerId) return;
			if (!moved && Math.hypot(pointer.clientX - x, pointer.clientY - y) < 4) return;
			moved = true;
			pointer.preventDefault();
			scroller.classList.add("tl-is-panning");
			scroller.scrollLeft += lastX - pointer.clientX;
			scroller.scrollTop += lastY - pointer.clientY;
			lastX = pointer.clientX;
			lastY = pointer.clientY;
		};
		const finish = () => {
			doc.removeEventListener("pointermove", move);
			doc.removeEventListener("pointerup", up);
			doc.removeEventListener("pointercancel", up);
			doc.defaultView?.removeEventListener("blur", finish);
			scroller.classList.remove("tl-is-panning");
			end = undefined;
		};
		const up = (pointer: PointerEvent) => {
			if (pointer.pointerId === event.pointerId) finish();
		};
		end = finish;
		doc.addEventListener("pointermove", move, { passive: false });
		doc.addEventListener("pointerup", up);
		doc.addEventListener("pointercancel", up);
		doc.defaultView?.addEventListener("blur", finish);
	};
	scroller.addEventListener("pointerdown", down);
	return () => {
		end?.();
		scroller.removeEventListener("pointerdown", down);
	};
}

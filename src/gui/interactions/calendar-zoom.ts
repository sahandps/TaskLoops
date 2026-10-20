import {
	DEFAULT_SLOT_HEIGHT,
	MIN_SLOT_HEIGHT,
	MAX_SLOT_HEIGHT,
	slotHeight,
	draggedSlotHeight,
	zoomedScroll,
} from "../../core/calendar-zoom";

/** The time ruler owns zoom gestures; event cells retain selection and dragging. */
export function attachCalendarZoom(
	host: HTMLElement,
	initial: number,
	setHeight: (size: number) => void,
	save: (size: number) => void,
): () => void {
	const doc = host.ownerDocument;
	const win = doc.defaultView!;
	let height = slotHeight(initial);
	let frame = 0;
	let end: ((commit: boolean) => void) | undefined;
	let keyChanged = false;
	const ruler = () => host.querySelector<HTMLElement>(".ec-body > .ec-sidebar");
	const status = host.createDiv({
		cls: "tl-time-zoom-status",
		attr: { role: "status", "aria-live": "polite" },
	});
	const decorate = () => {
		const axis = ruler();
		if (!axis) return;
		axis.removeAttribute("aria-hidden");
		axis.setAttribute("tabindex", "0");
		axis.setAttribute("role", "slider");
		axis.setAttribute("aria-label", "Calendar time zoom");
		axis.setAttribute("aria-orientation", "vertical");
		axis.setAttribute("aria-valuemin", String(MIN_SLOT_HEIGHT));
		axis.setAttribute("aria-valuemax", String(MAX_SLOT_HEIGHT));
		axis.setAttribute("aria-valuenow", String(height));
		axis.setAttribute("aria-valuetext", Math.round((height / DEFAULT_SLOT_HEIGHT) * 100) + "%");
		axis.title =
			"Hold left-click and drag up to zoom in, down to zoom out. Arrow keys adjust; Home resets.";
		status.setText("Zoom " + Math.round((height / DEFAULT_SLOT_HEIGHT) * 100) + "%");
	};
	const apply = (
		next: number,
		anchor?: { slots: number; header: number; offset: number; scroller: HTMLElement },
	) => {
		height = slotHeight(next);
		setHeight(height);
		decorate();
		win.cancelAnimationFrame(frame);
		frame = win.requestAnimationFrame(() => {
			decorate();
			if (anchor)
				anchor.scroller.scrollTop = zoomedScroll(anchor.slots, height, anchor.header, anchor.offset);
		});
	};
	const isRuler = (event: Event) => {
		const target = event.target as Element | null;
		return typeof target?.closest === "function" && !!target.closest(".ec-body > .ec-sidebar");
	};
	const anchorAt = (y: number) => {
		const scroller = host.querySelector<HTMLElement>(".ec-time-grid > .ec-main");
		const body = host.querySelector<HTMLElement>(".ec-body");
		if (!scroller || !body) return;
		const top = scroller.getBoundingClientRect().top;
		const bodyTop = body.getBoundingClientRect().top;
		return {
			scroller,
			slots: Math.max(0, (y - bodyTop) / height),
			header: bodyTop - top + scroller.scrollTop,
			offset: y - top,
		};
	};
	const down = (event: PointerEvent) => {
		if (
			event.button !== 0 ||
			event.isPrimary === false ||
			event.pointerType === "touch" ||
			!isRuler(event)
		)
			return;
		event.preventDefault();
		event.stopImmediatePropagation();
		end?.(false);
		ruler()?.focus({ preventScroll: true });
		const start = height,
			y = event.clientY,
			anchor = anchorAt(y);
		let changed = false;
		const move = (pointer: PointerEvent) => {
			if (pointer.pointerId !== event.pointerId) return;
			pointer.preventDefault();
			pointer.stopPropagation();
			if (!changed && Math.abs(pointer.clientY - y) < 4) return;
			changed = true;
			host.classList.add("tl-is-zooming");
			apply(draggedSlotHeight(start, pointer.clientY - y), anchor);
		};
		const finish = (commit: boolean) => {
			doc.removeEventListener("pointermove", move, { capture: true });
			doc.removeEventListener("pointerup", up, { capture: true });
			doc.removeEventListener("pointercancel", cancel, { capture: true });
			doc.removeEventListener("keydown", escape, { capture: true });
			win.removeEventListener("blur", cancel);
			host.classList.remove("tl-is-zooming");
			end = undefined;
			if (!commit && changed) apply(start, anchor);
			else if (commit && changed && height !== start) save(height);
		};
		const up = (pointer: PointerEvent) => {
			if (pointer.pointerId === event.pointerId) finish(true);
		};
		const cancel = () => finish(false);
		const escape = (key: KeyboardEvent) => {
			if (key.key === "Escape") {
				key.preventDefault();
				key.stopImmediatePropagation();
				finish(false);
			}
		};
		end = finish;
		doc.addEventListener("pointermove", move, { capture: true, passive: false });
		doc.addEventListener("pointerup", up, { capture: true });
		doc.addEventListener("pointercancel", cancel, { capture: true });
		doc.addEventListener("keydown", escape, { capture: true });
		win.addEventListener("blur", cancel);
	};
	const click = (event: MouseEvent) => {
		if (isRuler(event)) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	};
	const keydown = (event: KeyboardEvent) => {
		if (!isRuler(event) || end || !["ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		const scroller = host.querySelector<HTMLElement>(".ec-time-grid > .ec-main");
		const header = host.querySelector<HTMLElement>(".ec-header");
		const y =
			(scroller?.getBoundingClientRect().top ?? 0) + (header?.getBoundingClientRect().height ?? 0) + 40;
		const anchor = anchorAt(y);
		apply(
			event.key === "Home" ? DEFAULT_SLOT_HEIGHT : height + (event.key === "ArrowUp" ? 2 : -2),
			anchor,
		);
		keyChanged = true;
	};
	const commitKey = () => {
		if (keyChanged) {
			keyChanged = false;
			save(height);
		}
	};
	host.addEventListener("pointerdown", down, { capture: true });
	host.addEventListener("click", click, { capture: true });
	host.addEventListener("keydown", keydown, { capture: true });
	host.addEventListener("keyup", commitKey, { capture: true });
	host.addEventListener("focusout", commitKey, { capture: true });
	frame = win.requestAnimationFrame(decorate);
	return () => {
		end?.(false);
		win.cancelAnimationFrame(frame);
		host.removeEventListener("pointerdown", down, { capture: true });
		host.removeEventListener("click", click, { capture: true });
		host.removeEventListener("keydown", keydown, { capture: true });
		host.removeEventListener("keyup", commitKey, { capture: true });
		host.removeEventListener("focusout", commitKey, { capture: true });
		status.remove();
	};
}

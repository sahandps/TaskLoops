/** Scroll towards offscreen columns while a task hovers at either edge. */
export function attachBoardDragScroll(board: HTMLElement, isDragging: () => boolean): void {
	const win = board.ownerDocument.defaultView;
	if (!win) return;
	let frame = 0;
	let speed = 0;
	function stop() {
		if (frame) win?.cancelAnimationFrame(frame);
		frame = 0;
		speed = 0;
	}
	function tick() {
		frame = 0;
		if (!win || !speed || !board.isConnected || !isDragging()) return;
		board.scrollLeft += speed;
		frame = win.requestAnimationFrame(tick);
	}
	board.addEventListener(
		"dragover",
		(event) => {
			if (!isDragging()) return;
			const { left, right, width } = board.getBoundingClientRect();
			const edge = Math.min(55, width / 4);
			speed = event.clientX < left + edge ? -12 : event.clientX > right - edge ? 12 : 0;
			if (speed && !frame) frame = win.requestAnimationFrame(tick);
		},
		true,
	);
	board.addEventListener("dragleave", (event) => {
		if (!(event.relatedTarget instanceof Node) || !board.contains(event.relatedTarget)) stop();
	});
	board.addEventListener("drop", stop, true);
	board.addEventListener("dragend", stop);
}

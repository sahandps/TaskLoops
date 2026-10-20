/** Re-evaluate the local day after midnight, tab wake and clock changes. No task store. */
export function attachTodayClock(root: HTMLElement, refresh: () => void): () => void {
	const doc = root.ownerDocument;
	const win = doc.defaultView!;
	let timer = 0;
	let disposed = false;
	const tick = () => {
		if (disposed) return;
		refresh();
	};
	const wake = () => {
		if (doc.visibilityState !== "hidden") tick();
	};
	timer = win.setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
	doc.addEventListener("visibilitychange", wake);
	win.addEventListener("focus", wake);
	return () => {
		disposed = true;
		win.clearTimeout(timer);
		doc.removeEventListener("visibilitychange", wake);
		win.removeEventListener("focus", wake);
	};
}

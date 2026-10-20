/** Fold task bodies without re-rendering the calendar or modifying notes. */
export function taskGroupFolds(collapsed: Set<string>): {
	controls: (root: HTMLElement) => void;
	add: (path: string, heading: HTMLElement, body: HTMLElement, count: number) => void;
} {
	const groups: { path: string; body: HTMLElement; button: HTMLButtonElement; chevron: HTMLElement }[] = [];
	let bulk: HTMLButtonElement | undefined;
	const update = () => {
		for (const group of groups) {
			const closed = collapsed.has(group.path);
			group.body.hidden = closed;
			group.button.setAttribute("aria-expanded", String(!closed));
			group.button.setAttribute(
				"aria-label",
				`${closed ? "Expand" : "Collapse"} tasks in ${group.path}`,
			);
			group.button.title = `${closed ? "Show" : "Hide"} tasks in ${group.path}`;
			group.chevron.setText(closed ? "▸" : "▾");
		}
		if (bulk) {
			const allClosed = groups.length > 0 && groups.every((group) => collapsed.has(group.path));
			bulk.setText(allClosed ? "Expand all" : "Collapse all");
			bulk.setAttribute("aria-label", `${allClosed ? "Expand" : "Collapse"} all task groups`);
			bulk.disabled = !groups.length;
		}
	};
	return {
		controls(root) {
			bulk = root.createEl("button", {
				cls: "tl-fold-all",
				attr: { title: "Show or hide tasks in the notes matching this view" },
			});
			bulk.onclick = () => {
				const expand = groups.every((group) => collapsed.has(group.path));
				for (const group of groups) {
					if (expand) collapsed.delete(group.path);
					else collapsed.add(group.path);
				}
				update();
			};
			update();
		},
		add(path, heading, body, count) {
			const button = heading.createEl("button", { cls: "tl-group-toggle" });
			const chevron = button.createSpan({ cls: "tl-fold-chevron", attr: { "aria-hidden": "true" } });
			button.createSpan({
				cls: "tl-group-count",
				text: String(count),
				attr: { "aria-hidden": "true" },
			});
			button.onclick = () => {
				if (collapsed.has(path)) collapsed.delete(path);
				else collapsed.add(path);
				update();
			};
			groups.push({ path, body, button, chevron });
			update();
		},
	};
}

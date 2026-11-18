import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import { taskTagCounts } from "../../core/note-grid";

/** Search and favorite task tags without editing detection settings or Markdown. */
export function renderTaskTagFilter(
	parent: HTMLElement,
	tasks: ScannedTask[],
	actions: TaskActions,
	onChange: () => void,
): void {
	const counts = taskTagCounts(tasks);
	const selected = actions.settings.noteTagFilter ?? null;
	const picker = parent.createEl("details", { cls: "tl-tag-picker" });
	picker.createEl("summary", {
		text: selected ?? "All tags",
		attr: { "aria-label": `Filter tasks by tag: ${selected ?? "All tags"}` },
	});
	const panel = picker.createDiv("tl-tag-panel");
	const search = panel.createEl("input", {
		type: "search",
		placeholder: "Find a task tag…",
		attr: { "aria-label": "Find a task tag" },
	});
	search.value = "";
	const modes = panel.createDiv("tl-tag-modes");
	let favoritesOnly = false;
	const all = modes.createEl("button", { text: "All tags", attr: { "aria-pressed": "true" } });
	const favorites = modes.createEl("button", { text: "Favorites", attr: { "aria-pressed": "false" } });
	const clear = panel.createEl("button", {
		text: "All tags · Clear filter",
		attr: { "aria-pressed": String(selected === null) },
	});
	const choose = (tag: string | null) => {
		actions.settings.noteTagFilter = tag;
		void actions.saveSettings();
		onChange();
	};
	clear.onclick = () => choose(null);
	const list = panel.createDiv("tl-tag-list");
	const empty = panel.createEl("p", { cls: "tl-tag-empty", attr: { "aria-live": "polite" } });
	const update = () => {
		list.replaceChildren();
		const saved = actions.settings.favoriteTaskTags ?? [];
		const tags = [...new Set([...counts.keys(), ...saved, ...(selected ? [selected] : [])])]
			.filter(
				(tag) =>
					(!favoritesOnly || saved.includes(tag)) &&
					tag.includes(search.value.trim().toLowerCase()),
			)
			.sort((a, b) => a.localeCompare(b));
		all.setAttribute("aria-pressed", String(!favoritesOnly));
		favorites.setAttribute("aria-pressed", String(favoritesOnly));
		empty.hidden = tags.length > 0;
		empty.setText(
			favoritesOnly
				? "No favorites match. Star tags in All tags to add them here."
				: "No task tags match.",
		);
		for (const tag of tags) {
			const row = list.createDiv("tl-tag-row");
			row.createEl("button", {
				cls: "tl-tag-choice",
				text: `${tag} (${counts.get(tag) ?? 0})`,
				attr: { "aria-pressed": String(tag === selected) },
			}).onclick = () => choose(tag);
			const isFavorite = saved.includes(tag);
			const star = row.createEl("button", {
				cls: "tl-tag-star",
				text: isFavorite ? "★" : "☆",
				attr: {
					"aria-label": `${isFavorite ? "Remove" : "Add"} ${tag} ${isFavorite ? "from" : "to"} favorites`,
					"aria-pressed": String(isFavorite),
				},
			});
			star.onclick = () => {
				actions.settings.favoriteTaskTags = isFavorite
					? saved.filter((value) => value !== tag)
					: [...saved, tag];
				void actions.saveSettings();
				update();
				// Preserve keyboard focus when the list is rebuilt or a favorite is removed.
				(list.querySelector<HTMLButtonElement>(".tl-tag-star") ?? search).focus();
			};
		}
	};
	all.onclick = () => {
		favoritesOnly = false;
		update();
	};
	favorites.onclick = () => {
		favoritesOnly = true;
		update();
	};
	search.oninput = update;
	panel.onkeydown = (event) => {
		if (event.key === "Escape") {
			picker.open = false;
			picker.querySelector("summary")?.focus();
		}
	};
	update();
}

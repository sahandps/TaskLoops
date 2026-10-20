import type { App, TFile } from "obsidian";
import { insertNoteLink, noteLinkQuery } from "../../core/note-links";

let sequence = 0;
/** Input-only note references: selecting a result never opens or modifies its target. */
export function attachNoteLinkSuggest(
	input: HTMLInputElement | HTMLTextAreaElement,
	app: App,
	source: () => string,
): void {
	const wrapper = input.parentElement!.createDiv("tl-link-field");
	input.before(wrapper);
	wrapper.append(input);
	const list = wrapper.createDiv({
		cls: "tl-link-suggestions",
		attr: { role: "listbox", "aria-label": "Link to a note", id: "tl-note-links-" + ++sequence },
	});
	list.hidden = true;
	input.setAttribute("aria-autocomplete", "list");
	input.setAttribute("aria-controls", list.id);
	input.setAttribute("aria-expanded", "false");
	let choices: TFile[] = [];
	let active = 0;
	const close = () => {
		list.hidden = true;
		input.setAttribute("aria-expanded", "false");
		input.removeAttribute("aria-activedescendant");
	};
	const choose = (file: TFile) => {
		const range = noteLinkQuery(input.value, input.selectionStart ?? input.value.length);
		if (!range) return;
		const target = app.metadataCache.fileToLinktext(file, source(), true);
		const next = insertNoteLink(input.value, range, target);
		input.value = next.value;
		input.focus();
		input.setSelectionRange(next.caret, next.caret);
		// Keep the reason draft and other existing input listeners in sync.
		input.dispatchEvent(new Event("input", { bubbles: true }));
		close();
	};
	const highlight = () => {
		Array.from(list.children).forEach((el, index) =>
			el.setAttribute("aria-selected", String(index === active)),
		);
		const option = list.children[active];
		if (option) {
			input.setAttribute("aria-activedescendant", option.id);
			option.scrollIntoView({ block: "nearest" });
		}
	};
	const draw = () => {
		const range = noteLinkQuery(input.value, input.selectionStart ?? input.value.length);
		if (!range || input.selectionStart !== input.selectionEnd) {
			close();
			return;
		}
		const query = range.query.trim().toLocaleLowerCase();
		choices = app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.toLocaleLowerCase().includes(query))
			.sort((a, b) => a.path.localeCompare(b.path))
			.slice(0, 20);
		active = 0;
		list.empty();
		if (!choices.length) {
			close();
			return;
		}
		choices.forEach((file, index) => {
			const option = list.createEl("button", {
				cls: "tl-link-option",
				attr: { type: "button", role: "option", id: list.id + "-" + index, tabindex: "-1" },
			});
			option.createSpan({ text: file.path.replace(/\.md$/, "") });
			option.addEventListener("pointerdown", (event) => event.preventDefault());
			option.onclick = () => choose(file);
		});
		list.hidden = false;
		input.setAttribute("aria-expanded", "true");
		highlight();
	};
	input.addEventListener("input", draw);
	input.addEventListener("click", draw);
	input.addEventListener("focus", draw);
	input.addEventListener("blur", close);
	input.addEventListener("keyup", (event) => {
		if (event instanceof KeyboardEvent && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
			draw();
	});
	input.addEventListener(
		"keydown",
		(event) => {
			if (!(event instanceof KeyboardEvent) || event.isComposing || list.hidden) return;
			if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			if (event.key === "Escape") close();
			else if (event.key === "Enter") choose(choices[active]);
			else {
				active = (active + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
				highlight();
			}
		},
		true,
	);
	input.title = "Type [[ to link an existing note. Use ↑ ↓ and Enter to choose.";
}

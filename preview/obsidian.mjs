// Browser-only Obsidian classes for exercising the actual planner and dialogs.
import { installDOMHelpers } from "./dom.mjs";
installDOMHelpers();

export class ItemView {
	constructor(leaf) {
		this.app = leaf.app;
		this.contentEl = document.getElementById("app");
	}
}
export class Modal {
	constructor(app) {
		this.app = app;
		this.dialog = document.createElement("dialog");
		this.modalEl = this.dialog;
		this.contentEl = this.dialog.createDiv("modal-content");
	}
	open() {
		document.body.append(this.dialog);
		this.dialog.addEventListener("close", () => {
			this.onClose?.();
			this.dialog.remove();
		});
		this.dialog.addEventListener("click", (e) => {
			if (e.target === this.dialog) this.close();
		});
		this.onOpen?.();
		this.dialog.showModal();
	}
	close() {
		this.dialog.close();
	}
}
export class FuzzySuggestModal extends Modal {
	setPlaceholder(text) {
		this.placeholder = text;
	}
	setInstructions() {}
	onOpen() {
		const search = this.contentEl.createEl("input", { type: "search", placeholder: this.placeholder });
		const list = this.contentEl.createDiv();
		const draw = () => {
			list.empty();
			for (const item of this.getItems().filter((item) =>
				this.getItemText(item).toLowerCase().includes(search.value.toLowerCase()),
			)) {
				list.createEl("button", { text: this.getItemText(item) }).onclick = () => {
					this.onChooseItem(item);
					this.close();
				};
			}
		};
		search.oninput = draw;
		draw();
	}
}
export class TFile {
	constructor(path) {
		this.path = path;
	}
}
export class Notice {
	constructor(text) {
		const el = document.body.createDiv({ cls: "toast", text });
		window.setTimeout(() => el.remove(), 4000);
	}
}
export const Platform = { isMobile: false };
export function setIcon(el) {
	el.textContent = "↗";
}

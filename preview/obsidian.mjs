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

export function normalizePath(path) {
	return path
		.replace(/\\/g, "/")
		.replace(/\/{2,}/g, "/")
		.replace(/^\/+|\/+$/g, "");
}

// Render the production settings definitions in the browser preview.
export class PluginSettingTab {
	constructor(app, plugin) {
		this.app = app;
		this.plugin = plugin;
	}
}
export class Setting {
	constructor(root) {
		this.row = root.createDiv("tl-preview-setting");
		this.info = this.row.createDiv();
		this.control = this.row.createDiv("tl-preview-setting-control");
	}
	setName(name) {
		this.name = name;
		this.info.createEl("strong", { text: name });
		return this;
	}
	setDesc(desc) {
		this.info.createEl("small", { text: desc });
		return this;
	}
	addDropdown(callback) {
		const input = this.control.createEl("select", { attr: { "aria-label": this.name } });
		const component = {
			addOption: (value, text) => {
				input.createEl("option", { value, text });
				return component;
			},
			setValue: (value) => {
				input.value = value;
				return component;
			},
			onChange: (fn) => {
				input.onchange = () => void fn(input.value);
				return component;
			},
		};
		callback(component);
		return this;
	}
	addToggle(callback) {
		const input = this.control.createEl("input", { type: "checkbox", attr: { "aria-label": this.name } });
		const component = {
			setValue: (value) => {
				input.checked = value;
				return component;
			},
			onChange: (fn) => {
				input.onchange = () => void fn(input.checked);
				return component;
			},
		};
		callback(component);
		return this;
	}
	addSlider(callback) {
		const input = this.control.createEl("input", { type: "range", attr: { "aria-label": this.name } });
		const component = {
			setLimits: (min, max, step) => {
				input.min = min;
				input.max = max;
				input.step = step;
				return component;
			},
			setValue: (value) => {
				input.value = value;
				return component;
			},
			setDynamicTooltip: () => component,
			onChange: (fn) => {
				input.onchange = () => void fn(Number(input.value));
				return component;
			},
		};
		callback(component);
		return this;
	}
	addText(callback) {
		const input = this.control.createEl("input", { type: "text", attr: { "aria-label": this.name } });
		const component = {
			inputEl: input,
			setValue: (value) => {
				input.value = value;
				return component;
			},
			getValue: () => input.value,
			setPlaceholder: (value) => {
				input.placeholder = value;
				return component;
			},
		};
		callback(component);
		return this;
	}
}

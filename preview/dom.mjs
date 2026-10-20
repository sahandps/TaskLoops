export function installDOMHelpers() {
	const proto = HTMLElement.prototype;
	proto.createEl = function (tag, options = {}) {
		if (typeof options === "string") options = { cls: options };
		const el = document.createElement(tag);
		if (options.cls) el.className = options.cls;
		if (options.text) el.textContent = options.text;
		for (const [key, value] of Object.entries(options.attr ?? {})) el.setAttribute(key, value);
		for (const key of ["type", "value", "placeholder"]) if (options[key]) el[key] = options[key];
		this.append(el);
		return el;
	};
	proto.createDiv = function (options) {
		return this.createEl("div", options);
	};
	proto.createSpan = function (options) {
		return this.createEl("span", options);
	};
	proto.empty = function () {
		this.replaceChildren();
	};
	proto.addClass = function (...names) {
		this.classList.add(...names);
	};
	proto.removeClass = function (...names) {
		this.classList.remove(...names);
	};
	proto.setText = function (text) {
		this.textContent = text;
	};
}

const THEME_KEY = "taskloops-preview-theme";
const THEMES = ["light", "dark", "plum"];

/** Exercise Obsidian's body classes and palette changes without reloading views. */
export function installThemeControl() {
	const select = document.getElementById("preview-theme");
	let saved = "light";
	try {
		saved = window.localStorage.getItem(THEME_KEY) ?? "light";
	} catch {
		/* Preview still works without storage. */
	}
	const apply = (value) => {
		const theme = THEMES.includes(value) ? value : "light";
		document.body.classList.remove("theme-light", "theme-dark", "preview-plum");
		document.body.classList.add(theme === "light" ? "theme-light" : "theme-dark");
		if (theme === "plum") document.body.classList.add("preview-plum");
		select.value = theme;
		try {
			window.localStorage.setItem(THEME_KEY, theme);
		} catch {
			/* Themes remain usable without persistence. */
		}
	};
	select.onchange = () => apply(select.value);
	apply(saved);
}

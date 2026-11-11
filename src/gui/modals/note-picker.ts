import { App, FuzzySuggestModal } from "obsidian";

export class NotePicker extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		private standalone: string,
		private onPick: (path: string) => void,
		private choices?: string[],
		placeholder = choices ? "Search notes with available tasks…" : "Search project notes…",
	) {
		super(app);
		this.setPlaceholder(placeholder);
		this.setInstructions([
			{ command: "↑ ↓", purpose: "navigate notes" },
			{ command: "↵", purpose: "pick project" },
			{ command: "esc", purpose: "cancel" },
		]);
	}
	getItems(): string[] {
		return [
			...new Set(
				this.choices ?? [
					this.standalone,
					...this.app.vault.getMarkdownFiles().map((file) => file.path),
				],
			),
		].sort((a, b) => a.localeCompare(b));
	}
	getItemText(path: string): string {
		return path === this.standalone ? "Standalone tasks — " + path : path.replace(/\.md$/, "");
	}
	onChooseItem(path: string): void {
		this.onPick(path);
	}
}

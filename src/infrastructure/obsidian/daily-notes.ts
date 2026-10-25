import { App, TFile, moment, normalizePath } from "obsidian";

interface DailyNotesCore {
	enabled: boolean;
	instance?: { options?: { folder?: string; format?: string; template?: string } };
}

/** Core Daily Notes has no public typed API; keep its settings access here. */
export class DailyNotes {
	private pending = new Map<string, Promise<TFile>>();
	constructor(private getApp: () => App) {}
	private get app(): App {
		return this.getApp();
	}
	private core(): DailyNotesCore | undefined {
		return (
			this.app as App & { internalPlugins?: { getPluginById(id: string): DailyNotesCore | undefined } }
		).internalPlugins?.getPluginById("daily-notes");
	}
	get enabled(): boolean {
		return !!this.core()?.enabled;
	}
	private options() {
		if (!this.enabled) throw new Error("Enable Obsidian’s core Daily notes plugin in Settings first.");
		return this.core()?.instance?.options ?? {};
	}
	path(date: string): string {
		const options = this.options();
		const day = moment(date, "YYYY-MM-DD", true);
		if (!day.isValid()) throw new Error("Choose a valid daily note date.");
		return normalizePath(
			[options.folder, day.format(options.format || "YYYY-MM-DD") + ".md"].filter(Boolean).join("/"),
		);
	}
	exists(date: string): boolean {
		return this.enabled && this.app.vault.getAbstractFileByPath(this.path(date)) instanceof TFile;
	}
	async ensure(date: string): Promise<TFile> {
		const path = this.path(date);
		const active = this.pending.get(path);
		if (active) return active;
		const work = this.create(date, path);
		this.pending.set(path, work);
		try {
			return await work;
		} finally {
			this.pending.delete(path);
		}
	}
	private async create(date: string, path: string): Promise<TFile> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) return existing;
		if (existing) throw new Error("The daily note path is occupied by a folder.");
		const options = this.options();
		let content = "";
		if (options.template) {
			const templatePath = normalizePath(options.template.replace(/\.md$/i, "") + ".md");
			const file = this.app.vault.getAbstractFileByPath(templatePath);
			if (!(file instanceof TFile)) throw new Error("The Daily notes template could not be found.");
			const day = moment(date, "YYYY-MM-DD", true);
			content = (await this.app.vault.read(file))
				.replace(/{{\s*date(?::([^}]+))?\s*}}/gi, (_match: string, format: string | undefined) =>
					day.format(format?.trim() || options.format || "YYYY-MM-DD"),
				)
				.replace(/{{\s*time(?::([^}]+))?\s*}}/gi, (_match: string, format: string | undefined) =>
					moment().format(format?.trim() || "HH:mm"),
				)
				.replace(/{{\s*title\s*}}/gi, path.split("/").pop()!.replace(/\.md$/, ""));
		}
		const parts = path.split("/").slice(0, -1);
		for (let i = 1; i <= parts.length; i++) {
			const folder = parts.slice(0, i).join("/");
			if (!this.app.vault.getAbstractFileByPath(folder)) {
				try {
					await this.app.vault.createFolder(folder);
				} catch (error) {
					if (!this.app.vault.getAbstractFileByPath(folder)) throw error;
				}
			}
		}
		try {
			return await this.app.vault.create(path, content);
		} catch (error) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) return file;
			throw error;
		}
	}
}

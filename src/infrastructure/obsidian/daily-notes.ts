import { App, TFile, moment, normalizePath } from "obsidian";

interface DailyNotesCore {
	enabled: boolean;
	instance?: {
		options?: { folder?: string; format?: string; template?: string };
		getDailyNote?(date: ReturnType<typeof moment>): Promise<TFile | null | undefined>;
	};
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
			[
				options.folder || this.app.fileManager.getNewFileParent("").path,
				day.format(options.format || "YYYY-MM-DD").trim() + ".md",
			]
				.filter(Boolean)
				.join("/"),
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
		const instance = this.core()?.instance;
		if (!this.enabled || !instance?.getDailyNote)
			throw new Error("Core Daily notes is unavailable. Enable it in Obsidian Settings and try again.");
		const file = await instance.getDailyNote(moment(date, "YYYY-MM-DD", true));
		if (!(file instanceof TFile))
			throw new Error(
				"Core Daily notes could not create the note. Check its folder and template settings.",
			);
		return file;
	}
}

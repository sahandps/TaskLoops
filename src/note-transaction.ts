import { App, TFile } from "obsidian";

export interface NoteChange { file: TFile; before: string; after: string }

/** Write the assembled destination first; restore sources before destination. */
export async function applyNoteChanges(app: App, changes: NoteChange[]): Promise<void> {
	const attempted: NoteChange[] = [];
	try {
		for (const change of changes) {
			if (change.before === change.after) continue;
			attempted.push(change);
			await app.vault.process(change.file, (content) => {
				if (content !== change.before) throw new Error("A selected note changed. Refresh and try again.");
				return change.after;
			});
		}
	} catch (error) {
		let sourcesRestored = true;
		for (const change of [...attempted].reverse()) {
			// The first change contains every moved task. Keep it if a source
			// cannot be confirmed restored, so rollback cannot lose a task.
			if (change === changes[0] && !sourcesRestored) break;
			try {
				const current = await app.vault.read(change.file);
				if (current === change.before) continue;
				if (current !== change.after) { sourcesRestored = false; continue; }
				await app.vault.process(change.file, (content) => {
					if (content !== change.after) throw new Error("A note changed during recovery.");
					return change.before;
				});
			} catch { sourcesRestored = false; }
		}
		if (!sourcesRestored) throw new Error("The save could not finish safely. Task copies have been kept; review the selected notes before retrying.");
		throw error;
	}
}

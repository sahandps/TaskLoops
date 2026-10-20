import type { NoteFilter } from "../../core/note-grid";

export interface TaskViewState {
	query: string;
	showDone: boolean;
	onlyUndated: boolean;
	mode: "planner" | "notes";
	noteFilter: NoteFilter;
	folder: string | null;
	expandedNotes: Set<string>;
}

import type { PlannerTaskFilter } from "../../core/task-review";
import type { NoteFilter } from "../../core/note-grid";

export interface TaskViewState {
	query: string;
	showDone: boolean;
	taskFilter: PlannerTaskFilter;
	mode: "planner" | "notes";
	noteFilter: NoteFilter;
	folder: string | null;
	expandedNotes: Set<string>;
	collapsedNotes: Set<string>;
}

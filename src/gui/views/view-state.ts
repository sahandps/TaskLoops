import type { CompletionTab } from "../../core/task-completion-view";
import type { PlannerTaskFilter } from "../../core/task-review";
import type { NoteFilter } from "../../core/note-grid";

export interface TaskViewState {
	query: string;
	showDone: boolean;
	completionTab?: CompletionTab;
	todayExpanded?: Set<string>;
	taskFilter: PlannerTaskFilter;
	mode: "planner" | "notes" | "today";
	noteFilter: NoteFilter;
	folder: string | null;
	expandedNotes: Set<string>;
	collapsedNotes: Set<string>;
}

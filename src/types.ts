/**
 * The GTD buckets an item can be filed into. "inbox" is the implicit state of
 * anything that has been found in the vault but not yet clarified.
 */
export type Bucket =
	| "inbox"
	| "next"
	| "project"
	| "waiting"
	| "scheduled"
	| "someday"
	| "reference"
	| "trash";

export interface BucketDef {
	id: Bucket | "done";
	label: string;
	icon: string;
	/** Shown as the empty-state line for that list. */
	empty: string;
}

export const BUCKETS: BucketDef[] = [
	{ id: "inbox", label: "Inbox", icon: "inbox", empty: "Inbox zero." },
	{
		id: "next",
		label: "Next",
		icon: "zap",
		empty: "No next actions filed yet.",
	},
	{
		id: "project",
		label: "Projects",
		icon: "layers",
		empty: "No projects. A project is any outcome needing more than one action.",
	},
	{
		id: "waiting",
		label: "Waiting",
		icon: "hourglass",
		empty: "Nothing delegated.",
	},
	{
		id: "scheduled",
		label: "Scheduled",
		icon: "calendar",
		empty: "Nothing on the calendar.",
	},
	{
		id: "someday",
		label: "Someday",
		icon: "cloud",
		empty: "Nothing parked for later.",
	},
	{
		id: "reference",
		label: "Reference",
		icon: "bookmark",
		empty: "No reference material.",
	},
	{ id: "done", label: "Done", icon: "check-circle", empty: "Nothing done yet." },
	{ id: "trash", label: "Trash", icon: "trash-2", empty: "Trash is empty." },
];

/**
 * The plugin's own record of a task. This is the *only* place sorting state is
 * kept — nothing about the GTD classification is ever written into your notes.
 */
export interface TaskLoopsItem {
	id: string;
	/**
	 * Identity that survives rewording the line. `id` is derived from the text
	 * and changes when you edit it; project links point at `uid` instead so a
	 * reworded project keeps its actions.
	 */
	uid: string;
	bucket: Bucket;
	/** Last known location, used to re-home the item after a file rename. */
	path: string;
	/** Last known cleaned text, used for the Done archive and rename remapping. */
	text: string;
	/** Index among identical task lines in the same file; part of the id. */
	occ: number;
	context?: string;
	waitingFor?: string;
	/** ISO yyyy-mm-dd. */
	due?: string;
	done?: boolean;
	sortedAt?: number;
	doneAt?: number;
	/**
	 * Explicit project link, by the project's `uid`. `null` means "deliberately
	 * standalone" and suppresses the link indentation would otherwise imply;
	 * `undefined` means nothing was said, so indentation decides.
	 */
	projectUid?: string | null;
	/** True for records derived on the fly that have never been saved. */
	provisional?: boolean;
	/**
	 * Manual position within its list, set by dragging one card onto another.
	 * Items without one sort after those with one, by most recently filed.
	 */
	order?: number;
}

/** A `#task` line as it exists in the vault right now. */
export interface ScannedTask {
	id: string;
	path: string;
	/** 0-based line number. */
	line: number;
	/** The raw line, verbatim. */
	raw: string;
	/** Display text: tag, list markers and the handled marker stripped out. */
	text: string;
	/** Leading whitespace in columns, used to derive parent/child links. */
	indent: number;
	/** Task id of the line this one is indented under, if any. */
	parentId?: string;
	/** True when the line already carries the handled marker. */
	handled: boolean;
}

/** A scanned task joined with its stored GTD state. */
export interface JoinedTask extends ScannedTask {
	item: TaskLoopsItem;
	/** uid of the project this belongs to, explicit link or inherited. */
	projectUid?: string;
	/** True when the project link came from indentation rather than a choice. */
	inherited?: boolean;
}

export interface TaskLoopsSettings {
	/** The tag that promotes a line into the inbox. */
	tag: string;
	/** Appended to a line once it has been clarified. */
	handledMarker: string;
	/** When false, the plugin makes no writes to your notes at all. */
	markHandled: boolean;
	/** Contexts offered when filing a next action. */
	contexts: string[];
	/** Show the containing folder alongside the note name. */
	showFolder: boolean;
	/**
	 * The single note quick-capture appends to. This is the only note the
	 * plugin ever adds a line to; it is created on first use if missing.
	 */
	captureNote: string;
	/** False until you've been asked once where captures should live. */
	captureFolderChosen: boolean;
	/** Hide clarified items from the Inbox list even if the marker is missing. */
	lastBucket: Bucket | "done";
}

export const DEFAULT_SETTINGS: TaskLoopsSettings = {
	tag: "#task",
	handledMarker: "*(Handled)*",
	markHandled: true,
	contexts: ["@computer", "@home", "@office", "@errands", "@calls", "@anywhere"],
	showFolder: false,
	captureNote: "TaskLoops Inbox.md",
	captureFolderChosen: false,
	lastBucket: "inbox",
};

export interface TaskLoopsData {
	settings: TaskLoopsSettings;
	items: Record<string, TaskLoopsItem>;
}

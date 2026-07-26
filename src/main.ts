import {
	App,
	Notice,
	Plugin,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
	debounce,
	normalizePath,
} from "obsidian";
import {
	Bucket,
	DEFAULT_SETTINGS,
	TaskLoopsData,
	TaskLoopsItem,
	TaskLoopsSettings,
	JoinedTask,
	ScannedTask,
} from "./types";
import {
	scanFile,
	scanVault,
	setHandledMarker,
	setTaskText,
	taskId,
} from "./scanner";
import { CAPTURE_BASENAME, TextPromptModal } from "./modals";
import { TaskLoopsSettingTab } from "./settings";
import { TaskLoopsView, VIEW_TYPE_TASKLOOPS } from "./view";

/**
 * The settings window, which Obsidian exposes at runtime but leaves out of the
 * public typings. Declared narrowly rather than reached for through `any`.
 */
interface SettingsOpener {
	open(): void;
	openTabById(id: string): void;
}

let uidCounter = 0;
function newUid(): string {
	uidCounter += 1;
	return (
		Date.now().toString(36) +
		"-" +
		uidCounter.toString(36) +
		"-" +
		Math.floor(Math.random() * 1e6).toString(36)
	);
}

/** Buckets that count as a live open loop when judging whether a project stalled. */
const OPEN_BUCKETS: Bucket[] = ["next", "waiting", "scheduled"];

export default class TaskLoopsPlugin extends Plugin {
	settings: TaskLoopsSettings;
	items: Record<string, TaskLoopsItem> = {};

	/** Current `#task` lines in the vault, keyed by file path. */
	private tasks = new Map<string, ScannedTask[]>();
	/** Paths this plugin is mid-write on, so its own edits don't loop. */
	private writing = new Set<string>();

	async onload(): Promise<void> {
		await this.loadState();

		this.registerView(VIEW_TYPE_TASKLOOPS, (leaf) => new TaskLoopsView(leaf, this));

		this.addRibbonIcon("inbox", "TaskLoops", () => void this.activateView());

		this.addCommand({
			id: "open-panel",
			name: "Open panel",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "rescan-vault",
			name: "Rescan vault for tasks",
			callback: () => void this.rescan(),
		});

		this.addCommand({
			id: "capture-task",
			name: "Capture a task to the inbox",
			callback: () => {
				new TextPromptModal(this.app, {
					title: "Capture to inbox",
					placeholder: "What's on your mind?",
					cta: "Capture",
					onSubmit: (text) => void this.captureTask(text),
				}).open();
			},
		});

		this.addSettingTab(new TaskLoopsSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			void this.rescan();
		});

		const onMetaChange = debounce(
			(file: TFile) => void this.refreshFile(file),
			300,
			true
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.writing.has(file.path)) return;
				onMetaChange(file);
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.tasks.delete(file.path)) {
					this.reconcileAll();
					void this.saveData_();
					this.refreshViews();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				void this.handleRename(file, oldPath);
			})
		);
	}

	onunload(): void {
		// Leaves are left in place so the panel survives a plugin reload.
	}

	// ----------------------------------------------------------------- state

	private async loadState(): Promise<void> {
		const data = (await this.loadData()) as Partial<TaskLoopsData> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings ?? {});
		this.items = data?.items ?? {};
	}

	async saveData_(): Promise<void> {
		const data: TaskLoopsData = { settings: this.settings, items: this.items };
		await this.saveData(data);
	}

	// --------------------------------------------------------------- scanning

	async rescan(): Promise<void> {
		this.tasks = await scanVault(this.app, this.settings.tag);
		this.reconcileAll();
		await this.saveData_();
		this.refreshViews();
	}

	private async refreshFile(file: TFile): Promise<void> {
		if (file.extension !== "md") return;
		const found = await scanFile(this.app, file, this.settings.tag);
		if (found.length) this.tasks.set(file.path, found);
		else this.tasks.delete(file.path);
		// Re-home only: a single file's view is too narrow to justify deleting
		// records, and a line mid-edit can briefly stop looking like a task.
		if (this.rehomePath(file.path)) await this.saveData_();
		this.refreshViews();
	}

	private async handleRename(file: TAbstractFile, oldPath: string): Promise<void> {
		const moved = Object.values(this.items).filter((i) => i.path === oldPath);
		for (const item of moved) {
			delete this.items[item.id];
			item.path = file.path;
			item.id = taskId(file.path, item.text, item.occ ?? 0);
			this.items[item.id] = item;
		}
		this.tasks.delete(oldPath);
		if (file instanceof TFile) await this.refreshFile(file);
		if (moved.length) await this.saveData_();
		this.refreshViews();
	}

	/**
	 * Re-attach records whose line was reworded.
	 *
	 * A record is orphaned when its id no longer matches any scanned line. If
	 * exactly one orphan in a file lines up with exactly one marked line that
	 * has no record of its own, that is a rewording rather than a deletion, and
	 * the record moves across with its uid intact — so a renamed project keeps
	 * the actions pointing at it.
	 */
	private rehomePath(path: string): boolean {
		const live = this.tasks.get(path) ?? [];
		const liveIds = new Set(live.map((t) => t.id));

		const orphans = Object.values(this.items).filter(
			(i) => i.path === path && !liveIds.has(i.id)
		);
		if (orphans.length !== 1) return false;

		const candidates = live.filter((t) => t.handled && !this.items[t.id]);
		if (candidates.length !== 1) return false;

		const item = orphans[0];
		const task = candidates[0];
		delete this.items[item.id];
		item.id = task.id;
		item.text = task.text;
		item.occ = live.indexOf(task);
		this.items[task.id] = item;
		return true;
	}

	/**
	 * Full reconciliation: re-home what can be re-homed, drop records whose
	 * line is genuinely gone, then clear links pointing at projects that no
	 * longer exist. Only runs after a complete scan, so a partial view of the
	 * vault can never delete anything.
	 */
	private reconcileAll(): void {
		const paths = new Set<string>(this.tasks.keys());
		for (const item of Object.values(this.items)) paths.add(item.path);
		for (const path of paths) this.rehomePath(path);

		const live = new Set<string>();
		for (const list of this.tasks.values()) {
			for (const t of list) live.add(t.id);
		}
		for (const id of Object.keys(this.items)) {
			if (!live.has(id)) delete this.items[id];
		}

		const uids = new Set(Object.values(this.items).map((i) => i.uid));
		for (const item of Object.values(this.items)) {
			if (item.projectUid && !uids.has(item.projectUid)) {
				item.projectUid = undefined;
			}
		}
	}

	/**
	 * Every current `#task` line, paired with its stored GTD state and its
	 * resolved project link.
	 *
	 * Records for lines the plugin has never seen are derived here but not
	 * saved. Persisting them on sight would defeat re-homing, which recognises
	 * a reworded line precisely by its lack of a record.
	 */
	joined(): JoinedTask[] {
		const out: JoinedTask[] = [];
		const byId = new Map<string, TaskLoopsItem>();
		const paths = Array.from(this.tasks.keys()).sort();

		for (const path of paths) {
			const list = this.tasks.get(path)!;
			for (let occ = 0; occ < list.length; occ++) {
				const task = list[occ];
				let item = this.items[task.id];
				if (item) {
					if (!item.uid) item.uid = newUid();
					item.path = task.path;
					item.text = task.text;
					item.occ = occ;
				} else {
					item = {
						id: task.id,
						uid: "provisional:" + task.id,
						// A line already carrying the marker was sorted at some
						// point; the marker doesn't record which bucket, so it
						// lands in Next where it stays visible and re-filable.
						bucket: task.handled ? "next" : "inbox",
						path: task.path,
						text: task.text,
						occ,
						provisional: true,
					};
				}
				byId.set(task.id, item);
				out.push({ ...task, item });
			}
		}

		for (const task of out) {
			if (task.item.projectUid === null) continue; // deliberately standalone
			if (task.item.projectUid) {
				task.projectUid = task.item.projectUid;
				continue;
			}
			if (!task.parentId) continue;
			const parent = byId.get(task.parentId);
			if (parent?.bucket === "project" && !parent.provisional) {
				task.projectUid = parent.uid;
				task.inherited = true;
			}
		}

		out.sort((a, b) => (b.item.sortedAt ?? 0) - (a.item.sortedAt ?? 0));
		return out;
	}

	// --------------------------------------------------------------- projects

	/** Live projects, most recently filed first. */
	projects(all: JoinedTask[]): JoinedTask[] {
		return all.filter((t) => t.item.bucket === "project" && !t.item.done);
	}

	/** Everything filed under a project, excluding trashed items. */
	actionsOf(all: JoinedTask[], uid: string): JoinedTask[] {
		return all.filter(
			(t) =>
				t.projectUid === uid &&
				t.item.bucket !== "project" &&
				t.item.bucket !== "trash"
		);
	}

	/**
	 * The check the weekly review exists to perform: a project with nothing
	 * open against it has quietly stalled.
	 */
	isStalled(actions: JoinedTask[]): boolean {
		return !actions.some(
			(a) => !a.item.done && OPEN_BUCKETS.includes(a.item.bucket)
		);
	}

	/** Tasks not already filed under any project, offered when linking. */
	unattached(all: JoinedTask[]): JoinedTask[] {
		return all.filter(
			(t) =>
				!t.projectUid &&
				t.item.bucket !== "project" &&
				t.item.bucket !== "trash" &&
				!t.item.done
		);
	}

	/** Link a task to a project, or to nothing at all. */
	async linkToProject(
		task: JoinedTask,
		projectUid: string | null | undefined
	): Promise<void> {
		const item = this.persist(task);
		item.projectUid = projectUid;
		await this.saveData_();
		this.refreshViews();
	}

	/** Promote a derived record into the saved set so edits to it stick. */
	private persist(task: JoinedTask): TaskLoopsItem {
		let item = this.items[task.id];
		if (!item) {
			item = { ...task.item, uid: newUid(), provisional: undefined };
			this.items[task.id] = item;
		}
		if (!item.uid) item.uid = newUid();
		return item;
	}

	// ---------------------------------------------------------------- actions

	/** File a task into a bucket and reflect that with the handled marker. */
	async file(
		task: JoinedTask,
		patch: {
			bucket: Bucket;
			context?: string;
			waitingFor?: string;
			due?: string;
			done?: boolean;
			projectUid?: string | null;
		}
	): Promise<void> {
		const item = this.persist(task);

		item.bucket = patch.bucket;
		item.sortedAt = Date.now();

		// Clear attributes that no longer apply to the new bucket.
		if (patch.bucket !== "next") item.context = undefined;
		if (patch.bucket !== "waiting") item.waitingFor = undefined;
		if (patch.bucket !== "scheduled") item.due = undefined;
		if (patch.context !== undefined) item.context = patch.context;
		if (patch.waitingFor !== undefined) item.waitingFor = patch.waitingFor;
		if (patch.due !== undefined) item.due = patch.due;

		if (patch.done !== undefined) {
			item.done = patch.done;
			item.doneAt = patch.done ? Date.now() : undefined;
		}
		if (patch.projectUid !== undefined) item.projectUid = patch.projectUid;

		if (patch.bucket === "inbox") {
			item.done = false;
			item.doneAt = undefined;
			item.projectUid = undefined;
		}
		// A project cannot belong to another project; GTD keeps the list flat.
		if (patch.bucket === "project") item.projectUid = null;

		await this.saveData_();
		await this.syncMarker(task, item.bucket !== "inbox");
		this.refreshViews();
	}

	async toggleDone(task: JoinedTask): Promise<void> {
		const item = this.persist(task);
		item.done = !item.done;
		item.doneAt = item.done ? Date.now() : undefined;
		if (item.done && item.bucket === "inbox") {
			item.bucket = "next";
			item.sortedAt = Date.now();
		}
		await this.saveData_();
		await this.syncMarker(task, item.bucket !== "inbox");
		this.refreshViews();
	}

	/** Point capture at a folder. A null folder means the vault root. */
	async setCaptureFolder(folder: string | null): Promise<void> {
		const dir = !folder || folder === "/" ? "" : folder.replace(/\/+$/, "");
		this.settings.captureNote = dir
			? dir + "/" + CAPTURE_BASENAME
			: CAPTURE_BASENAME;
		this.settings.captureFolderChosen = true;
		await this.saveData_();
		this.refreshViews();
	}

	/** Set or clear a date, moving the task onto the calendar if needed. */
	async setDue(task: JoinedTask, iso: string | null): Promise<void> {
		const item = this.persist(task);
		if (iso) {
			item.due = iso;
			if (item.bucket !== "scheduled") {
				item.bucket = "scheduled";
				item.sortedAt = Date.now();
			}
		} else {
			item.due = undefined;
		}
		await this.saveData_();
		await this.syncMarker(task, item.bucket !== "inbox");
		this.refreshViews();
	}

	/**
	 * Rewrite a task's sentence in its note.
	 *
	 * Identity is derived from the text, so the record is re-keyed to match.
	 * Everything else about the line — indent, bullet, checkbox, tag, block id,
	 * handled marker — is preserved by the rewrite itself.
	 */
	async renameTask(task: JoinedTask, body: string): Promise<boolean> {
		const text = body.replace(/\s+/g, " ").trim();
		if (!text || text === task.text) return false;

		const item = this.persist(task);

		this.writing.add(task.path);
		let written = false;
		try {
			written = await setTaskText(this.app, task, this.settings.tag, text);
		} catch (err) {
			console.error("TaskLoops: failed to rewrite task text", err);
			new Notice("TaskLoops: failed to update the note. See console.");
			return false;
		} finally {
			this.writing.delete(task.path);
		}

		if (!written) {
			new Notice("TaskLoops: couldn't find that line — it may have been edited.");
			return false;
		}

		const nextId = taskId(task.path, text, item.occ);
		if (nextId !== item.id) {
			delete this.items[item.id];
			item.id = nextId;
			this.items[nextId] = item;
		}
		item.text = text;

		await this.saveData_();
		const file = this.app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) await this.refreshFile(file);
		this.refreshViews();
		return true;
	}

	/** Set or clear a next action's context. */
	async setContext(task: JoinedTask, context: string | null): Promise<void> {
		const item = this.persist(task);
		item.context = context ?? undefined;
		if (context && item.bucket !== "next") {
			item.bucket = "next";
			item.sortedAt = Date.now();
		}
		await this.saveData_();
		await this.syncMarker(task, item.bucket !== "inbox");
		this.refreshViews();
	}

	/** Record a manual ordering for a list the user has just rearranged. */
	async reorder(tasks: JoinedTask[]): Promise<void> {
		tasks.forEach((task, index) => {
			this.persist(task).order = index;
		});
		await this.saveData_();
		this.refreshViews();
	}

	/** Set who a delegated task is waiting on. */
	async setWaitingFor(task: JoinedTask, who: string): Promise<void> {
		const item = this.persist(task);
		item.waitingFor = who;
		if (item.bucket !== "waiting") {
			item.bucket = "waiting";
			item.sortedAt = Date.now();
		}
		await this.saveData_();
		await this.syncMarker(task, true);
		this.refreshViews();
	}

	/**
	 * Quick capture: append a new tagged line to the capture note.
	 *
	 * This is the only note the plugin ever adds content to, it only ever
	 * appends, and it never touches a line that is already there. The note is
	 * created on first use.
	 */
	async captureTask(
		text: string,
		projectUid?: string | null,
		bucket: Bucket = "inbox"
	): Promise<boolean> {
		const body = text.trim();
		if (!body) return false;

		const path = normalizePath(this.settings.captureNote);
		const line = `- ${body} ${this.settings.tag}`;

		let file = this.app.vault.getAbstractFileByPath(path);
		try {
			if (!file) {
				const dir = path.split("/").slice(0, -1).join("/");
				if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
					await this.app.vault.createFolder(dir);
				}
				file = await this.app.vault.create(path, line + "\n");
			} else if (file instanceof TFile) {
				await this.app.vault.process(file, (data) => {
					const gap = data.length === 0 || data.endsWith("\n") ? "" : "\n";
					return data + gap + line + "\n";
				});
			}
		} catch (err) {
			console.error("TaskLoops: capture failed", err);
			new Notice("TaskLoops: couldn't write to " + path);
			return false;
		}

		if (!(file instanceof TFile)) return false;

		const task = await this.awaitTask(file, line);
		if (!task) {
			// The line is on disk; only the immediate project link is lost.
			await this.rescan();
			return true;
		}

		const item: TaskLoopsItem = {
			id: task.id,
			uid: newUid(),
			bucket,
			path: task.path,
			text: task.text,
			occ: (this.tasks.get(file.path) ?? []).indexOf(task),
		};
		if (projectUid !== undefined) item.projectUid = projectUid;
		if (bucket !== "inbox") item.sortedAt = Date.now();
		this.items[task.id] = item;

		await this.saveData_();
		// Anything captured already-clarified gets the marker like any other
		// sorted line; a plain inbox capture stays unmarked.
		if (bucket !== "inbox") {
			await this.syncMarker({ ...task, handled: false }, true);
		}
		this.refreshViews();
		return true;
	}

	/**
	 * Wait for the metadata cache to catch up with a line we just wrote, so the
	 * new task can be linked immediately rather than on the next scan.
	 */
	private async awaitTask(
		file: TFile,
		raw: string
	): Promise<ScannedTask | null> {
		for (let attempt = 0; attempt < 20; attempt++) {
			const found = await scanFile(this.app, file, this.settings.tag);
			const hits = found.filter((t) => t.raw === raw);
			if (hits.length) {
				this.tasks.set(file.path, found);
				return hits[hits.length - 1];
			}
			await new Promise((r) => window.setTimeout(r, 50));
		}
		return null;
	}

	/**
	 * The only write this plugin makes to an existing line: append or remove
	 * the handled marker at the end of the task's own line.
	 */
	private async syncMarker(task: ScannedTask, on: boolean): Promise<void> {
		if (!this.settings.markHandled) return;
		if (task.handled === on) return;

		this.writing.add(task.path);
		try {
			const ok = await setHandledMarker(
				this.app,
				task,
				this.settings.handledMarker,
				on
			);
			if (!ok) {
				new Notice("TaskLoops: couldn't find that line — it may have been edited.");
			}
		} catch (err) {
			console.error("TaskLoops: failed to write handled marker", err);
			new Notice("TaskLoops: failed to update the note. See console.");
		} finally {
			this.writing.delete(task.path);
		}

		const file = this.app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) await this.refreshFile(file);
	}

	async reveal(task: ScannedTask): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			new Notice("TaskLoops: source note is gone.");
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, {
			eState: { line: task.line },
			active: true,
		});
	}

	sourceLabel(task: ScannedTask): string {
		const parts = task.path.replace(/\.md$/, "").split("/");
		const name = parts.pop() ?? task.path;
		if (this.settings.showFolder && parts.length) {
			return parts[parts.length - 1] + "/" + name;
		}
		return name;
	}

	// ------------------------------------------------------------------- view

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TASKLOOPS)) {
			const view = leaf.view;
			if (view instanceof TaskLoopsView) view.render();
		}
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_TASKLOOPS);

		let leaf: WorkspaceLeaf | null;
		if (existing.length > 0) {
			leaf = existing[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_TASKLOOPS, active: true });
		}
		if (leaf) await workspace.revealLeaf(leaf);
	}

	openSettings(): void {
		const { setting } = this.app as App & { setting?: SettingsOpener };
		setting?.open();
		setting?.openTabById(this.manifest.id);
	}
}

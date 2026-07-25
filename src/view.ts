import { ItemView, Menu, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type TaskLoopsPlugin from "./main";
import { BUCKETS, Bucket, JoinedTask } from "./types";
import {
	DateModal,
	FolderPicker,
	ProjectPicker,
	TaskPicker,
	TextPromptModal,
} from "./modals";
import { DUE_GROUP_ORDER, daysUntil, dueGroup, formatDue } from "./dates";
import { truncate } from "./text";
import { Wizard, WizardHost, renderWizard } from "./wizard";

export const VIEW_TYPE_TASKLOOPS = "taskloops-view";

export class TaskLoopsView extends ItemView implements WizardHost {
	plugin: TaskLoopsPlugin;
	private active: Bucket | "done";
	private wizards = new Map<string, Wizard>();
	private expanded = new Set<string>();
	private query = "";
	/** When set, the capture row is open; a uid scopes it to that project. */
	private capturing: { for: string | null; fresh: boolean } | null = null;
	private dragging: string | null = null;
	/** uid -> project text, rebuilt each render for chip labels. */
	private projectNames = new Map<string, string>();

	constructor(leaf: WorkspaceLeaf, plugin: TaskLoopsPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.active = plugin.settings.lastBucket ?? "inbox";
	}

	getViewType(): string {
		return VIEW_TYPE_TASKLOOPS;
	}

	getDisplayText(): string {
		return "TaskLoops";
	}

	getIcon(): string {
		return "inbox";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("tl-view");
		this.render();
	}

	async onClose(): Promise<void> {
		this.wizards.clear();
	}

	/** WizardHost: redraw the panel. */
	rerender(): void {
		this.render();
	}

	/** WizardHost: forget an in-progress clarification. */
	cancelWizard(id: string): void {
		this.wizards.delete(id);
	}

	show(bucket: Bucket | "done"): void {
		this.active = bucket;
		this.plugin.settings.lastBucket = bucket;
		void this.plugin.saveData_();
		this.render();
	}

	// ---------------------------------------------------------------- render

	render(): void {
		const scroll = this.contentEl.querySelector(".tl-list")?.scrollTop ?? 0;
		const focused =
			this.contentEl.querySelector(".tl-capture-input") ===
			document.activeElement;

		this.contentEl.empty();

		const tasks = this.plugin.joined();

		this.projectNames.clear();
		for (const p of this.plugin.projects(tasks)) {
			this.projectNames.set(p.item.uid, p.text);
		}

		this.renderHeader(this.contentEl, tasks);
		this.renderTabs(this.contentEl, tasks);
		this.renderSearch(this.contentEl);
		if (this.capturing && this.capturing.for === null) {
			this.renderCapture(this.contentEl, null, focused);
		}

		const list = this.contentEl.createDiv("tl-list");
		this.renderList(list, tasks);
		list.scrollTop = scroll;
	}

	private renderHeader(root: HTMLElement, tasks: JoinedTask[]): void {
		const head = root.createDiv("tl-header");
		const title = head.createDiv("tl-header-title");
		title.createSpan({ text: "TaskLoops" });

		const inbox = tasks.filter((t) => t.item.bucket === "inbox").length;
		if (inbox > 0) {
			title.createSpan({ cls: "tl-header-badge", text: String(inbox) });
		}

		const actions = head.createDiv("tl-header-actions");

		const add = actions.createEl("button", {
			cls: "tl-icon-btn is-primary",
			attr: { "aria-label": "Capture a task" },
		});
		setIcon(add, "plus");
		add.onclick = () => {
			this.capturing =
				this.capturing?.for === null ? null : { for: null, fresh: true };
			if (this.capturing) this.show("inbox");
			else this.render();
		};

		const refresh = actions.createEl("button", {
			cls: "tl-icon-btn",
			attr: { "aria-label": "Rescan vault" },
		});
		setIcon(refresh, "refresh-cw");
		refresh.onclick = async () => {
			refresh.addClass("is-spinning");
			await this.plugin.rescan();
			refresh.removeClass("is-spinning");
		};

		const settings = actions.createEl("button", {
			cls: "tl-icon-btn",
			attr: { "aria-label": "Settings" },
		});
		setIcon(settings, "settings");
		settings.onclick = () => this.plugin.openSettings();
	}

	/**
	 * The capture row stays open after each entry — capture is bursty, and
	 * reopening it between two thoughts is exactly the friction GTD warns about.
	 */
	private renderCapture(
		root: HTMLElement,
		projectUid: string | null,
		autofocus: boolean
	): void {
		const wrap = root.createDiv("tl-capture");
		const top = wrap.createDiv("tl-capture-row");
		const input = top.createEl("input", {
			cls: "tl-capture-input",
			attr: {
				placeholder: projectUid
					? "New action for this project…"
					: "What's on your mind?",
				spellcheck: "false",
			},
		});

		const write = async (text: string) => {
			// Typing an action under a project is itself the clarifying act, so
			// it is filed as a next action rather than landing back in the inbox.
			const ok = await this.plugin.captureTask(
				text,
				projectUid,
				projectUid ? "next" : "inbox"
			);
			if (ok) new Notice("Captured to " + this.plugin.settings.captureNote);
		};

		const commit = async () => {
			const text = input.value.trim();
			if (!text) return;
			input.value = "";

			// Ask once where captures should live, then never nag again.
			if (!this.plugin.settings.captureFolderChosen) {
				new FolderPicker(this.app, (folder) => {
					void (async () => {
						await this.plugin.setCaptureFolder(folder);
						await write(text);
					})();
				}).open();
				return;
			}
			await write(text);
		};

		input.onkeydown = (e) => {
			if (e.key === "Enter") void commit();
			if (e.key === "Escape") {
				this.capturing = null;
				this.render();
			}
		};

		const done = top.createEl("button", {
			cls: "tl-icon-btn",
			attr: { "aria-label": "Close capture" },
		});
		setIcon(done, "x");
		done.onclick = () => {
			this.capturing = null;
			this.render();
		};

		// The destination is always visible and always one tap from changing.
		const dest = wrap.createEl("button", {
			cls: "tl-capture-dest",
			attr: { "aria-label": "Change capture folder" },
		});
		const pin = dest.createSpan("tl-capture-dest-icon");
		setIcon(pin, "folder");
		dest.createSpan({
			cls: "tl-capture-dest-path",
			text: this.plugin.settings.captureNote,
		});
		dest.onclick = () => {
			new FolderPicker(this.app, (folder) => {
				void this.plugin.setCaptureFolder(folder);
			}).open();
		};

		// Focus on first open, and keep it across the re-render that follows a
		// capture — but never steal it back from wherever you moved on to.
		if (autofocus || this.capturing?.fresh) {
			if (this.capturing) this.capturing.fresh = false;
			window.setTimeout(() => input.focus(), 0);
		}
	}

	private renderTabs(root: HTMLElement, tasks: JoinedTask[]): void {
		const bar = root.createDiv("tl-tabs");

		for (const def of BUCKETS) {
			const count =
				def.id === "done"
					? tasks.filter((t) => t.item.done).length
					: tasks.filter(
							(t) => t.item.bucket === def.id && !t.item.done
					  ).length;

			// Keep the rail short: empty side-buckets stay hidden until used.
			const optional =
				def.id === "reference" || def.id === "trash" || def.id === "done";
			if (optional && count === 0 && this.active !== def.id && !this.dragging) {
				continue;
			}

			const tab = bar.createEl("button", {
				cls: "tl-tab" + (this.active === def.id ? " is-active" : ""),
				attr: { "aria-label": def.label },
			});
			const icon = tab.createSpan("tl-tab-icon");
			setIcon(icon, def.icon);
			tab.createSpan({ cls: "tl-tab-label", text: def.label });
			if (count > 0) {
				tab.createSpan({ cls: "tl-tab-count", text: String(count) });
			}

			// A stalled project is the one thing worth interrupting the rail for.
			if (def.id === "project") {
				const stalled = this.plugin
					.projects(tasks)
					.filter((p) =>
						this.plugin.isStalled(this.plugin.actionsOf(tasks, p.item.uid))
					).length;
				if (stalled > 0) tab.addClass("has-alert");
			}

			tab.onclick = () => this.show(def.id);
			this.makeDropTarget(tab, (task) => this.dropOnBucket(task, def.id));
		}
	}

	private renderSearch(root: HTMLElement): void {
		const wrap = root.createDiv("tl-search");
		const input = wrap.createEl("input", {
			type: "search",
			attr: { placeholder: "Filter…", spellcheck: "false" },
		});
		input.value = this.query;
		input.oninput = () => {
			this.query = input.value;
			const list = this.contentEl.querySelector(".tl-list") as HTMLElement;
			if (list) {
				list.empty();
				this.renderList(list, this.plugin.joined());
			}
		};
	}

	// ----------------------------------------------------------- drag & drop

	private makeDraggable(el: HTMLElement, task: JoinedTask): void {
		el.setAttr("draggable", "true");
		el.addEventListener("dragstart", (e) => {
			this.dragging = task.id;
			e.dataTransfer?.setData("text/plain", task.id);
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
			el.addClass("is-dragging");
			this.contentEl.addClass("is-dragging-task");
			// Reveal the buckets that stay hidden when empty.
			window.setTimeout(() => this.renderTabsOnly(), 0);
		});
		el.addEventListener("dragend", () => {
			this.dragging = null;
			el.removeClass("is-dragging");
			this.contentEl.removeClass("is-dragging-task");
			this.render();
		});
	}

	/** Re-render just the tab rail mid-drag, without disturbing the drag source. */
	private renderTabsOnly(): void {
		const bar = this.contentEl.querySelector(".tl-tabs");
		if (!bar) return;
		const fresh = this.contentEl.createDiv();
		this.renderTabs(fresh, this.plugin.joined());
		const rebuilt = fresh.firstElementChild;
		if (rebuilt) bar.replaceWith(rebuilt);
		fresh.remove();
	}

	private makeDropTarget(
		el: HTMLElement,
		onDrop: (task: JoinedTask) => void
	): void {
		el.addEventListener("dragover", (e) => {
			if (!this.dragging) return;
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			el.addClass("is-drop-target");
		});
		el.addEventListener("dragleave", () => el.removeClass("is-drop-target"));
		el.addEventListener("drop", (e) => {
			e.preventDefault();
			e.stopPropagation();
			el.removeClass("is-drop-target");
			const id = e.dataTransfer?.getData("text/plain") || this.dragging;
			this.dragging = null;
			if (!id) return;
			const task = this.plugin.joined().find((t) => t.id === id);
			if (task) onDrop(task);
		});
	}

	/** Dropping onto a bucket files the task, asking only for what it must. */
	private dropOnBucket(task: JoinedTask, bucket: Bucket | "done"): void {
		if (bucket === "done") {
			if (!task.item.done) void this.plugin.toggleDone(task);
			return;
		}
		if (bucket === task.item.bucket && !task.item.done) return;

		if (bucket === "scheduled") {
			new DateModal(this.app, {
				initial: task.item.due,
				onPick: (iso) => {
					if (iso) void this.plugin.file(task, { bucket, due: iso });
				},
			}).open();
			return;
		}

		if (bucket === "waiting") {
			new TextPromptModal(this.app, {
				title: "Waiting on whom?",
				placeholder: "Name",
				initial: task.item.waitingFor,
				cta: "File it",
				onSubmit: (who) =>
					void this.plugin.file(task, { bucket, waitingFor: who }),
			}).open();
			return;
		}

		void this.plugin.file(task, { bucket });
	}

	// -------------------------------------------------------------- listing

	private matches(task: JoinedTask, q: string): boolean {
		if (!q) return true;
		return (
			task.text.toLowerCase().includes(q) ||
			task.path.toLowerCase().includes(q) ||
			(task.item.context ?? "").toLowerCase().includes(q) ||
			(task.item.waitingFor ?? "").toLowerCase().includes(q)
		);
	}

	private renderEmpty(list: HTMLElement, icon: string, text: string): void {
		const empty = list.createDiv("tl-empty");
		const el = empty.createDiv("tl-empty-icon");
		setIcon(el, icon);
		empty.createDiv({ cls: "tl-empty-text", text });
		if (this.active === "inbox" && !this.query) {
			empty.createDiv({
				cls: "tl-empty-hint",
				text: `Write ${this.plugin.settings.tag} anywhere in a note, or press + above.`,
			});
		}
	}

	private renderList(list: HTMLElement, all: JoinedTask[]): void {
		const def = BUCKETS.find((b) => b.id === this.active)!;
		const q = this.query.trim().toLowerCase();

		if (this.active === "project") {
			this.renderProjects(list, all, q);
			return;
		}

		let tasks =
			this.active === "done"
				? all.filter((t) => t.item.done)
				: all.filter((t) => t.item.bucket === this.active && !t.item.done);

		tasks = tasks.filter((t) => this.matches(t, q));

		if (tasks.length === 0) {
			this.renderEmpty(
				list,
				def.icon,
				q ? "Nothing matches that filter." : def.empty
			);
			return;
		}

		for (const [heading, group] of this.groupTasks(tasks)) {
			if (heading) list.createDiv({ cls: "tl-group", text: heading });
			for (const task of group) this.renderCard(list, task);
		}
	}

	/** Returns [heading, tasks][]; a null heading means "no grouping". */
	private groupTasks(tasks: JoinedTask[]): Array<[string | null, JoinedTask[]]> {
		const by = (key: (t: JoinedTask) => string, order?: string[]) => {
			const map = new Map<string, JoinedTask[]>();
			for (const t of tasks) {
				const k = key(t);
				if (!map.has(k)) map.set(k, []);
				map.get(k)!.push(t);
			}
			const keys = Array.from(map.keys()).sort((a, b) => {
				if (order) {
					const ia = order.indexOf(a);
					const ib = order.indexOf(b);
					if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
				}
				return a.localeCompare(b);
			});
			return keys.map((k) => [k, map.get(k)!] as [string, JoinedTask[]]);
		};

		if (this.active === "next") return by((t) => t.item.context || "No context");
		if (this.active === "waiting") {
			return by((t) => t.item.waitingFor || "Unassigned");
		}
		if (this.active === "scheduled") {
			return by((t) => dueGroup(t.item.due), DUE_GROUP_ORDER);
		}
		return [[null, tasks]];
	}

	// ---------------------------------------------------------------- projects

	/**
	 * The projects list stays a list of outcomes. Actions live one level down
	 * and only when you ask to see them; what is always visible is whether a
	 * project still has something open against it.
	 */
	private renderProjects(list: HTMLElement, all: JoinedTask[], q: string): void {
		const projects = this.plugin
			.projects(all)
			.filter((p) => this.matches(p, q));

		if (projects.length === 0) {
			this.renderEmpty(
				list,
				"layers",
				q
					? "Nothing matches that filter."
					: BUCKETS.find((b) => b.id === "project")!.empty
			);
			return;
		}

		const stalled = projects.filter((p) =>
			this.plugin.isStalled(this.plugin.actionsOf(all, p.item.uid))
		);

		if (stalled.length > 0) {
			list.createDiv({
				cls: "tl-group is-alert",
				text: `${stalled.length} waiting on a next action`,
			});
		}

		const ordered = [
			...stalled,
			...projects.filter((p) => !stalled.includes(p)),
		];

		for (const project of ordered) {
			const actions = this.plugin.actionsOf(all, project.item.uid);
			this.renderProjectCard(list, project, actions, all);
		}
	}

	private renderProjectCard(
		list: HTMLElement,
		project: JoinedTask,
		actions: JoinedTask[],
		all: JoinedTask[]
	): void {
		const open = actions.filter((a) => !a.item.done);
		const isStalled = this.plugin.isStalled(actions);
		const uid = project.item.uid;
		const isOpen = this.expanded.has(uid);

		const card = list.createDiv(
			"tl-card tl-project" + (isStalled ? " is-stalled" : "")
		);
		const row = card.createDiv("tl-card-row");

		// Dropping a task onto a project files it under that project.
		this.makeDropTarget(card, (task) => {
			if (task.item.uid === uid) return;
			void this.plugin.linkToProject(task, uid);
			this.expanded.add(uid);
		});
		this.makeDraggable(card, project);

		const chevron = row.createEl("button", {
			cls: "tl-chevron",
			attr: { "aria-label": isOpen ? "Collapse" : "Expand" },
		});
		setIcon(chevron, isOpen ? "chevron-down" : "chevron-right");
		chevron.onclick = (e) => {
			e.stopPropagation();
			if (isOpen) this.expanded.delete(uid);
			else this.expanded.add(uid);
			this.render();
		};

		const body = row.createDiv("tl-card-body");
		body.createDiv({ cls: "tl-card-text", text: project.text });

		const meta = body.createDiv("tl-card-meta");
		const src = meta.createSpan({
			cls: "tl-source",
			text: this.plugin.sourceLabel(project),
		});
		src.onclick = (e) => {
			e.stopPropagation();
			void this.plugin.reveal(project);
		};

		if (isStalled) {
			meta.createSpan({ cls: "tl-chip is-warn", text: "no next action" });
		} else {
			meta.createSpan({
				cls: "tl-chip",
				text: open.length === 1 ? "1 action" : `${open.length} actions`,
			});
		}

		const tools = row.createDiv("tl-card-tools");
		const more = tools.createEl("button", {
			cls: "tl-icon-btn",
			attr: { "aria-label": "More" },
		});
		setIcon(more, "more-horizontal");
		more.onclick = (e) => {
			e.stopPropagation();
			this.showMenu(e, project);
		};

		if (!isOpen) return;

		const children = card.createDiv("tl-project-children");
		for (const action of actions) {
			this.renderCard(children, action, { nested: true });
		}

		if (this.capturing && this.capturing.for === uid) {
			this.renderCapture(children, uid, true);
		}

		const add = children.createDiv("tl-add-row");

		const create = add.createEl("button", {
			cls: "tl-link",
			text: "+ New action",
		});
		create.onclick = (e) => {
			e.stopPropagation();
			this.capturing =
				this.capturing?.for === uid ? null : { for: uid, fresh: true };
			this.expanded.add(uid);
			this.render();
		};

		const link = add.createEl("button", {
			cls: "tl-link",
			text: "Link existing…",
		});
		link.onclick = (e) => {
			e.stopPropagation();
			const candidates = this.plugin.unattached(all);
			if (candidates.length === 0) {
				new Notice("Every open task is already filed under a project.");
				return;
			}
			new TaskPicker(this.app, candidates, (task) => {
				void this.plugin.linkToProject(task, uid);
			}).open();
		};
	}

	// ------------------------------------------------------------------ card

	private renderCard(
		list: HTMLElement,
		task: JoinedTask,
		opts: { nested?: boolean } = {}
	): void {
		const wizard = this.wizards.get(task.id);
		const card = list.createDiv(
			"tl-card" +
				(wizard ? " is-clarifying" : "") +
				(task.item.done ? " is-done" : "") +
				(opts.nested ? " is-nested" : "")
		);

		if (!wizard) this.makeDraggable(card, task);

		const row = card.createDiv("tl-card-row");
		const showCheck = opts.nested || this.active !== "inbox";

		if (showCheck) {
			const box = row.createEl("input", {
				type: "checkbox",
				cls: "tl-check",
			});
			box.checked = !!task.item.done;
			box.onclick = (e) => {
				e.stopPropagation();
				void this.plugin.toggleDone(task);
			};
		}

		const body = row.createDiv("tl-card-body");
		body.createDiv({ cls: "tl-card-text", text: task.text });

		const meta = body.createDiv("tl-card-meta");
		const src = meta.createSpan({
			cls: "tl-source",
			text: this.plugin.sourceLabel(task),
		});
		src.onclick = (e) => {
			e.stopPropagation();
			void this.plugin.reveal(task);
		};

		if (opts.nested) {
			const label = BUCKETS.find((b) => b.id === task.item.bucket)?.label;
			if (label) meta.createSpan({ cls: "tl-chip", text: label });
		}
		if (task.item.context && this.active !== "next") {
			meta.createSpan({ cls: "tl-chip", text: task.item.context });
		}
		if (task.item.waitingFor && this.active !== "waiting") {
			meta.createSpan({ cls: "tl-chip", text: "→ " + task.item.waitingFor });
		}

		// The date chip is the natural place to reach for when rescheduling.
		const d = task.item.due ? daysUntil(task.item.due) : 0;
		const dateChip = meta.createSpan({
			cls: task.item.due
				? "tl-chip is-date" +
				  (d < 0 ? " is-overdue" : d === 0 ? " is-today" : "")
				: "tl-chip is-date is-empty",
			text: task.item.due ? formatDue(task.item.due) : "+ date",
			attr: { "aria-label": "Change date" },
		});
		dateChip.onclick = (e) => {
			e.stopPropagation();
			this.pickDate(task);
		};

		if (!opts.nested && task.projectUid) {
			const name = this.projectNames.get(task.projectUid);
			if (name) {
				meta.createSpan({
					cls: "tl-chip is-project",
					text: truncate(name, 22),
					attr: { "aria-label": name },
				});
			}
		}
		if (!task.handled && task.item.bucket !== "inbox") {
			meta.createSpan({ cls: "tl-chip is-warn", text: "unmarked" });
		}

		const tools = row.createDiv("tl-card-tools");
		const more = tools.createEl("button", {
			cls: "tl-icon-btn",
			attr: { "aria-label": "More" },
		});
		setIcon(more, "more-horizontal");
		more.onclick = (e) => {
			e.stopPropagation();
			this.showMenu(e, task);
		};

		if (this.active === "inbox" && !opts.nested) {
			if (wizard) {
				renderWizard(this, card, task, wizard);
			} else {
				const start = tools.createEl("button", {
					cls: "tl-icon-btn is-primary",
					attr: { "aria-label": "Clarify" },
				});
				setIcon(start, "wand-2");
				start.onclick = (e) => {
					e.stopPropagation();
					this.wizards.set(task.id, {
						step: "actionable",
						history: [],
						draft: {},
					});
					this.render();
				};
			}
		}
	}

	private pickDate(task: JoinedTask): void {
		new DateModal(this.app, {
			title: task.item.due ? "Change date" : "Set a date",
			initial: task.item.due,
			allowClear: !!task.item.due,
			onPick: (iso) => void this.plugin.setDue(task, iso),
		}).open();
	}

	// ------------------------------------------------------------------ menu

	private showMenu(evt: MouseEvent, task: JoinedTask): void {
		const menu = new Menu();

		menu.addItem((i) =>
			i
				.setTitle("Open note")
				.setIcon("file-text")
				.onClick(() => void this.plugin.reveal(task))
		);

		menu.addItem((i) =>
			i
				.setTitle(task.item.due ? "Change date…" : "Set a date…")
				.setIcon("calendar")
				.onClick(() => this.pickDate(task))
		);

		if (task.item.due) {
			menu.addItem((i) =>
				i
					.setTitle("Clear date")
					.setIcon("calendar-x")
					.onClick(() => void this.plugin.setDue(task, null))
			);
		}

		if (task.item.bucket !== "project") {
			menu.addItem((i) =>
				i
					.setTitle("Part of project…")
					.setIcon("layers")
					.onClick(() => {
						const projects = this.plugin.projects(this.plugin.joined());
						if (projects.length === 0) {
							new Notice("No projects yet. File a task as a project first.");
							return;
						}
						new ProjectPicker(this.app, projects, (uid) => {
							void this.plugin.linkToProject(task, uid);
						}).open();
					})
			);
		}

		menu.addSeparator();

		for (const def of BUCKETS) {
			if (def.id === "done") continue;
			const target = def.id;
			if (target === task.item.bucket && !task.item.done) continue;
			menu.addItem((i) =>
				i
					.setTitle(
						target === "inbox" ? "Return to Inbox" : "Move to " + def.label
					)
					.setIcon(def.icon)
					.onClick(() => this.dropOnBucket(task, target))
			);
		}

		menu.addSeparator();
		menu.addItem((i) =>
			i
				.setTitle(task.item.done ? "Mark not done" : "Mark done")
				.setIcon(task.item.done ? "rotate-ccw" : "check")
				.onClick(() => void this.plugin.toggleDone(task))
		);

		menu.showAtMouseEvent(evt);
	}
}

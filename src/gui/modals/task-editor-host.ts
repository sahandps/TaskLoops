import { applyPlannerTheme } from "../components/planner-theme";
import { renderTaskEditor } from "./task-editor";
import { App, ItemView, Platform } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { PlannerTheme, ScannedTask } from "../../core/types";

/**
 * Edit task is a transient draft, so it is not an Obsidian sidebar leaf.
 * Leaves are restored with the workspace and would replace Outline, Backlinks,
 * or the planner itself when TaskLoops already occupies the right sidebar.
 * A wide planner docks this panel on the right. Obsidian mobile and narrow
 * views use the same editor as a full page. Creation, deferral and pickers
 * stay centered modals above it.
 */
export const TASK_EDITOR_DOCK_MIN_WIDTH = 860;

export function taskEditorPresentation(width: number, mobile: boolean): "dock" | "page" {
	if (mobile || width < TASK_EDITOR_DOCK_MIN_WIDTH) return "page";
	return "dock";
}

/** View width when the planner is on screen; otherwise the window width. */
export function taskEditorMeasure(viewWidth: number, windowWidth: number): number {
	return viewWidth > 0 ? viewWidth : windowWidth;
}

const PLANNER_VIEW_TYPE = "taskloops-view";
const sessions = new Set<TaskEditorSession>();
const byMount = new WeakMap<HTMLElement, TaskEditorSession>();
const listened = new WeakSet<Document>();

function editorDocument(app: App): Document {
	return app.workspace.getActiveViewOfType(ItemView)?.containerEl.ownerDocument ?? document;
}

function activePlannerMount(app: App): HTMLElement | undefined {
	const view = app.workspace.getActiveViewOfType(ItemView);
	if (!view || view.getViewType() !== PLANNER_VIEW_TYPE || !view.contentEl.isConnected) return undefined;
	return view.contentEl;
}

function listen(doc: Document): void {
	if (listened.has(doc)) return;
	listened.add(doc);
	doc.addEventListener("keydown", onEscape);
}

function onEscape(event: KeyboardEvent): void {
	if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
	const doc = event.view?.document;
	if (!doc || doc.querySelector(".modal-container, dialog[open]")) return;
	const open = [...sessions].filter((session) => session.isOpen() && session.document === doc);
	const focused = open.find((session) => session.contains(doc.activeElement));
	const target = focused ?? open.at(-1);
	if (!target) return;
	event.preventDefault();
	event.stopPropagation();
	target.closeTop();
}

interface EditorFrame {
	el: HTMLElement;
	taskId: string;
	onUpdated?: () => void;
}

class TaskEditorSession {
	readonly host: HTMLElement;
	readonly document: Document;
	private frames: EditorFrame[] = [];
	private frozen: Element[] = [];
	private observer: ResizeObserver;
	private presentation: "dock" | "page" = "dock";

	constructor(private mount: HTMLElement) {
		this.document = mount.ownerDocument;
		this.host = mount.createDiv({
			cls: "tl-task-editor-host",
			attr: { role: "dialog", "aria-label": "Edit task" },
		});
		this.observer = new ResizeObserver(() => this.sync());
		this.observer.observe(mount.classList.contains("tl-view") ? mount : this.document.documentElement);
		listen(this.document);
		sessions.add(this);
	}

	isOpen(): boolean {
		return this.frames.length > 0;
	}

	contains(node: Node | null): boolean {
		return !!node && this.host.contains(node);
	}

	open(app: App, plugin: TaskActions, task: ScannedTask, onUpdated?: () => void): void {
		sessions.delete(this);
		sessions.add(this);
		if (this.frames.length === 1 && this.frames[0]?.taskId === task.id) return;
		this.clear(true);
		this.mountFrame(app, plugin, task, onUpdated);
	}

	closeTop(): void {
		const frame = this.frames.pop();
		if (!frame) return;
		frame.el.remove();
		const previous = this.frames.at(-1);
		if (previous) {
			previous.el.hidden = false;
			const heading = previous.el.querySelector("h2");
			if (heading?.id) this.host.setAttribute("aria-labelledby", heading.id);
			previous.el.querySelector<HTMLInputElement>(".tl-task-input")?.focus({ preventScroll: true });
		}
		frame.onUpdated?.();
		if (this.frames.length) this.sync();
		else this.destroy();
	}

	sync(theme?: PlannerTheme): void {
		if (!this.frames.length) return;
		if (!this.host.isConnected) this.mount.append(this.host);
		if (theme) {
			applyPlannerTheme(this.host, theme);
			for (const frame of this.frames) applyPlannerTheme(frame.el, theme);
		}
		const inView = this.mount.classList.contains("tl-view");
		const width = taskEditorMeasure(
			inView ? this.mount.clientWidth : 0,
			this.document.documentElement.clientWidth || this.document.defaultView?.innerWidth || 0,
		);
		const presentation = taskEditorPresentation(width, Platform.isMobile);
		const wasDocked = this.mount.classList.contains("tl-editor-docked");
		this.presentation = presentation;
		this.mount.classList.toggle("tl-editor-docked", inView && presentation === "dock");
		this.mount.classList.toggle("tl-editor-page", inView && presentation === "page");
		this.host.classList.toggle("is-page", presentation === "page");
		this.host.classList.toggle("is-window", !inView);
		this.host.dataset.tlEditor = presentation;
		this.host.setAttribute("aria-modal", presentation === "page" ? "true" : "false");
		this.freezePage();
		if (wasDocked !== this.mount.classList.contains("tl-editor-docked"))
			this.document.defaultView?.dispatchEvent(new Event("resize"));
	}

	destroy(): void {
		this.clear(false);
		this.thaw();
		this.observer.disconnect();
		this.host.remove();
		this.mount.classList.remove("tl-editor-docked", "tl-editor-page");
		sessions.delete(this);
		byMount.delete(this.mount);
		if (![...sessions].some((session) => session.document === this.document))
			this.document.defaultView?.dispatchEvent(new Event("resize"));
	}

	private mountFrame(app: App, plugin: TaskActions, task: ScannedTask, onUpdated?: () => void): void {
		if (!this.host.isConnected) this.mount.append(this.host);
		for (const frame of this.frames) frame.el.hidden = true;
		const panel = this.host.createDiv("tl-task-editor-frame");
		const heading = renderTaskEditor(
			panel,
			app,
			plugin,
			task,
			() => this.closeFrame(panel),
			(child, updated) => this.push(app, plugin, child, updated),
		);
		applyPlannerTheme(panel, plugin.settings.theme);
		applyPlannerTheme(this.host, plugin.settings.theme);
		this.host.setAttribute("aria-labelledby", heading.id);
		this.frames.push({ el: panel, taskId: task.id, onUpdated });
		this.sync(plugin.settings.theme);
	}

	private push(app: App, plugin: TaskActions, task: ScannedTask, onUpdated?: () => void): void {
		this.mountFrame(app, plugin, task, onUpdated);
	}

	private closeFrame(panel: HTMLElement): void {
		if (this.frames.at(-1)?.el !== panel) return;
		this.closeTop();
	}

	private clear(notify: boolean): void {
		const frames = this.frames;
		this.frames = [];
		for (const frame of frames) frame.el.remove();
		if (notify) for (const frame of frames) frame.onUpdated?.();
	}

	private freezePage(): void {
		this.thaw();
		if (this.presentation !== "page") return;
		const parent = this.mount.classList.contains("tl-view") ? this.mount : this.document.body;
		for (const child of Array.from(parent.children)) {
			if (
				child === this.host ||
				child.classList.contains("modal-container") ||
				child.tagName === "DIALOG"
			)
				continue;
			child.setAttribute("inert", "");
			this.frozen.push(child);
		}
	}

	private thaw(): void {
		for (const el of this.frozen) el.removeAttribute("inert");
		this.frozen = [];
	}
}

function sessionFor(mount: HTMLElement): TaskEditorSession {
	const existing = byMount.get(mount);
	if (existing) return existing;
	const created = new TaskEditorSession(mount);
	byMount.set(mount, created);
	return created;
}

/** Open the editor, or switch the open panel when another task is chosen. */
export function openTaskEditor(
	app: App,
	plugin: TaskActions,
	task: ScannedTask,
	onUpdated?: () => void,
	mount?: HTMLElement,
): void {
	const doc = mount?.ownerDocument ?? editorDocument(app);
	const target = mount ?? activePlannerMount(app) ?? doc.body;
	if (target !== doc.body) byMount.get(doc.body)?.destroy();
	sessionFor(target).open(app, plugin, task, onUpdated);
}

/** Drop the editor mounted in this view, including across view close. */
export function closeTaskEditor(mount: HTMLElement): void {
	byMount.get(mount)?.destroy();
}

/** Keep the open editor out of a view rebuild without losing its draft. */
export function detachTaskEditor(mount: HTMLElement): HTMLElement | null {
	const host = mount.querySelector(":scope > .tl-task-editor-host");
	host?.remove();
	return host instanceof HTMLElement ? host : null;
}

/** Reapply dock or page layout after the planner renders or the theme changes. */
export function syncTaskEditor(mount: HTMLElement, theme?: PlannerTheme): void {
	const session = byMount.get(mount);
	if (!session?.isOpen()) {
		mount.classList.remove("tl-editor-docked", "tl-editor-page");
		return;
	}
	session.sync(theme);
}

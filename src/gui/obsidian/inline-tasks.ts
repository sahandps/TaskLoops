import { editorInfoField, MarkdownRenderChild, MarkdownView, Notice, setIcon, TFile } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import type TaskLoopsPlugin from "../../main";
import { openTaskEditor } from "../modals/index";
import { locateNoteTask, noteTaskRows } from "../../core/inline-task-data";
import { inScanFolder } from "../../core/note-grid";

async function openTask(
	plugin: TaskLoopsPlugin,
	path: string,
	line: number,
	raw: string,
	save?: () => Promise<void>,
): Promise<void> {
	try {
		await save?.();
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		const content = await plugin.app.vault.read(file);
		const task = locateNoteTask(noteTaskRows(content, path), line, raw);
		if (!task) {
			new Notice("This task changed. Reopen it from the updated note.");
			return;
		}
		await plugin.refreshFile(file);
		openTaskEditor(plugin.app, plugin, task);
	} catch (error) {
		console.error("TaskLoops: could not open inline task", error);
		new Notice("Could not open this task. Save the note and try again.");
	}
}

function button(doc: Document, action: () => void): HTMLButtonElement {
	const control = doc.adoptNode(createEl("button"));
	control.type = "button";
	control.className = "tl-inline-schedule";
	control.setAttribute("aria-label", "Edit task schedule in TaskLoops");
	control.title = "Edit task schedule in TaskLoops";
	setIcon(control, "calendar-plus");
	control.onclick = (event) => {
		event.preventDefault();
		event.stopPropagation();
		action();
	};
	return control;
}

class ScheduleWidget extends WidgetType {
	constructor(
		private plugin: TaskLoopsPlugin,
		private path: string,
		private line: number,
		private raw: string,
	) {
		super();
	}
	eq(other: ScheduleWidget): boolean {
		return this.path === other.path && this.line === other.line && this.raw === other.raw;
	}
	toDOM(view: EditorView): HTMLElement {
		return button(view.dom.ownerDocument, () => {
			const info = view.state.field(editorInfoField, false);
			if (info?.file?.path !== this.path) return;
			const owner =
				info instanceof MarkdownView
					? info
					: this.plugin.app.workspace
							.getLeavesOfType("markdown")
							.map((leaf) => leaf.view)
							.find(
								(candidate): candidate is MarkdownView =>
									candidate instanceof MarkdownView &&
									candidate.file?.path === this.path &&
									candidate.editor === info.editor,
							);
			void openTask(
				this.plugin,
				this.path,
				this.line,
				this.raw,
				owner ? () => owner.save() : undefined,
			);
		});
	}
	ignoreEvent(): boolean {
		return true;
	}
}

export function inlineTaskExtension(
	plugin: TaskLoopsPlugin,
): ViewPlugin<{ decorations: DecorationSet; update: (update: ViewUpdate) => void }> {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}
			update(update: ViewUpdate): void {
				if (update.docChanged || update.viewportChanged || update.transactions.length)
					this.decorations = this.build(update.view);
			}
			build(view: EditorView): DecorationSet {
				const info = view.state.field(editorInfoField, false),
					path = info?.file?.path;
				if (!path || !inScanFolder(path, plugin.settings.scanFolder)) return Decoration.none;
				const rows = noteTaskRows(view.state.doc.toString(), path);
				return Decoration.set(
					rows.flatMap((task) => {
						const line = view.state.doc.line(task.line + 1);
						if (!view.visibleRanges.some((range) => line.to >= range.from && line.to <= range.to))
							return [];
						return [
							Decoration.widget({
								widget: new ScheduleWidget(plugin, path, task.line, task.raw),
								side: 1,
							}).range(line.to),
						];
					}),
					true,
				);
			}
		},
		{ decorations: (value) => value.decorations },
	);
}

export function readingTaskButtons(
	plugin: TaskLoopsPlugin,
	root: HTMLElement,
	context: MarkdownPostProcessorContext,
): void {
	if (!inScanFolder(context.sourcePath, plugin.settings.scanFolder)) return;
	const items = Array.from(root.querySelectorAll<HTMLElement>("li.task-list-item"));
	if (!items.length) return;
	const section = context.getSectionInfo(root);
	if (!section) return;
	const rows = noteTaskRows(section.text, context.sourcePath).filter(
		(task) => task.line >= section.lineStart && task.line <= section.lineEnd,
	);
	// Section offsets are absolute within section.text (the complete document).
	// If an embed or custom renderer changes the count, omit controls rather than
	// attaching an action to the wrong task.
	if (rows.length !== items.length) return;
	const lifecycle = new MarkdownRenderChild(root);
	context.addChild(lifecycle);
	items.forEach((item, index) => {
		if (Array.from(item.children).some((child) => child.classList.contains("tl-inline-schedule"))) return;
		const task = rows[index];
		const control = button(
			item.ownerDocument,
			() => void openTask(plugin, context.sourcePath, task.line, task.raw),
		);
		const nested = Array.from(item.children).find((child) => child.matches("ul, ol"));
		item.insertBefore(control, nested ?? null);
		plugin.inlineControls.add(control);
		lifecycle.register(() => {
			control.remove();
			plugin.inlineControls.delete(control);
		});
	});
}

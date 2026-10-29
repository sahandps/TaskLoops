import { readFile } from "node:fs/promises";
import { createSuite } from "./harness.mjs";

export default async function run(mod) {
	const { eq, results } = createSuite("task editor presentation");
	const min = mod.TASK_EDITOR_DOCK_MIN_WIDTH;
	eq(mod.taskEditorPresentation(min, false), "dock", "wide planner docks the editor");
	eq(mod.taskEditorPresentation(min - 1, false), "page", "narrow planner uses a full page");
	eq(mod.taskEditorPresentation(1600, true), "page", "Obsidian mobile uses a full page");
	eq(mod.taskEditorMeasure(0, 1280), 1280, "hidden view falls back to the window width");
	eq(mod.taskEditorMeasure(1024, 1280), 1024, "visible planner measures its own width");
	const css = await readFile("src/gui/styles.css", "utf8");
	eq(css.includes(".tl-view.tl-view.tl-editor-docked"), true, "dock reserves space beside the planner");
	eq(css.includes(".tl-task-editor-host.is-page"), true, "page mode covers its container");
	eq(css.includes("button.tl-editor-close"), true, "editor has an explicit close control");
	eq(
		/\.tl-task-editor-host[\s\S]*overflow:\s*hidden/.test(css),
		true,
		"editor body can scroll inside a pinned frame",
	);
	return results;
}

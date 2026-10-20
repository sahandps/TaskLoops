import { TaskModal } from "../src/gui/modals/task-create.ts";
import { DEFAULT_SETTINGS } from "../src/core/types.ts";
import { writeSchedule } from "../src/core/schedule.ts";
import { makeTask } from "./sample-data.mjs";
import { showNotePreview } from "./note-preview.mjs";

export function createPreviewActions(app, store, onChange) {
	const persist = () => {
		store.save();
		onChange();
	};
	const actions = {
		settings: { ...DEFAULT_SETTINGS },
		allTasks: () => [...store.tasks].sort((a, b) => a.path.localeCompare(b.path)),
		noteName: (path) => path.split("/").pop().replace(/\.md$/, ""),
		saveSettings: async () => {},
		rescan: async () => onChange(),
		schedule: async (task, schedule) => {
			const index = store.tasks.findIndex((t) => t.id === task.id);
			store.tasks[index] = {
				...store.tasks[index],
				due: undefined,
				time: undefined,
				duration: undefined,
				deadline: undefined,
				...schedule,
				raw: writeSchedule(store.tasks[index].raw, schedule, "YYYY-MM-DD"),
			};
			persist();
		},
		complete: async (task) => {
			const current = store.tasks.find((t) => t.id === task.id);
			current.checked = true;
			current.raw = current.raw.replace(/^(\s*- \[)[^\]](\])/, "$1x$2");
			persist();
			return true;
		},
		reveal: async (task) => actions.openNote(task.path),
		openNote: async (path) => showNotePreview(path, store.tasks),
		newTask: (schedule = {}, path) => new TaskModal(app, actions, schedule, path).open(),
		createTask: async (text, path, schedule) => {
			store.tasks.push(makeTask(text, path, schedule));
			persist();
			return true;
		},
		editTask: async (task, text, path, schedule, drafts, selected) => {
			const index = store.tasks.findIndex((t) => t.id === task.id);
			store.tasks[index] = {
				...store.tasks[index],
				text,
				path,
				due: undefined,
				time: undefined,
				duration: undefined,
				deadline: undefined,
				...schedule,
				raw: writeSchedule(
					(store.tasks[index].checked ? "- [x] " : "- [ ] ") + text,
					schedule,
					"YYYY-MM-DD",
				),
			};
			drafts.forEach((text) =>
				store.tasks.push({ ...makeTask(text, path), parentId: task.id, indent: 2 }),
			);
			selected.forEach((child) =>
				Object.assign(
					store.tasks.find((t) => t.id === child.id),
					{ parentId: task.id, path, indent: 2 },
				),
			);
			persist();
			return true;
		},
	};
	return actions;
}

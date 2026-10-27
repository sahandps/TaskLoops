import { normalizeSettings } from "../src/core/settings.ts";
import { existingSubtaskDestination } from "../src/core/existing-tasks.ts";
import {
	deferBlock,
	resolveDeferral,
	readDeferral,
	validateDeferralReason,
} from "../src/core/task-deferral.ts";
import { todayISO } from "../src/core/dates.ts";
import { TaskModal } from "../src/gui/modals/task-create.ts";
import { DEFAULT_SETTINGS } from "../src/core/types.ts";
import { parseSchedule, writeSchedule } from "../src/core/schedule.ts";
import { nextRepeatSchedule } from "../src/core/repeat.ts";
import { makeTask } from "./sample-data.mjs";
import { showNotePreview } from "./note-preview.mjs";

export function createPreviewActions(app, store, onChange) {
	const persist = () => {
		store.save();
		onChange();
	};
	const updateHistory = (task, due) => {
		const block = resolveDeferral([task.raw, ...(task.continuations ?? [])], due, todayISO());
		task.raw = block[0];
		task.continuations = block.slice(1);
		task.deferral = readDeferral(block);
	};
	const actions = {
		settings: (() => {
			try {
				return normalizeSettings(
					JSON.parse(window.localStorage.getItem("taskloops-preview-settings")),
				);
			} catch {
				return { ...DEFAULT_SETTINGS };
			}
		})(),
		allTasks: () => [...store.tasks].sort((a, b) => a.path.localeCompare(b.path)),
		noteName: (path) => path.split("/").pop().replace(/\.md$/, ""),
		saveSettings: async () => {
			window.localStorage.setItem("taskloops-preview-settings", JSON.stringify(actions.settings));
		},
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
			store.tasks[index].repeat = parseSchedule(store.tasks[index].raw).schedule.repeat;
			updateHistory(store.tasks[index], schedule.due);
			persist();
		},
		complete: async (task) => {
			const current = store.tasks.find((t) => t.id === task.id);
			const next = nextRepeatSchedule(current, todayISO());
			current.checked = true;
			current.raw = current.raw.replace(/^(\s*- \[)[^\]](\])/, "$1x$2");
			if (next) {
				const copy = makeTask(current.text, current.path, next);
				Object.assign(copy, { parentId: current.parentId, indent: current.indent });
				store.tasks.push(copy);
				for (const child of store.tasks.filter((t) => t.parentId === current.id))
					store.tasks.push({
						...makeTask(child.text, child.path, {}),
						parentId: copy.id,
						indent: child.indent,
					});
			}
			persist();
			return true;
		},
		reveal: async (task) => actions.openNote(task.path),
		openNote: async (path) => showNotePreview(path, store.tasks),
		newTask: (schedule = {}, path) => new TaskModal(app, actions, schedule, path).open(),
		deleteTask: async (task) => {
			const current = store.tasks.find((item) => item.id === task.id);
			if (!current) return false;
			store.tasks = store.tasks.filter((item) => item.id !== current.id);
			for (const child of store.tasks)
				if (child.parentId === current.id) child.parentId = current.parentId;
			persist();
			return true;
		},
		deferTask: async (task, reason) => {
			validateDeferralReason(reason);
			const current = store.tasks.find((t) => t.id === task.id);
			if (!current || current.checked) return false;
			const block = deferBlock(
				[writeSchedule(current.raw, {}, "YYYY-MM-DD"), ...(current.continuations ?? [])],
				reason,
			);
			Object.assign(current, {
				due: undefined,
				deadline: undefined,
				time: undefined,
				duration: undefined,
				raw: block[0],
				continuations: block.slice(1),
				deferral: readDeferral(block),
			});
			persist();
			return true;
		},
		createTask: async (text, path, schedule, reason) => {
			const task = makeTask(text, path, schedule);
			if (reason !== undefined) {
				const block = deferBlock([task.raw], reason);
				Object.assign(task, {
					raw: block[0],
					continuations: block.slice(1),
					deferral: readDeferral(block),
				});
			}
			store.tasks.push(task);
			persist();
			return true;
		},
		editTask: async (task, text, path, schedule, drafts, selected, reason) => {
			path = existingSubtaskDestination(
				task.path,
				actions.settings.standaloneNote,
				path,
				selected.map((child) => child.path),
			);
			const moveTree = (id) => {
				const item = store.tasks.find((t) => t.id === id);
				if (item) item.path = path;
				for (const child of store.tasks.filter((t) => t.parentId === id)) moveTree(child.id);
			};
			moveTree(task.id);
			if (reason !== undefined) schedule = { priority: schedule.priority, color: schedule.color };
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
			store.tasks[index].repeat = parseSchedule(store.tasks[index].raw).schedule.repeat;
			updateHistory(store.tasks[index], schedule.due);
			if (reason !== undefined) {
				const current = store.tasks[index];
				const block = deferBlock([current.raw, ...(current.continuations ?? [])], reason);
				Object.assign(current, {
					raw: block[0],
					continuations: block.slice(1),
					deferral: readDeferral(block),
				});
			}
			drafts.forEach((text) =>
				store.tasks.push({ ...makeTask(text, path), parentId: task.id, indent: 2 }),
			);
			selected.forEach((child) => {
				moveTree(child.id);
				Object.assign(
					store.tasks.find((t) => t.id === child.id),
					{ parentId: task.id, path, indent: 2 },
				);
			});
			persist();
			return true;
		},
	};
	return actions;
}

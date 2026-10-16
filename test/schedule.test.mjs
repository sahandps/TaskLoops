import { createSuite } from "./harness.mjs";

export default function run(mod) {
	const { parseSchedule, writeSchedule, formatDuration, validSchedule, formatDate, parseDate, appendTask, daySegment, cleanTaskText, taskId } = mod;
	const { eq, results } = createSuite("scheduling, calendar and note sections");
	const schedule = { due: "2026-10-16", time: "14:00", duration: 65 };
	const full = "- [ ] Buy groceries - Due date: 2026-10-16 Time: 14:00 Duration: 1 Hour 5 Minutes";
	eq(writeSchedule("- [ ] Buy groceries", schedule, "YYYY-MM-DD"), full, "write explicit scheduling fields");
	eq(parseSchedule(full).schedule, schedule, "round trip all fields");
	eq(cleanTaskText(full, "#task"), "Buy groceries", "schedule is not task wording");
	eq(taskId("a.md", cleanTaskText(full, "#task"), 0), taskId("a.md", "Buy groceries", 0), "scheduling preserves task identity");
	for (const format of ["YYYY-MM-DD", "DD/MM/YYYY", "DD.MM.YYYY", "YYYY/MM/DD"]) {
		eq(parseSchedule(writeSchedule("- [ ] Test", schedule, format)).schedule, schedule, "round trip " + format);
		eq(parseDate(formatDate(schedule.due, format)), schedule.due, "date parsing " + format);
	}
	eq(parseSchedule("- [ ] Groceries 2026-10-16").schedule, { due: "2026-10-16" }, "bare ISO suffix supported");
	eq(writeSchedule(full, {}, "YYYY-MM-DD"), "- [ ] Buy groceries", "clear all schedule fields");
	eq(writeSchedule(full, { due: "2027-01-01" }, "YYYY-MM-DD"), "- [ ] Buy groceries - Due date: 2027-01-01", "replace without duplicate fields");
	eq(writeSchedule("\t1. [ ] **Bold task** #tag ^block\r", schedule, "YYYY-MM-DD"), "\t1. [ ] **Bold task** #tag - Due date: 2026-10-16 Time: 14:00 Duration: 1 Hour 5 Minutes ^block\r", "preserve indentation, wording, tags, block ids and CRLF");
	eq(formatDuration(60), "1 Hour", "singular hour");
	eq(formatDuration(125), "2 Hours 5 Minutes", "plural hours");
	eq(formatDuration(1), "1 Minute", "singular minute");
	eq(parseSchedule("- [ ] Call Due date: 2024-02-29").schedule, { due: "2024-02-29" }, "leap day accepted");
	for (const suffix of ["Due date: 2026-02-29", "Due date: 2026-13-01", "Due date: 2026-10-16 Time: 24:00", "Due date: 2026-10-16 Duration: 0 Minutes"]) {
		eq(parseSchedule("- [ ] Preserve " + suffix).suffix, "", "invalid fields are preserved: " + suffix);
	}
	eq(validSchedule({ time: "14:00" }), false, "time requires date");
	eq(validSchedule({ duration: 60 }), false, "duration requires date");
	eq(validSchedule({ due: "2026-10-16", duration: -1 }), false, "negative duration rejected");
	eq(validSchedule({ due: "2026-10-16", duration: 1.5 }), false, "fractional duration rejected");
	eq(validSchedule({}), true, "undated task accepted");
	eq(appendTask("", "- [ ] New"), "# Tasks\n- [ ] New\n", "new standalone note");
	eq(appendTask("---\nproject: test\n---\n\n# Project\nNotes.", "- [ ] New"), "---\nproject: test\n---\n\n# Project\nNotes.\n\n# Tasks\n- [ ] New\n", "properties and existing prose unchanged");
	eq(appendTask("# Project\n## Tasks:\n- [ ] Old\n\n## Notes\nKeep me\n", "- [ ] New"), "# Project\n## Tasks:\n- [ ] Old\n- [ ] New\n\n## Notes\nKeep me\n", "insert before next peer heading");
	eq(appendTask("## Tasks:\n### Subsection\nExisting\n## Other\n", "- [ ] New"), "## Tasks:\n### Subsection\nExisting\n- [ ] New\n## Other\n", "nested headings stay in Tasks section");
	eq(appendTask("```md\n## Tasks:\n```\nActual note\n", "- [ ] New"), "```md\n## Tasks:\n```\nActual note\n\n# Tasks\n- [ ] New\n", "ignore heading in code fence");
	eq(appendTask("## Tasks:\r\n- [ ] Old\r\n\r\n## Other\r\n", "- [ ] New"), "## Tasks:\r\n- [ ] Old\r\n- [ ] New\r\n\r\n## Other\r\n", "preserve CRLF on insertion");
	let rejected = false;
	try { appendTask("## Tasks:\n```\nUnclosed", "- [ ] New"); } catch { rejected = true; }
	eq(rejected, true, "do not append inside unclosed code fence");
	eq(daySegment(schedule, "2026-10-16"), { start: 840, end: 905 }, "65-minute calendar block");
	eq(daySegment(schedule, "2026-10-17"), null, "unrelated day has no block");
	eq(daySegment({ due: "2026-10-16", time: "23:30", duration: 90 }, "2026-10-16"), { start: 1410, end: 1440 }, "clip event at midnight");
	eq(daySegment({ due: "2026-10-16", time: "23:30", duration: 90 }, "2026-10-17"), { start: 0, end: 60 }, "show continuation on next day");
	eq(daySegment({ due: "2026-10-25", time: "23:30", duration: 90 }, "2026-10-26"), { start: 0, end: 60 }, "calendar arithmetic through DST change");
	for (const [minutes, expected] of [[0, "00:00"], [5, "00:05"], [605, "10:05"], [610, "10:10"], [625, "10:25"], [1435, "23:55"]]) {
		eq(mod.timelineDropTime(minutes / 60 * 64 + 0.001), expected, "five-minute drop at " + expected);
	}
	eq(mod.timelineDropTime(607 / 60 * 64), "10:05", "drop snaps within a five-minute interval");
	eq(mod.timelineDropTime(-100), "00:00", "clamp drop before midnight");
	eq(mod.timelineDropTime(2000), "23:55", "last five-minute interval remains reachable");
	return results;
}

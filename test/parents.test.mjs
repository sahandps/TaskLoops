import { createSuite } from "./harness.mjs";

const TAG = "#task";

export default function run(mod) {
	const { assignParents, cleanTaskText, indentOf } = mod;
	const { eq, results } = createSuite("parents");

	/**
	 * Build the ScannedTask list the way scanFile does, run the real parenting
	 * pass, and report each task's parent as readable text.
	 */
	const parents = (md) => {
		const lines = md.split("\n");
		const tasks = [];
		lines.forEach((raw, line) => {
			if (!/#task\b/.test(raw)) return;
			const text = cleanTaskText(raw, TAG);
			if (!text) return;
			tasks.push({ id: "id" + line, line, raw, text, indent: indentOf(raw) });
		});
		assignParents(tasks, lines);
		const byId = new Map(tasks.map((t) => [t.id, t.text]));
		return tasks.map((t) => [t.text, t.parentId ? byId.get(t.parentId) : null]);
	};

	// --- indentOf ------------------------------------------------------------
	eq(indentOf("no indent"), 0, "indent 0");
	eq(indentOf("  two"), 2, "indent 2 spaces");
	eq(indentOf("\tone tab"), 4, "tab counts as four");
	eq(indentOf("\t  mixed"), 6, "tab plus spaces");

	// --- the ordinary outline ------------------------------------------------
	eq(
		parents(`- Redesign onboarding #task
  - Draft the copy #task
  - Get sign-off #task`),
		[
			["Redesign onboarding", null],
			["Draft the copy", "Redesign onboarding"],
			["Get sign-off", "Redesign onboarding"],
		],
		"two children under one parent"
	);

	eq(
		parents(`- Launch site #task
  - Write copy #task
    - Proofread it #task
  - Ship it #task`),
		[
			["Launch site", null],
			["Write copy", "Launch site"],
			["Proofread it", "Write copy"],
			["Ship it", "Launch site"],
		],
		"nesting pops back out correctly"
	);

	eq(
		parents(`- Parent #task
\t- Tab child #task`),
		[
			["Parent", null],
			["Tab child", "Parent"],
		],
		"tab-indented child"
	);

	// --- block boundaries ----------------------------------------------------
	eq(
		parents(`- Parent #task

  - Still a child #task`),
		[
			["Parent", null],
			["Still a child", "Parent"],
		],
		"blank line does not break the block"
	);

	eq(
		parents(`- Parent #task

Some unrelated prose in between.

  - Not a child #task`),
		[
			["Parent", null],
			["Not a child", null],
		],
		"prose at column zero ends the block"
	);

	eq(
		parents(`- Parent #task
## New section
  - Not a child #task`),
		[
			["Parent", null],
			["Not a child", null],
		],
		"heading ends the block"
	);

	eq(
		parents(`- Parent #task
  some indented note
  - Child #task`),
		[
			["Parent", null],
			["Child", "Parent"],
		],
		"indented non-task text keeps the block"
	);

	// --- edges ---------------------------------------------------------------
	eq(
		parents(`- One #task
- Two #task
- Three #task`),
		[
			["One", null],
			["Two", null],
			["Three", null],
		],
		"siblings stay unparented"
	);

	eq(
		parents(`  - Orphan child #task`),
		[["Orphan child", null]],
		"indented task with nothing above it"
	);

	eq(
		parents(`Redesign onboarding #task
  - Draft the copy #task`),
		[
			["Redesign onboarding", null],
			["Draft the copy", "Redesign onboarding"],
		],
		"prose task line parents an indented one"
	);

	return results;
}

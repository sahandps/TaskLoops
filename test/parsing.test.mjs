import { createSuite } from "./harness.mjs";

const TAG = "#task";

export default function run(mod) {
	const { cleanTaskText, hasHandledMarker, stripHandledMarker, taskId } = mod;
	const { eq, results } = createSuite("parsing");

	// --- the shapes a tagged line actually takes -----------------------------
	eq(cleanTaskText("ewfowefj #task", TAG), "ewfowefj", "bare sentence + tag");
	eq(cleanTaskText("#task call the dentist", TAG), "call the dentist", "leading tag");
	eq(cleanTaskText("- call mum #task", TAG), "call mum", "bullet");
	eq(cleanTaskText("* call mum #task", TAG), "call mum", "asterisk bullet");
	eq(cleanTaskText("+ call mum #task", TAG), "call mum", "plus bullet");
	eq(cleanTaskText("1. call mum #task", TAG), "call mum", "ordered list");
	eq(cleanTaskText("1) call mum #task", TAG), "call mum", "ordered paren");
	eq(cleanTaskText("- [ ] call mum #task", TAG), "call mum", "unchecked checkbox");
	eq(cleanTaskText("- [x] call mum #task", TAG), "call mum", "checked checkbox");
	eq(cleanTaskText("    - [ ] indented #task", TAG), "indented", "indented checkbox");
	eq(cleanTaskText("> quoted thing #task", TAG), "quoted thing", "blockquote");
	eq(cleanTaskText(">> nested quote #task", TAG), "nested quote", "nested blockquote");
	eq(cleanTaskText("## heading task #task", TAG), "heading task", "heading");
	eq(cleanTaskText("do the thing #task/work", TAG), "do the thing", "child tag");
	eq(cleanTaskText("do it #task/work/urgent", TAG), "do it", "deep child tag");
	eq(cleanTaskText("mid #task sentence", TAG), "mid sentence", "tag mid-sentence");
	eq(cleanTaskText("finish it #task.", TAG), "finish it.", "tag before period");
	eq(
		cleanTaskText("finish it #task, then rest", TAG),
		"finish it, then rest",
		"tag before comma"
	);
	eq(cleanTaskText("email bob #task ^blk123", TAG), "email bob", "block id");
	eq(cleanTaskText("  spaced   out   #task ", TAG), "spaced out", "whitespace collapse");
	eq(cleanTaskText("#task", TAG), "", "bare tag only is not a task");
	eq(cleanTaskText("- #task", TAG), "", "bullet + bare tag is not a task");

	// Tags that merely start with the same letters are left alone.
	eq(cleanTaskText("a #tasked thing #task", TAG), "a #tasked thing", "sibling tag kept");
	eq(cleanTaskText("see #taskmaster #task", TAG), "see #taskmaster", "longer tag kept");
	eq(cleanTaskText("ship it #task #urgent", TAG), "ship it #urgent", "other tags kept");

	// --- handled marker ------------------------------------------------------
	eq(hasHandledMarker("call mum #task *(Handled)*"), true, "detect marker");
	eq(hasHandledMarker("call mum #task _(Handled)_"), true, "detect underscore marker");
	eq(hasHandledMarker("call mum #task *(handled)*"), true, "case-insensitive");
	eq(hasHandledMarker("call mum #task"), false, "no marker");
	eq(stripHandledMarker("call mum #task *(Handled)*"), "call mum #task", "strip marker");

	// The marker must not change the cleaned text, or the id would move.
	eq(
		cleanTaskText("- [ ] call mum #task *(Handled)*", TAG),
		cleanTaskText("- [ ] call mum #task", TAG),
		"marker does not affect clean text"
	);

	// --- ids -----------------------------------------------------------------
	eq(taskId("a.md", "call mum", 0) === taskId("a.md", "call mum", 0), true, "id is stable");
	eq(taskId("a.md", "call mum", 0) === taskId("b.md", "call mum", 0), false, "id varies by path");
	eq(taskId("a.md", "call mum", 0) === taskId("a.md", "call mum", 1), false, "id varies by occurrence");
	eq(taskId("a.md", "call mum", 0) === taskId("a.md", "Call Mum", 0), true, "id ignores case");

	// Collision sanity over a realistic corpus.
	const ids = new Set();
	const verbs = ["call", "email", "review", "draft", "ship", "read", "buy", "fix"];
	const nouns = ["mum", "bob", "the report", "invoice", "plugin", "book", "milk", "bug"];
	let n = 0;
	for (const v of verbs) {
		for (const noun of nouns) {
			for (let f = 0; f < 40; f++) {
				ids.add(taskId(`notes/file-${f}.md`, `${v} ${noun}`, 0));
				n++;
			}
		}
	}
	eq(ids.size, n, `no id collisions across ${n} tasks`);

	return results;
}

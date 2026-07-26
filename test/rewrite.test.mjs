import { createSuite } from "./harness.mjs";

const TAG = "#task";

export default function run(mod) {
	const { parseTaskLine, rebuildTaskLine, cleanTaskText } = mod;
	const { eq, results } = createSuite("line rewriting");

	const edit = (raw, body) => rebuildTaskLine(parseTaskLine(raw, TAG), body);

	// --- everything structural survives an edit ------------------------------
	eq(edit("Call the dentist #task", "Call the vet"), "Call the vet #task", "plain line");
	eq(edit("- Call the dentist #task", "Call the vet"), "- Call the vet #task", "bullet kept");
	eq(edit("* Call it #task", "Ring it"), "* Ring it #task", "asterisk bullet kept");
	eq(edit("1. Call it #task", "Ring it"), "1. Ring it #task", "ordered marker kept");
	eq(edit("1) Call it #task", "Ring it"), "1) Ring it #task", "ordered paren kept");
	eq(
		edit("- [ ] Renew the insurance #task", "Renew the car insurance"),
		"- [ ] Renew the car insurance #task",
		"unchecked checkbox kept"
	);
	eq(
		edit("- [x] Renew the insurance #task", "Renew the car insurance"),
		"- [x] Renew the car insurance #task",
		"checked checkbox kept"
	);
	eq(
		edit("\t- [ ] Measure desks #task", "Measure the desks"),
		"\t- [ ] Measure the desks #task",
		"tab indent kept"
	);
	eq(
		edit("    - Measure desks #task", "Measure the desks"),
		"    - Measure the desks #task",
		"space indent kept"
	);
	eq(edit("> Read the book #task", "Read Kleppmann"), "> Read the book".replace("Read the book", "Read Kleppmann") + " #task", "blockquote kept");
	eq(edit("## Heading task #task", "Renamed"), "## Renamed #task", "heading kept");

	// --- the tag is preserved exactly as written -----------------------------
	eq(edit("Do it #task/work", "Do it now"), "Do it now #task/work", "child tag kept");
	eq(
		edit("Do it #task/work/urgent", "Do it now"),
		"Do it now #task/work/urgent",
		"deep child tag kept"
	);

	// --- block ids and the handled marker ride along -------------------------
	eq(
		edit("Email Bob #task ^blk123", "Email Bobby"),
		"Email Bobby #task ^blk123",
		"block id kept"
	);
	eq(
		edit("- Call mum #task *(Handled)*", "Call mother"),
		"- Call mother #task *(Handled)*",
		"handled marker kept"
	);
	eq(
		edit("- Call mum #task *(Handled)* ", "Call mother"),
		"- Call mother #task *(Handled)*",
		"trailing space not accumulated"
	);
	eq(
		edit("- [ ] Ship it #task ^id-1 *(Handled)*", "Ship it today"),
		"- [ ] Ship it today #task ^id-1 *(Handled)*",
		"block id and marker together"
	);

	// --- a mid-sentence tag moves to the end, once -------------------------
	const moved = edit("Some prose with #task in the middle", "Rewritten sentence");
	eq(moved, "Rewritten sentence #task", "mid-sentence tag not duplicated");
	eq((moved.match(/#task/g) ?? []).length, 1, "exactly one tag after an edit");

	// --- round trip: an edit to the same text is a no-op --------------------
	for (const raw of [
		"- [ ] Renew the car insurance #task",
		"\t- Give notice on the old lease #task *(Handled)*",
		"> Read the Kleppmann book #task",
		"## A heading task #task",
		"1. Ordered thing #task ^abc",
		"Do the thing #task/work",
	]) {
		const parts = parseTaskLine(raw, TAG);
		eq(rebuildTaskLine(parts, parts.body), raw, `no-op round trip: ${raw.slice(0, 30)}`);
		// parseTaskLine's body must agree with what the panel displays.
		eq(parts.body, cleanTaskText(raw, TAG), `body matches display text: ${raw.slice(0, 30)}`);
	}

	// --- the new text is what the panel will show back ----------------------
	const after = edit("- [ ] Old wording #task *(Handled)*", "New wording");
	eq(cleanTaskText(after, TAG), "New wording", "edited line reads back as the new text");

	// --- whitespace in user input is normalised, not preserved --------------
	eq(edit("- Thing #task", "  spaced   out  "), "- spaced out #task", "input whitespace collapsed");

	return results;
}
